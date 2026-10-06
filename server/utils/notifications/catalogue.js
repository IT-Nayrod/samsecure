// Pre-catalogue applicatif des notifications (story #121, revu pour la spec
// v1.1 - retours Samuel du 27/09/2026, stories #258 a #261).
//
// Source unique des types, de leurs defauts et de leurs textes. Le type est
// un texte controle ici et non par une contrainte SQL : ajouter un type se
// fait dans ce fichier, sans migration (regle 8 de la specification).
//
// Module PUR : aucun acces a la base, aucune dependance au serveur. Il est
// teste par regles.test.js et consomme par le moteur, le planificateur, les
// routes et les courriers.
//
// Multilingue (27/09) : chaque texte passe par un modele a parametres
// ({placeholders}) dont le francais ci-dessous est la version de reference.
// composerTexte() accepte un traducteur (cle -> modele, referentiel
// langue/traduction de la BDD Commune, module "notifications") ; sans
// traduction pour la cle, le modele francais du code s'applique. Les cles
// sont stables : app.<type>[.<variante>].titre|message, fragments
// app.commun.*, courriels courriel.<type>.*, courriel.commun.*, recap.*.
//
// Destinataires : la specification nomme des profils (Manager DSI, Admin SAM,
// Financier, IT Ops). L'API ne raisonne qu'en permissions (routesPermissions,
// permissionsEffectives). Chaque profil est donc reconnu par sa permission
// signature, celle que la matrice 011/021 ne donne qu'a lui : les trois
// droits de dashboard pour les trois personas, gerer_connecteurs pour
// l'administrateur (meme convention que la route /mails/test). Un profil
// personnalise qui porte ces droits est notifie comme le profil d'origine.
// Admin SAM porte toutes les permissions du catalogue : il recoit donc chaque
// type, ce qui est le comportement attendu pour l'administrateur du tenant.

export const PROFILS = {
  manager_dsi: "acceder_dashboard_manager_dsi",
  financier:   "acceder_dashboard_financier",
  it_ops:      "acceder_dashboard_it_ops",
  admin_sam:   "gerer_connecteurs",
};

// Libelles des profils destinataires, pour l'ecran des preferences
// (destinataires par defaut de chaque type) et le simulateur.
export const PROFILS_LIBELLES = {
  [PROFILS.manager_dsi]: "Manager DSI",
  [PROFILS.financier]:   "Financier",
  [PROFILS.it_ops]:      "IT Ops",
  [PROFILS.admin_sam]:   "Admin SAM",
};

// Droit qui rend les montants visibles, meme regle que le module licences et
// la conformite (masquage cote serveur). Sans lui, la notification en
// application ne porte que des quantites. Les courriers, eux, ne portent
// plus aucune donnee metier (confidentialite v1.1).
export const PERMISSION_MONTANTS = "consulter_kpi_financiers";

// Droit de traitement des saisies, audience du type validation_en_attente.
export const PERMISSION_VALIDATION = "valider_saisie";

export const MODES_COURRIER = ["immediat", "quotidien", "desactive"];
export const GRAVITES = ["info", "jaune", "orange", "rouge"];

export const LIBELLES_MODES = {
  immediat:  "Courrier immédiat",
  quotidien: "Récapitulatif quotidien",
  desactive: "Pas de courrier",
};

// Types, dans l'ordre d'affichage de la page Parametres.
//   audience        : permissions dont UNE suffit pour etre destinataire.
//                     Retrait du Financier des echeances de souscription et
//                     des depassements de conformite (retours Samuel du
//                     27/09, a confirmer sur le document) ; il reste
//                     destinataire du seuil budgetaire.
//   courrier_defaut : reglage du courrier en l'absence de preference
//   gravite         : niveau visuel par defaut (une composition peut le durcir)
export const TYPES = {
  echeance_contrat: {
    libelle: "Échéances de contrats",
    description: "Un contrat actif arrive à échéance (90, 60 et 30 jours avant sa date de fin).",
    audience: [PROFILS.manager_dsi, PROFILS.admin_sam],
    courrier_defaut: "quotidien",
    gravite: "jaune",
  },
  echeance_souscription: {
    libelle: "Échéances de souscriptions",
    description: "Une licence en souscription arrive à échéance dans les 30 jours.",
    audience: [PROFILS.manager_dsi, PROFILS.admin_sam],
    courrier_defaut: "quotidien",
    gravite: "jaune",
  },
  // Fin de maintenance (D59-D60, alertes lot 2) : la derniere periode de
  // maintenance d'une licence arrive a echeance. Detection par le
  // planificateur sur maintenance_historique.date_fin ; continuite comme les
  // souscriptions (une maintenance qui se poursuit, une licence renouvelee ou
  // un contrat renouvele eteignent l'alerte, regle maintenanceNotifiable).
  fin_maintenance: {
    libelle: "Fins de maintenance",
    description: "La maintenance d'une licence arrive à échéance dans les 30 jours.",
    audience: [PROFILS.manager_dsi, PROFILS.admin_sam, PROFILS.it_ops],
    courrier_defaut: "quotidien",
    gravite: "jaune",
  },
  depassement_conformite: {
    libelle: "Dépassements de conformité",
    description: "Un logiciel passe en dépassement, ou son écart valorisé négatif franchit le seuil en euros.",
    audience: [PROFILS.manager_dsi, PROFILS.admin_sam, PROFILS.it_ops],
    courrier_defaut: "immediat",
    gravite: "rouge",
  },
  budget_seuil: {
    libelle: "Seuil budgétaire",
    description: "Le taux d'engagement d'une société dépasse le seuil d'alerte (90 % par défaut).",
    audience: [PROFILS.financier, PROFILS.manager_dsi],
    courrier_defaut: "immediat",
    gravite: "orange",
  },
  validation_en_attente: {
    libelle: "Validations en attente",
    description: "Une saisie est soumise à validation sur votre périmètre.",
    audience: [PERMISSION_VALIDATION],
    courrier_defaut: "quotidien",
    gravite: "info",
  },
  saisie_traitee: {
    libelle: "Saisies traitées",
    description: "Une de vos saisies a été validée ou refusée (courrier immédiat en cas de refus).",
    audience: [],  // destinataire explicite : l'auteur de la saisie
    courrier_defaut: "quotidien",
    gravite: "info",
  },
  revalidation_echue: {
    libelle: "Revalidations échues",
    description: "Une affectation à revalider a dépassé son échéance.",
    audience: [PROFILS.it_ops, PROFILS.manager_dsi],
    courrier_defaut: "quotidien",
    gravite: "orange",
  },
  // Decision du 11/09/2026 : le contrat suit les licences. Detection dans le
  // traitement quotidien (server/utils/successionContrat.js), cle par contrat,
  // Manager DSI et Admin SAM de la portee, courrier recapitulatif.
  contrat_a_suivre: {
    libelle: "Contrats à faire suivre",
    description: "Des licences ont été renouvelées sur un contrat échu ou à échéance qui n'a été ni renouvelé ni prolongé.",
    audience: [PROFILS.manager_dsi, PROFILS.admin_sam],
    courrier_defaut: "quotidien",
    gravite: "orange",
  },
};

export const TYPES_CODES = Object.keys(TYPES);

export function typeConnu(type) {
  return Object.prototype.hasOwnProperty.call(TYPES, type);
}

export function courrierDefaut(type) {
  return typeConnu(type) ? TYPES[type].courrier_defaut : "quotidien";
}

// Libelles des destinataires par defaut d'un type, pour l'ecran des
// preferences. Le type saisie_traitee n'a pas d'audience par profil :
// l'auteur de la saisie est son seul destinataire.
export function destinatairesDefaut(type) {
  if (!typeConnu(type)) return [];
  if (type === "saisie_traitee") return ["Auteur de la saisie"];
  if (type === "validation_en_attente") return ["Porteurs du droit de validation"];
  return TYPES[type].audience.map((p) => PROFILS_LIBELLES[p] || p);
}

// Paliers d'echeance des contrats en jours, a defaut de seuils du tenant.
export const PALIERS_CONTRAT_DEFAUT = [90, 60, 30];
export const PALIER_SOUSCRIPTION = 30;
// Fin de maintenance : meme anticipation que les souscriptions (30 jours),
// a defaut d'une valeur D59-D60 plus precise.
export const PALIER_MAINTENANCE = 30;
export const SEUIL_BUDGET_DEFAUT = 90;

// ---------------------------------------------------------------------------
// Entites du workflow de validation : libelles et ecrans
// ---------------------------------------------------------------------------

// Libelle lisible de chaque entite validable, avec son article.
export const ENTITES = {
  contrat:        { libelle: "contrat",     article: "le",  lien: (id) => `/contrats/liste/${id}` },
  commande:       { libelle: "commande",    article: "la",  lien: (id) => `/contrats/commandes/${id}` },
  facture:        { libelle: "facture",     article: "la",  lien: (id) => `/contrats/factures/${id}` },
  preuve:         { libelle: "preuve",      article: "la",  lien: () => "/contrats/factures" },
  affectation:    { libelle: "affectation", article: "l'",  lien: (id) => `/conformite/affectations/${id}` },
  editeur:        { libelle: "éditeur",     article: "l'",  lien: (id) => `/referentiels/editeurs/${id}` },
  produit_client: { libelle: "logiciel",    article: "le",  lien: (id) => `/referentiels/logiciels/${id}` },
};

// Entites portant une societe (perimetre des destinataires). Les autres sont
// notifiees a l'echelle du tenant.
export const ENTITES_AVEC_SOCIETE = new Set(["contrat", "commande", "affectation"]);

export function lienEntite(entiteType, entiteId) {
  const e = ENTITES[entiteType];
  return e ? e.lien(entiteId) : "/dashboard";
}

function nomEntite(entiteType, label) {
  const e = ENTITES[entiteType] || { libelle: "saisie", article: "la" };
  const article = e.article.endsWith("'") ? e.article : `${e.article} `;
  return label ? `${article}${e.libelle} « ${label} »` : `${article}${e.libelle}`;
}

// ---------------------------------------------------------------------------
// Formats francais
// ---------------------------------------------------------------------------

export function formatDateFr(iso) {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const [a, m, j] = s.split("-");
  if (!a || !m || !j) return s;
  return `${j}/${m}/${a}`;
}

export function formatEuros(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "";
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n))} €`;
}

export function formatPourcent(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Number(n))} %`;
}

function pluriel(n, singulier, plurielForme = `${singulier}s`) {
  return Number(n) > 1 ? plurielForme : singulier;
}

function nomPersonne(p) {
  if (!p) return "";
  return [p.prenom, p.nom].filter(Boolean).join(" ").trim();
}

// ---------------------------------------------------------------------------
// Modeles a parametres
// ---------------------------------------------------------------------------

// Substitution des {placeholders} d'un modele. Un parametre absent ou null
// s'efface : les fragments optionnels (societe, motif) sont passes deja
// composes, vides quand ils n'ont pas lieu d'etre.
export function appliquerModele(modele, params) {
  if (!modele) return "";
  if (!params) return String(modele);
  return String(modele).replace(/\{(\w+)\}/g, (tout, cle) =>
    (params[cle] === undefined || params[cle] === null ? "" : String(params[cle])));
}

// ---------------------------------------------------------------------------
// Composition des textes de l'application
//
// composerTexte(type, donnees, { montantsVisibles, traduire }) rend { titre,
// message, lien, gravite }. Le meme evenement produit un texte par
// destinataire : sans consulter_kpi_financiers, aucun montant n'apparait a
// l'ecran ; avec un traducteur, le texte sort dans la langue de l'utilisateur.
// Les textes francais ci-dessous restent la reference (repli).
// ---------------------------------------------------------------------------

// Fragment "aujourd'hui" / "dans N jour(s)".
function fragmentQuand(jours, tr) {
  if (!(jours > 0)) return tr("app.commun.aujourdhui", "aujourd'hui");
  return jours > 1
    ? tr("app.commun.dans_jours", "dans {n} jours", { n: jours })
    : tr("app.commun.dans_jour", "dans {n} jour", { n: jours });
}

// Fragment "N jour(s)" (retards).
function fragmentJours(n, tr) {
  return n > 1
    ? tr("app.commun.jours", "{n} jours", { n })
    : tr("app.commun.jour", "{n} jour", { n });
}

const COMPOSITEURS = {
  echeance_contrat(d, { tr }) {
    const jours = Number(d.jours_restants);
    const quand = fragmentQuand(jours, tr);
    const societe = d.societe_label ? ` (${d.societe_label})` : "";
    return {
      titre: tr("app.echeance_contrat.titre",
        "Contrat « {label} » à échéance {quand}",
        { label: d.label, quand }),
      message: tr("app.echeance_contrat.message",
        "Le contrat « {label} »{societe} arrive à échéance le {date_fin}, {quand}. Pensez à préparer son renouvellement ou sa résiliation.",
        { label: d.label, societe, date_fin: formatDateFr(d.date_fin), quand }),
      lien: `/contrats/liste/${d.id_contrat}`,
      gravite: jours <= 30 ? "orange" : jours <= 60 ? "jaune" : "info",
    };
  },

  echeance_souscription(d, { tr }) {
    const jours = Number(d.jours_restants);
    const quand = fragmentQuand(jours, tr);
    const nom = d.produit_label || d.label || tr("app.commun.sans_libelle", "sans libellé");
    const quantite = d.quantite
      ? (Number(d.quantite) > 1
        ? tr("app.echeance_souscription.droits", " ({n} droits)", { n: d.quantite })
        : tr("app.echeance_souscription.droit", " ({n} droit)", { n: d.quantite }))
      : "";
    const societe = d.societe_label
      ? tr("app.commun.societe_suffixe", ", société {societe}", { societe: d.societe_label })
      : "";
    return {
      titre: tr("app.echeance_souscription.titre",
        "Souscription « {nom} » à échéance {quand}", { nom, quand }),
      message: tr("app.echeance_souscription.message",
        "La souscription « {nom} »{quantite}{societe} prend fin le {date_fin}, {quand}. Sans renouvellement, les droits correspondants disparaîtront de la balance de conformité.",
        { nom, quantite, societe, date_fin: formatDateFr(d.date_fin), quand }),
      lien: `/conformite/licences/${d.id_licence}`,
      gravite: "jaune",
    };
  },

  // Fin de maintenance (D59-D60) : meme construction que l'echeance de
  // souscription, texte propre a la maintenance (mises a jour et support).
  fin_maintenance(d, { tr }) {
    const jours = Number(d.jours_restants);
    const quand = fragmentQuand(jours, tr);
    const nom = d.produit_label || d.licence_label || tr("app.commun.sans_libelle", "sans libellé");
    const societe = d.societe_label
      ? tr("app.commun.societe_suffixe", ", société {societe}", { societe: d.societe_label })
      : "";
    return {
      titre: tr("app.fin_maintenance.titre",
        "Maintenance de « {nom} » à échéance {quand}", { nom, quand }),
      message: tr("app.fin_maintenance.message",
        "La maintenance de la licence « {nom} »{societe} prend fin le {date_fin}, {quand}. Sans renouvellement, les mises à jour et le support cesseront et la version sera figée.",
        { nom, societe, date_fin: formatDateFr(d.date_fin), quand }),
      lien: `/conformite/licences/${d.id_licence}`,
      gravite: "jaune",
    };
  },

  depassement_conformite(d, { montantsVisibles, tr }) {
    const nom = d.produit_label || tr("app.depassement_conformite.sans_libelle", "Logiciel sans libellé");
    const editeur = d.editeur_label ? ` (${d.editeur_label})` : "";
    const usages = Number(d.usages);
    const droits = Number(d.droits);
    const manque = Math.max(0, usages - droits);
    let message;
    if (d.statut === "depassement") {
      const usagesDecl = `${d.usages} ${pluriel(usages, "usage")} déclaré${usages > 1 ? "s" : ""}`;
      const droitsAcquis = `${d.droits} ${pluriel(droits, "droit")} acquis`;
      const droitsManquants = `${manque} ${pluriel(manque, "droit")} manquant${manque > 1 ? "s" : ""}`;
      message = tr("app.depassement_conformite.depassement.message",
        "Le logiciel « {nom} »{editeur} est en dépassement : {usages_decl} pour {droits_acquis}, soit {droits_manquants}.",
        { nom, editeur, usages_decl: usagesDecl, droits_acquis: droitsAcquis, droits_manquants: droitsManquants,
          usages: d.usages, droits: d.droits, manque });
    } else {
      message = tr("app.depassement_conformite.ecart.message",
        "Le logiciel « {nom} »{editeur} présente un écart important entre usages déclarés ({usages}) et droits acquis ({droits}).",
        { nom, editeur, usages: d.usages, droits: d.droits });
    }
    if (montantsVisibles && d.ecart_valorise !== null && d.ecart_valorise !== undefined && Number(d.ecart_valorise) < 0) {
      const montant = formatEuros(Math.abs(Number(d.ecart_valorise)));
      message += d.seuil_montant
        ? tr("app.depassement_conformite.montant_seuil",
          " Écart valorisé : {montant} (seuil d'alerte {seuil}).",
          { montant, seuil: formatEuros(d.seuil_montant) })
        : tr("app.depassement_conformite.montant", " Écart valorisé : {montant}.", { montant });
    }
    return {
      titre: d.statut === "depassement"
        ? tr("app.depassement_conformite.depassement.titre", "Dépassement de conformité : {nom}", { nom })
        : tr("app.depassement_conformite.ecart.titre", "Écart de conformité : {nom}", { nom }),
      message,
      lien: `/conformite/licences?produit=${d.id_produit}`,
      gravite: d.statut === "depassement" ? "rouge" : "orange",
    };
  },

  budget_seuil(d, { montantsVisibles, tr }) {
    const taux = Number(d.taux);
    const societe = d.societe_label || tr("app.budget_seuil.la_societe", "la société");
    let message = tr("app.budget_seuil.message",
      "Le taux d'engagement du budget alloué de {societe} atteint {taux} sur l'exercice {exercice}, au-delà du seuil d'alerte de {seuil}.",
      { societe, taux: formatPourcent(taux), exercice: d.exercice, seuil: formatPourcent(d.seuil) });
    if (montantsVisibles) {
      message += tr("app.budget_seuil.montants",
        " Engagé : {engage} pour {alloue} alloués.",
        { engage: formatEuros(d.engage), alloue: formatEuros(d.alloue) });
    }
    return {
      titre: tr("app.budget_seuil.titre",
        "Budget {exercice} de {societe} engagé à {taux}",
        { exercice: d.exercice, societe, taux: formatPourcent(taux) }),
      message,
      lien: "/budget",
      gravite: taux >= 100 ? "rouge" : "orange",
    };
  },

  validation_en_attente(d, { tr }) {
    const auteur = nomPersonne(d.auteur);
    const par = auteur ? tr("app.commun.par", " par {nom}", { nom: auteur }) : "";
    const societe = d.societe_label ? ` (${d.societe_label})` : "";
    const quoi = nomEntite(d.entite_type, d.label);
    const quoiMaj = quoi.charAt(0).toUpperCase() + quoi.slice(1);
    const entite = ENTITES[d.entite_type]?.libelle || "saisie";
    const feminin = ENTITES[d.entite_type]?.article === "la";
    return {
      titre: tr("app.validation_en_attente.titre",
        "Saisie à valider : {nom}", { nom: d.label || entite }),
      message: tr("app.validation_en_attente.message",
        feminin
          ? "{quoi}{societe} a été soumise{par} et attend votre validation."
          : "{quoi}{societe} a été soumis{par} et attend votre validation.",
        { quoi: quoiMaj, societe, par, entite, label: d.label || "" }),
      lien: lienEntite(d.entite_type, d.entite_id),
      gravite: "info",
    };
  },

  saisie_traitee(d, { tr }) {
    const quoi = nomEntite(d.entite_type, d.label);
    const entite = ENTITES[d.entite_type]?.libelle || "saisie";
    const feminin = ENTITES[d.entite_type]?.article === "la";
    const traitePar = nomPersonne(d.traite_par);
    const par = traitePar ? tr("app.commun.par", " par {nom}", { nom: traitePar }) : "";
    const nom = d.label || tr("app.commun.saisie", "saisie");
    if (d.statut === "refuse") {
      const motif = d.motif ? tr("app.saisie_traitee.motif", " Motif : {motif}", { motif: d.motif }) : "";
      return {
        titre: tr("app.saisie_traitee.refusee.titre", "Saisie refusée : {nom}", { nom }),
        message: tr("app.saisie_traitee.refusee.message",
          "Votre saisie de {quoi} a été refusée{par}.{motif}",
          { quoi, par, motif, entite, label: d.label || "" }),
        lien: lienEntite(d.entite_type, d.entite_id),
        gravite: "orange",
      };
    }
    return {
      titre: tr("app.saisie_traitee.validee.titre", "Saisie validée : {nom}", { nom }),
      message: tr("app.saisie_traitee.validee.message",
        feminin
          ? "Votre saisie de {quoi} a été validée{par}."
          : "Votre saisie de {quoi} a été validé{par}.",
        { quoi, par, entite, label: d.label || "" }),
      lien: lienEntite(d.entite_type, d.entite_id),
      gravite: "info",
    };
  },

  contrat_a_suivre(d, { tr }) {
    const nb = Number(d.nb_licences_renouvelees) || 0;
    const licences = nb > 1
      ? tr("app.contrat_a_suivre.licences", "{n} licences ont été renouvelées", { n: nb })
      : tr("app.contrat_a_suivre.licence", "une licence a été renouvelée");
    const societe = d.societe_label ? ` (${d.societe_label})` : "";
    const jours = d.jours_restants === null || d.jours_restants === undefined ? null : Number(d.jours_restants);
    const dateFin = formatDateFr(d.date_fin);
    const etat = jours === null
      ? tr("app.contrat_a_suivre.echeance", "arrive à échéance")
      : jours < 0 ? tr("app.contrat_a_suivre.echu", "est échu depuis le {date_fin}", { date_fin: dateFin })
      : jours === 0 ? tr("app.contrat_a_suivre.echeance_jour", "arrive à échéance aujourd'hui")
      : tr("app.contrat_a_suivre.echeance_date", "arrive à échéance le {date_fin}, {quand}",
          { date_fin: dateFin, quand: fragmentQuand(jours, tr) });
    return {
      titre: tr("app.contrat_a_suivre.titre",
        "Contrat « {label} » à renouveler ou prolonger", { label: d.label }),
      message: tr("app.contrat_a_suivre.message",
        "Ce contrat doit être renouvelé ou prolongé : {licences} dessus. Le contrat « {label} »{societe} {etat} et n'a ni successeur ni prolongation.",
        { licences, label: d.label, societe, etat }),
      lien: `/contrats/liste/${d.id_contrat}`,
      gravite: jours !== null && jours < 0 ? "rouge" : "orange",
    };
  },

  revalidation_echue(d, { tr }) {
    const retard = Number(d.jours_retard);
    const nom = d.label || d.reference_client || d.produit_label || d.licence_label
      || tr("app.commun.sans_libelle", "sans libellé");
    const societe = d.societe_label ? ` (${d.societe_label})` : "";
    const produit = d.produit_label && d.produit_label !== nom
      ? tr("app.revalidation_echue.logiciel", ", logiciel {logiciel}", { logiciel: d.produit_label })
      : "";
    const lien = d.id_societe
      ? `/conformite/affectations?societe=${d.id_societe}`
      : "/conformite/affectations";
    return {
      titre: tr("app.revalidation_echue.titre", "Revalidation échue : {nom}", { nom }),
      message: tr("app.revalidation_echue.message",
        "L'affectation « {nom} »{societe}{logiciel} devait être revalidée le {date} et accuse {retard} de retard. Confirmez ou corrigez cette affectation.",
        { nom, societe, logiciel: produit, date: formatDateFr(d.date_prochaine), retard: fragmentJours(retard, tr) }),
      lien,
      gravite: retard > 30 ? "rouge" : "orange",
    };
  },
};

export function composerTexte(type, donnees = {}, { montantsVisibles = false, traduire = null } = {}) {
  // tr : modele traduit si le referentiel en porte un pour la cle, modele
  // francais du code sinon, parametres substitues dans les deux cas.
  const tr = (cle, modeleDefaut, params = null) =>
    appliquerModele((traduire && traduire(cle)) || modeleDefaut, params);
  const compositeur = COMPOSITEURS[type];
  if (!compositeur) {
    return { titre: donnees.titre || "Notification", message: donnees.message || "", lien: donnees.lien || "/dashboard", gravite: donnees.gravite || "info" };
  }
  const texte = compositeur(donnees, { montantsVisibles, tr });
  if (!GRAVITES.includes(texte.gravite)) texte.gravite = TYPES[type]?.gravite || "info";
  return texte;
}

// ---------------------------------------------------------------------------
// Courriers : libelles generiques par type (confidentialite v1.1)
//
// Aucun courriel ne porte de donnee metier : ni montant, ni quantite, ni
// motif, ni preuve d'ecart, ni libelle d'entite. Seul le libelle generique de
// l'evenement et le lien vers l'ecran concerne sont envoyes ; la donnee reste
// dans l'application, sous controle des droits.
// ---------------------------------------------------------------------------

export const COURRIELS = {
  echeance_contrat: {
    objet: "Échéance de contrat",
    message: "Un contrat de votre périmètre arrive à échéance.",
  },
  echeance_souscription: {
    objet: "Échéance de souscription",
    message: "Une licence en souscription de votre périmètre arrive à échéance.",
  },
  fin_maintenance: {
    objet: "Fin de maintenance",
    message: "La maintenance d'une licence de votre périmètre arrive à échéance.",
  },
  depassement_conformite: {
    objet: "Alerte de conformité",
    message: "Un logiciel présente un écart de conformité.",
  },
  budget_seuil: {
    objet: "Seuil budgétaire atteint",
    message: "Le budget d'une société a franchi son seuil d'alerte.",
  },
  validation_en_attente: {
    objet: "Saisie à valider",
    message: "Une saisie attend votre validation.",
  },
  saisie_traitee: {
    objet: "Saisie traitée",
    message: "Une de vos saisies a été traitée.",
  },
  revalidation_echue: {
    objet: "Revalidation échue",
    message: "Une affectation a dépassé son échéance de revalidation.",
  },
  contrat_a_suivre: {
    objet: "Contrat à renouveler ou prolonger",
    message: "Un contrat arrivé à échéance porte des licences renouvelées.",
  },
};

export const COURRIEL_GENERIQUE = {
  objet: "Notification",
  message: "Un événement de votre périmètre requiert votre attention.",
};
