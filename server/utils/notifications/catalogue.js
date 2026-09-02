// Pre-catalogue applicatif des notifications (story #121).
//
// Source unique des types, de leurs defauts et de leurs textes. Le type est
// un texte controle ici et non par une contrainte SQL : ajouter un type se
// fait dans ce fichier, sans migration (regle 8 de la specification).
//
// Module PUR : aucun acces a la base, aucune dependance au serveur. Il est
// teste par regles.test.js et consomme par le moteur, le planificateur, les
// routes et les courriers.
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

// Droit qui rend les montants visibles, meme regle que le module licences et
// la conformite (masquage cote serveur). Sans lui, la notification et le
// courrier ne portent que des quantites.
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
//   audience        : permissions dont UNE suffit pour etre destinataire
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
    audience: [PROFILS.manager_dsi, PROFILS.admin_sam, PROFILS.financier],
    courrier_defaut: "quotidien",
    gravite: "jaune",
  },
  depassement_conformite: {
    libelle: "Dépassements de conformité",
    description: "Un produit passe en dépassement, ou son écart valorisé négatif franchit le seuil en euros.",
    audience: [PROFILS.manager_dsi, PROFILS.admin_sam, PROFILS.financier, PROFILS.it_ops],
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
};

export const TYPES_CODES = Object.keys(TYPES);

export function typeConnu(type) {
  return Object.prototype.hasOwnProperty.call(TYPES, type);
}

export function courrierDefaut(type) {
  return typeConnu(type) ? TYPES[type].courrier_defaut : "quotidien";
}

// Paliers d'echeance des contrats en jours, a defaut de seuils du tenant.
export const PALIERS_CONTRAT_DEFAUT = [90, 60, 30];
export const PALIER_SOUSCRIPTION = 30;
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
// Composition des textes
//
// composerTexte(type, donnees, { montantsVisibles }) rend { titre, message,
// lien, gravite }. Le meme evenement produit un texte par destinataire : sans
// consulter_kpi_financiers, aucun montant n'apparait, ni a l'ecran ni dans le
// courrier. Les textes sont en francais accentue, sans jargon technique.
// ---------------------------------------------------------------------------

const COMPOSITEURS = {
  echeance_contrat(d) {
    const jours = Number(d.jours_restants);
    const quand = jours <= 0 ? "aujourd'hui" : `dans ${jours} ${pluriel(jours, "jour")}`;
    const societe = d.societe_label ? ` (${d.societe_label})` : "";
    return {
      titre: `Contrat « ${d.label} » à échéance ${quand}`,
      message: `Le contrat « ${d.label} »${societe} arrive à échéance le ${formatDateFr(d.date_fin)}, ${quand}. Pensez à préparer son renouvellement ou sa résiliation.`,
      lien: `/contrats/liste/${d.id_contrat}`,
      gravite: jours <= 30 ? "orange" : jours <= 60 ? "jaune" : "info",
    };
  },

  echeance_souscription(d) {
    const jours = Number(d.jours_restants);
    const quand = jours <= 0 ? "aujourd'hui" : `dans ${jours} ${pluriel(jours, "jour")}`;
    const nom = d.produit_label || d.label || "sans libellé";
    const quantite = d.quantite ? ` (${d.quantite} ${pluriel(d.quantite, "droit")})` : "";
    const societe = d.societe_label ? `, société ${d.societe_label}` : "";
    return {
      titre: `Souscription « ${nom} » à échéance ${quand}`,
      message: `La souscription « ${nom} »${quantite}${societe} prend fin le ${formatDateFr(d.date_fin)}, ${quand}. Sans renouvellement, les droits correspondants disparaîtront de la balance de conformité.`,
      lien: `/conformite/licences/${d.id_licence}`,
      gravite: "jaune",
    };
  },

  depassement_conformite(d, { montantsVisibles }) {
    const nom = d.produit_label || "Produit sans libellé";
    const editeur = d.editeur_label ? ` (${d.editeur_label})` : "";
    const manque = Math.max(0, Number(d.usages) - Number(d.droits));
    let message;
    if (d.statut === "depassement") {
      message = `Le produit « ${nom} »${editeur} est en dépassement : ${d.usages} ${pluriel(d.usages, "usage")} déclaré${Number(d.usages) > 1 ? "s" : ""} pour ${d.droits} ${pluriel(d.droits, "droit")} acquis, soit ${manque} ${pluriel(manque, "droit")} manquant${manque > 1 ? "s" : ""}.`;
    } else {
      message = `Le produit « ${nom} »${editeur} présente un écart important entre usages déclarés (${d.usages}) et droits acquis (${d.droits}).`;
    }
    if (montantsVisibles && d.ecart_valorise !== null && d.ecart_valorise !== undefined && Number(d.ecart_valorise) < 0) {
      message += ` Écart valorisé : ${formatEuros(Math.abs(Number(d.ecart_valorise)))}` +
        (d.seuil_montant ? ` (seuil d'alerte ${formatEuros(d.seuil_montant)}).` : ".");
    }
    return {
      titre: d.statut === "depassement" ? `Dépassement de conformité : ${nom}` : `Écart de conformité : ${nom}`,
      message,
      lien: `/conformite/licences?produit=${d.id_produit}`,
      gravite: d.statut === "depassement" ? "rouge" : "orange",
    };
  },

  budget_seuil(d, { montantsVisibles }) {
    const taux = Number(d.taux);
    const societe = d.societe_label || "la société";
    let message = `Le taux d'engagement du budget alloué de ${societe} atteint ${formatPourcent(taux)} sur l'exercice ${d.exercice}, au-delà du seuil d'alerte de ${formatPourcent(d.seuil)}.`;
    if (montantsVisibles) {
      message += ` Engagé : ${formatEuros(d.engage)} pour ${formatEuros(d.alloue)} alloués.`;
    }
    return {
      titre: `Budget ${d.exercice} de ${societe} engagé à ${formatPourcent(taux)}`,
      message,
      lien: "/budget",
      gravite: taux >= 100 ? "rouge" : "orange",
    };
  },

  validation_en_attente(d) {
    const auteur = nomPersonne(d.auteur);
    const par = auteur ? ` par ${auteur}` : "";
    const societe = d.societe_label ? ` (${d.societe_label})` : "";
    const quoi = nomEntite(d.entite_type, d.label);
    const quoiMaj = quoi.charAt(0).toUpperCase() + quoi.slice(1);
    return {
      titre: `Saisie à valider : ${d.label || ENTITES[d.entite_type]?.libelle || "saisie"}`,
      message: `${quoiMaj}${societe} a été soumis${ENTITES[d.entite_type]?.article === "la" ? "e" : ""}${par} et attend votre validation.`,
      lien: lienEntite(d.entite_type, d.entite_id),
      gravite: "info",
    };
  },

  saisie_traitee(d) {
    const quoi = nomEntite(d.entite_type, d.label);
    const feminin = ENTITES[d.entite_type]?.article === "la";
    const traitePar = nomPersonne(d.traite_par);
    const par = traitePar ? ` par ${traitePar}` : "";
    if (d.statut === "refuse") {
      return {
        titre: `Saisie refusée : ${d.label || "saisie"}`,
        message: `Votre saisie de ${quoi} a été refusée${par}.` + (d.motif ? ` Motif : ${d.motif}` : ""),
        lien: lienEntite(d.entite_type, d.entite_id),
        gravite: "orange",
      };
    }
    return {
      titre: `Saisie validée : ${d.label || "saisie"}`,
      message: `Votre saisie de ${quoi} a été validé${feminin ? "e" : ""}${par}.`,
      lien: lienEntite(d.entite_type, d.entite_id),
      gravite: "info",
    };
  },

  revalidation_echue(d) {
    const retard = Number(d.jours_retard);
    const nom = d.label || d.reference_client || d.produit_label || d.licence_label || "sans libellé";
    const societe = d.societe_label ? ` (${d.societe_label})` : "";
    const produit = d.produit_label && d.produit_label !== nom ? `, produit ${d.produit_label}` : "";
    const lien = d.id_societe
      ? `/conformite/affectations?societe=${d.id_societe}`
      : "/conformite/affectations";
    return {
      titre: `Revalidation échue : ${nom}`,
      message: `L'affectation « ${nom} »${societe}${produit} devait être revalidée le ${formatDateFr(d.date_prochaine)} ` +
        `et accuse ${retard} ${pluriel(retard, "jour")} de retard. Confirmez ou corrigez cette affectation.`,
      lien,
      gravite: retard > 30 ? "rouge" : "orange",
    };
  },
};

export function composerTexte(type, donnees = {}, { montantsVisibles = false } = {}) {
  const compositeur = COMPOSITEURS[type];
  if (!compositeur) {
    return { titre: donnees.titre || "Notification", message: donnees.message || "", lien: donnees.lien || "/dashboard", gravite: donnees.gravite || "info" };
  }
  const texte = compositeur(donnees, { montantsVisibles });
  if (!GRAVITES.includes(texte.gravite)) texte.gravite = TYPES[type]?.gravite || "info";
  return texte;
}
