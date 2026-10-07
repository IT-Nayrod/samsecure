// Complétude des fiches (US #324) : GET /completude/:type/:id sert les
// actions requises d'une fiche, GET /completude/resume les compteurs des
// listes et du dashboard. Lecture seule stricte : rien n'est écrit, pas même
// dans anomalie_qualite (c'est le rôle de GET /qualite) ; l'état se recalcule
// à chaque appel, comme la détection des manques de GET /commandes/manques.
//
// Ce routeur ne porte AUCUNE règle : il lit des faits en base et appelle le
// catalogue pur server/utils/completude.js. La fiche et le résumé passent par
// les mêmes collecteurs et les mêmes règles : les compteurs ne peuvent pas
// diverger du bloc « Actions requises ».
//
// Les lectures reprennent les définitions existantes, jamais une variante :
// facture et preuve d'une commande comme GET /commandes/manques (#50/#215),
// justificatif d'un contrat comme la détection qualité, statut d'affectation
// par jointureStatut, maintenance par etatMaintenance sur les périodes
// réelles, usage sans droit depuis precalcul_conformite (D53, héritage #216
// compris, même source que GET /qualite).
//
// Codes retour : plage complétude 5550-5559 (pré-catalogue
// server/docs/codes_retour.md ; seed Commune à jouer, voir le journal du
// chantier : un code absent du catalogue sort avec libelle null sans casser
// la réponse, reponse.js fait foi).
import express from "express";
import { tenantPool, commonPool } from "../db.js";
import { succes, erreur } from "../utils/reponse.js";
import { jointureStatut } from "../utils/validationWorkflow.js";
import { etatMaintenance } from "../utils/maintenanceLicence.js";
import {
  evaluerCompletude, compterGravites, compterResume, TYPES_COMPLETUDE,
} from "../utils/completude.js";

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Collecteurs de faits : un par type, bornés (jamais une requête par ligne).
// Chacun rend [{ id, label, ...faits }] ; avec un id, zéro ou une ligne.
// ---------------------------------------------------------------------------

// Mêmes lectures que GET /commandes/:id (compteurs) et GET /commandes/manques
// (#215 : la facture se lit sur le type documentaire de la preuve).
async function faitsCommandes(id = null) {
  const { rows } = await tenantPool.query(
    `SELECT c.id, c.label, c.montant::float8 AS montant,
            (SELECT count(*) FROM preuve p JOIN type_preuve tp ON tp.id = p.id_type_preuve
              WHERE p.id_commande = c.id AND tp.code = 'facture')::int AS nb_factures,
            (SELECT count(*) FROM preuve p WHERE p.id_commande = c.id)::int AS nb_preuves,
            (SELECT count(*) FROM licence l WHERE l.id_commande = c.id)::int AS nb_licences
       FROM commande c
      WHERE ($1::uuid IS NULL OR c.id = $1::uuid)`,
    [id]);
  return rows;
}

// a_justificatif : même triple lecture que la détection
// contrat_sans_justificatif de qualite.js (preuve directe, preuve ou facture
// d'une de ses commandes). nb_successeurs : même sous-requête que la
// projection des contrats (succession D35).
async function faitsContrats(id = null) {
  const { rows } = await tenantPool.query(
    `SELECT ct.id, ct.label, ct.archive, ct.id_societe,
            ct.date_fin::text AS date_fin,
            (SELECT count(*) FROM contrat cx WHERE cx.id_contrat_predecesseur = ct.id)::int AS nb_successeurs,
            (SELECT count(*) FROM commande c WHERE c.id_contrat = ct.id)::int AS nb_commandes,
            (EXISTS (SELECT 1 FROM preuve p WHERE p.id_contrat = ct.id)
             OR EXISTS (SELECT 1 FROM preuve p JOIN commande c ON c.id = p.id_commande
                         WHERE c.id_contrat = ct.id)
             OR EXISTS (SELECT 1 FROM facture f JOIN commande c ON c.id = f.id_commande
                         WHERE c.id_contrat = ct.id)) AS a_justificatif
       FROM contrat ct
      WHERE ($1::uuid IS NULL OR ct.id = $1::uuid)`,
    [id]);
  return rows;
}

// Trois lectures bornées : la licence et ses compteurs, les affectations
// groupées par licence (statut par jointureStatut, une affectation sans
// entrée vaut en_attente, même coalesce que qualite.js), puis les périodes de
// maintenance passées à la règle pure etatMaintenance (#201) : le statut
// `echue` servi ici est exactement celui du badge de la fiche licence.
async function faitsLicences(id = null) {
  const { rows: licences } = await tenantPool.query(
    `SELECT l.id, l.label, l.type, l.quantite, l.id_version, l.id_edition,
            l.date_fin_souscription::text  AS date_fin_souscription,
            l.date_arret_maintenance::text AS date_arret_maintenance,
            COALESCE(tl.version_geree, false) AS version_geree,
            (SELECT count(*) FROM licence sx WHERE sx.id_licence_predecesseur = l.id)::int AS nb_successeurs,
            (SELECT count(*) FROM preuve p WHERE p.id_licence = l.id)::int AS nb_preuves
       FROM licence l
       LEFT JOIN type_licence tl ON tl.code = l.type
      WHERE ($1::uuid IS NULL OR l.id = $1::uuid)`,
    [id]);
  if (!licences.length) return [];

  const ids = licences.map((l) => l.id);
  const [{ rows: usages }, { rows: periodes }] = await Promise.all([
    tenantPool.query(
      `SELECT a.id_licence,
              count(*)::int AS nb_affectations,
              count(*) FILTER (WHERE COALESCE(wv.statut_validation, 'en_attente') = 'en_attente')::int
                AS nb_affectations_en_attente
         FROM affectation a
         ${jointureStatut("affectation", "a")}
        WHERE a.id_licence = ANY($1)
        GROUP BY a.id_licence`,
      [ids]),
    tenantPool.query(
      `SELECT h.id_licence, h.date_debut::text AS date_debut,
              h.date_fin::text AS date_fin, h.created_at
         FROM maintenance_historique h
        WHERE h.id_licence = ANY($1)
        ORDER BY h.date_debut, h.created_at`,
      [ids]),
  ]);

  const usageParLicence = new Map(usages.map((u) => [u.id_licence, u]));
  const periodesParLicence = new Map();
  for (const p of periodes) {
    if (!periodesParLicence.has(p.id_licence)) periodesParLicence.set(p.id_licence, []);
    periodesParLicence.get(p.id_licence).push(p);
  }

  return licences.map((l) => {
    const u = usageParLicence.get(l.id);
    const { statut_maintenance } = etatMaintenance(l, periodesParLicence.get(l.id) ?? []);
    return {
      ...l,
      nb_affectations: u?.nb_affectations ?? 0,
      nb_affectations_en_attente: u?.nb_affectations_en_attente ?? 0,
      statut_maintenance,
    };
  });
}

// Droits et usages lus dans precalcul_conformite (alimentée par les triggers
// validés : droits_total porte l'héritage des composés #216), même source que
// la détection usage_sans_droit de qualite.js. La composition s'y joint pour
// couvrir un composé sans aucune licence. Le périmètre est l'union des deux :
// un logiciel sans ligne de précalcul ni composition n'a rien à signaler.
async function faitsLogiciels(id = null) {
  const { rows } = await tenantPool.query(
    `WITH compos AS (
       SELECT id_produit_compose AS id_produit, count(*)::int AS nb_composants
         FROM produit_composition
        GROUP BY id_produit_compose
     )
     SELECT COALESCE(pc.id_produit, co.id_produit) AS id,
            COALESCE(pc.droits_total, 0)::int AS droits,
            COALESCE(pc.usages_total, 0)::int AS usages,
            COALESCE(co.nb_composants, 0)::int AS nb_composants
       FROM precalcul_conformite pc
       FULL JOIN compos co ON co.id_produit = pc.id_produit
      WHERE COALESCE(pc.id_produit, co.id_produit) IS NOT NULL
        AND ($1::uuid IS NULL OR COALESCE(pc.id_produit, co.id_produit) = $1::uuid)`,
    [id]);
  return rows;
}

// Libellé d'un logiciel : catalogue Commune puis logiciels du client, lien
// logique sans jointure entre bases (même doctrine que resoudreCatalogue).
async function libelleLogiciel(id) {
  const { rows } = await commonPool.query(
    `SELECT label FROM produit_referentiel WHERE id = $1`, [id]);
  if (rows.length) return rows[0].label;
  const { rows: clients } = await tenantPool.query(
    `SELECT label FROM produit_client WHERE id = $1`, [id]);
  return clients.length ? clients[0].label : null;
}

async function faitsAffectations(id = null) {
  const { rows } = await tenantPool.query(
    `SELECT a.id, a.reference_client AS label,
            wv.statut_validation, wv.message_refus
       FROM affectation a
       ${jointureStatut("affectation", "a")}
      WHERE ($1::uuid IS NULL OR a.id = $1::uuid)`,
    [id]);
  return rows;
}

const COLLECTEURS = {
  commande: faitsCommandes,
  contrat: faitsContrats,
  licence: faitsLicences,
  logiciel: faitsLogiciels,
  affectation: faitsAffectations,
};

const INTROUVABLES = {
  commande: "Commande introuvable.",
  contrat: "Contrat introuvable.",
  licence: "Licence introuvable.",
  logiciel: "Logiciel introuvable.",
  affectation: "Affectation introuvable.",
};

// ---------------------------------------------------------------------------
// GET /completude/resume : compteurs par type pour les listes et le dashboard.
// Chemin littéral déclaré avant /completude/:type/:id, sinon Express ferait
// correspondre "resume" au paramètre.
// ---------------------------------------------------------------------------
router.get("/completude/resume", async (req, res) => {
  try {
    const types = {};
    for (const type of TYPES_COMPLETUDE) {
      const faits = await COLLECTEURS[type](null);
      types[type] = compterResume(faits.map((f) => evaluerCompletude(type, f)));
    }
    succes(res, 5551, { genere_le: new Date().toISOString(), types });
  } catch (err) {
    console.error("GET /completude/resume error", err);
    erreur(res, 5559, { status: 500, message: "Erreur serveur" });
  }
});

// ---------------------------------------------------------------------------
// GET /completude/:type/:id : actions requises d'une fiche. Le bloc front
// (ActionsRequises.jsx) n'affiche rien quand manques est vide.
// ---------------------------------------------------------------------------
router.get("/completude/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  try {
    if (!TYPES_COMPLETUDE.includes(type)) {
      return erreur(res, 5552, {
        status: 400,
        message: `Type de fiche inconnu pour la complétude : ${type}.`,
      });
    }
    if (!UUID_RE.test(id)) {
      return erreur(res, 5553, { status: 404, message: INTROUVABLES[type] });
    }

    let faits = (await COLLECTEURS[type](id))[0] ?? null;
    let label = faits?.label ?? null;

    // Un logiciel peut exister sans ligne de précalcul ni composition : la
    // fiche est alors simplement complète, pas introuvable. L'existence se
    // vérifie sur les deux origines (catalogue Commune, produit_client).
    if (type === "logiciel") {
      label = await libelleLogiciel(id);
      if (label === null) {
        return erreur(res, 5553, { status: 404, message: INTROUVABLES[type] });
      }
      faits = faits ?? { id, droits: 0, usages: 0, nb_composants: 0 };
    } else if (!faits) {
      return erreur(res, 5553, { status: 404, message: INTROUVABLES[type] });
    }

    const manques = evaluerCompletude(type, faits);
    succes(res, 5550, { type, id, label, manques, ...compterGravites(manques) });
  } catch (err) {
    console.error("GET /completude/:type/:id error", err);
    erreur(res, 5559, { status: 500, message: "Erreur serveur" });
  }
});

export default router;
