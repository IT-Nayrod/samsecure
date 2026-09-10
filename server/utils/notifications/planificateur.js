// Planificateur du module notifications (story #121).
//
// Deux passages quotidiens, heure de Paris :
//   - 7 h    : traitement quotidien (echeances de contrats et de
//              souscriptions, revalidations echues, conformite, budget), purge
//              bornee, puis envoi des courriers immediats produits ;
//   - 7 h 30 : recapitulatif quotidien (un courrier par utilisateur).
// Rattrapage au demarrage : si l'heure est passee et que le traitement du
// jour n'a pas tourne, il est lance apres un court delai. Declenchement manuel
// par POST /notifications/executer-planification (Admin SAM).
//
// Verrou journalier : une ligne tache_asynchrone par type et par jour (index
// unique partiel de la 051). Une execution reussie n'est jamais rejouee ; une
// execution echouee l'est au demarrage suivant ou a la main.
//
// Aucun timer ne bloque le serveur : un echec de passage est trace dans
// log_serveur et le passage suivant est planifie normalement.
import { tenantPool, commonPool } from "../../db.js";
import { seuilsConformite } from "../conformite.js";
import { jointureStatut } from "../validationWorkflow.js";
import { jointureRevalidation } from "../revalidation.js";
import { PALIER_SOUSCRIPTION, SEUIL_BUDGET_DEFAUT } from "./catalogue.js";
import {
  cleEvenement, paliersDepuisSeuils, palierAtteint, prochaineOccurrence, heurePassee, dateParis,
  echeanceNotifiable,
} from "./regles.js";
import { creerNotification, nouveauContexte, libellesProduits, tracer } from "./moteur.js";
import { envoyerImmediats, envoyerRecapitulatifs } from "./courriers.js";

export const HEURE_TRAITEMENT = { heure: 7, minute: 0 };
export const HEURE_RECAPITULATIF = { heure: 7, minute: 30 };
const DELAI_RATTRAPAGE_MS = 20000;

// ---------------------------------------------------------------------------
// Seuils du tenant (seuil_dashboard) puis defaut Commune (default_seuil_dashboard)
// ---------------------------------------------------------------------------

async function seuilsWidget(widgetCode) {
  const lire = (pool, table) => pool.query(
    `SELECT echelle, valeur::float8 AS valeur, unite, direction FROM ${table}
      WHERE widget_code = $1 ORDER BY echelle`, [widgetCode]);
  const { rows: tenant } = await lire(tenantPool, "seuil_dashboard");
  if (tenant.length) return tenant;
  try {
    const { rows: commun } = await lire(commonPool, "default_seuil_dashboard");
    return commun;
  } catch (err) {
    console.error("[notifications] default_seuil_dashboard illisible", err.message);
    return [];
  }
}

async function seuilBudget() {
  const seuils = await seuilsWidget("budget_taux_engagement");
  const s = seuils.find((x) => x.echelle === 1);
  return s && Number.isFinite(s.valeur) && s.valeur > 0 ? s.valeur : SEUIL_BUDGET_DEFAUT;
}

// ---------------------------------------------------------------------------
// Detections. Chacune renvoie le nombre de notifications creees.
// ---------------------------------------------------------------------------

// 1. Echeances de contrats : contrats actifs (non archives, commences), un
//    palier a la fois (le plus serre atteint), cle par contrat et palier.
//    Continuite (D35) : un contrat renouvele par un successeur
//    (id_contrat_predecesseur, migration 056) n'est plus notifie.
export async function detecterEcheancesContrats(contexte) {
  const paliers = paliersDepuisSeuils(await seuilsWidget("echeances-contrats"));
  const horizon = Math.max(...paliers);
  const { rows } = await tenantPool.query(
    `SELECT c.id, c.label, c.date_fin::text AS date_fin,
            (c.date_fin - CURRENT_DATE)::int AS jours_restants,
            c.id_societe, s.raison_sociale AS societe_label,
            (SELECT count(*) FROM contrat sx WHERE sx.id_contrat_predecesseur = c.id)::int AS nb_successeurs
       FROM contrat c
       LEFT JOIN societe s ON s.id = c.id_societe
      WHERE c.archive = false
        AND c.date_fin IS NOT NULL
        AND c.date_fin >= CURRENT_DATE
        AND c.date_fin <= CURRENT_DATE + $1::int
        AND (c.date_debut IS NULL OR c.date_debut <= CURRENT_DATE)`,
    [horizon]);
  let crees = 0;
  for (const c of rows) {
    if (!echeanceNotifiable(c.nb_successeurs)) continue;
    const palier = palierAtteint(c.jours_restants, paliers);
    if (palier === null) continue;
    const r = await creerNotification(null, {
      type: "echeance_contrat",
      cle: cleEvenement("echeance_contrat", c.id, palier),
      id_societe: c.id_societe,
      entite_type: "contrat", entite_id: c.id,
      donnees: {
        id_contrat: c.id, label: c.label, date_fin: c.date_fin,
        jours_restants: c.jours_restants, palier, societe_label: c.societe_label,
      },
    }, contexte);
    crees += r.crees;
  }
  return crees;
}

// 2. Echeances de souscriptions : 30 jours avant la fin, un seul palier.
//    Continuite (D35) : une licence renouvelee par un successeur
//    (id_licence_predecesseur, migration 056) n'est plus notifiee.
export async function detecterEcheancesSouscriptions(contexte) {
  const { rows } = await tenantPool.query(
    `SELECT l.id, l.label, l.id_produit, l.quantite,
            l.date_fin_souscription::text AS date_fin,
            (l.date_fin_souscription - CURRENT_DATE)::int AS jours_restants,
            c.id_societe, s.raison_sociale AS societe_label,
            (SELECT count(*) FROM licence sx WHERE sx.id_licence_predecesseur = l.id)::int AS nb_successeurs
       FROM licence l
       LEFT JOIN commande c ON c.id = l.id_commande
       LEFT JOIN societe  s ON s.id = c.id_societe
      WHERE l.type = 'souscription'
        AND l.date_fin_souscription IS NOT NULL
        AND l.date_fin_souscription >= CURRENT_DATE
        AND l.date_fin_souscription <= CURRENT_DATE + $1::int`,
    [PALIER_SOUSCRIPTION]);
  const produits = await libellesProduits(rows.map((r) => r.id_produit));
  let crees = 0;
  for (const l of rows) {
    if (!echeanceNotifiable(l.nb_successeurs)) continue;
    const p = produits.get(l.id_produit);
    const r = await creerNotification(null, {
      type: "echeance_souscription",
      cle: cleEvenement("echeance_souscription", l.id, PALIER_SOUSCRIPTION),
      id_societe: l.id_societe,
      entite_type: "licence", entite_id: l.id,
      donnees: {
        id_licence: l.id, label: l.label, produit_label: p?.label || null,
        quantite: l.quantite, date_fin: l.date_fin, jours_restants: l.jours_restants,
        societe_label: l.societe_label,
      },
    }, contexte);
    crees += r.crees;
  }
  return crees;
}

// 3. Revalidations echues : affectations validees dont l'echeance du cycle
//    est passee, une notification par cycle (cle affectation + echeance).
export async function detecterRevalidationsEchues(contexte) {
  const { rows } = await tenantPool.query(
    `SELECT a.id, a.label, a.reference_client, a.quantite, a.id_societe,
            s.raison_sociale AS societe_label,
            l.label AS licence_label, l.id_produit,
            rv.date_prochaine_revalidation::text AS date_prochaine,
            (CURRENT_DATE - rv.date_prochaine_revalidation)::int AS jours_retard
       FROM affectation a
       LEFT JOIN licence  l ON l.id = a.id_licence
       LEFT JOIN societe  s ON s.id = a.id_societe
       ${jointureStatut("affectation", "a")}
       ${jointureRevalidation("a")}
      WHERE wv.statut_validation = 'valide'
        AND rv.date_prochaine_revalidation IS NOT NULL
        AND rv.date_prochaine_revalidation < CURRENT_DATE`);
  const produits = await libellesProduits(rows.map((r) => r.id_produit));
  let crees = 0;
  for (const a of rows) {
    const p = produits.get(a.id_produit);
    const r = await creerNotification(null, {
      type: "revalidation_echue",
      cle: cleEvenement("revalidation_echue", a.id, a.date_prochaine),
      id_societe: a.id_societe,
      entite_type: "affectation", entite_id: a.id,
      donnees: {
        id_affectation: a.id, label: a.label, reference_client: a.reference_client,
        quantite: a.quantite, id_societe: a.id_societe, societe_label: a.societe_label,
        licence_label: a.licence_label, produit_label: p?.label || null,
        date_prochaine: a.date_prochaine, jours_retard: a.jours_retard,
      },
    }, contexte);
    crees += r.crees;
  }
  return crees;
}

// 4. Conformite : produits en depassement, ou ecart valorise negatif au-dela
//    du seuil en euros (precalcul_conformite, alimente par les triggers 046).
//    Cle par produit et jour de derniere mise a jour du precalcul : un
//    produit qui reste en depassement sans nouveau calcul n'est pas
//    renotifie ; un nouveau calcul dans la journee ne l'est pas non plus.
export async function detecterDepassementsConformite(contexte) {
  const { seuilMontant } = await seuilsConformite();
  const { rows } = await tenantPool.query(
    `SELECT pc.id_produit, pc.droits_total, pc.usages_total, pc.ecart,
            pc.ecart_valorise::float8 AS ecart_valorise, pc.statut_conformite,
            pc.derniere_maj::date::text AS jour_maj
       FROM precalcul_conformite pc
      WHERE pc.id_produit IS NOT NULL
        AND (pc.statut_conformite = 'depassement'
             OR (pc.ecart_valorise IS NOT NULL AND pc.ecart_valorise < 0
                 AND abs(pc.ecart_valorise) >= $1))`,
    [seuilMontant]);
  const produits = await libellesProduits(rows.map((r) => r.id_produit));
  let crees = 0;
  for (const pc of rows) {
    const p = produits.get(pc.id_produit);
    const r = await creerNotification(null, {
      type: "depassement_conformite",
      cle: cleEvenement("depassement_conformite", pc.id_produit, pc.jour_maj),
      id_societe: null,
      entite_type: "produit", entite_id: pc.id_produit,
      donnees: {
        id_produit: pc.id_produit, produit_label: p?.label || null, editeur_label: p?.editeur_label || null,
        droits: pc.droits_total, usages: pc.usages_total, ecart: pc.ecart,
        ecart_valorise: pc.ecart_valorise, statut: pc.statut_conformite,
        seuil_montant: seuilMontant,
      },
    }, contexte);
    crees += r.crees;
  }
  return crees;
}

// 5. Budget : taux d'engagement (engage / alloue) de chaque societe payeuse
//    sur son exercice courant, au-dela du seuil. Alloue = lignes "alloue"
//    recoupant l'exercice ; engage = precalcul_financier sur ses mois (meme
//    source que GET /budget/synthese). Cle par societe, exercice et seuil.
export async function detecterBudgetSeuils(contexte) {
  const seuil = await seuilBudget();
  const { rows } = await tenantPool.query(
    `WITH tc AS (
       SELECT COALESCE((SELECT debut_exercice_fiscal_defaut FROM tenant_config LIMIT 1), DATE '2000-01-01') AS debut
     ), soc AS (
       SELECT s.id, s.raison_sociale,
              COALESCE(s.debut_exercice_fiscal, tc.debut) AS debut
         FROM societe s CROSS JOIN tc
        WHERE s.actif = true AND s.date_suppression IS NULL
     ), bornes AS (
       SELECT id, raison_sociale,
              exercice_fiscal_de(CURRENT_DATE, debut) AS exercice,
              exercice_fiscal_debut(exercice_fiscal_de(CURRENT_DATE, debut), debut) AS d_debut,
              exercice_fiscal_fin(exercice_fiscal_de(CURRENT_DATE, debut), debut)   AS d_fin
         FROM soc
     ), alloue AS (
       SELECT c.id_societe,
              sum(COALESCE(b.montant_capex, 0) + COALESCE(b.montant_opex, 0))::float8 AS alloue
         FROM budget b
         JOIN licence  l  ON l.id = b.id_licence
         JOIN commande c  ON c.id = l.id_commande
         JOIN bornes   bo ON bo.id = c.id_societe
        WHERE b.type = 'alloue'
          AND b.date_debut <= bo.d_fin AND b.date_fin >= bo.d_debut
        GROUP BY c.id_societe
     ), engage AS (
       SELECT pf.id_societe, sum(pf.montant_commande)::float8 AS engage
         FROM precalcul_financier pf
         JOIN bornes bo ON bo.id = pf.id_societe
        WHERE pf.periode BETWEEN to_char(bo.d_debut, 'YYYY-MM') AND to_char(bo.d_fin, 'YYYY-MM')
        GROUP BY pf.id_societe
     )
     SELECT bo.id AS id_societe, bo.raison_sociale AS societe_label, bo.exercice,
            a.alloue, COALESCE(e.engage, 0) AS engage,
            round((COALESCE(e.engage, 0) / a.alloue * 100)::numeric, 2)::float8 AS taux
       FROM bornes bo
       JOIN alloue a ON a.id_societe = bo.id
       LEFT JOIN engage e ON e.id_societe = bo.id
      WHERE a.alloue > 0
        AND COALESCE(e.engage, 0) / a.alloue * 100 >= $1`,
    [seuil]);
  let crees = 0;
  for (const b of rows) {
    const r = await creerNotification(null, {
      type: "budget_seuil",
      cle: cleEvenement("budget_seuil", b.id_societe, b.exercice, seuil),
      id_societe: b.id_societe,
      entite_type: "societe", entite_id: b.id_societe,
      donnees: {
        id_societe: b.id_societe, societe_label: b.societe_label, exercice: b.exercice,
        taux: b.taux, seuil, alloue: b.alloue, engage: b.engage,
      },
    }, contexte);
    crees += r.crees;
  }
  return crees;
}

// ---------------------------------------------------------------------------
// Verrou journalier (tache_asynchrone)
// ---------------------------------------------------------------------------

async function prendreVerrou(type, jour, declencheur) {
  const { rows } = await tenantPool.query(
    `INSERT INTO tache_asynchrone (type, statut, payload, tentatives)
     VALUES ($1, 'en_cours', $2::jsonb, 1)
     ON CONFLICT (type, (payload->>'date')) WHERE type LIKE 'notifications_%'
     DO UPDATE SET statut = 'en_cours',
                   tentatives = tache_asynchrone.tentatives + 1,
                   payload = tache_asynchrone.payload || $2::jsonb
           WHERE tache_asynchrone.statut = 'echec'
     RETURNING id`,
    [type, JSON.stringify({ date: jour, declencheur })]);
  return rows[0]?.id || null;
}

async function libererVerrou(id, statut, resultat) {
  await tenantPool.query(
    `UPDATE tache_asynchrone
        SET statut = $2, completed_at = now(), payload = payload || $3::jsonb
      WHERE id = $1`,
    [id, statut, JSON.stringify({ resultat })]);
}

// ---------------------------------------------------------------------------
// Passages
// ---------------------------------------------------------------------------

let traitementEnCours = false;

export async function traitementQuotidien(contexte = nouveauContexte()) {
  const bilan = {};
  bilan.echeance_contrat = await detecterEcheancesContrats(contexte);
  bilan.echeance_souscription = await detecterEcheancesSouscriptions(contexte);
  bilan.revalidation_echue = await detecterRevalidationsEchues(contexte);
  bilan.depassement_conformite = await detecterDepassementsConformite(contexte);
  bilan.budget_seuil = await detecterBudgetSeuils(contexte);
  const { rows: [purge] } = await tenantPool.query(`SELECT * FROM purger_notifications()`);
  bilan.purge = purge;
  bilan.courriers_immediats = await envoyerImmediats();
  return bilan;
}

// Execute un passage sous verrou journalier. force = sans verrou (manuel).
async function executer(type, fonction, { declencheur = "planifie", force = false } = {}) {
  const jour = dateParis();
  let idTache = null;
  if (!force) {
    idTache = await prendreVerrou(type, jour, declencheur);
    if (!idTache) {
      return { execute: false, motif: "déjà exécuté ou en cours pour ce jour", jour };
    }
  }
  const debut = Date.now();
  try {
    const resultat = await fonction();
    const duree_ms = Date.now() - debut;
    if (idTache) await libererVerrou(idTache, "succes", { ...resultat, duree_ms });
    await tracer("info", `${type} (${declencheur}) termine`, { jour, duree_ms, ...resultat });
    return { execute: true, jour, duree_ms, ...resultat };
  } catch (err) {
    console.error(`[notifications] ${type} en echec`, err);
    if (idTache) await libererVerrou(idTache, "echec", { erreur: err.message }).catch(() => {});
    await tracer("error", `${type} (${declencheur}) en echec`, { jour, motif: err.message });
    throw err;
  }
}

export function executerTraitementQuotidien(options) {
  return executer("notifications_quotidien", () => traitementQuotidien(), options);
}

export function executerRecapitulatif(options) {
  return executer("notifications_recapitulatif", () => envoyerRecapitulatifs({ avant: new Date() }), options);
}

// Declenchement manuel (route reservee a l'administrateur) : les deux
// passages a la suite, sans verrou journalier (l'anti-doublon des
// notifications rend l'operation rejouable), un seul a la fois.
export async function executerManuellement() {
  if (traitementEnCours) return null;
  traitementEnCours = true;
  try {
    const traitement = await executerTraitementQuotidien({ declencheur: "manuel", force: true });
    const recapitulatif = await executerRecapitulatif({ declencheur: "manuel", force: true });
    await tenantPool.query(
      `INSERT INTO tache_asynchrone (type, statut, payload, tentatives, completed_at)
       VALUES ('notifications_manuel', 'succes', $1::jsonb, 1, now())`,
      [JSON.stringify({ date: dateParis(), heure: new Date().toISOString(), traitement, recapitulatif })]);
    return { traitement, recapitulatif };
  } finally {
    traitementEnCours = false;
  }
}

// ---------------------------------------------------------------------------
// Demarrage
// ---------------------------------------------------------------------------

function programmer(nom, horaire, action) {
  const cible = prochaineOccurrence(horaire.heure, horaire.minute);
  const delai = Math.max(1000, cible.getTime() - Date.now());
  const t = setTimeout(async () => {
    try {
      await action({ declencheur: "planifie" });
    } catch (err) {
      console.error(`[notifications] ${nom} : ${err.message}`);
    } finally {
      programmer(nom, horaire, action);
    }
  }, delai);
  if (typeof t.unref === "function") t.unref();
  console.log(`[notifications] ${nom} programme pour ${cible.toISOString()}`);
}

async function rattraper() {
  try {
    if (heurePassee(HEURE_TRAITEMENT.heure, HEURE_TRAITEMENT.minute)) {
      const r = await executerTraitementQuotidien({ declencheur: "rattrapage" });
      if (r.execute) console.log("[notifications] traitement quotidien rattrape au demarrage");
    }
    if (heurePassee(HEURE_RECAPITULATIF.heure, HEURE_RECAPITULATIF.minute)) {
      const r = await executerRecapitulatif({ declencheur: "rattrapage" });
      if (r.execute) console.log("[notifications] recapitulatif rattrape au demarrage");
    }
  } catch (err) {
    console.error("[notifications] rattrapage au demarrage :", err.message);
  }
}

// Appele une fois par index.js apres app.listen(). NOTIFICATIONS_PLANIFICATEUR=false
// desactive les passages (un environnement de test qui ne doit rien produire).
export function demarrerPlanificateur() {
  if (process.env.NOTIFICATIONS_PLANIFICATEUR === "false") {
    console.log("[notifications] planificateur desactive (NOTIFICATIONS_PLANIFICATEUR=false)");
    return;
  }
  programmer("traitement quotidien 7 h", HEURE_TRAITEMENT, executerTraitementQuotidien);
  programmer("recapitulatif 7 h 30", HEURE_RECAPITULATIF, executerRecapitulatif);
  const t = setTimeout(rattraper, DELAI_RATTRAPAGE_MS);
  if (typeof t.unref === "function") t.unref();
}
