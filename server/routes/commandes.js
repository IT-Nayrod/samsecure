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
// la ou la commande est simplement introuvable.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Projection identique en liste et en detail : garantit qu'aucun champ
// n'apparaisse dans un ecran et pas dans l'autre.
// montant est cast en float8 : pg renvoie les numeric en chaine, ce qui casse
// les tris et les sommes cote consommateur. La plage DECIMAL(12,2) tient
// largement dans un double, aucune perte de precision possible ici.
const SELECT_COMMANDE = `
  SELECT c.id, c.label, c.numero_devis,
         c.id_contrat,       ct.label         AS contrat_label,
         c.id_societe,       s.raison_sociale AS societe_label,
         c.id_revendeur,     r.raison_sociale AS revendeur_label,
         c.id_mode_commande, mc.code AS mode_code, mc.label AS mode_label,
	 c.date_commande::text AS date_commande, c.date_fin::text AS date_fin,
         c.montant::float8 AS montant,
         c.a_renouveler,
         c.created_at, c.updated_at
  FROM commande c
  LEFT JOIN contrat       ct ON ct.id = c.id_contrat
  LEFT JOIN societe       s  ON s.id  = c.id_societe
  LEFT JOIN revendeur     r  ON r.id  = c.id_revendeur
  LEFT JOIN mode_commande mc ON mc.id = c.id_mode_commande`;

// Colonnes metier ecrivables, dans l'ordre des parametres d'INSERT et d'UPDATE.
const CHAMPS = [
  "label", "numero_devis", "id_contrat", "id_societe", "id_revendeur",
  "id_mode_commande", "montant", "date_commande", "date_fin", "a_renouveler",
];

// Verifie l'existence d'une reference. Evite qu'un UUID inconnu remonte en
// 23503 brute transformee en 500 illisible. Un id absent est valide : c'est
// la validation de presence qui tranche, pas celle d'existence.
async function existe(client, table, id) {
  if (!id) return true;
  const { rowCount } = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return rowCount > 0;
}

// Un <select> vide et un <input type="date"> vide envoient "" et non null.
// Sans cette normalisation, "" part sur une colonne UUID ou DATE et produit
// une 22P02 brute remontee en 500.
function normaliserCorps(body = {}) {
  const vide = (v) => (v === "" || v === undefined ? null : v);
  const montant = vide(body.montant);
  return {
    label: body.label ?? "",
    numero_devis: vide(body.numero_devis),
    id_contrat: vide(body.id_contrat),
    id_societe: vide(body.id_societe),
    id_revendeur: vide(body.id_revendeur),
    id_mode_commande: vide(body.id_mode_commande),
    // Number("") vaut 0, d'ou le passage par vide() avant conversion : un
    // montant efface doit ressortir absent, pas nul.
    montant: montant === null ? null : Number(montant),
    date_commande: vide(body.date_commande),
    date_fin: vide(body.date_fin),
    a_renouveler: body.a_renouveler === true,
  };
}

async function validerCommande(client, body) {
  const { label, id_contrat, id_societe, id_revendeur, id_mode_commande,
          montant, date_commande, date_fin } = body;

  // code_retour: 3111
  if (!label || !label.trim())
    return { status: 400, error: "Le libelle est obligatoire." };
  // code_retour: 3112
  if (!id_contrat)
    return { status: 400, error: "Le contrat est obligatoire." };
  // code_retour: 3113
  if (!(await existe(client, "contrat", id_contrat)))
    return { status: 400, error: "Contrat introuvable." };
  // code_retour: 3114
  if (!id_societe)
    return { status: 400, error: "La societe acheteuse est obligatoire." };
  // code_retour: 3115
  if (!(await existe(client, "societe", id_societe)))
    return { status: 400, error: "Societe acheteuse introuvable." };
  // code_retour: 3116
  if (!(await existe(client, "revendeur", id_revendeur)))
    return { status: 400, error: "Revendeur introuvable." };
  // code_retour: 3117
  if (!(await existe(client, "mode_commande", id_mode_commande)))
    return { status: 400, error: "Mode de commande introuvable." };
  // code_retour: 3118
  if (montant === null || montant === undefined)
    return { status: 400, error: "Le montant est obligatoire." };
  // code_retour: 3119
  // Couvre le zero, le negatif et la saisie non numerique d'un seul message :
  // dans les trois cas le montant n'est pas un montant valide.
  if (!Number.isFinite(montant) || montant <= 0)
    return { status: 400, error: "Le montant doit etre strictement positif." };
  // code_retour: 3120
  if (!date_commande)
    return { status: 400, error: "La date de commande est obligatoire." };
  // code_retour: 3121
  // Doublon volontaire de ck_commande_dates : la contrainte base produirait
  // une 23514 en 500, on veut un 400 lisible.
  if (date_fin && date_fin < date_commande)
    return { status: 400, error: "La date de fin doit etre posterieure a la date de commande." };
  return null;
}

router.get("/commandes", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(`${SELECT_COMMANDE} ORDER BY c.date_commande DESC NULLS LAST, c.label`);
    // code_retour: 3100
    res.json(rows);
  } catch (err) {
    console.error("GET /commandes error", err);
    // code_retour: 3199
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Agregats financiers, lus exclusivement dans precalcul_financier alimente par
// les triggers. Declaree avant /commandes/:id : sinon Express fait
// correspondre "agregats" au parametre et repond 404.
// Axes disponibles : societe et editeur, les seuls portes par le precalcul.
// Ni contrat ni revendeur, qui n'existent qu'au niveau de la liste (decision
// Dorian du 10/08).
router.get("/commandes/agregats", async (req, res) => {
  try {
    const annee = req.query.annee ? Number(req.query.annee) : new Date().getFullYear();
    // code_retour: 3141
    if (!Number.isInteger(annee) || annee < 1970 || annee > 2999)
      return res.status(400).json({ error: "L'annee demandee est invalide." });

    const idSociete = req.query.id_societe || null;
    // code_retour: 3142
    if (idSociete && !UUID_RE.test(idSociete))
      return res.status(400).json({ error: "Identifiant de societe invalide." });

    const idEditeur = req.query.id_editeur || null;
    // code_retour: 3143
    if (idEditeur && !UUID_RE.test(idEditeur))
      return res.status(400).json({ error: "Identifiant d'editeur invalide." });

    // Sommes en numeric cote SQL, cast en float8 a la sortie seulement :
    // additionner des flottants des le depart ferait deriver le centime.
    const { rows } = await tenantPool.query(
      `SELECT periode,
              sum(montant_commande)::float8 AS montant_commande,
              sum(montant_paye)::float8     AS montant_paye
         FROM precalcul_financier
        WHERE periode LIKE $1
          AND ($2::uuid IS NULL OR id_societe = $2::uuid)
          AND ($3::uuid IS NULL OR id_editeur = $3::uuid)
        GROUP BY periode`,
      [`${annee}-%`, idSociete, idEditeur]);

    const parPeriode = new Map(rows.map((r) => [r.periode, r]));

    // Les 12 mois sont toujours renvoyes, les mois sans commande a 0 : le
    // consommateur n'a pas a combler les trous d'une serie temporelle.
    const mois = Array.from({ length: 12 }, (_, i) => {
      const periode = `${annee}-${String(i + 1).padStart(2, "0")}`;
      const ligne = parPeriode.get(periode);
      return {
        periode,
        mois: i + 1,
        montant_commande: ligne ? ligne.montant_commande : 0,
        montant_paye: ligne ? ligne.montant_paye : 0,
      };
    });

    // Totaux derives des 12 mois, jamais requetes separement : ils sont ainsi
    // egaux a leur somme par construction. L'arrondi au centime absorbe le
    // residu binaire de l'addition flottante.
    const somme = (cle) => Math.round(mois.reduce((t, m) => t + m[cle], 0) * 100) / 100;

    // code_retour: 3140
    res.json({
      annee,
      filtres: { id_societe: idSociete, id_editeur: idEditeur },
      mois,
      totaux: { montant_commande: somme("montant_commande"), montant_paye: somme("montant_paye") },
    });
  } catch (err) {
    console.error("GET /commandes/agregats error", err);
    // code_retour: 3199
    res.status(500).json({ error: "Erreur serveur" });
  }
});


router.get("/commandes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // code_retour: 3110
    if (!UUID_RE.test(id)) return res.status(404).json({ error: "Commande introuvable." });

    const { rows } = await tenantPool.query(`${SELECT_COMMANDE} WHERE c.id = $1`, [id]);
    // code_retour: 3110
    if (!rows.length) return res.status(404).json({ error: "Commande introuvable." });

    // Memes compteurs que le garde-fou de suppression : la fiche detail affiche
    // le nombre reel de rattachements sans dependre des modules non branches.
    const { rows: [liens] } = await tenantPool.query(
      `SELECT (SELECT count(*) FROM facture WHERE id_commande = $1)::int AS nb_factures,
              (SELECT count(*) FROM preuve  WHERE id_commande = $1)::int AS nb_preuves,
              (SELECT count(*) FROM licence WHERE id_commande = $1)::int AS nb_licences`,
      [id]);

    // code_retour: 3101
    res.json({ ...rows[0], ...liens });
  } catch (err) {
    console.error("GET /commandes/:id error", err);
    // code_retour: 3199
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/commandes", async (req, res) => {
  const corps = normaliserCorps(req.body);
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const invalide = await validerCommande(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return res.status(invalide.status).json({ error: invalide.error });
    }

    const label = corps.label.trim();
    const { rows: [creee] } = await client.query(
      `INSERT INTO commande (${CHAMPS.join(", ")})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [label, corps.numero_devis, corps.id_contrat, corps.id_societe, corps.id_revendeur,
       corps.id_mode_commande, corps.montant, corps.date_commande, corps.date_fin,
       corps.a_renouveler]
    );

    await log(client, "CREATE", "commande", creee.id, `Creation de la commande "${label}"`, corps);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_COMMANDE} WHERE c.id = $1`, [creee.id]);
    // code_retour: 3102
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /commandes error", err);
    // code_retour: 3199
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/commandes/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    // code_retour: 3110
    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Commande introuvable." });
    }

    // Dates lues en texte : validerCommande compare des chaines ISO, un objet
    // Date de pg fausserait la comparaison date_fin < date_commande.
    // Montant lu en float8 pour la meme raison, Number.isFinite refuserait une chaine.
    const { rows: existant } = await client.query(
      `SELECT label, numero_devis, id_contrat, id_societe, id_revendeur, id_mode_commande,
              montant::float8 AS montant,
              date_commande::text AS date_commande, date_fin::text AS date_fin,
              a_renouveler
       FROM commande WHERE id = $1`, [id]);
    // code_retour: 3110
    if (!existant.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Commande introuvable." });
    }

    // Fusion avant validation : un PATCH partiel ne doit pas echouer sur un
    // champ obligatoire qui n'a simplement pas ete transmis.
    const patch = normaliserCorps(req.body);
    const corps = { ...existant[0] };
    for (const champ of CHAMPS) {
      if (Object.prototype.hasOwnProperty.call(req.body, champ)) corps[champ] = patch[champ];
    }

    const invalide = await validerCommande(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return res.status(invalide.status).json({ error: invalide.error });
    }

    const label = corps.label.trim();
    await client.query(
      `UPDATE commande
          SET label = $1, numero_devis = $2, id_contrat = $3, id_societe = $4,
              id_revendeur = $5, id_mode_commande = $6, montant = $7,
              date_commande = $8, date_fin = $9, a_renouveler = $10, updated_at = now()
        WHERE id = $11`,
      [label, corps.numero_devis, corps.id_contrat, corps.id_societe, corps.id_revendeur,
       corps.id_mode_commande, corps.montant, corps.date_commande, corps.date_fin,
       corps.a_renouveler, id]
    );

    await log(client, "UPDATE", "commande", id, `Modification de la commande "${label}"`, patch);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_COMMANDE} WHERE c.id = $1`, [id]);
    // code_retour: 3103
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /commandes/:id error", err);
    // code_retour: 3199
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/commandes/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    // code_retour: 3110
    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Commande introuvable." });
    }

    const { rows: existant } = await client.query(`SELECT label FROM commande WHERE id = $1`, [id]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      // code_retour: 3110
      return res.status(404).json({ error: "Commande introuvable." });
    }

    // Les 3 FK entrantes du DDL v4. Depuis le drop de licence.id_contrat par la
    // migration 014, la commande est le seul chemin de la licence vers le
    // contrat : ce blocage protege toute la chaine de rattachement.
    const { rows: [liens] } = await client.query(
      `SELECT (SELECT count(*) FROM facture WHERE id_commande = $1) AS factures,
              (SELECT count(*) FROM preuve  WHERE id_commande = $1) AS preuves,
              (SELECT count(*) FROM licence WHERE id_commande = $1) AS licences`,
      [id]);

    const bloquants = [];
    if (+liens.factures) bloquants.push(`${liens.factures} facture(s)`);
    if (+liens.preuves)  bloquants.push(`${liens.preuves} preuve(s)`);
    if (+liens.licences) bloquants.push(`${liens.licences} licence(s)`);

    if (bloquants.length) {
      await client.query("ROLLBACK");
      // code_retour: 3130
      return res.status(409).json({
        error: `Suppression impossible : cette commande porte ${bloquants.join(", ")}.`,
        details: liens,
      });
    }

    await client.query(`DELETE FROM commande WHERE id = $1`, [id]);
    await log(client, "DELETE", "commande", id, `Suppression de la commande "${existant[0].label}"`, null);
    await client.query("COMMIT");
    // code_retour: 3104
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /commandes/:id error", err);
    // code_retour: 3199
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
