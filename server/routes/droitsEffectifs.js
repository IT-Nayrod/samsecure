// Droits effectifs d'un utilisateur sur une société, pour la visionneuse de
// la fiche utilisateur et le simulateur de droits.
//
// Modèle #249 corrigé multi-profils (06/10/2026, stories #73/#190) : les
// profils par défaut du compte sont l'ensemble de ses attributions non-groupe
// actives (utilisateur_profil_societe, id_societe ignoré, #57) ;
// utilisateur.id_profil n'est plus lu. Chaque profil apporte, pour la société
// regardée, sa matrice configurée si (profil, société) est configuré (Q2/Q3),
// sinon la matrice par défaut du tenant ; l'union des profils fait foi, un
// profil configuré ne masquant jamais ce qu'un autre apporte. Les groupes
// attribués s'ajoutent sans condition de diffusion (#57). Les exceptions
// s'appliquent en dernier, le retrait primant sur l'accord (inchangé).
// profilId reste accepté pour regarder ou simuler UN profil (visionneuse par
// profil, simulateur de droits) : il remplace alors l'ensemble dans le calcul.

import express from "express";
import { tenantPool } from "../db.js";
import { profilsParDefaut } from "../utils/droitsUtilisateur.js";

const router = express.Router();

router.get("/utilisateurs/:id/droits-effectifs", async (req, res) => {
  const { id } = req.params;
  const { societeId, profilId } = req.query;

  if (!societeId) {
    return res.status(400).json({ error: "societeId requis" });
  }

  try {
    const { rows: userCheck } = await tenantPool.query(
      `SELECT 1 FROM utilisateur WHERE id = $1 AND actif = true
       AND (date_finale IS NULL OR date_finale >= CURRENT_DATE)
       AND (date_mise_en_fonction IS NULL OR date_mise_en_fonction <= CURRENT_DATE)`,
      [id]
    );
    if (!userCheck.length) return res.status(404).json({ error: "Utilisateur introuvable ou inactif" });

    const profilsReels = await profilsParDefaut(id);

    // Profils dont la matrice est regardée : celui demandé (vue par profil ou
    // simulation d'un autre profil), sinon l'ensemble des profils du compte.
    let vises = profilsReels;
    if (profilId) {
      const { rows: prof } = await tenantPool.query(
        `SELECT id, code, label, type FROM profil
          WHERE id = $1 AND date_suppression IS NULL`,
        [profilId]
      );
      vises = prof;
    }

    // Matrice de chaque profil visé pour CETTE société : configurée si
    // marqueur, sinon défaut. Même règle que droitsUtilisateur.js, bornée à
    // une société ; la première source rencontrée fait foi dans l'union.
    const profils = [];
    const matriceProfils = new Map();
    for (const vise of vises) {
      const { rows: conf } = await tenantPool.query(
        `SELECT 1 FROM profil_societe_configuration
          WHERE id_profil = $1 AND id_societe = $2`,
        [vise.id, societeId]
      );
      const configure = conf.length > 0;
      const { rows } = configure
        ? await tenantPool.query(
            `SELECT DISTINCT p.id, p.code, p.label, p.module
               FROM profil_societe_permission psp
               JOIN permission p ON p.id = psp.id_permission
              WHERE psp.id_profil = $1 AND psp.id_societe = $2`,
            [vise.id, societeId])
        : await tenantPool.query(
            `SELECT DISTINCT p.id, p.code, p.label, p.module
               FROM profil_permission pp
               JOIN permission p ON p.id = pp.id_permission
              WHERE pp.id_profil = $1 AND pp.date_suppression IS NULL`,
            [vise.id]);
      profils.push({ id: vise.id, code: vise.code, label: vise.label, type: vise.type, configure });
      for (const perm of rows) {
        if (!matriceProfils.has(perm.id)) matriceProfils.set(perm.id, perm);
      }
    }

    // Groupes attribués (#57) : l'attribution suffit, la portée suit le
    // rattachement, id_societe n'est plus lu.
    const { rows: matriceGroupes } = await tenantPool.query(
      `SELECT DISTINCT perm.id, perm.code, perm.label, perm.module
         FROM utilisateur_profil_societe ups
         JOIN profil g ON g.id = ups.id_profil
                      AND g.type = 'groupe' AND g.date_suppression IS NULL
         JOIN profil_permission pp ON pp.id_profil = g.id AND pp.date_suppression IS NULL
         JOIN permission perm ON perm.id = pp.id_permission
        WHERE ups.id_utilisateur = $1 AND ups.date_suppression IS NULL`,
      [id]
    );

    const { rows: exceptions } = await tenantPool.query(
      `SELECT id, id_utilisateur AS idutilisateur, id_permission AS idpermission,
              id_societe AS idsociete, type, motif, date_debut AS datedebut, date_fin AS datefin
       FROM exception_droit
       WHERE id_utilisateur = $1 AND date_suppression IS NULL
         AND (id_societe IS NULL OR id_societe = $2)`,
      [id, societeId]
    );

    const map = new Map();
    for (const perm of matriceProfils.values()) {
      map.set(perm.id, { permission: perm, source: "profil", effectif: true, exception: null, redondante: false });
    }
    for (const perm of matriceGroupes) {
      if (map.has(perm.id)) continue;
      map.set(perm.id, { permission: perm, source: "groupe", effectif: true, exception: null, redondante: false });
    }
    // Le retrait est toujours prioritaire sur un accord pour une même permission :
    // on traite systématiquement tous les "accorde" avant tous les "retire", quel
    // que soit l'ordre de retour SQL, pour que le retrait écrase inconditionnellement.
    for (const exc of exceptions.filter((e) => e.type === "accorde")) {
      const entry = map.get(exc.idpermission);
      if (entry) {
        map.set(exc.idpermission, { ...entry, exception: exc, redondante: true });
      } else {
        map.set(exc.idpermission, {
          permission: await loadPermission(exc.idpermission),
          source: "exceptionaccorde", effectif: true, exception: exc, redondante: false,
        });
      }
    }
    for (const exc of exceptions.filter((e) => e.type === "retire")) {
      const entry = map.get(exc.idpermission);
      map.set(exc.idpermission, {
        permission: entry?.permission || await loadPermission(exc.idpermission),
        source: "exceptionretire", effectif: false, exception: exc, redondante: false,
      });
    }

    res.json({
      // profilId et profilIds : contrat historique du simulateur de droits
      // (resolveDroits), restauré multi-profils par le correctif du 06/10.
      profilId: profilId || profilsReels[0]?.id || null,
      profilIds: profilsReels.map((p) => p.id),
      // Les profils regardés, chacun avec son état de configuration pour la
      // société (visionneuse par profil).
      profils,
      droits: Array.from(map.values()),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

async function loadPermission(idPermission) {
  const { rows } = await tenantPool.query(
    "SELECT id, code, label, module FROM permission WHERE id = $1",
    [idPermission]
  );
  return rows[0];
}

export default router;
