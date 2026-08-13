import express from "express";
import { tenantPool } from "../db.js";
import { getAdminScope, scopeWhereClause } from "../utils/scope.js";
import { auditer } from "../utils/audit.js";

const router = express.Router();

async function log(client, action, entite_type, entite_id, description, payload) {
  await client.query(
    `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [action, entite_type, entite_id || null, description, payload ? JSON.stringify(payload) : null]
  );
}

router.get("/utilisateurs/:id/profils", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await tenantPool.query(
      `SELECT id, id_utilisateur AS idutilisateur, id_profil AS idprofil, id_societe AS idsociete
       FROM utilisateur_profil_societe
       WHERE id_utilisateur = $1 AND date_suppression IS NULL
       ORDER BY id_societe`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/attributions", async (req, res) => {
  try {
    const scope = await getAdminScope(req.user.id);
    const { clause, params } = scopeWhereClause(scope, 1);
    const { rows } = await tenantPool.query(
      `SELECT ups.id, ups.id_utilisateur AS idutilisateur, ups.id_profil AS idprofil, ups.id_societe AS idsociete
       FROM utilisateur_profil_societe ups
       JOIN utilisateur u ON u.id = ups.id_utilisateur
       WHERE ups.date_suppression IS NULL
         AND (${clause})
       ORDER BY ups.id_utilisateur, ups.id_societe`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/utilisateurs/:id/profils", async (req, res) => {
  const { id } = req.params;
  const { id_profil, id_societe } = req.body;
  if (!id_profil) return res.status(400).json({ error: "id_profil requis" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    // DO UPDATE (et non un INSERT nu) : une attribution précédemment retirée
    // (soft-delete), par exemple décochée puis recochée dans l'UI, doit
    // pouvoir être réactivée sans violation de contrainte unique brute
    // (bug constaté : uq_utilisateur_profil_societe).
    const { rows } = await client.query(
      `INSERT INTO utilisateur_profil_societe (id_utilisateur, id_profil, id_societe)
       VALUES ($1, $2, $3)
       ON CONFLICT ON CONSTRAINT uq_utilisateur_profil_societe
       DO UPDATE SET date_suppression = NULL
       RETURNING id, id_utilisateur AS idutilisateur, id_profil AS idprofil, id_societe AS idsociete`,
      [id, id_profil, id_societe || null]
    );
    const { rows: u } = await client.query(`SELECT prenom, nom FROM utilisateur WHERE id = $1`, [id]);
    const { rows: p } = await client.query(`SELECT label FROM profil WHERE id = $1`, [id_profil]);
    const { rows: s } = id_societe ? await client.query(`SELECT raison_sociale FROM societe WHERE id = $1`, [id_societe]) : { rows: [{ raison_sociale: null }] };
    await log(client, "CREATE", "utilisateur_profil_societe", rows[0].id, `Attribution du groupe "${p[0]?.label || id_profil}" à ${u[0]?.prenom || ''} ${u[0]?.nom || ''} sur ${s[0]?.raison_sociale || id_societe || 'tenant'}`, rows[0]);
    // entiteId vise le COMPTE et non la ligne d'attribution : l'audit d'un
    // utilisateur doit se lire d'une seule requete sur entite_id, sans avoir a
    // remonter les identifiants techniques des tables de liaison.
    // code_retour: 2020
    await auditer(client, req, {
      action: "GROUPE_ATTRIBUE",
      entiteId: id,
      apres: { id_profil, profil: p[0]?.label || null, id_societe: id_societe || null,
               societe: s[0]?.raison_sociale || "tenant", id_attribution: rows[0].id },
    });
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /utilisateurs/:id/profils error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/utilisateurs/:id/profils/:attribId", async (req, res) => {
  const { id, attribId } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: a } = await client.query(`SELECT id_utilisateur, id_profil, id_societe FROM utilisateur_profil_societe WHERE id = $1`, [attribId]);
    const { rowCount } = await client.query(
      `UPDATE utilisateur_profil_societe SET date_suppression = now() WHERE id = $1 AND date_suppression IS NULL`,
      [attribId]
    );
    if (!rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Attribution introuvable" }); }
    const { rows: u } = await client.query(`SELECT prenom, nom FROM utilisateur WHERE id = $1`, [a[0]?.id_utilisateur]);
    const { rows: p } = await client.query(`SELECT label FROM profil WHERE id = $1`, [a[0]?.id_profil]);
    const { rows: s } = a[0]?.id_societe ? await client.query(`SELECT raison_sociale FROM societe WHERE id = $1`, [a[0].id_societe]) : { rows: [{ raison_sociale: null }] };
    await log(client, "SOFT_DELETE", "utilisateur_profil_societe", attribId, `Attribution du groupe "${p[0]?.label || a[0]?.id_profil}" supprimée pour ${u[0]?.prenom || ''} ${u[0]?.nom || ''} sur ${s[0]?.raison_sociale || a[0]?.id_societe || 'tenant'}`, null);
    // code_retour: 2021
    await auditer(client, req, {
      action: "GROUPE_RETIRE",
      // L'utilisateur porteur de l'attribution fait foi, le parametre d'URL
      // n'est qu'un repli : les deux doivent concorder, mais c'est la ligne en
      // base qui dit de quel compte le groupe est reellement retire.
      entiteId: a[0]?.id_utilisateur || id,
      avant: { id_profil: a[0]?.id_profil, profil: p[0]?.label || null,
               id_societe: a[0]?.id_societe || null,
               societe: s[0]?.raison_sociale || "tenant", id_attribution: attribId },
    });
    await client.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /utilisateurs/:id/profils/:attribId error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
