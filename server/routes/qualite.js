// Qualite des saisies et indice de confiance (US #116, module 3).
// Enveloppe normalisee, codes 5400-5449 (migration 044).
//
// GET /qualite : detection a la volee, sans precalcul, croisee avec
// anomalie_qualite. Une anomalie marquee resolue (resolution reelle ou faux
// positif, la table ne distingue pas : resolu = true couvre les deux) exclut
// l'element meme s'il est encore detecte ; une anomalie deja ouverte est
// servie sans doublon ; une detection nouvelle est inseree avec son type, sa
// gravite et sa description, dans la transaction de la lecture. C'est la
// seule ecriture de ce routeur, et elle alimente la composante coherence de
// l'indice de confiance.
//
// GET /confiance : note sur 100 par perimetre (tenant ou societe), ponderee
// par la valeur (cout des licences actives). Le calcul est porte par la
// fonction pure server/utils/indiceConfiance.js, testee au node:test ; ce
// routeur ne fait que lire les faits en base.
import express from "express";
import { tenantPool, commonPool } from "../db.js";
import { succes, erreur } from "../utils/reponse.js";
import { permissionsEffectives } from "../utils/droitsUtilisateur.js";
import { jointureStatut } from "../utils/validationWorkflow.js";
import { jointureRevalidation } from "../utils/revalidation.js";
import { LICENCE_EXPIREE } from "../utils/conformite.js";
import { calculerIndiceConfiance } from "../utils/indiceConfiance.js";

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// GET /qualite : detections
// ---------------------------------------------------------------------------

// Types de ce producteur. Le vocabulaire complete celui pose par contrats.js
// (incoherence, hors_plage_parent) et inventaire.js (ligne_import) : ces
// anomalies-la ont leurs propres producteurs et ne sont pas reservies ici.
const TYPES_DETECTION = [
  "licence_sans_contrat", "contrat_sans_justificatif", "commande_sans_preuve",
  "doublon_affectation", "doublon_produit", "champ_obligatoire_vide",
];

const ORDRE_GRAVITE = { critique: 0, attention: 1, info: 2 };

// Chaque detection rend des elements { type_anomalie, gravite, entite_type,
// entite_id, libelle, description }. Les requetes sont bornees : une par
// famille, jamais une par ligne.
async function detecterLicencesSansContrat(client) {
  const { rows } = await client.query(
    `SELECT l.id, coalesce(l.label, 'licence sans libellé') AS libelle,
            (l.id_commande IS NULL) AS sans_commande
       FROM licence l
       LEFT JOIN commande c ON c.id = l.id_commande
      WHERE l.id_commande IS NULL OR c.id_contrat IS NULL`);
  return rows.map((r) => ({
    type_anomalie: "licence_sans_contrat",
    gravite: "attention",
    entite_type: "licence",
    entite_id: r.id,
    libelle: r.libelle,
    description: r.sans_commande
      ? `Licence "${r.libelle}" sans contrat : aucune commande rattachée`
      : `Licence "${r.libelle}" sans contrat : sa commande n'est rattachée à aucun contrat`,
  }));
}

async function detecterContratsSansJustificatif(client) {
  const { rows } = await client.query(
    `SELECT ct.id, ct.label AS libelle
       FROM contrat ct
      WHERE ct.archive = false
        AND NOT EXISTS (SELECT 1 FROM facture f JOIN commande c ON c.id = f.id_commande
                         WHERE c.id_contrat = ct.id)
        AND NOT EXISTS (SELECT 1 FROM preuve p WHERE p.id_contrat = ct.id)
        AND NOT EXISTS (SELECT 1 FROM preuve p JOIN commande c ON c.id = p.id_commande
                         WHERE c.id_contrat = ct.id)`);
  return rows.map((r) => ({
    type_anomalie: "contrat_sans_justificatif",
    gravite: "attention",
    entite_type: "contrat",
    entite_id: r.id,
    libelle: r.libelle,
    description: `Contrat "${r.libelle}" sans facture ni preuve rattachée`,
  }));
}

async function detecterCommandesSansPreuve(client) {
  const { rows } = await client.query(
    `SELECT c.id, c.label AS libelle
       FROM commande c
      WHERE NOT EXISTS (SELECT 1 FROM preuve p WHERE p.id_commande = c.id)`);
  return rows.map((r) => ({
    type_anomalie: "commande_sans_preuve",
    gravite: "attention",
    entite_type: "commande",
    entite_id: r.id,
    libelle: r.libelle,
    description: `Commande "${r.libelle}" sans preuve rattachée`,
  }));
}

// Doublon potentiel : meme reference client (casse et espaces ignores) et
// meme produit, saisies non refusees. La premiere declaration fait foi, les
// suivantes sont signalees : pas de deduplication dans le decompte (regle
// 4106), le doublon est un signal de qualite, jamais une correction.
async function detecterDoublonsAffectation(client) {
  const { rows } = await client.query(
    `SELECT a.id, a.reference_client AS libelle,
            l.id_produit, lower(btrim(a.reference_client)) AS ref,
            a.created_at
       FROM affectation a
       JOIN licence l ON l.id = a.id_licence
       ${jointureStatut("affectation", "a")}
      WHERE a.reference_client IS NOT NULL AND btrim(a.reference_client) <> ''
        AND l.id_produit IS NOT NULL
        AND coalesce(wv.statut_validation, 'en_attente') <> 'refuse'
      ORDER BY a.created_at, a.id`);
  const groupes = new Map();
  for (const r of rows) {
    const cle = `${r.id_produit}|${r.ref}`;
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(r);
  }
  const elements = [];
  for (const groupe of groupes.values()) {
    if (groupe.length < 2) continue;
    for (const r of groupe.slice(1)) {
      elements.push({
        type_anomalie: "doublon_affectation",
        gravite: "attention",
        entite_type: "affectation",
        entite_id: r.id,
        libelle: r.libelle,
        description: `Référence "${r.libelle}" déclarée ${groupe.length} fois pour le même produit`,
      });
    }
  }
  return elements;
}

// Doublon potentiel de produit : logiciels client en double entre eux, ou
// portant le libelle d'un produit du catalogue commun. Le croisement avec la
// BDD Commune est applicatif : aucune jointure ne traverse les deux bases.
async function detecterDoublonsProduit(client) {
  const { rows } = await client.query(
    `SELECT id, label, lower(btrim(label)) AS ref, created_at
       FROM produit_client
      ORDER BY created_at, id`);
  if (!rows.length) return [];

  const { rows: communs } = await commonPool.query(
    `SELECT DISTINCT lower(btrim(label)) AS ref FROM produit_referentiel
      WHERE lower(btrim(label)) = ANY($1)`,
    [[...new Set(rows.map((r) => r.ref))]]);
  const auCatalogue = new Set(communs.map((r) => r.ref));

  const vus = new Set();
  const elements = [];
  for (const r of rows) {
    if (auCatalogue.has(r.ref)) {
      elements.push({
        type_anomalie: "doublon_produit",
        gravite: "info",
        entite_type: "produit_client",
        entite_id: r.id,
        libelle: r.label,
        description: `Le logiciel "${r.label}" existe déjà au catalogue commun`,
      });
    } else if (vus.has(r.ref)) {
      elements.push({
        type_anomalie: "doublon_produit",
        gravite: "info",
        entite_type: "produit_client",
        entite_id: r.id,
        libelle: r.label,
        description: `Le logiciel "${r.label}" existe en double dans le référentiel client`,
      });
    }
    vus.add(r.ref);
  }
  return elements;
}

// Champs obligatoires vides : les obligatoires de chaque formulaire (regles
// des routeurs #41, #44, #102, #106), sur des lignes qui peuvent leur etre
// anterieures. Une anomalie par entite, les champs manquants dans la
// description.
async function detecterChampsVides(client) {
  const familles = [
    {
      entite: "contrat",
      sql: `SELECT id, label AS libelle,
                   (id_type_contrat IS NULL) AS m1, (id_editeur IS NULL) AS m2,
                   (id_societe IS NULL) AS m3, (date_debut IS NULL) AS m4
              FROM contrat
             WHERE archive = false
               AND (id_type_contrat IS NULL OR id_editeur IS NULL
                    OR id_societe IS NULL OR date_debut IS NULL)`,
      champs: ["type de contrat", "éditeur", "société signataire", "date de début"],
    },
    {
      entite: "commande",
      sql: `SELECT id, label AS libelle,
                   (id_contrat IS NULL) AS m1, (id_societe IS NULL) AS m2,
                   (montant IS NULL) AS m3, (date_commande IS NULL) AS m4
              FROM commande
             WHERE id_contrat IS NULL OR id_societe IS NULL
                OR montant IS NULL OR date_commande IS NULL`,
      champs: ["contrat", "société payeuse", "montant", "date de commande"],
    },
    {
      entite: "licence",
      sql: `SELECT id, coalesce(label, 'licence sans libellé') AS libelle,
                   (id_produit IS NULL) AS m1
              FROM licence
             WHERE id_produit IS NULL`,
      champs: ["produit"],
    },
    {
      entite: "affectation",
      sql: `SELECT id, coalesce(nullif(btrim(coalesce(reference_client, '')), ''),
                                'affectation sans référence') AS libelle,
                   (id_societe IS NULL) AS m1,
                   (reference_client IS NULL OR btrim(reference_client) = '') AS m2
              FROM affectation
             WHERE id_societe IS NULL
                OR reference_client IS NULL OR btrim(reference_client) = ''`,
      champs: ["société", "référence client"],
    },
  ];

  const elements = [];
  for (const f of familles) {
    const { rows } = await client.query(f.sql);
    for (const r of rows) {
      const manquants = f.champs.filter((_, i) => r[`m${i + 1}`]);
      elements.push({
        type_anomalie: "champ_obligatoire_vide",
        gravite: "info",
        entite_type: f.entite,
        entite_id: r.id,
        libelle: r.libelle,
        description: `Champs obligatoires vides sur ${f.entite} "${r.libelle}" : ${manquants.join(", ")}`,
      });
    }
  }
  return elements;
}

router.get("/qualite", async (req, res) => {
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const detectes = [
      ...(await detecterLicencesSansContrat(client)),
      ...(await detecterContratsSansJustificatif(client)),
      ...(await detecterCommandesSansPreuve(client)),
      ...(await detecterDoublonsAffectation(client)),
      ...(await detecterDoublonsProduit(client)),
      ...(await detecterChampsVides(client)),
    ];

    // Croisement avec le stock : une seule requete pour tout l'etat connu.
    const { rows: connues } = await client.query(
      `SELECT entite_type, entite_id, type_anomalie,
              bool_or(NOT resolu) AS ouverte, bool_or(resolu) AS resolue
         FROM anomalie_qualite
        WHERE type_anomalie = ANY($1)
        GROUP BY entite_type, entite_id, type_anomalie`,
      [TYPES_DETECTION]);
    const etat = new Map(connues.map((r) =>
      [`${r.entite_type}|${r.entite_id}|${r.type_anomalie}`, r]));

    const elements = [];
    for (const e of detectes) {
      const connu = etat.get(`${e.entite_type}|${e.entite_id}|${e.type_anomalie}`);
      // Resolue sans reouverture = traitee ou faux positif : exclue.
      if (connu && connu.resolue && !connu.ouverte) continue;
      elements.push(e);
      if (!connu) {
        await client.query(
          `INSERT INTO anomalie_qualite (entite_type, entite_id, type_anomalie, gravite, description)
           VALUES ($1, $2, $3, $4, $5)`,
          [e.entite_type, e.entite_id, e.type_anomalie, e.gravite,
           e.description.slice(0, 2000)]);
      }
    }
    await client.query("COMMIT");

    elements.sort((a, b) =>
      (ORDRE_GRAVITE[a.gravite] ?? 9) - (ORDRE_GRAVITE[b.gravite] ?? 9)
      || a.type_anomalie.localeCompare(b.type_anomalie)
      || String(a.libelle).localeCompare(String(b.libelle), "fr"));

    const parType = {};
    for (const e of elements) parType[e.type_anomalie] = (parType[e.type_anomalie] || 0) + 1;

    succes(res, 5400, { total: elements.length, par_type: parType, elements });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("GET /qualite error", err);
    erreur(res, 5449, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// GET /confiance
// ---------------------------------------------------------------------------

router.get("/confiance", async (req, res) => {
  try {
    const idSociete = req.query.id_societe || null;
    if (idSociete && !UUID_RE.test(idSociete)) {
      return erreur(res, 5410, { status: 400, message: "Identifiant de societe invalide." });
    }

    // Licences actives du perimetre (societe payeuse via la commande), avec
    // leurs 4 liens d'exhaustivite et la presence d'une anomalie ouverte sur
    // la licence ou sa chaine (commande, contrat) : un objet multi-anomalies
    // ne compte qu'une fois, l'EXISTS s'en charge.
    const { rows: licences } = await tenantPool.query(
      `SELECT l.id,
              coalesce(l.cout_licence, 0)::float8 AS valeur,
              (l.id_commande IS NOT NULL) AS a_commande,
              (c.id_contrat IS NOT NULL)  AS a_contrat,
              (ct.id_societe IS NOT NULL) AS a_societe_signataire,
              (EXISTS (SELECT 1 FROM facture f WHERE f.id_commande = l.id_commande)
               OR EXISTS (SELECT 1 FROM preuve p WHERE p.id_commande = l.id_commande)
               OR EXISTS (SELECT 1 FROM preuve p2 WHERE p2.id_contrat = c.id_contrat))
                AS a_justificatif,
              EXISTS (SELECT 1 FROM anomalie_qualite aq
                       WHERE aq.resolu = false
                         AND ((aq.entite_type = 'licence'  AND aq.entite_id = l.id)
                           OR (aq.entite_type = 'commande' AND aq.entite_id = l.id_commande)
                           OR (aq.entite_type = 'contrat'  AND aq.entite_id = c.id_contrat)))
                AS a_anomalie
         FROM licence l
         LEFT JOIN commande c ON c.id = l.id_commande
         LEFT JOIN contrat ct ON ct.id = c.id_contrat
        WHERE NOT ${LICENCE_EXPIREE}
          AND ($1::uuid IS NULL OR c.id_societe = $1::uuid)`,
      [idSociete]);

    // Affectations validees du perimetre (societe declarante), licences
    // actives seulement : la ponderation est le cout des licences actives.
    // Valeur d'une affectation : sa quantite au prix unitaire de sa licence.
    // Fraiche = echeance de revalidation non depassee ; une affectation
    // validee sans echeance (cas residuel) reste fraiche.
    const { rows: affectations } = await tenantPool.query(
      `SELECT a.id,
              CASE WHEN l.quantite > 0 AND l.cout_licence IS NOT NULL
                   THEN round(a.quantite * l.cout_licence / l.quantite, 2)::float8
                   ELSE 0 END AS valeur,
              (rv.date_prochaine_revalidation IS NULL
               OR rv.date_prochaine_revalidation >= CURRENT_DATE) AS fraiche
         FROM affectation a
         JOIN licence l ON l.id = a.id_licence
         ${jointureStatut("affectation", "a")}
         ${jointureRevalidation("a")}
        WHERE wv.statut_validation = 'valide'
          AND NOT ${LICENCE_EXPIREE}
          AND ($1::uuid IS NULL OR a.id_societe = $1::uuid)`,
      [idSociete]);

    const resultat = calculerIndiceConfiance({ licences, affectations });

    // valeur_totale est un montant : meme regle de masquage que les couts du
    // module licences. Les notes et les points de malus restent servis, ce
    // sont des indices et non des montants.
    const { permissions } = await permissionsEffectives(req.user.id);
    const visibles = permissions.has("consulter_kpi_financiers");
    succes(res, 5401, {
      filtres: { id_societe: idSociete },
      ...resultat,
      valeur_totale: visibles ? resultat.valeur_totale : null,
      montants_masques: !visibles,
    });
  } catch (err) {
    console.error("GET /confiance error", err);
    erreur(res, 5449, { status: 500, message: "Erreur serveur" });
  }
});

export default router;
