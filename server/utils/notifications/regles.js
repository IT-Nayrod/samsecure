// Regles pures du module notifications (story #121).
//
// Aucun acces a la base, aucune dependance au serveur : tout ce qui est ici
// se teste en isolation (regles.test.js, node --test). Le moteur, les
// courriers et le planificateur ne font qu'alimenter ces fonctions avec des
// donnees lues en base.
import {
  TYPES, typeConnu, courrierDefaut, LIBELLES_MODES, PALIERS_CONTRAT_DEFAUT,
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

// Cle d'une echeance (echeance_contrat, echeance_souscription), 16/09/2026 :
// type:id:date_fin:palier. La date de fin fait partie de la cle pour qu'une
// prolongation (nouvelle date de fin) produise naturellement une nouvelle
// notification au passage suivant, sans liberation manuelle de la cle
// precedente. L'anti-doublon reste porte par l'index unique (051) : meme
// entite, meme date de fin, meme palier, une seule notification par
// utilisateur. La date est reduite au jour calendaire, qu'elle arrive en
// chaine ISO ou en Date ; sans date, le segment vaut "aucun" comme ailleurs.
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
//   candidats : [{ id, email, prenom, nom, permissions: Set, isTenantScope, societeIds }]
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
// Courriers
// ---------------------------------------------------------------------------

export const PREFIXE_SUJET = "SamSecure";

function lienAbsolu(lien, urlBase) {
  if (!lien) return "";
  const base = String(urlBase || "").replace(/\/+$/, "");
  return base ? `${base}${lien.startsWith("/") ? "" : "/"}${lien}` : lien;
}

const MENTION_PREFERENCES = "Vous recevez ce message selon vos préférences de notification, modifiables dans SamSecure, menu Mon profil, onglet Notifications.";

// Courrier immediat : meme contenu que la notification, lien vers l'ecran,
// mention du reglage. Texte brut, paragraphes separes par une ligne vide,
// comme l'attend le gabarit du socle mail.
export function composerCourrier(notification, { urlBase } = {}) {
  const lien = lienAbsolu(notification.lien, urlBase);
  const paragraphes = [
    notification.message,
    lien ? `Ouvrir l'écran concerné : ${lien}` : null,
    MENTION_PREFERENCES,
  ].filter(Boolean);
  return {
    sujet: `${PREFIXE_SUJET} : ${notification.titre}`,
    contenu: paragraphes.join("\n\n"),
  };
}

function libelleType(type) {
  return typeConnu(type) ? TYPES[type].libelle : "Autres notifications";
}

// Recapitulatif quotidien : les notifications de la veille regroupees par
// type, chacune avec son texte et son lien, en un seul courrier.
export function composerRecapitulatif(notifications, { urlBase, dateLabel } = {}) {
  const parType = new Map();
  for (const n of notifications) {
    if (!parType.has(n.type)) parType.set(n.type, []);
    parType.get(n.type).push(n);
  }
  const total = notifications.length;
  const intro = `Vous avez ${total} ${total > 1 ? "nouvelles notifications" : "nouvelle notification"} dans SamSecure` +
    (dateLabel ? ` (${dateLabel})` : "") + ".";
  const blocs = [intro];
  // Ordre du catalogue, types inconnus a la fin.
  const ordre = [...Object.keys(TYPES), ...[...parType.keys()].filter((t) => !typeConnu(t))];
  for (const type of ordre) {
    const liste = parType.get(type);
    if (!liste) continue;
    const lignes = liste.map((n) => {
      const lien = lienAbsolu(n.lien, urlBase);
      return `- ${n.message}${lien ? `\n  ${lien}` : ""}`;
    });
    blocs.push(`${libelleType(type)} (${liste.length})\n${lignes.join("\n")}`);
  }
  blocs.push(MENTION_PREFERENCES);
  return {
    sujet: `${PREFIXE_SUJET} : récapitulatif quotidien, ${total} ${total > 1 ? "notifications" : "notification"}`,
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
