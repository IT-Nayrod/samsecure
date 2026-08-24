import express from "express";
import { tenantPool } from "../db.js";
import { succes, erreur, erreurPivot } from "../utils/reponse.js";
import {
  jointureStatut, COLONNES_STATUT, soumettre, purgerValidations,
} from "../utils/validationWorkflow.js";

const router = express.Router();

// Convention du projet : helper de journalisation local a chaque routeur.
// id_auteur est lu dans req.user (session JWT), comme le fait audit() : les
// quatre routeurs de saisie sont montes apres authMiddleware, req.user est
// donc toujours renseigne. Jamais un id arbitraire : la FK vers utilisateur
// ferait avorter la transaction en cours.
async function log(client, req, action, entite_type, entite_id, description, payload) {
  try {
    await client.query(
      `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, id_auteur, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [action, entite_type, entite_id || null, description, req?.user?.id || null,
       payload ? JSON.stringify(payload) : null]
    );
  } catch (e) {
    console.error("[journal] log failed:", e.message);
  }
}

// Garde-fou : un :id non UUID part sinon en Postgres et ressort en 500 illisible
// la ou la commande est simplement introuvable.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Statut d'echeance : source unique de verite, jamais recalcule cote front.
// Meme vocabulaire et meme ordre de priorite que le statut des contrats, pour
// que StatutEcheanceBadge serve les deux ecrans sans adaptation.
const STATUT_ECHEANCE = `
  CASE
    WHEN c.date_fin IS NULL                              THEN 'perpetuel'
    WHEN c.date_fin < CURRENT_DATE                       THEN 'expire'
    WHEN c.a_renouveler                                  THEN 'a_renouveler'
    WHEN c.date_fin <= CURRENT_DATE + INTERVAL '90 days' THEN 'a_renouveler'
    ELSE 'actif'
  END AS statut_echeance`;

const SELECT_COMMANDE = `
  SELECT c.id, c.label, c.numero_devis, c.reference_interne,
         c.id_contrat,       ct.label         AS contrat_label,
         c.id_societe,       s.raison_sociale AS societe_label,
         c.id_revendeur,     r.raison_sociale AS revendeur_label,
         c.id_mode_commande, mc.code AS mode_code, mc.label AS mode_label,
         c.montant::float8 AS montant,
         c.date_commande::text AS date_commande,
         c.date_fin::text      AS date_fin,
         c.a_renouveler,
         ${STATUT_ECHEANCE},
         CASE WHEN c.date_fin IS NULL THEN NULL
              ELSE (c.date_fin - CURRENT_DATE) END AS jours_restants,
         c.created_at, c.updated_at,
         ${COLONNES_STATUT}
  FROM commande c
  LEFT JOIN contrat       ct ON ct.id = c.id_contrat
  LEFT JOIN societe       s  ON s.id  = c.id_societe
  LEFT JOIN revendeur     r  ON r.id  = c.id_revendeur
  LEFT JOIN mode_commande mc ON mc.id = c.id_mode_commande
  ${jointureStatut("commande", "c")}`;

const CHAMPS = [
  "label", "numero_devis", "reference_interne", "id_contrat", "id_societe",
  "id_revendeur", "id_mode_commande", "montant", "date_commande", "date_fin",
  "a_renouveler",
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
    reference_interne: vide(body.reference_interne),
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

  if (!label || !label.trim())
    return { status: 400, code: 3111, error: "Le libelle est obligatoire." };
  if (!id_contrat)
    return { status: 400, code: 3112, error: "Le contrat est obligatoire." };
  if (!(await existe(client, "contrat", id_contrat)))
    return { status: 400, code: 3113, error: "Contrat introuvable." };
  if (!id_societe)
    return { status: 400, code: 3114, error: "La societe acheteuse est obligatoire." };
  if (!(await existe(client, "societe", id_societe)))
    return { status: 400, code: 3115, error: "Societe acheteuse introuvable." };
  if (!(await existe(client, "revendeur", id_revendeur)))
    return { status: 400, code: 3116, error: "Revendeur introuvable." };
  if (!(await existe(client, "mode_commande", id_mode_commande)))
    return { status: 400, code: 3117, error: "Mode de commande introuvable." };
  if (montant === null || montant === undefined)
    return { status: 400, code: 3118, error: "Le montant est obligatoire." };
  // Couvre le zero, le negatif et la saisie non numerique d'un seul message :
  // dans les trois cas le montant n'est pas un montant valide.
  if (!Number.isFinite(montant) || montant <= 0)
    return { status: 400, code: 3119, error: "Le montant doit etre strictement positif." };
  if (!date_commande)
    return { status: 400, code: 3120, error: "La date de commande est obligatoire." };
  // Doublon volontaire de ck_commande_dates : la contrainte base produirait
  // une 23514 en 500, on veut un 400 lisible.
  if (date_fin && date_fin < date_commande)
    return { status: 400, code: 3121, error: "La date de fin doit etre posterieure a la date de commande." };
  return null;
}

// Bornes mensuelles d'une plage. Le precalcul etant mensuel, une plage au jour
// pres est servie au mois pres : les bornes reellement appliquees sont
// renvoyees dans la reponse, et le front filtre sa liste sur ces memes bornes.
// C'est ce qui garantit que liste, timeline et KPI ne peuvent pas diverger.
function moisEntre(debut, fin) {
  const out = [];
  let [a, m] = debut.split("-").map(Number);
  const [af, mf] = fin.split("-").map(Number);
  while (a < af || (a === af && m <= mf)) {
    out.push(`${a}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; a++; }
  }
  return out;
}

const MOIS_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/commandes", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(`${SELECT_COMMANDE} ORDER BY c.date_commande DESC NULLS LAST, c.label`);
    succes(res, 3100, rows);
  } catch (err) {
    console.error("GET /commandes error", err);
    erreur(res, 3199, { status: 500, message: "Erreur serveur" });
  }
});

// Agregats financiers, lus exclusivement dans precalcul_financier alimente par
// les triggers. Declaree avant /commandes/:id : sinon Express fait
// correspondre "agregats" au parametre et repond 404.
// Deux modes : annee civile, ou plage date_debut/date_fin pour les exercices
// fiscaux decales et les periodes glissantes du selecteur.
// Axes de filtrage : societe et editeur, les seuls portes par le precalcul.
// Ni contrat ni revendeur, qui n'existent qu'au niveau de la liste.
router.get("/commandes/agregats", async (req, res) => {
  try {
    const { annee, date_debut, date_fin, id_societe, id_editeur } = req.query;

    let moisDebut, moisFin;
    if (date_debut || date_fin) {
      if (!DATE_RE.test(date_debut || "") || !DATE_RE.test(date_fin || ""))
        return erreur(res, 3144, { status: 400, message: "La periode demandee est invalide." });
      moisDebut = date_debut.slice(0, 7);
      moisFin = date_fin.slice(0, 7);
      if (moisFin < moisDebut)
        return erreur(res, 3144, { status: 400, message: "La periode demandee est invalide." });
    } else {
      const an = annee ? Number(annee) : new Date().getFullYear();
      if (!Number.isInteger(an) || an < 1970 || an > 2999)
        return erreur(res, 3141, { status: 400, message: "L'annee demandee est invalide." });
      moisDebut = `${an}-01`;
      moisFin = `${an}-12`;
    }

    const societe = id_societe || null;
    if (societe && !UUID_RE.test(societe))
      return erreur(res, 3142, { status: 400, message: "Identifiant de societe invalide." });

    const editeur = id_editeur || null;
    if (editeur && !UUID_RE.test(editeur))
      return erreur(res, 3143, { status: 400, message: "Identifiant d'editeur invalide." });

    // Sommes en numeric cote SQL, cast en float8 a la sortie seulement :
    // additionner des flottants des le depart ferait deriver le centime.
    const { rows } = await tenantPool.query(
      `SELECT periode,
              sum(montant_commande)::float8     AS montant_commande,
              sum(montant_a_renouveler)::float8 AS montant_a_renouveler,
              sum(montant_paye)::float8         AS montant_paye,
              sum(nb_commandes)::int            AS nb_commandes,
              sum(nb_a_renouveler)::int         AS nb_a_renouveler
         FROM precalcul_financier
        WHERE periode BETWEEN $1 AND $2
          AND ($3::uuid IS NULL OR id_societe = $3::uuid)
          AND ($4::uuid IS NULL OR id_editeur = $4::uuid)
        GROUP BY periode`,
      [moisDebut, moisFin, societe, editeur]);

    const parPeriode = new Map(rows.map((r) => [r.periode, r]));
    const CLES = ["montant_commande", "montant_a_renouveler", "montant_paye",
                  "nb_commandes", "nb_a_renouveler"];

    // Tous les mois de la plage sont renvoyes, les mois sans commande a 0 :
    // le consommateur n'a pas a combler les trous d'une serie temporelle.
    const mois = moisEntre(moisDebut, moisFin).map((periode) => {
      const l = parPeriode.get(periode);
      const sortie = { periode, mois: Number(periode.slice(5)) };
      for (const c of CLES) sortie[c] = l ? l[c] : 0;
      return sortie;
    });

    // Totaux derives des mois, jamais requetes separement : ils sont ainsi
    // egaux a leur somme par construction. L'arrondi au centime absorbe le
    // residu binaire de l'addition flottante.
    const totaux = {};
    for (const c of CLES) totaux[c] = Math.round(mois.reduce((t, m) => t + m[c], 0) * 100) / 100;

    succes(res, 3140, {
      periode_debut: moisDebut,
      periode_fin: moisFin,
      filtres: { id_societe: societe, id_editeur: editeur },
      mois,
      totaux,
    });
  } catch (err) {
    console.error("GET /commandes/agregats error", err);
    erreur(res, 3199, { status: 500, message: "Erreur serveur" });
  }
});

// Detection des manques documentaires (#50). Vue temps reel, aucune ecriture :
// rien n'est stocke dans anomalie_qualite, l'etat se recalcule a chaque appel.
//
// Regle actee en session spec module 2, v0.5 : la completude se controle au
// niveau de la commande. Une commande est complete si elle porte au moins une
// facture (facture.id_commande) ET au moins une preuve rattachee directement a
// elle (preuve.id_commande).
//
// Les deux conditions se testent independamment, sans raccourci par la facture.
// Depuis la resolution E3, facture.id_preuve peut pointer une preuve qui n'est
// rattachee qu'au contrat : cette preuve la ne complete pas la commande, et
// passer par facture.id_preuve donnerait un faux complet. De meme, une preuve
// rattachee au seul contrat ne complete jamais la commande : choix v0.5 assume,
// a ne pas etendre sans nouvelle decision.
//
// Codes retour dans la plage documents 3280-3289 et non dans celle des
// commandes : la ressource est la commande mais la fonctionnalite appartient au
// module documents. Declaree avant /commandes/:id, sinon Express fait
// correspondre "manques" au parametre et repond 404.
router.get("/commandes/manques", async (req, res) => {
  try {
    const societe = req.query.id_societe || null;
    if (societe && !UUID_RE.test(societe))
      return erreur(res, 3281, { status: 400, message: "Identifiant de societe invalide." });

    const contrat = req.query.id_contrat || null;
    if (contrat && !UUID_RE.test(contrat))
      return erreur(res, 3282, { status: 400, message: "Identifiant de contrat invalide." });

    let annee = null;
    if (req.query.annee) {
      annee = Number(req.query.annee);
      if (!Number.isInteger(annee) || annee < 1970 || annee > 2999)
        return erreur(res, 3283, { status: 400, message: "L'annee demandee est invalide." });
    }

    // Deux anti-jointures, pas de boucle applicative.
    // MATERIALIZED n'est pas cosmetique : sans lui PostgreSQL inline le CTE et
    // evalue les deux NOT EXISTS quatre fois, une fois pour la colonne et une
    // fois pour le predicat, soit quatre parcours de facture et preuve au lieu
    // de deux. Mesure sur 5 000 commandes dont 4 000 completes : 318 ms sans le
    // mot-cle, 13 ms avec.
    // Les filtres sont appliques dans le CTE, avant le test de completude, pour
    // que le predicat ne s'evalue que sur le perimetre demande.
    const { rows } = await tenantPool.query(
      `WITH etat AS MATERIALIZED (
         SELECT c.id, c.label,
                c.id_contrat, ct.label         AS contrat_label,
                c.id_societe, s.raison_sociale AS societe_label,
                c.montant::float8     AS montant,
                c.date_commande::text AS date_commande,
                NOT EXISTS (SELECT 1 FROM facture f WHERE f.id_commande = c.id) AS facture_manquante,
                NOT EXISTS (SELECT 1 FROM preuve  p WHERE p.id_commande = c.id) AS preuve_manquante
           FROM commande c
           LEFT JOIN contrat ct ON ct.id = c.id_contrat
           LEFT JOIN societe s  ON s.id  = c.id_societe
          WHERE ($1::uuid IS NULL OR c.id_societe = $1::uuid)
            AND ($2::uuid IS NULL OR c.id_contrat = $2::uuid)
            AND ($3::int  IS NULL OR EXTRACT(YEAR FROM c.date_commande) = $3::int)
       )
       SELECT * FROM etat
        WHERE facture_manquante OR preuve_manquante
        ORDER BY date_commande DESC NULLS LAST, label`,
      [societe, contrat, annee]);

    // Compteurs derives des lignes renvoyees, jamais requetes separement : ils
    // ne peuvent ainsi pas diverger de la liste affichee.
    const total_sans_facture = rows.filter((r) => r.facture_manquante).length;
    const total_sans_preuve = rows.filter((r) => r.preuve_manquante).length;

    succes(res, 3280, {
      filtres: { id_societe: societe, id_contrat: contrat, annee },
      total: rows.length,
      total_sans_facture,
      total_sans_preuve,
      commandes: rows,
    });
  } catch (err) {
    console.error("GET /commandes/manques error", err);
    erreur(res, 3299, { status: 500, message: "Erreur serveur" });
  }
});


router.get("/commandes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (!UUID_RE.test(id)) return erreur(res, 3110, { status: 404, message: "Commande introuvable." });

    const { rows } = await tenantPool.query(`${SELECT_COMMANDE} WHERE c.id = $1`, [id]);
    if (!rows.length) return erreur(res, 3110, { status: 404, message: "Commande introuvable." });

    // Memes compteurs que le garde-fou de suppression : la fiche detail affiche
    // le nombre reel de rattachements sans dependre des modules non branches.
    const { rows: [liens] } = await tenantPool.query(
      `SELECT (SELECT count(*) FROM facture WHERE id_commande = $1)::int AS nb_factures,
              (SELECT count(*) FROM preuve  WHERE id_commande = $1)::int AS nb_preuves,
              (SELECT count(*) FROM licence WHERE id_commande = $1)::int AS nb_licences`,
      [id]);

    succes(res, 3101, { ...rows[0], ...liens });
  } catch (err) {
    console.error("GET /commandes/:id error", err);
    erreur(res, 3199, { status: 500, message: "Erreur serveur" });
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
      return erreurPivot(res, invalide);
    }

    const label = corps.label.trim();
    const { rows: [creee] } = await client.query(
      `INSERT INTO commande (${CHAMPS.join(", ")})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [label, corps.numero_devis, corps.reference_interne, corps.id_contrat,
       corps.id_societe, corps.id_revendeur, corps.id_mode_commande, corps.montant,
       corps.date_commande, corps.date_fin, corps.a_renouveler]
    );

    // Toute saisie part en attente de validation, dans la meme transaction que
    // l'ecriture metier.
    await soumettre(client, "commande", creee.id, req.user?.id);

    await log(client, req, "CREATE", "commande", creee.id, `Creation de la commande "${label}"`, corps);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_COMMANDE} WHERE c.id = $1`, [creee.id]);
    succes(res, 3102, rows[0], { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /commandes error", err);
    erreur(res, 3199, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/commandes/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return erreur(res, 3110, { status: 404, message: "Commande introuvable." });
    }

    // Dates lues en texte : validerCommande compare des chaines ISO, un objet
    // Date de pg fausserait la comparaison date_fin < date_commande.
    // Montant lu en float8 pour la meme raison, Number.isFinite refuserait une chaine.
    const { rows: existant } = await client.query(
      `SELECT label, numero_devis, id_contrat, id_societe, id_revendeur, id_mode_commande,
              montant::float8 AS montant, reference_interne,
              date_commande::text AS date_commande, date_fin::text AS date_fin,
              a_renouveler
       FROM commande WHERE id = $1`, [id]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      return erreur(res, 3110, { status: 404, message: "Commande introuvable." });
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
      return erreurPivot(res, invalide);
    }

    const label = corps.label.trim();
    await client.query(
      `UPDATE commande
          SET label = $1, numero_devis = $2, reference_interne = $3, id_contrat = $4,
              id_societe = $5, id_revendeur = $6, id_mode_commande = $7, montant = $8,
              date_commande = $9, date_fin = $10, a_renouveler = $11, updated_at = now()
        WHERE id = $12`,
      [label, corps.numero_devis, corps.reference_interne, corps.id_contrat,
       corps.id_societe, corps.id_revendeur, corps.id_mode_commande, corps.montant,
       corps.date_commande, corps.date_fin, corps.a_renouveler, id]
    );

    // Une modification est une saisie : retour en attente, motif de refus efface.
    await soumettre(client, "commande", id, req.user?.id);

    await log(client, req, "UPDATE", "commande", id, `Modification de la commande "${label}"`, patch);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_COMMANDE} WHERE c.id = $1`, [id]);
    succes(res, 3103, rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /commandes/:id error", err);
    erreur(res, 3199, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/commandes/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return erreur(res, 3110, { status: 404, message: "Commande introuvable." });
    }

    const { rows: existant } = await client.query(`SELECT label FROM commande WHERE id = $1`, [id]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      return erreur(res, 3110, { status: 404, message: "Commande introuvable." });
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
      return erreur(res, 3130, {
        status: 409,
        message: `Suppression impossible : cette commande porte ${bloquants.join(", ")}.`,
        details: liens,
      });
    }

    // workflow_validation.entite_id est polymorphe et sans FK : nettoyage
    // applicatif, dans la meme transaction que la suppression.
    await purgerValidations(client, "commande", id);
    await client.query(`DELETE FROM commande WHERE id = $1`, [id]);
    await log(client, req, "DELETE", "commande", id, `Suppression de la commande "${existant[0].label}"`, null);
    await client.query("COMMIT");
    succes(res, 3104, null);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /commandes/:id error", err);
    erreur(res, 3199, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
