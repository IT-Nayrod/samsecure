import express from "express";
import bcrypt from "bcryptjs";
import { tenantPool } from "../db.js";
import { getAdminScope, isUserInScope, scopeWhereClause } from "../utils/scope.js";

const router = express.Router();

async function log(client, action, entite_type, entite_id, description, payload) {
  try {
    await client.query(
      `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [action, entite_type, entite_id || null, description, payload ? JSON.stringify(payload) : null]
    );
  } catch (e) {
    console.error("[journal] log failed:", e.message);
  }
}

// Tous les comptes sont servis, desactives compris : la suppression n'existe
// plus, un compte retire doit rester visible pour etre reactivable.
router.get("/utilisateurs", async (req, res) => {
  try {
    const scope = await getAdminScope(req.user.id);
    const { clause, params } = scopeWhereClause(scope, 1);
    const { rows } = await tenantPool.query(
      `SELECT u.id, u.nom, u.prenom, u.email, u.actif, u.date_finale, u.date_mise_en_fonction
       FROM utilisateur u
       WHERE (${clause})
       ORDER BY u.nom, u.prenom`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /utilisateurs error", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/utilisateurs", async (req, res) => {
  // Contrat d'Antonin (cf. sandbox handleCreateUser) : le champ s'appelle
  // mot_de_passe_hash. Ce serveur de développement local le hache tout de
  // même via bcrypt par hygiène ; rien ne garantit que l'API réelle d'Antonin
  // fasse de même (sa sandbox de référence y écrit une valeur en clair).
  const { nom, prenom, email, mot_de_passe_hash, actif, langue, date_finale, date_mise_en_fonction } = req.body;
  if (!nom || !prenom || !email) return res.status(400).json({ error: "nom, prenom et email requis" });
  if (!mot_de_passe_hash || mot_de_passe_hash.length < 4) {
    return res.status(400).json({ error: "Un mot de passe initial d'au moins 4 caractères est requis." });
  }

  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const motDePasseHash = await bcrypt.hash(mot_de_passe_hash, 10);
    const fields = ["nom", "prenom", "email", "mot_de_passe_hash", "actif", "langue"];
    const values = [nom, prenom, email, motDePasseHash, actif ?? true, langue || "fr"];
    const placeholders = ["$1", "$2", "$3", "$4", "$5", "$6"];

    if (date_finale !== undefined && date_finale !== null && date_finale !== "") {
      fields.push("date_finale");
      values.push(date_finale);
      placeholders.push(`$${values.length}`);
    }

    if (date_mise_en_fonction !== undefined && date_mise_en_fonction !== null && date_mise_en_fonction !== "") {
      fields.push("date_mise_en_fonction");
      values.push(date_mise_en_fonction);
      placeholders.push(`$${values.length}`);
    } else {
      fields.push("date_mise_en_fonction");
      placeholders.push("CURRENT_DATE");
    }

    const sql = `INSERT INTO utilisateur (${fields.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING id, nom, prenom, email, actif, langue, date_finale, date_mise_en_fonction`;

    const { rows } = await client.query(sql, values);
    await log(client, "CREATE", "utilisateur", rows[0].id, `Utilisateur "${prenom} ${nom}" créé`, { email, date_finale, date_mise_en_fonction });
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /utilisateurs error", err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Cet email est déjà utilisé." });
    }
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/utilisateurs/:id", async (req, res) => {
  const { id } = req.params;
  const { nom, prenom, email, actif, langue, date_finale, date_mise_en_fonction } = req.body;
  const scope = await getAdminScope(req.user.id);
  if (!(await isUserInScope(id, scope))) {
    return res.status(403).json({ error: "Cet utilisateur n'est pas dans votre périmètre." });
  }
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const setFields = [];
    const values = [id];
    let idx = 2;

    if (nom !== undefined) { setFields.push(`nom = $${idx++}`); values.push(nom); }
    if (prenom !== undefined) { setFields.push(`prenom = $${idx++}`); values.push(prenom); }
    if (email !== undefined) { setFields.push(`email = $${idx++}`); values.push(email); }
    if (actif !== undefined) { setFields.push(`actif = $${idx++}`); values.push(actif); }
    if (langue !== undefined) { setFields.push(`langue = $${idx++}`); values.push(langue); }
    if (date_finale !== undefined) { setFields.push(`date_finale = $${idx++}`); values.push(date_finale); }
    if (date_mise_en_fonction !== undefined) { setFields.push(`date_mise_en_fonction = $${idx++}`); values.push(date_mise_en_fonction); }

    if (setFields.length === 0) return res.status(400).json({ error: "Aucun champ à modifier" });

    const { rows } = await client.query(
      `UPDATE utilisateur SET ${setFields.join(", ")} WHERE id = $1 RETURNING id, nom, prenom, email, actif, langue, date_finale, date_mise_en_fonction`,
      values
    );
    if (!rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Utilisateur introuvable" }); }
    await log(client, "UPDATE", "utilisateur", id, `Utilisateur "${rows[0].prenom} ${rows[0].nom}" modifié`, req.body);
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /utilisateurs/:id error", err);
    res.status(500).json({ error: "Cet email est déjà utilisé." });
  } finally {
    client.release();
  }
});

// La suppression d'un utilisateur n'existe plus, migration 022 : le retrait
// d'un compte se fait par desactivation, PATCH /utilisateurs/:id { actif:
// false }. Un compte desactive reste visible a l'ecran et reactivable, la ou
// un compte supprime disparaissait de la liste et n'etait plus recuperable que
// par une intervention en base.

router.post("/utilisateurs/:id/societes", async (req, res) => {
  const { id } = req.params;
  const { id_societe } = req.body;
  try {
    // DO UPDATE (et non DO NOTHING) : un rattachement précédemment retiré
    // (soft-delete) doit pouvoir être réactivé, y compris l'échelle tenant
    // (id_societe NULL) après un passage à des sociétés spécifiques.
    const { rows } = await tenantPool.query(
      `INSERT INTO utilisateur_societe (id_utilisateur, id_societe) VALUES ($1, $2)
       ON CONFLICT ON CONSTRAINT uq_utilisateur_societe
       DO UPDATE SET date_suppression = NULL
       RETURNING *`,
      [id, id_societe || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Retrait du rattachement à l'échelle tenant (id_societe NULL) : distinct de
// la route ci-dessous car NULL n'est pas représentable dans un paramètre
// d'URL au sens de l'égalité SQL.
router.delete("/utilisateurs/:id/rattachement-tenant", async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await tenantPool.query(
      `UPDATE utilisateur_societe SET date_suppression = now()
       WHERE id_utilisateur = $1 AND id_societe IS NULL AND date_suppression IS NULL`,
      [id]
    );
    if (!rowCount) return res.status(404).json({ error: "Rattachement tenant introuvable" });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/utilisateurs/:id/societes", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await tenantPool.query(
      `SELECT id, id_utilisateur AS idutilisateur, id_societe AS idsociete
       FROM utilisateur_societe
       WHERE id_utilisateur = $1 AND date_suppression IS NULL`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/utilisateurs/:id/societes/:societeId", async (req, res) => {
  const { id, societeId } = req.params;
  try {
    await tenantPool.query(
      `UPDATE utilisateur_profil_societe SET date_suppression = now()
       WHERE id_utilisateur = $1 AND id_societe = $2 AND date_suppression IS NULL`,
      [id, societeId]
    );
    const { rowCount } = await tenantPool.query(
      `UPDATE utilisateur_societe SET date_suppression = now()
       WHERE id_utilisateur = $1 AND id_societe = $2 AND date_suppression IS NULL`,
      [id, societeId]
    );
    if (!rowCount) return res.status(404).json({ error: "Rattachement introuvable" });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
