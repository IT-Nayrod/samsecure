// Regles pures du module notifications (story #121, revues pour la spec v1.1
// - retours Samuel du 27/09/2026).
//
// Aucun acces a la base, aucune dependance au serveur : tout ce qui est ici
// se teste en isolation (regles.test.js, node --test). Le moteur, les
// courriers et le planificateur ne font qu'alimenter ces fonctions avec des
// donnees lues en base.
import {
  TYPES, typeConnu, courrierDefaut, LIBELLES_MODES, PALIERS_CONTRAT_DEFAUT,
  COURRIELS, COURRIEL_GENERIQUE, appliquerModele,
} from "./catalogue.js";

// ---------------------------------------------------------------------------
// Cle d'evenement
// ---------------------------------------------------------------------------

// Cle unique d'un evenement : type puis identifiants et palier, separes par
// deux-points. Combinee a l'utilisateur, elle porte l'anti-doublon (index
// unique de la migration 051). Les valeurs vides sont rendues explicites pour
// que deux evenements distincts ne produisent jamais la meme cle.
export function cleEvenement(type, ...parties) {
  const segments = parties.map((p) => (p === null || p === undefined || p === "" ? "aucun" : String(p)));
  return [type, ...segments].join(":");
}

// Cle d'une echeance (echeance_contrat, echeance_souscription,
// fin_maintenance), 16/09/2026 : type:id:date_fin:palier. La date de fin fait
// partie de la cle pour qu'une prolongation (nouvelle date de fin) produise
// naturellement une nouvelle notification au passage suivant, sans liberation
// manuelle de la cle precedente. L'anti-doublon reste porte par l'index
// unique (051) : meme entite, meme date de fin, meme palier, une seule
// notification par utilisateur. La date est reduite au jour calendaire,
// qu'elle arrive en chaine ISO ou en Date ; sans date, le segment vaut
// "aucun" comme ailleurs.
export function cleEcheance(type, id, dateFin, palier) {
  const jour = dateFin === null || dateFin === undefined || dateFin === ""
    ? null
    : (dateFin instanceof Date ? dateFin.toISOString() : String(dateFin)).slice(0, 10);
  return cleEvenement(type, id, jour, palier);
}

// ---------------------------------------------------------------------------
// Continuite des renouvellements (D35, story #209)
// ---------------------------------------------------------------------------

// Une echeance (contrat, souscription) n'est notifiable que si l'entite n'a
// pas de successeur : un contrat ou une licence renouvele par un successeur
// (contrat.id_contrat_predecesseur, licence.id_licence_predecesseur,
// migration 056) est deja pris en charge, l'alerte n'a plus d'objet. Le
// planificateur lit le nombre de successeurs en base et applique cette regle.
export function echeanceNotifiable(nbSuccesseurs) {
  const n = Number(nbSuccesseurs);
  return !(Number.isFinite(n) && n > 0);
}

// Continuite des fins de maintenance (D59-D60, alertes lot 2), meme esprit
// que les souscriptions : l'alerte s'eteint des que la suite est assuree.
//   nb_maintenances_suivantes : periodes de maintenance de la licence dont la
//     fin depasse celle de la periode consideree (NULL = sans fin) ;
//   nb_successeurs_licence    : licences renouvelees sur ce predecesseur ;
//   nb_successeurs_contrat    : contrats succedant au contrat de la licence ;
//   date_arret                : arret volontaire de la maintenance (version
//     figee) : la fin est un choix, pas une echeance a surveiller.
export function maintenanceNotifiable({
  nb_maintenances_suivantes = 0,
  nb_successeurs_licence = 0,
  nb_successeurs_contrat = 0,
  date_arret = null,
} = {}) {
  if (date_arret) return false;
  for (const n of [nb_maintenances_suivantes, nb_successeurs_licence, nb_successeurs_contrat]) {
    const v = Number(n);
    if (Number.isFinite(v) && v > 0) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Multilingue : regles pures (le cache et les lectures en base vivent dans
// traductions.js, qui consomme ces deux fonctions)
// ---------------------------------------------------------------------------

// Code langue normalise : minuscules, tronque a la langue ("fr-FR" -> "fr").
export function normaliserLangue(code) {
  const base = String(code || "").trim().toLowerCase().split(/[-_]/)[0];
  return base || null;
}

// Premiere traduction trouvee pour la cle dans l'ordre des langues donnees.
// null si aucune : l'appelant retombe sur le modele francais du code.
export function resoudreTraduction(parLangue, langues, cle) {
  if (!(parLangue instanceof Map)) return null;
  for (const langue of langues) {
    if (!langue) continue;
    const dico = parLangue.get(langue);
    const valeur = dico && dico.get(cle);
    if (valeur) return valeur;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Destinataires
// ---------------------------------------------------------------------------

// Un candidat couvre une societe s'il est a portee tenant, ou si elle figure
// dans son rattachement. Un evenement sans societe (produit, tenant) est
// visible de tous les porteurs du droit.
export function couvreSociete(candidat, idSociete) {
  if (!idSociete) return true;
  if (candidat.isTenantScope) return true;
  return Array.isArray(candidat.societeIds) && candidat.societeIds.includes(idSociete);
}

// Selection des destinataires d'un evenement parmi les candidats (utilisateurs
// actifs, avec permissions effectives et portee).
//   candidats : [{ id, email, prenom, nom, langue, permissions: Set,
//                  isTenantScope, societeIds }]
//   evenement : { type, id_societe, audience?, destinataires?, exclure? }
// - destinataires : identifiants explicites (auteur d'une saisie), la portee
//   n'est pas verifiee, seuls l'existence et l'exclusion le sont ;
// - audience : permissions dont une suffit, surcharge celle du catalogue ;
// - exclure : identifiants ecartes (l'auteur de la soumission, par exemple).
export function selectionnerDestinataires(candidats, evenement) {
  const exclure = new Set(evenement.exclure || []);
  if (Array.isArray(evenement.destinataires)) {
    const voulus = new Set(evenement.destinataires.filter(Boolean));
    return candidats.filter((c) => voulus.has(c.id) && !exclure.has(c.id));
  }
  const audience = evenement.audience ?? (typeConnu(evenement.type) ? TYPES[evenement.type].audience : []);
  if (!audience.length) return [];
  return candidats.filter((c) => {
    if (exclure.has(c.id)) return false;
    const permissions = c.permissions instanceof Set ? c.permissions : new Set(c.permissions || []);
    if (!audience.some((p) => permissions.has(p))) return false;
    return couvreSociete(c, evenement.id_societe);
  });
}

// ---------------------------------------------------------------------------
// Mode de courrier
// ---------------------------------------------------------------------------

// Mode retenu pour une notification : preference de l'utilisateur pour ce
// type, sinon defaut du catalogue. Une urgence "immediat" (refus d'une
// saisie) fait passer un recapitulatif en envoi immediat ; elle ne reactive
// jamais un courrier desactive.
export function modeCourrier(preference, type, urgence = null) {
  const base = preference || courrierDefaut(type);
  if (base === "desactive") return "desactive";
  if (urgence === "immediat") return "immediat";
  return base;
}

export function statutCourrierInitial(mode) {
  return mode === "desactive" ? "sans_objet" : "a_envoyer";
}

// ---------------------------------------------------------------------------
// Paliers d'echeance
// ---------------------------------------------------------------------------

// Paliers en jours a partir des seuils du tenant (widget echeances-contrats,
// echelles en mois ou en jours). Un seuil nul (echelle 4 = 0 mois) n'est pas
// un palier d'anticipation. Sans seuil exploitable, les defauts 90/60/30.
export function paliersDepuisSeuils(seuils) {
  if (!Array.isArray(seuils) || !seuils.length) return [...PALIERS_CONTRAT_DEFAUT];
  const jours = seuils
    .map((s) => {
      const v = Number(s.valeur);
      if (!Number.isFinite(v) || v <= 0) return null;
      const unite = String(s.unite || "mois").toLowerCase();
      if (unite.startsWith("mois")) return Math.round(v * 30);
      if (unite.startsWith("semaine")) return Math.round(v * 7);
      return Math.round(v);
    })
    .filter((j) => j !== null && j > 0);
  const uniques = [...new Set(jours)].sort((a, b) => b - a);
  return uniques.length ? uniques : [...PALIERS_CONTRAT_DEFAUT];
}

// Palier atteint pour un nombre de jours restants : le plus serre des paliers
// que l'echeance a franchi. Une echeance a 20 jours avec les paliers 90/60/30
// donne 30, jamais trois notifications d'un coup. null si aucun palier n'est
// atteint ou si l'echeance est passee.
export function palierAtteint(joursRestants, paliers = PALIERS_CONTRAT_DEFAUT) {
  const j = Number(joursRestants);
  if (!Number.isFinite(j) || j < 0) return null;
  const atteints = paliers.filter((p) => j <= p);
  if (!atteints.length) return null;
  return Math.min(...atteints);
}

// ---------------------------------------------------------------------------
// Courriers (confidentialite v1.1, retours Samuel du 27/09)
//
// Aucun courriel ne porte de donnee metier : ni montant, ni quantite, ni
// motif, ni preuve d'ecart, ni titre ou message de la notification. Chaque
// courrier se reduit au libelle generique du type (catalogue COURRIELS,
// traduisible) et au lien vers l'ecran concerne ; la donnee reste dans
// l'application, servie sous controle des droits.
// ---------------------------------------------------------------------------

export const PREFIXE_SUJET = "SamSecure";

// Prefixe d'objet : SamSecure plus le nom du tenant (client.raison_sociale),
// lu par courriers.js. Sans nom (base vide, lecture en echec), SamSecure seul.
export function prefixeSujet(nomTenant) {
  return nomTenant ? `${PREFIXE_SUJET} - ${nomTenant}` : PREFIXE_SUJET;
}

function lienAbsolu(lien, urlBase) {
  if (!lien) return "";
  const base = String(urlBase || "").replace(/\/+$/, "");
  return base ? `${base}${lien.startsWith("/") ? "" : "/"}${lien}` : lien;
}

const MENTION_PREFERENCES = "Vous recevez ce message selon vos préférences de notification, modifiables dans SamSecure, menu Mon profil, onglet Notifications.";

// tr local des courriers : modele du referentiel langue/traduction s'il
// existe, modele francais sinon.
function trDe(traduire) {
  return (cle, modeleDefaut, params = null) =>
    appliquerModele((traduire && traduire(cle)) || modeleDefaut, params);
}

function libellesCourriel(type, tr) {
  const defaut = COURRIELS[type] || COURRIEL_GENERIQUE;
  return {
    objet: tr(`courriel.${type}.objet`, defaut.objet),
    message: tr(`courriel.${type}.message`, defaut.message),
  };
}

// Courrier immediat : libelle generique de l'evenement, lien vers l'ecran,
// mention du reglage. Texte brut, paragraphes separes par une ligne vide,
// comme l'attend le gabarit du socle mail. Jamais le titre ni le message de
// la notification.
export function composerCourrier(notification, { urlBase, nomTenant = null, traduire = null } = {}) {
  const tr = trDe(traduire);
  const lien = lienAbsolu(notification.lien, urlBase);
  const { objet, message } = libellesCourriel(notification.type, tr);
  const paragraphes = [
    message,
    lien ? tr("courriel.commun.ouvrir", "Consulter le détail dans SamSecure : {lien}", { lien }) : null,
    tr("courriel.commun.preferences", MENTION_PREFERENCES),
  ].filter(Boolean);
  return {
    sujet: `${prefixeSujet(nomTenant)} : ${objet}`,
    contenu: paragraphes.join("\n\n"),
  };
}

function libelleType(type, tr) {
  const defaut = typeConnu(type) ? TYPES[type].libelle : "Autres notifications";
  return tr(`type.${type}.libelle`, defaut);
}

// Recapitulatif quotidien : le nombre de notifications par type et les liens
// vers les ecrans concernes, en un seul courrier. Les liens identiques d'un
// meme type sont dedoublonnes (plusieurs alertes budget menent au meme
// ecran). Aucun texte de notification.
export function composerRecapitulatif(notifications, { urlBase, dateLabel, nomTenant = null, traduire = null } = {}) {
  const tr = trDe(traduire);
  const parType = new Map();
  for (const n of notifications) {
    if (!parType.has(n.type)) parType.set(n.type, []);
    parType.get(n.type).push(n);
  }
  const total = notifications.length;
  const date = dateLabel ? ` (${dateLabel})` : "";
  const intro = total > 1
    ? tr("courriel.recap.intro_plusieurs", "Vous avez {n} nouvelles notifications dans SamSecure{date}.", { n: total, date })
    : tr("courriel.recap.intro_une", "Vous avez {n} nouvelle notification dans SamSecure{date}.", { n: total, date });
  const blocs = [intro];
  // Ordre du catalogue, types inconnus a la fin.
  const ordre = [...Object.keys(TYPES), ...[...parType.keys()].filter((t) => !typeConnu(t))];
  for (const type of ordre) {
    const liste = parType.get(type);
    if (!liste) continue;
    const liens = [...new Set(liste.map((n) => lienAbsolu(n.lien, urlBase)).filter(Boolean))];
    const lignes = liens.map((lien) =>
      `- ${tr("courriel.recap.consulter", "Consulter : {lien}", { lien })}`);
    blocs.push(`${libelleType(type, tr)} (${liste.length})${lignes.length ? `\n${lignes.join("\n")}` : ""}`);
  }
  blocs.push(tr("courriel.commun.preferences", MENTION_PREFERENCES));
  const sujet = total > 1
    ? tr("courriel.recap.objet_plusieurs", "récapitulatif quotidien, {n} notifications", { n: total })
    : tr("courriel.recap.objet_une", "récapitulatif quotidien, {n} notification", { n: total });
  return {
    sujet: `${prefixeSujet(nomTenant)} : ${sujet}`,
    contenu: blocs.join("\n\n"),
  };
}

export function libelleMode(mode) {
  return LIBELLES_MODES[mode] || mode;
}

// ---------------------------------------------------------------------------
// Heure de Paris
// ---------------------------------------------------------------------------

export const FUSEAU = "Europe/Paris";

const formateur = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU, hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});

// Composants calendaires d'un instant, vus de Paris.
export function composantsParis(date = new Date()) {
  const p = {};
  for (const part of formateur.formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return {
    annee: p.year, mois: p.month, jour: p.day,
    heure: p.hour === 24 ? 0 : p.hour, minute: p.minute, seconde: p.second,
  };
}

// Date du jour a Paris, au format AAAA-MM-JJ.
export function dateParis(date = new Date()) {
  const c = composantsParis(date);
  return `${c.annee}-${String(c.mois).padStart(2, "0")}-${String(c.jour).padStart(2, "0")}`;
}

// Instant (UTC) correspondant a une heure locale de Paris. Deux passes de
// correction absorbent le decalage, y compris les jours de changement d'heure.
export function instantParis(annee, mois, jour, heure, minute) {
  let t = Date.UTC(annee, mois - 1, jour, heure, minute, 0);
  for (let i = 0; i < 2; i += 1) {
    const c = composantsParis(new Date(t));
    const vu = Date.UTC(c.annee, c.mois - 1, c.jour, c.heure, c.minute, 0);
    t -= vu - Date.UTC(annee, mois - 1, jour, heure, minute, 0);
  }
  return new Date(t);
}

// Prochaine occurrence d'une heure de Paris, strictement apres maintenant.
export function prochaineOccurrence(heure, minute, maintenant = new Date()) {
  const c = composantsParis(maintenant);
  let cible = instantParis(c.annee, c.mois, c.jour, heure, minute);
  if (cible.getTime() <= maintenant.getTime()) {
    const lendemain = new Date(Date.UTC(c.annee, c.mois - 1, c.jour + 1, 12, 0, 0));
    const d = composantsParis(lendemain);
    cible = instantParis(d.annee, d.mois, d.jour, heure, minute);
  }
  return cible;
}

// Vrai si l'heure de Paris du jour est deja passee (rattrapage au demarrage).
export function heurePassee(heure, minute, maintenant = new Date()) {
  const c = composantsParis(maintenant);
  return c.heure > heure || (c.heure === heure && c.minute >= minute);
}
