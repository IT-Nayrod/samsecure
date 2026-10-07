// Catalogue unique des règles de complétude (US #324, retour chef de projet du
// 07/10/2026) : ce qu'il manque à une fiche pour que la saisie serve la
// conformité, l'usage et les droits d'usage, et l'action qui lève chaque
// manque.
//
// Module PUR : aucun accès à la base, aucune dépendance au serveur, testé par
// completude.test.js (node --test), même doctrine que successionContrat.js.
// Les routes (routes/completude.js) ne font que lire des faits en base et
// appeler evaluerCompletude() : la fiche et le résumé passent par les mêmes
// fonctions, c'est ce qui garantit « mêmes règles partout » entre le bloc
// Actions requises, la détection des manques du module Preuves et les
// compteurs.
//
// Les définitions REPRENNENT l'existant, jamais une variante :
//   - facture / preuve d'une commande : mêmes lectures que GET /commandes/
//     manques (commandes.js, #50/#215) : facture = preuve de type documentaire
//     `facture` rattachée à la commande, preuve = toute preuve id_commande ;
//   - justificatif d'un contrat : même lecture que la détection
//     contrat_sans_justificatif de GET /qualite (preuve directe, preuve ou
//     facture d'une de ses commandes) ;
//   - licence échue : licenceExpiree() de conformite.js (types à échéance
//     souscription ET essai, D44 étendu : la règle validée de la balance) ;
//   - maintenance échue : statut `echue` d'etatMaintenance()
//     (maintenanceLicence.js), posé par la route sur les périodes réelles ;
//   - statut d'une affectation : dernière entrée du workflow (jointureStatut),
//     une affectation sans entrée vaut en_attente (même coalesce que
//     qualite.js) ;
//   - usage sans droit : droits_total = 0 et usages_total > 0 du précalcul de
//     conformité (D53, héritage des composés #216 compris), même source que
//     GET /qualite ;
//   - composé incomplet : un seul composant dans produit_composition, même
//     lecture que composition_incomplete de logiciels.js (#216 : un composé
//     regroupe au moins deux logiciels).
//
// Gravités (deux valeurs, décision du brief #324) :
//   bloquant   : le manque fausse la balance droits/usages, sa valorisation ou
//                le comptage des usages (service conformité non rendu) ;
//   recommande : pièce ou précision attendue pour l'aptitude à l'audit, la
//                balance reste juste.
// Le détail de l'arbitrage par règle est tenu au journal du chantier.

import { licenceExpiree } from "./conformite.js";

export const GRAVITE_BLOQUANT = "bloquant";
export const GRAVITE_RECOMMANDE = "recommande";

const ORDRE_GRAVITE = { [GRAVITE_BLOQUANT]: 0, [GRAVITE_RECOMMANDE]: 1 };

const jourIso = (v) =>
  (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);

const entier = (v) => Number(v) || 0;

// ---------------------------------------------------------------------------
// Catalogue des règles
// ---------------------------------------------------------------------------
// Chaque règle : { regle, gravite, libelle, action: { code, libelle }, test }.
// test(faits, ctx) est un prédicat pur ; libelle peut être une fonction des
// faits (compteurs interpolés). action.code est le contrat avec le front : la
// fiche y branche la modale ou la navigation qui lève le manque.
//
// Faits attendus par type (contrat documenté, fourni par routes/completude.js) :
//   commande    : { montant, nb_factures, nb_preuves, nb_licences }
//   contrat     : { archive, id_societe, date_fin, nb_successeurs,
//                   nb_commandes, a_justificatif }
//   licence     : { type, quantite, date_fin_souscription, nb_successeurs,
//                   id_version, id_edition, version_geree, nb_preuves,
//                   nb_affectations, nb_affectations_en_attente,
//                   statut_maintenance }
//   logiciel    : { droits, usages, nb_composants }
//   affectation : { statut_validation, message_refus }

export const REGLES_COMPLETUDE = {
  commande: [
    {
      regle: "commande_sans_licence",
      gravite: GRAVITE_BLOQUANT,
      libelle: "Aucune licence rattachée : les droits acquis n'entrent pas dans la balance de conformité",
      action: { code: "saisir_licence", libelle: "Saisir la licence" },
      test: (f) => entier(f.nb_licences) === 0,
    },
    {
      regle: "commande_montant_absent",
      gravite: GRAVITE_BLOQUANT,
      libelle: "Montant absent : la valorisation et le budget engagé sont faussés",
      action: { code: "editer_commande", libelle: "Renseigner le montant" },
      test: (f) => f.montant === null || f.montant === undefined,
    },
    {
      regle: "commande_sans_facture",
      gravite: GRAVITE_RECOMMANDE,
      libelle: "Aucune facture rattachée à la commande",
      action: { code: "deposer_facture", libelle: "Déposer une facture" },
      test: (f) => entier(f.nb_factures) === 0,
    },
    {
      regle: "commande_sans_preuve",
      gravite: GRAVITE_RECOMMANDE,
      libelle: "Aucune preuve rattachée à la commande",
      action: { code: "deposer_preuve", libelle: "Rattacher une preuve" },
      test: (f) => entier(f.nb_preuves) === 0,
    },
  ],

  // Un contrat archivé n'appelle aucune action : même règle que les
  // détections qualité (archive = false) et que successionContrat.js.
  contrat: [
    {
      regle: "contrat_sans_societe",
      gravite: GRAVITE_BLOQUANT,
      libelle: "Société signataire absente : le rattachement des droits d'usage et le budget sont rompus",
      action: { code: "editer_contrat", libelle: "Renseigner la société signataire" },
      test: (f) => !f.archive && !f.id_societe,
    },
    {
      regle: "contrat_echeance_sans_renouvellement",
      gravite: GRAVITE_BLOQUANT,
      // Même vocabulaire que la succession (D35, #209) : un successeur
      // (contrat.id_contrat_predecesseur) éteint le signal.
      libelle: (f) => `Échéance passée le ${f.date_fin} sans renouvellement`,
      action: { code: "renouveler_contrat", libelle: "Prolonger ou renouveler le contrat" },
      test: (f, ctx) => !f.archive && !!f.date_fin && entier(f.nb_successeurs) === 0
        && jourIso(f.date_fin) < ctx.aujourdhui,
    },
    {
      regle: "contrat_sans_commande",
      gravite: GRAVITE_RECOMMANDE,
      libelle: "Aucune commande rattachée au contrat",
      action: { code: "saisir_commande", libelle: "Saisir une commande" },
      test: (f) => !f.archive && entier(f.nb_commandes) === 0,
    },
    {
      regle: "contrat_sans_preuve",
      gravite: GRAVITE_RECOMMANDE,
      libelle: "Aucune preuve rattachée au contrat ni à ses commandes",
      action: { code: "deposer_preuve", libelle: "Rattacher une preuve" },
      test: (f) => !f.archive && !f.a_justificatif,
    },
  ],

  licence: [
    {
      regle: "licence_droits_zero",
      gravite: GRAVITE_BLOQUANT,
      libelle: "Quantité de droits à zéro : la licence n'apporte rien à la balance",
      action: { code: "editer_licence", libelle: "Renseigner la quantité" },
      test: (f) => entier(f.quantite) === 0,
    },
    {
      regle: "licence_souscription_echue",
      gravite: GRAVITE_BLOQUANT,
      // licenceExpiree couvre les deux types à échéance de la balance
      // (souscription et essai, D44 étendu) ; un successeur (D35) éteint le
      // signal, comme pour les notifications d'échéance.
      libelle: (f) => (f.type === "essai"
        ? `Version d'essai échue le ${f.date_fin_souscription} : ces droits sont sortis de la balance`
        : `Souscription échue le ${f.date_fin_souscription} : ces droits sont sortis de la balance`),
      action: { code: "renouveler_licence", libelle: "Prolonger ou créer la nouvelle période" },
      test: (f, ctx) => entier(f.nb_successeurs) === 0
        && licenceExpiree(f, ctx.aujourdhui),
    },
    {
      regle: "licence_affectations_en_attente",
      gravite: GRAVITE_BLOQUANT,
      libelle: (f) => `${f.nb_affectations_en_attente} affectation(s) en attente de validation : ces usages ne sont pas comptés`,
      action: { code: "traiter_affectations", libelle: "Traiter les affectations en attente" },
      test: (f) => entier(f.nb_affectations_en_attente) > 0,
    },
    {
      regle: "licence_sans_usage",
      gravite: GRAVITE_BLOQUANT,
      libelle: "Aucun usage déclaré sur cette licence",
      action: { code: "saisir_affectation", libelle: "Déclarer une affectation" },
      test: (f) => entier(f.nb_affectations) === 0,
    },
    {
      regle: "licence_maintenance_echue",
      gravite: GRAVITE_RECOMMANDE,
      // statut_maintenance vient d'etatMaintenance() : `echue` signifie des
      // périodes passées sans période en cours ni à venir ; un arrêt assumé
      // (`arretee`) n'appelle aucune action.
      libelle: "Maintenance échue sans nouvelle période sur une licence perpétuelle",
      action: { code: "saisir_maintenance", libelle: "Saisir une période de maintenance" },
      test: (f) => f.type === "perpetuelle" && f.statut_maintenance === "echue",
    },
    {
      regle: "licence_sans_preuve",
      gravite: GRAVITE_RECOMMANDE,
      libelle: "Aucune preuve rattachée à la licence",
      action: { code: "deposer_preuve", libelle: "Rattacher une preuve" },
      test: (f) => entier(f.nb_preuves) === 0,
    },
    {
      regle: "licence_declinaison_manquante",
      gravite: GRAVITE_RECOMMANDE,
      // Bornée aux types à version gérée (type_licence.version_geree) : une
      // souscription suit la version courante de l'éditeur, rien à renseigner.
      libelle: (f) => (!f.id_version && !f.id_edition
        ? "Version et édition non renseignées"
        : !f.id_version ? "Version non renseignée" : "Édition non renseignée"),
      action: { code: "editer_licence", libelle: "Renseigner la version et l'édition" },
      test: (f) => !!f.version_geree && (!f.id_version || !f.id_edition),
    },
  ],

  logiciel: [
    {
      regle: "logiciel_usage_sans_droit",
      gravite: GRAVITE_BLOQUANT,
      // D53 : usages déclarés sans aucun droit acquis (plus de licence active,
      // héritage des composés compris). C'est l'anomalie usage_sans_droit,
      // relue ici depuis le précalcul comme le fait GET /qualite.
      libelle: (f) => `${f.usages} usage(s) déclaré(s) sans aucun droit acquis sur ce logiciel`,
      action: { code: "saisir_licence", libelle: "Saisir une licence" },
      test: (f) => entier(f.droits) === 0 && entier(f.usages) > 0,
    },
    {
      regle: "logiciel_compose_sans_composition",
      gravite: GRAVITE_RECOMMANDE,
      // #216 : un composé regroupe au moins deux logiciels du même éditeur.
      // Un seul composant = composition incomplète (composition_incomplete de
      // logiciels.js) ; zéro composant = le logiciel n'est pas un composé.
      libelle: "Logiciel composé avec un seul composant : composition incomplète",
      action: { code: "completer_composition", libelle: "Compléter la composition" },
      test: (f) => entier(f.nb_composants) === 1,
    },
  ],

  affectation: [
    {
      regle: "affectation_en_attente",
      gravite: GRAVITE_BLOQUANT,
      libelle: "En attente de validation : cet usage n'est pas compté dans la balance",
      action: { code: "traiter_validation", libelle: "Traiter la validation" },
      test: (f) => (f.statut_validation ?? "en_attente") === "en_attente",
    },
    {
      regle: "affectation_refusee",
      gravite: GRAVITE_BLOQUANT,
      libelle: (f) => (f.message_refus
        ? `Saisie refusée sans correction : ${f.message_refus}`
        : "Saisie refusée sans correction"),
      action: { code: "corriger_affectation", libelle: "Corriger la saisie" },
      test: (f) => f.statut_validation === "refuse",
    },
  ],
};

export const TYPES_COMPLETUDE = Object.keys(REGLES_COMPLETUDE);

// ---------------------------------------------------------------------------
// Évaluation
// ---------------------------------------------------------------------------

// Manques d'une fiche : les règles du type dont le prédicat est vrai, bloquants
// d'abord puis ordre du catalogue (tri stable). Chaque manque sort sans son
// prédicat : { regle, gravite, libelle, action }, prêt à servir tel quel.
// aujourdhui : chaîne AAAA-MM-JJ ou Date, injectable pour les tests.
export function evaluerCompletude(type, faits, { aujourdhui = new Date() } = {}) {
  const regles = REGLES_COMPLETUDE[type];
  if (!regles) throw new Error(`Type de fiche inconnu pour la complétude : ${type}`);
  const ctx = { aujourdhui: jourIso(aujourdhui) };
  return regles
    .filter((r) => r.test(faits ?? {}, ctx))
    .map((r) => ({
      regle: r.regle,
      gravite: r.gravite,
      libelle: typeof r.libelle === "function" ? r.libelle(faits ?? {}) : r.libelle,
      action: r.action,
    }))
    .sort((a, b) => (ORDRE_GRAVITE[a.gravite] ?? 9) - (ORDRE_GRAVITE[b.gravite] ?? 9));
}

export function compterGravites(manques = []) {
  return {
    nb_bloquants: manques.filter((m) => m.gravite === GRAVITE_BLOQUANT).length,
    nb_recommandes: manques.filter((m) => m.gravite === GRAVITE_RECOMMANDE).length,
  };
}

// Agrégat d'un type pour le résumé : listes = tableaux de manques, un par
// entité évaluée. avec_manque compte les entités, bloquants et recommandes
// comptent les manques, par_regle compte par code de règle : les compteurs
// des listes et des widgets lisent ces champs, jamais un recalcul local.
export function compterResume(listes = []) {
  const sortie = { total: listes.length, avec_manque: 0, bloquants: 0, recommandes: 0, par_regle: {} };
  for (const manques of listes) {
    if (manques.length) sortie.avec_manque += 1;
    for (const m of manques) {
      if (m.gravite === GRAVITE_BLOQUANT) sortie.bloquants += 1;
      else sortie.recommandes += 1;
      sortie.par_regle[m.regle] = (sortie.par_regle[m.regle] ?? 0) + 1;
    }
  }
  return sortie;
}
