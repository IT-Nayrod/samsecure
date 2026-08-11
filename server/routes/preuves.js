import express from "express";
import { tenantPool } from "../db.js";

const router = express.Router();

// Convention du projet : helper de journalisation local a chaque routeur.
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

// Garde-fou : un :id non UUID part sinon en Postgres et ressort en 500 illisible
// la ou la preuve est simplement introuvable.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Empreinte SHA-256 : 64 caracteres hexadecimaux, soit exactement la taille de
// la colonne VARCHAR(64). Sans ce controle, une saisie plus longue produirait
// une 22001 brute remontee en 500.
const SHA256_RE = /^[0-9a-f]{64}$/i;

// Projection identique en liste et en detail : garantit qu'aucun champ
// n'apparaisse dans un ecran et pas dans l'autre.
// nb_factures est servi des la liste, et non seulement sur le detail : c'est le
// compteur qui bloque la suppression, le front doit pouvoir griser l'action
// sans une requete par ligne.
const SELECT_PREUVE = `
  SELECT p.id, p.label,
         p.id_type_preuve, tp.code AS type_code, tp.label AS type_label,
         p.id_contrat,     ct.label AS contrat_label,
         p.id_commande,    cm.label AS commande_label,
         p.url_fichier, p.hash_sha256, p.created_at,
         (SELECT count(*) FROM facture f WHERE f.id_preuve = p.id)::int AS nb_factures
  FROM preuve p
  LEFT JOIN type_preuve tp ON tp.id = p.id_type_preuve
  LEFT JOIN contrat     ct ON ct.id = p.id_contrat
  LEFT JOIN commande    cm ON cm.id = p.id_commande`;

// Ordre identique aux $n de l'INSERT et de l'UPDATE.
const CHAMPS = [
  "label", "id_type_preuve", "id_contrat", "id_commande", "url_fichier", "hash_sha256",
];

// Filtres de liste : premier usage de query params dans les CRUD du projet.
// Forme reprise de GET /commandes/agregats, validation UUID puis clause
// construite, pour garder une requete unique quel que soit le nombre de
// filtres actifs.
const FILTRES = {
  id_type_preuve: "p.id_type_preuve",
  id_contrat: "p.id_contrat",
  id_commande: "p.id_commande",
};

function construireFiltres(query) {
  const clauses = [];
  const params = [];
  for (const [param, colonne] of Object.entries(FILTRES)) {
    const valeur = query[param];
    if (valeur === undefined || valeur === "") continue;
    if (!UUID_RE.test(valeur)) return { erreur: `Valeur de filtre invalide pour ${param}.` };
    params.push(valeur);
    clauses.push(`${colonne} = $${params.length}::uuid`);
  }
  return { clause: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

// Verifie l'existence d'une reference. Evite qu'un UUID inconnu remonte en
// 23503 brute transformee en 500 illisible. Un id absent est valide : c'est
// la validation de presence qui tranche, pas celle d'existence.
async function existe(client, table, id) {
  if (!id) return true;
  // Une reference malformee ne doit pas partir en Postgres : elle ressortirait
  // en 22P02 brute remontee en 500, la ou la reference est simplement
  // introuvable. Meme doctrine que le garde-fou UUID sur les :id de route.
  if (!UUID_RE.test(id)) return false;
  const { rowCount } = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return rowCount > 0;
}

// Un select vide envoie "" et non null. Sans cette normalisation, "" part sur
// une colonne UUID et produit une 22P02 brute remontee en 500.
function normaliserCorps(body = {}) {
  const vide = (v) => (v === "" || v === undefined ? null : v);
  return {
    label: body.label ?? "",
    id_type_preuve: vide(body.id_type_preuve),
    id_contrat: vide(body.id_contrat),
    id_commande: vide(body.id_commande),
    url_fichier: vide(body.url_fichier),
    hash_sha256: vide(body.hash_sha256),
  };
}

async function validerPreuve(client, body) {
  const { label, id_type_preuve, id_contrat, id_commande, url_fichier, hash_sha256 } = body;

  // code_retour: 3211
  if (!label || !label.trim())
    return { status: 400, error: "Le libelle est obligatoire." };
  // code_retour: 3212
  if (!id_type_preuve)
    return { status: 400, error: "Le type de preuve est obligatoire." };
  // code_retour: 3213
  if (!(await existe(client, "type_preuve", id_type_preuve)))
    return { status: 400, error: "Type de preuve introuvable." };
  // code_retour: 3214
  // Regle metier de la #48 : une preuve sans rattachement est orpheline, elle
  // ne serait atteignable ni par un contrat ni par une commande. Le DDL laisse
  // les deux colonnes nullables, c'est l'API qui porte la contrainte.
  if (!id_contrat && !id_commande)
    return { status: 400, error: "Une preuve doit etre rattachee a un contrat, a une commande, ou aux deux." };
  // code_retour: 3215
  if (!(await existe(client, "contrat", id_contrat)))
    return { status: 400, error: "Contrat introuvable." };
  // code_retour: 3216
  if (!(await existe(client, "commande", id_commande)))
    return { status: 400, error: "Commande introuvable." };
  // code_retour: 3217
  // url_fichier est NOT NULL en base (002_tenant_schema.sql:351). Decision du
  // 11/08 : on ne migre pas, le champ est donc obligatoire des la #48. En #49
  // il sera renseigne par le module de depot et non plus par le client, sans
  // changement de ce contrat d'API.
  // [ARBITRAGE D27] en attente : aucun controle de format n'est applique ici,
  // ni exigence d'un chemin de stockage, ni acceptation explicite d'une URL
  // http/https de GED. La chaine est stockee telle quelle. La regle viendra se
  // brancher a cet endroit precis, code 3231 reserve.
  if (!url_fichier || !url_fichier.trim())
    return { status: 400, error: "Le chemin du fichier est obligatoire." };
  // code_retour: 3218
  // Le hash reste facultatif : le rendre obligatoire prejugerait de D27, qui
  // prevoit justement un hash NULL pour un lien externe. Seul son format est
  // verifie quand il est fourni.
  if (hash_sha256 && !SHA256_RE.test(hash_sha256))
    return { status: 400, error: "L'empreinte SHA-256 doit comporter 64 caracteres hexadecimaux." };
  return null;
}

router.get("/preuves", async (req, res) => {
  try {
    const filtres = construireFiltres(req.query);
    // code_retour: 3219
    if (filtres.erreur) return res.status(400).json({ error: filtres.erreur });

    const { rows } = await tenantPool.query(
      `${SELECT_PREUVE} ${filtres.clause} ORDER BY p.created_at DESC, p.label`,
      filtres.params
    );
    // code_retour: 3200
    res.json(rows);
  } catch (err) {
    console.error("GET /preuves error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/preuves/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // code_retour: 3210
    if (!UUID_RE.test(id)) return res.status(404).json({ error: "Preuve introuvable." });

    const { rows } = await tenantPool.query(`${SELECT_PREUVE} WHERE p.id = $1`, [id]);
    // code_retour: 3210
    if (!rows.length) return res.status(404).json({ error: "Preuve introuvable." });

    // code_retour: 3201
    res.json(rows[0]);
  } catch (err) {
    console.error("GET /preuves/:id error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/preuves", async (req, res) => {
  const corps = normaliserCorps(req.body);
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const invalide = await validerPreuve(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return res.status(invalide.status).json({ error: invalide.error });
    }

    const label = corps.label.trim();
    const { rows: [creee] } = await client.query(
      `INSERT INTO preuve (${CHAMPS.join(", ")})
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [label, corps.id_type_preuve, corps.id_contrat, corps.id_commande,
       corps.url_fichier, corps.hash_sha256]
    );

    await log(client, "CREATE", "preuve", creee.id, `Creation de la preuve "${label}"`, corps);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_PREUVE} WHERE p.id = $1`, [creee.id]);
    // code_retour: 3202
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /preuves error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/preuves/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    // code_retour: 3210
    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Preuve introuvable." });
    }

    const { rows: existant } = await client.query(
      `SELECT label, id_type_preuve, id_contrat, id_commande, url_fichier, hash_sha256
       FROM preuve WHERE id = $1`, [id]);
    // code_retour: 3210
    if (!existant.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Preuve introuvable." });
    }

    // Fusion avant validation : un PATCH partiel ne doit pas echouer sur un
    // champ obligatoire qui n'a simplement pas ete transmis. hasOwnProperty
    // distingue le champ absent du champ volontairement mis a null.
    const patch = normaliserCorps(req.body);
    const corps = { ...existant[0] };
    for (const champ of CHAMPS) {
      if (Object.prototype.hasOwnProperty.call(req.body, champ)) corps[champ] = patch[champ];
    }

    const invalide = await validerPreuve(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return res.status(invalide.status).json({ error: invalide.error });
    }

    // Pas de updated_at : la table preuve n'en porte pas (002_tenant_schema.sql:344).
    const label = corps.label.trim();
    await client.query(
      `UPDATE preuve
          SET label = $1, id_type_preuve = $2, id_contrat = $3, id_commande = $4,
              url_fichier = $5, hash_sha256 = $6
        WHERE id = $7`,
      [label, corps.id_type_preuve, corps.id_contrat, corps.id_commande,
       corps.url_fichier, corps.hash_sha256, id]
    );

    await log(client, "UPDATE", "preuve", id, `Modification de la preuve "${label}"`, patch);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_PREUVE} WHERE p.id = $1`, [id]);
    // code_retour: 3203
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /preuves/:id error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/preuves/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    // code_retour: 3210
    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Preuve introuvable." });
    }

    const { rows: existant } = await client.query(`SELECT label FROM preuve WHERE id = $1`, [id]);
    // code_retour: 3210
    if (!existant.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Preuve introuvable." });
    }

    // Seule FK entrante de preuve dans le DDL v4 : facture.id_preuve. Supprimer
    // la preuve laisserait la facture sans justificatif, ce que la #50 compte
    // precisement detecter comme un manque.
    const { rows: [liens] } = await client.query(
      `SELECT count(*)::int AS factures FROM facture WHERE id_preuve = $1`, [id]);

    if (liens.factures) {
      await client.query("ROLLBACK");
      // code_retour: 3230
      return res.status(409).json({
        error: `Suppression impossible : cette preuve est rattachee a ${liens.factures} facture(s).`,
        details: liens,
      });
    }

    await client.query(`DELETE FROM preuve WHERE id = $1`, [id]);
    await log(client, "DELETE", "preuve", id, `Suppression de la preuve "${existant[0].label}"`, null);
    await client.query("COMMIT");
    // code_retour: 3204
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /preuves/:id error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
