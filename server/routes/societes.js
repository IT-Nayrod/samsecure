import express from "express";
import { tenantPool } from "../db.js";

const router = express.Router();

// Helper : logger en base
async function log(client, action, entite_type, entite_id, description, payload) {
  await client.query(
    `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [action, entite_type, entite_id || null, description, payload ? JSON.stringify(payload) : null]
  );
}

const SELECT_FIELDS = `
  id, raison_sociale AS raisonsociale, siret, email, id_societe_parent AS idsocieteparent,
  duree_amortissement AS dureeamortissement, revalorisation_annuelle AS revalorisationannuelle,
  delai_revalidation AS delairevalidation, debut_exercice_fiscal AS debutexercicefiscal, actif
`;

router.get("/societes", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(`
      SELECT ${SELECT_FIELDS}
      FROM societe
      WHERE date_suppression IS NULL
      ORDER BY raison_sociale
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/societes", async (req, res) => {
  const {
    raison_sociale, siret, email, id_societe_parent,
    duree_amortissement, revalorisation_annuelle, delai_revalidation, debut_exercice_fiscal,
  } = req.body;
  if (!raison_sociale) return res.status(400).json({ error: "raison_sociale requise" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO societe (raison_sociale, siret, email, id_societe_parent, duree_amortissement, revalorisation_annuelle, delai_revalidation, debut_exercice_fiscal)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${SELECT_FIELDS}`,
      [
        raison_sociale, siret || null, email || null, id_societe_parent || null,
        duree_amortissement || null, revalorisation_annuelle || null, delai_revalidation || null, debut_exercice_fiscal || null,
      ]
    );
    await log(client, "CREATE", "societe", rows[0].id, `Organisation "${raison_sociale}" créée`, rows[0]);
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /societes error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/societes/:id", async (req, res) => {
  const { id } = req.params;
  const {
    raison_sociale, siret, email, id_societe_parent,
    duree_amortissement, revalorisation_annuelle, delai_revalidation, debut_exercice_fiscal, actif,
  } = req.body;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const fields = [];
    const values = [id];
    let i = 2;
    if (raison_sociale !== undefined) { fields.push(`raison_sociale = $${i++}`); values.push(raison_sociale); }
    if (siret !== undefined) { fields.push(`siret = $${i++}`); values.push(siret); }
    if (email !== undefined) { fields.push(`email = $${i++}`); values.push(email); }
    if (id_societe_parent !== undefined) { fields.push(`id_societe_parent = $${i++}`); values.push(id_societe_parent); }
    if (duree_amortissement !== undefined) { fields.push(`duree_amortissement = $${i++}`); values.push(duree_amortissement); }
    if (revalorisation_annuelle !== undefined) { fields.push(`revalorisation_annuelle = $${i++}`); values.push(revalorisation_annuelle); }
    if (delai_revalidation !== undefined) { fields.push(`delai_revalidation = $${i++}`); values.push(delai_revalidation); }
    if (debut_exercice_fiscal !== undefined) { fields.push(`debut_exercice_fiscal = $${i++}`); values.push(debut_exercice_fiscal); }
    if (actif !== undefined) { fields.push(`actif = $${i++}`); values.push(actif); }
    if (fields.length === 0) return res.status(400).json({ error: "Aucun champ à modifier" });
    const { rows } = await client.query(
      `UPDATE societe SET ${fields.join(", ")} WHERE id = $1 AND date_suppression IS NULL
       RETURNING ${SELECT_FIELDS}`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: "Organisation introuvable" });
    await log(client, "UPDATE", "societe", id, `Organisation "${rows[0].raisonsociale}" modifiée`, req.body);
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /societes/:id error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.get("/societes/:id/profils-orphelins", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await tenantPool.query(
      `SELECT p.id, p.code, p.label
       FROM profil p
       WHERE p.date_suppression IS NULL
         AND EXISTS (SELECT 1 FROM profil_societe ps WHERE ps.id_profil = p.id AND ps.id_societe = $1 AND ps.date_suppression IS NULL)
         AND NOT EXISTS (
           SELECT 1 FROM profil_societe ps2
           WHERE ps2.id_profil = p.id AND ps2.id_societe IS DISTINCT FROM $1 AND ps2.date_suppression IS NULL
         )`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

async function purgeSociete(client, id) {
  await client.query(`UPDATE exception_droit SET date_suppression = now() WHERE id_societe = $1 AND date_suppression IS NULL`, [id]);
  await client.query(`UPDATE utilisateur_profil_societe SET date_suppression = now() WHERE id_societe = $1 AND date_suppression IS NULL`, [id]);
  await client.query(`UPDATE utilisateur_societe SET date_suppression = now() WHERE id_societe = $1 AND date_suppression IS NULL`, [id]);
  const { rows: profilsLies } = await client.query(
    `SELECT id_profil FROM profil_societe WHERE id_societe = $1 AND date_suppression IS NULL`, [id]
  );
  await client.query(`UPDATE profil_societe SET date_suppression = now() WHERE id_societe = $1`, [id]);
  for (const row of profilsLies) {
    const profilId = row.id_profil;
    const { rows: reste } = await client.query(
      `SELECT 1 FROM profil_societe WHERE id_profil = $1 AND date_suppression IS NULL LIMIT 1`, [profilId]
    );
    if (reste.length === 0) {
      await client.query(`UPDATE profil_permission SET date_suppression = now() WHERE id_profil = $1`, [profilId]);
      await client.query(`UPDATE profil SET date_suppression = now() WHERE id = $1`, [profilId]);
    }
  }
  await client.query(`UPDATE societe SET date_suppression = now() WHERE id = $1`, [id]);
}

async function collecterEnfants(client, parentId) {
  const ids = [];
  const queue = [parentId];
  while (queue.length > 0) {
    const current = queue.shift();
    const { rows } = await client.query(
      `SELECT id FROM societe WHERE id_societe_parent = $1 AND date_suppression IS NULL`, [current]
    );
    for (const r of rows) { ids.push(r.id); queue.push(r.id); }
  }
  return ids;
}

router.delete("/societes/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: soc } = await client.query(
      `SELECT raison_sociale FROM societe WHERE id = $1 AND date_suppression IS NULL`, [id]
    );
    if (!soc.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Organisation introuvable" }); }
    const enfants = await collecterEnfants(client, id);
    const tousIds = [id, ...enfants];
    for (let i = tousIds.length - 1; i >= 0; i--) await purgeSociete(client, tousIds[i]);
    await log(client, "SOFT_DELETE", "societe", id, `Organisation "${soc[0].raison_sociale}" et ${enfants.length} enfant(s) supprimée(s)`, { enfants });
    await client.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /societes/:id error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
