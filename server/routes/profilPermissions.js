// Permissions d'un profil : consultation, ajout et retrait, journalisés.

import express from "express";
import { tenantPool } from "../db.js";
import { estUuid, deciderAjout, deciderRetrait } from "../utils/matriceGroupe.js";

const router = express.Router();

async function log(client, action, entite_type, entite_id, description, payload) {
  await client.query(
    `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [action, entite_type, entite_id || null, description, payload ? JSON.stringify(payload) : null]
  );
}

router.get("/profils/:id/permissions", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Groupe introuvable." });
  try {
    const { rows } = await tenantPool.query(
      `SELECT p.id, p.code, p.label, p.module
       FROM profil_permission pp
       JOIN permission p ON p.id = pp.id_permission
       WHERE pp.id_profil = $1 AND pp.date_suppression IS NULL
       ORDER BY p.module, p.label`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Ligne du couple (groupe, permission), retirée ou non, verrouillée le temps
// de l'écriture : deux administrateurs sur la même case s'exécutent l'un après
// l'autre, le second décide sur l'état laissé par le premier.
async function lireLigne(client, idProfil, idPermission) {
  const { rows } = await client.query(
    `SELECT id, id_profil, id_permission, date_suppression
       FROM profil_permission
      WHERE id_profil = $1 AND id_permission = $2
        FOR UPDATE`,
    [idProfil, idPermission]
  );
  return rows[0];
}

router.post("/profils/:id/permissions", async (req, res) => {
  const { id } = req.params;
  const { id_permission } = req.body || {};
  if (!id_permission) return res.status(400).json({ error: "id_permission requis" });
  if (!estUuid(id)) return res.status(404).json({ error: "Groupe introuvable." });
  if (!estUuid(id_permission)) return res.status(400).json({ error: "Cette permission n'existe pas au catalogue." });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    // Références validées avant écriture : un 404 ou un 400 lisible plutôt que
    // la violation de clé étrangère (23503) rendue en 500.
    const { rows: prof } = await client.query(
      `SELECT label FROM profil WHERE id = $1 AND date_suppression IS NULL`, [id]
    );
    if (!prof.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Groupe introuvable." }); }
    const { rows: perm } = await client.query(`SELECT label, code FROM permission WHERE id = $1`, [id_permission]);
    if (!perm.length) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Cette permission n'existe pas au catalogue." }); }

    const ligne = await lireLigne(client, id, id_permission);
    const decision = deciderAjout(ligne);
    if (decision.ecriture === "aucune") {
      await client.query("ROLLBACK");
      return res.status(decision.status).json({ id: ligne.id, id_profil: ligne.id_profil, id_permission: ligne.id_permission });
    }
    // #170 : DO UPDATE (et non un INSERT nu). Un droit retiré garde sa ligne
    // (date_suppression) et occupe toujours uq_profil_permission : le rajouter
    // levait une violation d'unicité rendue en 500, sur tout droit décoché
    // puis recoché. L'upsert vaut pour l'insertion comme pour la réactivation
    // et couvre aussi l'insertion concurrente d'un couple encore absent.
    const { rows } = await client.query(
      `INSERT INTO profil_permission (id_profil, id_permission) VALUES ($1, $2)
       ON CONFLICT (id_profil, id_permission) DO UPDATE SET date_suppression = NULL
       RETURNING id, id_profil, id_permission`,
      [id, id_permission]
    );
    await log(client, "CREATE", "profil_permission", rows[0].id,
      `Permission "${perm[0].label || perm[0].code}" ajoutée au groupe "${prof[0].label}"`,
      decision.ecriture === "reactiver" ? { ...rows[0], reactivation: true } : rows[0]);
    await client.query("COMMIT");
    res.status(decision.status).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /profils/:id/permissions error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/profils/:id/permissions/:idPermission", async (req, res) => {
  const { id, idPermission } = req.params;
  if (!estUuid(id) || !estUuid(idPermission)) {
    return res.status(404).json({ error: "Cette permission n'est pas attribuée à ce groupe." });
  }
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const ligne = await lireLigne(client, id, idPermission);
    const decision = deciderRetrait(ligne);
    if (decision.ecriture === "aucune") {
      await client.query("ROLLBACK");
      return res.status(decision.status).json({ error: "Cette permission n'est pas attribuée à ce groupe." });
    }
    // Le retrait passe par le client de la transaction. Il partait sur le pool
    // (tenantPool.query) : validé hors transaction, il restait acquis quand la
    // suite échouait et que la route répondait 500, et chaque retrait tenait
    // deux connexions d'un pool de cinq.
    await client.query(`UPDATE profil_permission SET date_suppression = now() WHERE id = $1`, [ligne.id]);
    const { rows: prof } = await client.query(`SELECT label FROM profil WHERE id = $1`, [id]);
    const { rows: perm } = await client.query(`SELECT label, code FROM permission WHERE id = $1`, [idPermission]);
    await log(client, "DELETE", "profil_permission", ligne.id, `Permission "${perm[0]?.label || perm[0]?.code || idPermission}" retirée du groupe "${prof[0]?.label || id}"`, { id_profil: id, id_permission: idPermission });
    await client.query("COMMIT");
    res.status(decision.status).end();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /profils/:id/permissions/:idPermission error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
