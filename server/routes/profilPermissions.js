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

router.get("/profils/:id/permissions", async (req, res) => {
  const { id } = req.params;
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

router.post("/profils/:id/permissions", async (req, res) => {
  const { id } = req.params;
  const { id_permission } = req.body;
  if (!id_permission) return res.status(400).json({ error: "id_permission requis" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO profil_permission (id_profil, id_permission) VALUES ($1, $2)
       RETURNING id, id_profil, id_permission`,
      [id, id_permission]
    );
    const { rows: prof } = await client.query(`SELECT label FROM profil WHERE id = $1`, [id]);
    const { rows: perm } = await client.query(`SELECT label, code FROM permission WHERE id = $1`, [id_permission]);
    await log(client, "CREATE", "profil_permission", rows[0].id, `Permission "${perm[0]?.label || perm[0]?.code || id_permission}" ajoutée au groupe "${prof[0]?.label || id}"`, rows[0]);
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

router.delete("/profils/:id/permissions/:idPermission", async (req, res) => {
  const { id, idPermission } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await tenantPool.query(
      `UPDATE profil_permission SET date_suppression = now()
       WHERE id_profil = $1 AND id_permission = $2 AND date_suppression IS NULL`,
      [id, idPermission]
    );
    if (!rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Permission non trouvée pour ce profil" }); }
    const { rows: prof } = await client.query(`SELECT label FROM profil WHERE id = $1`, [id]);
    const { rows: perm } = await client.query(`SELECT label, code FROM permission WHERE id = $1`, [idPermission]);
    await log(client, "DELETE", "profil_permission", null, `Permission "${perm[0]?.label || perm[0]?.code || idPermission}" retirée du groupe "${prof[0]?.label || id}"`, { id_profil: id, id_permission: idPermission });
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

export default router;
