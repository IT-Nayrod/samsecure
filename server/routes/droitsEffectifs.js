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
      `SELECT 1 FROM utilisateur WHERE id = $1 AND actif = true
       AND (date_finale IS NULL OR date_finale >= CURRENT_DATE)
       AND (date_mise_en_fonction IS NULL OR date_mise_en_fonction <= CURRENT_DATE)`,
      [id]
    );
    if (!userCheck.length) return res.status(404).json({ error: "Utilisateur introuvable ou inactif" });

    const profRes = await tenantPool.query(
      `SELECT id_profil AS idprofil
       FROM utilisateur_profil_societe
       WHERE id_utilisateur = $1 AND date_suppression IS NULL
         AND (id_societe = $2 OR id_societe IS NULL)`,
      [id, societeId]
    );
    const profilIdsReels = profRes.rows.map(r => r.idprofil);
    const profilIds = profilId ? [profilId] : profilIdsReels;

    let heritees = [];
    if (profilIds.length > 0) {
      const herRes = await tenantPool.query(
        `SELECT DISTINCT p.id, p.code, p.label, p.module
         FROM profil_permission pp
         JOIN permission p ON p.id = pp.id_permission
         WHERE pp.id_profil = ANY($1) AND pp.date_suppression IS NULL`,
        [profilIds]
      );
      heritees = herRes.rows;
    }

    const excRes = await tenantPool.query(
      `SELECT id, id_utilisateur AS idutilisateur, id_permission AS idpermission,
              id_societe AS idsociete, type, motif, date_debut AS datedebut, date_fin AS datefin
       FROM exception_droit
       WHERE id_utilisateur = $1 AND date_suppression IS NULL
         AND (id_societe IS NULL OR id_societe = $2)`,
      [id, societeId]
    );
    const exceptions = excRes.rows;

    const map = new Map();
    for (const perm of heritees) {
      map.set(perm.id, {
        permission: perm,
        source: "profil",
        effectif: true,
        exception: null,
        redondante: false,
      });
    }
    // Le retrait est toujours prioritaire sur un accord pour une même permission :
    // on traite systématiquement tous les "accorde" avant tous les "retire", quel
    // que soit l'ordre de retour SQL, pour que le retrait écrase inconditionnellement.
    for (const exc of exceptions.filter((e) => e.type === "accorde")) {
      const entry = map.get(exc.idpermission);
      if (entry) {
        map.set(exc.idpermission, {
          permission: entry.permission,
          source: "profil",
          effectif: true,
          exception: exc,
          redondante: true,
        });
      } else {
        map.set(exc.idpermission, {
          permission: await loadPermission(exc.idpermission),
          source: "exceptionaccorde",
          effectif: true,
          exception: exc,
          redondante: false,
        });
      }
    }
    for (const exc of exceptions.filter((e) => e.type === "retire")) {
      const entry = map.get(exc.idpermission);
      map.set(exc.idpermission, {
        permission: entry?.permission || await loadPermission(exc.idpermission),
        source: "exceptionretire",
        effectif: false,
        exception: exc,
        redondante: false,
      });
    }

    const result = Array.from(map.values());
    res.json({
      profilId: profilIdsReels[0] || null,
      profilIds: profilIdsReels,
      droits: result
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