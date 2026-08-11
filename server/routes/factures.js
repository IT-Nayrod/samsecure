import express from "express";
import { tenantPool } from "../db.js";
import {
  recevoirUnFichier, erreurReception, validerFichier, ecrireFichier, supprimerFichier,
} from "../utils/stockagePreuves.js";

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
// la ou la facture est simplement introuvable.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Projection identique en liste et en detail.
// Le contrat remonte par la chaine facture vers commande vers contrat : la
// table facture ne porte pas de id_contrat et ne doit pas en porter
// (resolution E3). C'est aussi ce qui permet le filtre par contrat plus bas.
const SELECT_FACTURE = `
  SELECT f.id, f.label,
         f.id_commande, cm.label AS commande_label,
         cm.id_contrat, ct.label AS contrat_label,
         f.id_preuve,   pr.label AS preuve_label, pr.url_fichier AS preuve_url_fichier,
         pr.id_type_preuve AS preuve_id_type_preuve, tp.label AS preuve_type_label,
         f.created_at
  FROM facture f
  LEFT JOIN commande    cm ON cm.id = f.id_commande
  LEFT JOIN contrat     ct ON ct.id = cm.id_contrat
  LEFT JOIN preuve      pr ON pr.id = f.id_preuve
  LEFT JOIN type_preuve tp ON tp.id = pr.id_type_preuve`;

// Ordre identique aux $n de l'INSERT et de l'UPDATE.
const CHAMPS = ["label", "id_commande", "id_preuve"];

// Memes axes de filtrage que /preuves, pour que l'ecran unifie Documents de la
// #51 applique un seul jeu de filtres aux deux ressources. Contrat et type de
// preuve passent par les jointures, la facture ne les portant pas en propre.
const FILTRES = {
  id_type_preuve: "pr.id_type_preuve",
  id_contrat: "cm.id_contrat",
  id_commande: "f.id_commande",
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

// Verifie l'existence d'une reference. Un id absent est valide : c'est la
// validation de presence qui tranche, pas celle d'existence.
async function existe(client, table, id) {
  if (!id) return true;
  // Une reference malformee ne doit pas partir en Postgres : elle ressortirait
  // en 22P02 brute remontee en 500, la ou la reference est simplement
  // introuvable. Meme doctrine que le garde-fou UUID sur les :id de route.
  if (!UUID_RE.test(id)) return false;
  const { rowCount } = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return rowCount > 0;
}

function normaliserCorps(body = {}) {
  const vide = (v) => (v === "" || v === undefined ? null : v);
  return {
    label: body.label ?? "",
    id_commande: vide(body.id_commande),
    id_preuve: vide(body.id_preuve),
  };
}

async function validerFacture(client, body) {
  const { label, id_commande, id_preuve } = body;

  // code_retour: 3251
  if (!label || !label.trim())
    return { status: 400, error: "Le libelle est obligatoire." };
  // code_retour: 3252
  // Doublon volontaire du NOT NULL de facture.id_commande : la contrainte base
  // produirait une 23502 en 500, on veut un 400 lisible.
  if (!id_commande)
    return { status: 400, error: "La commande est obligatoire." };
  // code_retour: 3253
  if (!(await existe(client, "commande", id_commande)))
    return { status: 400, error: "Commande introuvable." };

  // [ARBITRAGE flux] en attente, daily du 11/08. La regle viendra ici : soit
  // id_preuve devient obligatoire des la creation, avec depot en transaction
  // cote #49 et refus code 3255, soit la facture reste saisissable seule et la
  // preuve est rattachee ensuite. Dans l'attente, le DDL fait foi : la colonne
  // est nullable, on ne verifie que l'existence de la reference fournie.
  // code_retour: 3254
  if (!(await existe(client, "preuve", id_preuve)))
    return { status: 400, error: "Preuve introuvable." };
  return null;
}

router.get("/factures", async (req, res) => {
  try {
    const filtres = construireFiltres(req.query);
    // code_retour: 3259
    if (filtres.erreur) return res.status(400).json({ error: filtres.erreur });

    const { rows } = await tenantPool.query(
      `${SELECT_FACTURE} ${filtres.clause} ORDER BY f.created_at DESC, f.label`,
      filtres.params
    );
    // code_retour: 3240
    res.json(rows);
  } catch (err) {
    console.error("GET /factures error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  }
});
// ---------------------------------------------------------------------------
// Depot combine facture plus preuve, en une transaction (#49, arbitrage rendu)
// ---------------------------------------------------------------------------
// Arbitrage du flux tranche le 11/08 : une facture ne se saisit pas sans son
// justificatif. Le fichier, la preuve et la facture naissent donc ensemble ou
// pas du tout. C'est la raison d'etre de cet endpoint : trois appels enchainés
// depuis le navigateur laisseraient une preuve orpheline si le dernier echoue.
//
// La preuve creee est rattachee a la commande, jamais au seul contrat : c'est
// ce rattachement direct que la detection des manques de la #50 exige pour
// considerer la commande complete.
const recevoirFichier = recevoirUnFichier("fichier");

// Trace probante, distincte du journal fonctionnel. Comme dans preuves.js elle
// n'avale pas ses erreurs : une trace manquante doit faire echouer le depot.
async function audit(client, req, action, entiteType, entiteId, apres) {
  await client.query(
    `INSERT INTO audit_log (id_utilisateur, action, entite_type, entite_id,
                            valeur_avant, valeur_apres, ip_address)
     VALUES ($1, $2, $3, $4, NULL, $5, $6)`,
    [req.user?.id || null, action, entiteType, entiteId,
     JSON.stringify(apres), (req.ip || "").slice(0, 45)]
  );
}

async function deposerFacture(req, res) {
  // code_retour: 3256
  if (!req.file)
    return res.status(400).json({ error: "Le fichier justificatif est obligatoire." });

  // code_retour: 3221
  // code_retour: 3223
  const invalideFichier = validerFichier(req.file);
  if (invalideFichier) return res.status(invalideFichier.status).json({ error: invalideFichier.error });

  const vide = (v) => (v === "" || v === undefined ? null : v);
  const label = (req.body?.label ?? "").trim();
  const idCommande = vide(req.body?.id_commande);
  const idTypePreuve = vide(req.body?.id_type_preuve);
  // Le libelle de la preuve retombe sur celui de la facture quand le formulaire
  // ne le distingue pas : un seul champ a saisir pour un seul geste metier.
  const labelPreuve = (vide(req.body?.label_preuve) ?? label).trim();

  const client = await tenantPool.connect();
  let ecrit = null;
  try {
    await client.query("BEGIN");

    // code_retour: 3251
    if (!label) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Le libelle est obligatoire." });
    }
    // code_retour: 3252
    if (!idCommande) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "La commande est obligatoire." });
    }
    // code_retour: 3253
    if (!(await existe(client, "commande", idCommande))) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Commande introuvable." });
    }
    // code_retour: 3212
    if (!idTypePreuve) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Le type de preuve est obligatoire." });
    }
    // code_retour: 3213
    if (!(await existe(client, "type_preuve", idTypePreuve))) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Type de preuve introuvable." });
    }

    ecrit = await ecrireFichier(req.file);

    const { rows: [preuve] } = await client.query(
      `INSERT INTO preuve (label, id_type_preuve, id_commande, url_fichier, hash_sha256, nom_origine)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [labelPreuve, idTypePreuve, idCommande, ecrit.nomPhysique, ecrit.hash, ecrit.nomOrigine]);

    const { rows: [facture] } = await client.query(
      `INSERT INTO facture (label, id_commande, id_preuve) VALUES ($1, $2, $3) RETURNING id`,
      [label, idCommande, preuve.id]);

    await audit(client, req, "DEPOT_FICHIER", "preuve", preuve.id,
      { url_fichier: ecrit.nomPhysique, hash_sha256: ecrit.hash, nom_origine: ecrit.nomOrigine,
        taille: req.file.size, id_facture: facture.id });
    await audit(client, req, "CREATE", "facture", facture.id,
      { label, id_commande: idCommande, id_preuve: preuve.id, hash_sha256: ecrit.hash });

    await log(client, "CREATE", "preuve", preuve.id,
      `Creation de la preuve "${labelPreuve}" au depot de la facture "${label}"`,
      { nom_origine: ecrit.nomOrigine, hash_sha256: ecrit.hash });
    await log(client, "CREATE", "facture", facture.id,
      `Creation de la facture "${label}" avec son justificatif`, { id_preuve: preuve.id });

    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_FACTURE} WHERE f.id = $1`, [facture.id]);
    // code_retour: 3245
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    // Tout ou rien jusqu'au disque : le fichier ecrit avant l'echec ne doit pas
    // survivre a une transaction annulee.
    if (ecrit) await supprimerFichier(ecrit.nomPhysique);
    console.error("POST /factures/depot error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
}

// Declaree avant /factures/:id, sinon Express fait correspondre "depot" au
// parametre et repond 404.
router.post("/factures/depot", (req, res) => {
  recevoirFichier(req, res, (err) => {
    if (err) {
      const connue = erreurReception(err);
      if (connue) return res.status(connue.status).json({ error: connue.error });
      console.error("POST /factures/depot multipart error", err);
      // code_retour: 3256
      return res.status(400).json({ error: "Le fichier justificatif est obligatoire." });
    }
    deposerFacture(req, res);
  });
});


router.get("/factures/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // code_retour: 3250
    if (!UUID_RE.test(id)) return res.status(404).json({ error: "Facture introuvable." });

    const { rows } = await tenantPool.query(`${SELECT_FACTURE} WHERE f.id = $1`, [id]);
    // code_retour: 3250
    if (!rows.length) return res.status(404).json({ error: "Facture introuvable." });

    // code_retour: 3241
    res.json(rows[0]);
  } catch (err) {
    console.error("GET /factures/:id error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/factures", async (req, res) => {
  const corps = normaliserCorps(req.body);
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const invalide = await validerFacture(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return res.status(invalide.status).json({ error: invalide.error });
    }

    const label = corps.label.trim();
    const { rows: [creee] } = await client.query(
      `INSERT INTO facture (${CHAMPS.join(", ")})
       VALUES ($1, $2, $3)
       RETURNING id`,
      [label, corps.id_commande, corps.id_preuve]
    );

    await log(client, "CREATE", "facture", creee.id, `Creation de la facture "${label}"`, corps);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_FACTURE} WHERE f.id = $1`, [creee.id]);
    // code_retour: 3242
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /factures error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/factures/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    // code_retour: 3250
    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Facture introuvable." });
    }

    const { rows: existant } = await client.query(
      `SELECT label, id_commande, id_preuve FROM facture WHERE id = $1`, [id]);
    // code_retour: 3250
    if (!existant.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Facture introuvable." });
    }

    // Fusion avant validation : un PATCH partiel ne doit pas echouer sur un
    // champ obligatoire qui n'a simplement pas ete transmis.
    const patch = normaliserCorps(req.body);
    const corps = { ...existant[0] };
    for (const champ of CHAMPS) {
      if (Object.prototype.hasOwnProperty.call(req.body, champ)) corps[champ] = patch[champ];
    }

    const invalide = await validerFacture(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return res.status(invalide.status).json({ error: invalide.error });
    }

    // Pas de updated_at : la table facture n'en porte pas (002_tenant_schema.sql:356).
    const label = corps.label.trim();
    await client.query(
      `UPDATE facture SET label = $1, id_commande = $2, id_preuve = $3 WHERE id = $4`,
      [label, corps.id_commande, corps.id_preuve, id]
    );

    await log(client, "UPDATE", "facture", id, `Modification de la facture "${label}"`, patch);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_FACTURE} WHERE f.id = $1`, [id]);
    // code_retour: 3243
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /factures/:id error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/factures/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    // code_retour: 3250
    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Facture introuvable." });
    }

    const { rows: existant } = await client.query(`SELECT label FROM facture WHERE id = $1`, [id]);
    // code_retour: 3250
    if (!existant.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Facture introuvable." });
    }

    // Aucun garde-fou de suppression : dans le DDL v4, aucune table ne
    // reference facture. La preuve liee n'est pas supprimee, elle survit a sa
    // facture et redevient une preuve libre.
    await client.query(`DELETE FROM facture WHERE id = $1`, [id]);
    await log(client, "DELETE", "facture", id, `Suppression de la facture "${existant[0].label}"`, null);
    await client.query("COMMIT");
    // code_retour: 3244
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /factures/:id error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
