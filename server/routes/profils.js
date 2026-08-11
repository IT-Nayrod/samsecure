import express from "express";
import { tenantPool } from "../db.js";

const router = express.Router();

async function log(client, action, entite_type, entite_id, description, payload) {
  await client.query(
    `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [action, entite_type, entite_id || null, description, payload ? JSON.stringify(payload) : null]
  );
}

router.get("/profils", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(
      `SELECT id, code, label, description FROM profil WHERE date_suppression IS NULL ORDER BY label`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/profils", async (req, res) => {
  const { code, label, description } = req.body;
  if (!code || !label) return res.status(400).json({ error: "code et label requis" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO profil (code, label, description) VALUES ($1, $2, $3)
       RETURNING id, code, label, description`,
      [code, label, description || null]
    );
    await log(client, "CREATE", "profil", rows[0].id, `Groupe "${label}" créé`, rows[0]);
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.get("/profils/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await tenantPool.query(
      `SELECT id, code, label, description FROM profil WHERE id = $1 AND date_suppression IS NULL`, [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Profil introuvable" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.patch("/profils/:id", async (req, res) => {
  const { id } = req.params;
  const { label, description } = req.body;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await tenantPool.query(
      `UPDATE profil SET label = COALESCE($2, label), description = COALESCE($3, description)
       WHERE id = $1 AND date_suppression IS NULL
       RETURNING id, code, label, description`,
      [id, label, description]
    );
    if (!rows.length) return res.status(404).json({ error: "Profil introuvable" });
    await log(client, "UPDATE", "profil", id, `Groupe "${rows[0].label}" modifié`, req.body);
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.get("/profils/:id/societes", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await tenantPool.query(
      `SELECT ps.id, ps.id_societe AS idsociete, s.raison_sociale AS raisonsociale
       FROM profil_societe ps
       LEFT JOIN societe s ON s.id = ps.id_societe
       WHERE ps.id_profil = $1 AND ps.date_suppression IS NULL`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/profils/:id/societes/:psId", async (req, res) => {
  const { id, psId } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: ps } = await client.query(`SELECT id_societe FROM profil_societe WHERE id = $1`, [psId]);
    const { rowCount } = await client.query(
      `UPDATE profil_societe SET date_suppression = now() WHERE id = $1 AND id_profil = $2 AND date_suppression IS NULL`,
      [psId, id]
    );
    if (!rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Diffusion introuvable" }); }
    const { rows: prof } = await client.query(`SELECT label FROM profil WHERE id = $1`, [id]);
    const { rows: soc } = await client.query(`SELECT raison_sociale FROM societe WHERE id = $1`, [ps[0]?.id_societe]);
    await log(client, "SOFT_DELETE", "profil_societe", psId, `Diffusion du groupe "${prof[0]?.label || id}" retirée de la société "${soc[0]?.raison_sociale || ps[0]?.id_societe || 'tenant'}"`, null);
    await client.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.get("/profils/:id/impact", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: users } = await tenantPool.query(
      `SELECT DISTINCT u.id, u.prenom, u.nom, u.email
       FROM utilisateur_profil_societe ups
       JOIN utilisateur u ON u.id = ups.id_utilisateur
       WHERE ups.id_profil = $1 AND ups.date_suppression IS NULL AND u.date_suppression IS NULL`,
      [id]
    );
    const { rows: societes } = await tenantPool.query(
      `SELECT DISTINCT s.id, s.raison_sociale AS raisonsociale
       FROM profil_societe ps
       JOIN societe s ON s.id = ps.id_societe
       WHERE ps.id_profil = $1 AND ps.id_societe IS NOT NULL AND ps.date_suppression IS NULL`,
      [id]
    );
    res.json({ utilisateurs: users, societes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/profils/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: prof } = await tenantPool.query(
      `SELECT label FROM profil WHERE id = $1 AND date_suppression IS NULL`, [id]
    );
    if (!prof.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Profil introuvable" }); }
    await client.query(`UPDATE profil_permission SET date_suppression = now() WHERE id_profil = $1`, [id]);
    await client.query(`UPDATE profil_societe SET date_suppression = now() WHERE id_profil = $1`, [id]);
    await client.query(`UPDATE utilisateur_profil_societe SET date_suppression = now() WHERE id_profil = $1`, [id]);
    await client.query(`UPDATE profil SET date_suppression = now() WHERE id = $1`, [id]);
    await log(client, "SOFT_DELETE", "profil", id, `Groupe "${prof[0].label}" supprimé`, null);
    await client.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.post("/profils/:id/societes", async (req, res) => {
  const { id } = req.params;
  const { id_societe } = req.body;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    // DO UPDATE (et non un INSERT nu) : une diffusion précédemment retirée
    // (soft-delete) doit pouvoir être réactivée sans provoquer une violation
    // de contrainte unique brute (bug constaté : uq_profil_societe).
    const { rows } = await client.query(
      `INSERT INTO profil_societe (id_profil, id_societe) VALUES ($1, $2)
       ON CONFLICT ON CONSTRAINT uq_profil_societe
       DO UPDATE SET date_suppression = NULL
       RETURNING *`,
      [id, id_societe || null]
    );
    const { rows: prof } = await client.query(`SELECT label FROM profil WHERE id = $1`, [id]);
    const { rows: soc } = await client.query(`SELECT raison_sociale FROM societe WHERE id = $1`, [id_societe || null]);
    await log(client, "CREATE", "profil_societe", rows[0].id, `Diffusion du groupe "${prof[0]?.label || id}" ajoutée à la société "${soc[0]?.raison_sociale || id_societe || 'tenant'}"`, rows[0]);
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
