// contacts - referentiel des contacts (module 4, #181).
//
// Meme convention que revendeurs.js : enveloppe normalisee (codes 5240-5259
// seedes par la migration 048), helper log() vers journal_ecriture avec
// id_auteur, trace probante auditer() vers audit_log sur chaque ecriture,
// transaction par ecriture, relecture de la projection apres commit.
//
// Rattachement : trois FK optionnelles posees par la migration 049
// (id_societe, id_editeur, id_revendeur), au plus une renseignee
// (ck_contact_rattachement_unique). L'API sert type_rattachement et
// rattachement_label derives, le front n'a pas a connaitre la forme en base.
//
// Etat : pas de colonne actif, l'etat se deduit de date_fin (une fin echue
// vaut contact inactif). Un contact parti se retire en posant sa date de fin,
// par PATCH ; la suppression reelle reste possible pour une fiche creee par
// erreur, aucune table ne referencant le contact.
//
// Doublons : memes fonctions SQL que les revendeurs (migration 044).
// L'adresse email d'abord, identifiant de la personne, egalite qui ne se
// discute pas ; puis cle_rapprochement sur le nom complet, qui rapproche
// "Lemoine Henri", "henri lemoine" et "H. Lemoine" ecrit sans accents. Comme
// pour les revendeurs, l'existant est rendu a l'appelant en proposition, pas
// seulement signale.
//
// Pas de workflow de validation : comme le revendeur, le contact est un tiers,
// il n'est pas soumis au circuit de la #53. A ouvrir si la doctrine change, en
// l'ajoutant a ENTITES_VALIDABLES.
import express from "express";
import { tenantPool } from "../db.js";
import { succes, erreur, erreurPivot } from "../utils/reponse.js";
import { auditer, diff } from "../utils/audit.js";

const router = express.Router();

// Convention du projet : helper de journalisation local a chaque routeur.
// id_auteur est lu dans req.user (session JWT). Il avale ses erreurs, une
// trace fonctionnelle manquante ne doit pas annuler l'ecriture.
async function log(client, req, action, entite_id, description, payload) {
  try {
    await client.query(
      `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, id_auteur, payload)
       VALUES ($1, 'contact', $2, $3, $4, $5)`,
      [action, entite_id || null, description, req?.user?.id || null,
       payload ? JSON.stringify(payload) : null]
    );
  } catch (e) {
    console.error("[journal] log failed:", e.message);
  }
}

// Garde-fou : un :id non UUID part sinon en Postgres et ressort en 500
// illisible la ou le contact est simplement introuvable.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Nom complet, prenom puis nom, sous la forme immutable indexee par la 049
// (idx_contact_nom_norm et idx_contact_cle_rapprochement) : la reprendre a
// l'identique est la condition pour que ces index servent aux egalites.
const NOM_COMPLET = `(coalesce(c.prenom, '') || ' ' || c.nom)`;

// Projection identique en liste et en detail : garantit qu'aucun champ
// n'apparaisse dans un ecran et pas dans l'autre. Les dates sortent en texte
// AAAA-MM-JJ : c'est la forme que les <input type="date"> attendent, et un
// DATE n'a pas de fuseau a serialiser. actif est derive de date_fin, jamais
// stocke ; type_rattachement et rattachement_label sont derives des trois FK.
const SELECT_CONTACT = `
  SELECT c.id, c.nom, c.prenom, c.email, c.telephone, c.photo_url,
         c.id_fonction, f.label AS fonction_label,
         c.id_societe, c.id_editeur, c.id_revendeur,
         CASE WHEN c.id_societe   IS NOT NULL THEN 'client'
              WHEN c.id_editeur   IS NOT NULL THEN 'editeur'
              WHEN c.id_revendeur IS NOT NULL THEN 'revendeur'
         END AS type_rattachement,
         COALESCE(s.raison_sociale, e.raison_sociale, r.raison_sociale) AS rattachement_label,
         c.date_debut::text AS date_debut,
         c.date_fin::text   AS date_fin,
         (c.date_fin IS NULL OR c.date_fin >= CURRENT_DATE) AS actif,
         c.created_at, c.updated_at
  FROM contact c
  LEFT JOIN fonction  f ON f.id = c.id_fonction
  LEFT JOIN societe   s ON s.id = c.id_societe
  LEFT JOIN editeur   e ON e.id = c.id_editeur
  LEFT JOIN revendeur r ON r.id = c.id_revendeur`;

// Projection courte des suggestions et des propositions de doublon : de quoi
// reconnaitre l'existant, sans les jointures de la projection complete.
const SELECT_COURT = `
  SELECT c.id, c.nom, c.prenom, c.email,
         (c.date_fin IS NULL OR c.date_fin >= CURRENT_DATE) AS actif
  FROM contact c`;

// Colonnes metier ecrivables, dans l'ordre des parametres d'INSERT et d'UPDATE.
const CHAMPS = [
  "nom", "prenom", "email", "telephone", "id_fonction",
  "id_societe", "id_editeur", "id_revendeur", "date_debut", "date_fin",
];

// Un <input> vide envoie "" et non null : sans normalisation, "" partirait sur
// une FK uuid et produirait une 22P02 brute remontee en 500. L'email est
// debarrasse de ses espaces, comme le SIRET des revendeurs : deux contacts a
// l'email vide ne doivent pas se heurter a uq_contact_email.
function normaliserCorps(body = {}) {
  const vide = (v) => (v === "" || v === undefined || v === null ? null : v);
  const email = vide(body.email);
  const telephone = vide(body.telephone);
  const prenom = vide(body.prenom);
  return {
    nom: body.nom ?? "",
    prenom: prenom === null ? null : String(prenom).trim(),
    email: email === null ? null : String(email).trim(),
    telephone: telephone === null ? null : String(telephone).trim(),
    id_fonction: vide(body.id_fonction),
    id_societe: vide(body.id_societe),
    id_editeur: vide(body.id_editeur),
    id_revendeur: vide(body.id_revendeur),
    date_debut: vide(body.date_debut),
    date_fin: vide(body.date_fin),
  };
}

// ---- Validation --------------------------------------------------------------

function emailValide(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Controle de forme leger : chiffres, espaces, points, tirets, parentheses,
// indicatif +. Le referentiel accueille des numeros etrangers.
function telephoneValide(telephone) {
  return /^\+?[\d\s().-]{6,20}$/.test(telephone);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Validation du corps fusionne. Les controles de reference (fonction,
// rattachement) interrogent la base et restent dans la transaction.
async function validerContact(client, corps) {
  if (!corps.nom || !String(corps.nom).trim())
    return { status: 400, code: 5248, error: "Le nom est obligatoire." };
  if (corps.email && !emailValide(corps.email))
    return { status: 400, code: 5249, error: "Adresse email invalide." };
  if (corps.telephone && !telephoneValide(corps.telephone))
    return { status: 400, code: 5249, error: "Téléphone invalide." };

  for (const champ of ["date_debut", "date_fin"]) {
    const valeur = corps[champ];
    if (valeur !== null && (!DATE_RE.test(valeur) || Number.isNaN(Date.parse(valeur))))
      return { status: 400, code: 5253, error: "Date invalide." };
  }
  if (corps.date_debut !== null && corps.date_fin !== null && corps.date_fin < corps.date_debut)
    return { status: 400, code: 5253, error: "La date de fin doit être postérieure ou égale à la date de début." };

  const rattachements = ["id_societe", "id_editeur", "id_revendeur"]
    .filter((champ) => corps[champ] !== null);
  if (rattachements.length > 1)
    return { status: 400, code: 5252, error: "Un contact porte au plus un rattachement : société, éditeur ou revendeur." };

  const references = [
    ["id_fonction", "fonction", 5250, "Fonction introuvable."],
    ["id_societe", "societe", 5251, "Société de rattachement introuvable."],
    ["id_editeur", "editeur", 5251, "Éditeur de rattachement introuvable."],
    ["id_revendeur", "revendeur", 5251, "Revendeur de rattachement introuvable."],
  ];
  for (const [champ, table, code, message] of references) {
    if (corps[champ] === null) continue;
    if (!UUID_RE.test(String(corps[champ])))
      return { status: 400, code, error: message };
    // Le nom de table vient du tableau ci-dessus, jamais d'une entree client.
    const { rowCount } = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [corps[champ]]);
    if (!rowCount) return { status: 400, code, error: message };
  }
  return null;
}

// Detection de doublon, deux passes, comme les revendeurs.
//
// L'adresse email d'abord : elle identifie la personne, son egalite ne se
// discute pas. Puis la cle de rapprochement (migration 044) sur le nom
// complet : un contact est presque toujours resaisi sous une forme voisine,
// prenom et nom inverses, accents perdus, jamais a l'identique.
//
// L'existant est rendu a l'appelant, et non seulement signale : l'ecran doit
// pouvoir proposer d'ouvrir sa fiche. Un refus sec conduirait a le recreer
// sous une troisieme graphie.
async function chercherDoublon(client, corps, idExclu) {
  const exclu = idExclu || null;

  if (corps.email) {
    const { rows } = await client.query(
      `${SELECT_COURT}
        WHERE lower(c.email) = lower($1) AND ($2::uuid IS NULL OR c.id <> $2)
        LIMIT 1`,
      [corps.email, exclu]);
    if (rows.length) {
      return { code: 5254, existant: rows[0], motif: "email" };
    }
  }

  const nomComplet = `${corps.prenom ?? ""} ${corps.nom}`.trim();
  const { rows } = await client.query(
    `${SELECT_COURT}
      WHERE cle_rapprochement(${NOM_COMPLET}) = cle_rapprochement($1)
        AND ($2::uuid IS NULL OR c.id <> $2)
      ORDER BY (c.date_fin IS NULL OR c.date_fin >= CURRENT_DATE) DESC, c.nom, c.prenom
      LIMIT 1`,
    [nomComplet, exclu]);
  if (rows.length) {
    return { code: 5255, existant: rows[0], motif: "nom" };
  }
  return null;
}

// Message du refus. Un existant inactif se signale comme tel : sa mission est
// peut-etre simplement a prolonger, pas a ressaisir.
function messageDoublon(doublon) {
  const e = doublon.existant;
  const nom = `${e.prenom ?? ""} ${e.nom}`.trim();
  const tete = doublon.motif === "email"
    ? `L'adresse ${e.email} est déjà portée par "${nom}".`
    : `"${nom}" existe déjà sous un nom très proche.`;
  return e.actif
    ? `${tete} Ouvrez sa fiche plutôt que d'en créer un second.`
    : `${tete} Ce contact est inactif : rouvrez sa fiche et prolongez sa période plutôt que d'en créer un second.`;
}

// Violation de uq_contact_email : deux creations concurrentes passent la
// detection applicative et se croisent sur l'index.
function conflitEmail(err) {
  return err?.code === "23505" && String(err.constraint || "").includes("contact_email");
}

// ---- Referentiel des fonctions ------------------------------------------------

// Fonctions des contacts (DSI, DAF, acheteur...), referentiel copy-on-write
// seede par 003. Le front filtre sur id et affiche label, comme type_contrat.
router.get("/fonctions", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(
      `SELECT id, code, label FROM fonction ORDER BY label`);
    succes(res, 5246, rows);
  } catch (err) {
    console.error("GET /fonctions error", err);
    erreur(res, 5256, { status: 500, message: "Erreur serveur" });
  }
});

// ---- Lecture ------------------------------------------------------------------

// Tous les contacts, inactifs compris : la fin de mission est une donnee de la
// fiche, pas un retrait du catalogue, et la liste filtre par etat a l'ecran.
router.get("/contacts", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(`${SELECT_CONTACT} ORDER BY c.nom, c.prenom`);
    succes(res, 5240, rows);
  } catch (err) {
    console.error("GET /contacts error", err);
    erreur(res, 5256, { status: 500, message: "Erreur serveur" });
  }
});

// Recherche incrementale, appelee au fil de la frappe.
//
// Insensible a la casse et aux accents : normaliser_texte (migration 044) est
// applique des deux cotes de la comparaison, sur le nom complet dans les deux
// ordres et sur l'adresse email. Le client qui tape "lemoine henri" trouve
// "Henri Lemoine", celui qui tape "anaelle" trouve "Anaëlle".
//
// Volontairement pauvre : la projection courte, sans les jointures de la
// liste. Une frappe ne doit couter qu'une seule requete, bornee par LIMIT.
// Meme reserve de montee en charge que les revendeurs : joker en tete, donc
// parcours sequentiel, pg_trgm en reponse si le referentiel grossit.
//
// Declaree avant /contacts/:id : la route parametree capturerait sinon
// "recherche" comme un identifiant. Meme regle cote routesPermissions.js.
router.get("/contacts/recherche", async (req, res) => {
  try {
    const brut = typeof req.query.q === "string" ? req.query.q.trim() : "";
    // Une saisie vide ne suggere rien : renvoyer le referentiel entier a chaque
    // ouverture du formulaire n'aiderait personne et couterait cher.
    if (!brut) return succes(res, 5245, { suggestions: [], total: 0 });

    // % et _ sont les jokers de LIKE : sans echappement, un client tapant
    // "100%" interrogerait le referentiel avec un joker au milieu de son texte.
    const motif = brut.replace(/([\\%_])/g, "\\$1");
    const exclu = UUID_RE.test(String(req.query.exclure ?? "")) ? req.query.exclure : null;
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 8, 1), 25);

    const nomInverse = `(c.nom || ' ' || coalesce(c.prenom, ''))`;
    // count(*) OVER () : le total des correspondances sans seconde requete.
    // L'ordre place la correspondance exacte en tete (nom complet ou email),
    // puis celles qui commencent par le texte saisi, puis le reste ; les
    // actifs avant les inactifs.
    const { rows } = await tenantPool.query(
      `SELECT c.id, c.nom, c.prenom, c.email,
              (c.date_fin IS NULL OR c.date_fin >= CURRENT_DATE) AS actif,
              (normaliser_texte(${NOM_COMPLET}) = normaliser_texte($1)
               OR normaliser_texte(${nomInverse}) = normaliser_texte($1)
               OR lower(coalesce(c.email, '')) = lower($1)) AS exact,
              count(*) OVER ()::int AS total
         FROM contact c
        WHERE (normaliser_texte(${NOM_COMPLET})
               LIKE '%' || normaliser_texte($2) || '%' ESCAPE '\\'
           OR normaliser_texte(${nomInverse})
               LIKE '%' || normaliser_texte($2) || '%' ESCAPE '\\'
           OR normaliser_texte(coalesce(c.email, ''))
               LIKE '%' || normaliser_texte($2) || '%' ESCAPE '\\')
          AND ($3::uuid IS NULL OR c.id <> $3)
        ORDER BY CASE
                   WHEN normaliser_texte(${NOM_COMPLET}) = normaliser_texte($1)
                     OR normaliser_texte(${nomInverse}) = normaliser_texte($1)
                     OR lower(coalesce(c.email, '')) = lower($1)              THEN 0
                   WHEN normaliser_texte(${NOM_COMPLET})
                        LIKE normaliser_texte($2) || '%' ESCAPE '\\'
                     OR normaliser_texte(${nomInverse})
                        LIKE normaliser_texte($2) || '%' ESCAPE '\\'          THEN 1
                   ELSE 2
                 END,
                 (c.date_fin IS NULL OR c.date_fin >= CURRENT_DATE) DESC,
                 c.nom, c.prenom
        LIMIT $4`,
      [brut, motif, exclu, limite]);

    const total = rows.length ? rows[0].total : 0;
    succes(res, 5245, {
      suggestions: rows.map(({ total: _total, ...c }) => c),
      total,
    });
  } catch (err) {
    console.error("GET /contacts/recherche error", err);
    erreur(res, 5256, { status: 500, message: "Erreur serveur" });
  }
});

router.get("/contacts/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (!UUID_RE.test(id)) return erreur(res, 5247, { status: 404, message: "Contact introuvable." });

    const { rows } = await tenantPool.query(`${SELECT_CONTACT} WHERE c.id = $1`, [id]);
    if (!rows.length) return erreur(res, 5247, { status: 404, message: "Contact introuvable." });

    succes(res, 5241, rows[0]);
  } catch (err) {
    console.error("GET /contacts/:id error", err);
    erreur(res, 5256, { status: 500, message: "Erreur serveur" });
  }
});

// ---- Ecriture -----------------------------------------------------------------

router.post("/contacts", async (req, res) => {
  const corps = normaliserCorps(req.body);
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const invalide = await validerContact(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    // L'existant part dans details : l'ecran doit pouvoir l'ouvrir, pas
    // seulement apprendre qu'il existe.
    const doublon = await chercherDoublon(client, corps, null);
    if (doublon) {
      await client.query("ROLLBACK");
      return erreur(res, doublon.code, {
        status: 409,
        message: messageDoublon(doublon),
        details: { existant: doublon.existant, motif: doublon.motif },
      });
    }

    const nom = String(corps.nom).trim();
    const { rows: [cree] } = await client.query(
      `INSERT INTO contact (${CHAMPS.join(", ")})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [nom, corps.prenom, corps.email, corps.telephone, corps.id_fonction,
       corps.id_societe, corps.id_editeur, corps.id_revendeur,
       corps.date_debut, corps.date_fin]);

    const libelle = [corps.prenom, nom].filter(Boolean).join(" ");
    await log(client, req, "CREATE", cree.id,
      `Creation du contact "${libelle}"`, corps);
    // code_retour: 5257
    await auditer(client, req, {
      action: "CONTACT_CREE", entiteType: "contact", entiteId: cree.id,
      apres: { ...corps, nom },
    });

    const { rows } = await client.query(`${SELECT_CONTACT} WHERE c.id = $1`, [cree.id]);
    await client.query("COMMIT");

    succes(res, 5242, rows[0], { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    if (conflitEmail(err)) {
      return erreur(res, 5254, { status: 409, message: "Un contact porte deja cette adresse email." });
    }
    console.error("POST /contacts error", err);
    erreur(res, 5256, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/contacts/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return erreur(res, 5247, { status: 404, message: "Contact introuvable." });
    }

    const { rows: existant } = await client.query(
      `SELECT nom, prenom, email, telephone, id_fonction,
              id_societe, id_editeur, id_revendeur,
              date_debut::text AS date_debut, date_fin::text AS date_fin
         FROM contact WHERE id = $1`, [id]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      return erreur(res, 5247, { status: 404, message: "Contact introuvable." });
    }

    // Fusion avant validation : un PATCH partiel ne doit pas echouer sur un
    // champ obligatoire qui n'a simplement pas ete transmis. Le changement de
    // type de rattachement passe par le meme mecanisme : le front envoie la FK
    // choisie et les deux autres a null.
    const patch = normaliserCorps(req.body);
    const corps = { ...existant[0] };
    for (const champ of CHAMPS) {
      if (Object.prototype.hasOwnProperty.call(req.body, champ)) corps[champ] = patch[champ];
    }

    const invalide = await validerContact(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    // Le contact modifie est exclu : il ne se signale pas a lui-meme comme un
    // doublon de lui-meme.
    const doublon = await chercherDoublon(client, corps, id);
    if (doublon) {
      await client.query("ROLLBACK");
      return erreur(res, doublon.code, {
        status: 409,
        message: messageDoublon(doublon),
        details: { existant: doublon.existant, motif: doublon.motif },
      });
    }

    const nom = String(corps.nom).trim();
    await client.query(
      `UPDATE contact
          SET nom = $1, prenom = $2, email = $3, telephone = $4, id_fonction = $5,
              id_societe = $6, id_editeur = $7, id_revendeur = $8,
              date_debut = $9, date_fin = $10
        WHERE id = $11`,
      [nom, corps.prenom, corps.email, corps.telephone, corps.id_fonction,
       corps.id_societe, corps.id_editeur, corps.id_revendeur,
       corps.date_debut, corps.date_fin, id]);

    const libelle = [corps.prenom, nom].filter(Boolean).join(" ");
    await log(client, req, "UPDATE", id,
      `Modification du contact "${libelle}"`, patch);
    // Trace probante : seuls les champs reellement modifies, jamais le corps
    // fusionne, sinon on lirait "mis a null" sur les champs conserves.
    // code_retour: 5258
    const d = diff(existant[0], { ...corps, nom });
    await auditer(client, req, {
      action: "CONTACT_MODIFIE", entiteType: "contact", entiteId: id,
      avant: d.avant, apres: d.apres,
    });

    const { rows } = await client.query(`${SELECT_CONTACT} WHERE c.id = $1`, [id]);
    await client.query("COMMIT");

    succes(res, 5243, rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    if (conflitEmail(err)) {
      return erreur(res, 5254, { status: 409, message: "Un contact porte deja cette adresse email." });
    }
    console.error("PATCH /contacts/:id error", err);
    erreur(res, 5256, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// Suppression reelle : aucune table ne reference le contact, il n'y a pas de
// rattachement a proteger. Un contact parti ne passe pas ici, il se retire en
// posant sa date de fin ; la suppression sert la fiche creee par erreur.
router.delete("/contacts/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return erreur(res, 5247, { status: 404, message: "Contact introuvable." });
    }

    const { rows: existant } = await client.query(
      `SELECT nom, prenom, email, telephone FROM contact WHERE id = $1`, [id]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      return erreur(res, 5247, { status: 404, message: "Contact introuvable." });
    }

    await client.query(`DELETE FROM contact WHERE id = $1`, [id]);

    const libelle = [existant[0].prenom, existant[0].nom].filter(Boolean).join(" ");
    await log(client, req, "DELETE", id,
      `Suppression du contact "${libelle}"`, null);
    // code_retour: 5259
    await auditer(client, req, {
      action: "CONTACT_SUPPRIME", entiteType: "contact", entiteId: id,
      avant: existant[0],
    });

    await client.query("COMMIT");
    succes(res, 5244, null);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /contacts/:id error", err);
    erreur(res, 5256, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
