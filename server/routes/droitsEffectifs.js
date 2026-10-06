// Droits effectifs d'un utilisateur sur une société, pour la visionneuse de
// la fiche utilisateur et le simulateur de droits.
//
// Modèle #249 : le profil par défaut du compte (utilisateur.id_profil)
// apporte, pour la société regardée, sa matrice configurée si (profil,
// société) est configuré (Q2/Q3), sinon la matrice par défaut du tenant. Les
// groupes attribués s'ajoutent sans condition de diffusion (#57). Les
// exceptions s'appliquent en dernier, le retrait primant sur l'accord
// (inchangé). profilId reste accepté pour simuler un autre profil (simulateur
// de droits) : il remplace alors utilisateur.id_profil dans le calcul.

import express from "express";
import { tenantPool } from "../db.js";

const router = express.Router();

router.get("/utilisateurs/:id/droits-effectifs", async (req, res) => {
  const { id } = req.params;
  const { societeId, profilId } = req.query;

  if (!societeId) {
    return res.status(400).json({ error: "societeId requis" });
  }

  try {
    const { rows: userCheck } = await tenantPool.query(
      `SELECT id_profil FROM utilisateur WHERE id = $1 AND actif = true
       AND (date_finale IS NULL OR date_finale >= CURRENT_DATE)
       AND (date_mise_en_fonction IS NULL OR date_mise_en_fonction <= CURRENT_DATE)`,
      [id]
    );
    if (!userCheck.length) return res.status(404).json({ error: "Utilisateur introuvable ou inactif" });

    const idProfil = profilId || userCheck[0].id_profil;

    // Matrice du profil pour CETTE société : configurée si marqueur, sinon
    // défaut. Même règle que droitsUtilisateur.js, bornée à une société.
    let profil = null;
    let matriceProfil = [];
    if (idProfil) {
      const { rows: prof } = await tenantPool.query(
        `SELECT p.id, p.code, p.label, p.type,
                (psc.id IS NOT NULL) AS configure
           FROM profil p
           LEFT JOIN profil_societe_configuration psc
                  ON psc.id_profil = p.id AND psc.id_societe = $2
          WHERE p.id = $1 AND p.date_suppression IS NULL`,
        [idProfil, societeId]
      );
      if (prof.length) {
        profil = prof[0];
        const { rows } = profil.configure
          ? await tenantPool.query(
              `SELECT DISTINCT p.id, p.code, p.label, p.module
                 FROM profil_societe_permission psp
                 JOIN permission p ON p.id = psp.id_permission
                WHERE psp.id_profil = $1 AND psp.id_societe = $2`,
              [idProfil, societeId])
          : await tenantPool.query(
              `SELECT DISTINCT p.id, p.code, p.label, p.module
                 FROM profil_permission pp
                 JOIN permission p ON p.id = pp.id_permission
                WHERE pp.id_profil = $1 AND pp.date_suppression IS NULL`,
              [idProfil]);
        matriceProfil = rows;
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
    for (const perm of matriceProfil) {
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
      // profilId conservé pour le simulateur de droits (resolveDroits).
      profilId: idProfil || null,
      profil: profil
        ? { id: profil.id, code: profil.code, label: profil.label, type: profil.type, configure: profil.configure }
        : null,
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
