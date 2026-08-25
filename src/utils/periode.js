// periode - Calcul de période partagé (Budget, fiches, rapports) - SamSecure v0.5 - US #164
// Fonctions pures, aucun import, aucune dépendance React ni mock : testable avec `node --test`.
//
// Deux axes :
//   TYPE     : 'calendaire' (année civile), 'trimestre' (civil), 'fiscale' (exercice ancré sur
//              debut_exercice_fiscal de l'organisation, défaut 1er janvier)
//   FENETRE  : 'courant', 'precedent', 'suivant' (décalage -1 / 0 / +1 par rapport à la
//              période contenant la date de référence, aujourd'hui par défaut)
//
// Une période résolue a toujours la forme :
//   { type, fenetre, debut: Date, fin: Date, dateDebut: 'YYYY-MM-DD', dateFin: 'YYYY-MM-DD', label, cle }
// `debut` et `fin` sont des Date locales à minuit (pas d'UTC, pas de décalage de fuseau),
// `dateDebut` et `dateFin` les mêmes bornes en ISO calendaire pour l'API et les query params.

export const TYPES_PERIODE = [
  { value: 'calendaire', label: 'Année calendaire' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'fiscale', label: 'Année fiscale' },
];

export const FENETRES_PERIODE = [
  { value: 'precedent', label: 'Précédent', offset: -1 },
  { value: 'courant', label: 'En cours', offset: 0 },
  { value: 'suivant', label: 'Suivant', offset: 1 },
];

export const DEBUT_EXERCICE_DEFAUT = Object.freeze({ jour: 1, mois: 1 });

function padZ(n) { return String(n).padStart(2, '0'); }

/** Date locale -> 'YYYY-MM-DD' sans passer par toISOString (qui bascule en UTC). */
export function toIsoDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}`;
}

/** 'YYYY-MM-DD' -> Date locale à minuit (new Date('YYYY-MM-DD') serait interprété en UTC). */
export function fromIsoDate(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const [y, m, j] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !j) return null;
  return new Date(y, m - 1, j);
}

function formatJJ(d) { return `${padZ(d.getDate())}/${padZ(d.getMonth() + 1)}/${d.getFullYear()}`; }

export function estBissextile(annee) {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
}

/** Nombre de jours du mois (1-12) pour une année donnée. */
export function joursDansMois(annee, mois) {
  return new Date(annee, mois, 0).getDate();
}

/**
 * Normalise un début d'exercice fiscal en { jour, mois } (mois 1-12).
 * Formats acceptés :
 *   - { jour, mois }                        (mocks front)
 *   - 'YYYY-MM-DD' ou 'MM-DD'               (colonne DATE::text de l'API, seuls jour et mois comptent)
 *   - objet société portant debut_exercice_fiscal dans l'un de ces formats
 *   - null / undefined / valeur invalide    -> 1er janvier
 */
export function normaliserDebutExercice(valeur) {
  if (valeur == null || valeur === '') return DEBUT_EXERCICE_DEFAUT;
  if (typeof valeur === 'object' && 'debut_exercice_fiscal' in valeur) {
    return normaliserDebutExercice(valeur.debut_exercice_fiscal);
  }
  let jour, mois;
  if (typeof valeur === 'string') {
    const parts = valeur.slice(0, 10).split('-').map(Number);
    if (parts.length === 3) [, mois, jour] = parts;
    else if (parts.length === 2) [mois, jour] = parts;
  } else if (typeof valeur === 'object') {
    jour = Number(valeur.jour);
    mois = Number(valeur.mois);
  }
  if (!Number.isInteger(jour) || !Number.isInteger(mois) || mois < 1 || mois > 12 || jour < 1 || jour > 31) {
    return DEBUT_EXERCICE_DEFAUT;
  }
  // 31 avril, 30 février... : borné au maximum possible du mois (année bissextile pour février)
  const maxJour = mois === 2 ? 29 : joursDansMois(2001, mois);
  return { jour: Math.min(jour, maxJour), mois };
}

/**
 * Date d'anniversaire de l'exercice pour une année donnée.
 * Un exercice ancré au 29 février tombe au 28 février les années non bissextiles
 * (choix documenté au journal : borne au dernier jour du mois, jamais de glissement au 1er mars).
 */
export function dateAnniversaire(annee, debutExercice) {
  const { jour, mois } = normaliserDebutExercice(debutExercice);
  return new Date(annee, mois - 1, Math.min(jour, joursDansMois(annee, mois)));
}

/** Veille d'une date (Date locale). */
function veille(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
}

function offsetFenetre(fenetre) {
  const f = FENETRES_PERIODE.find(x => x.value === fenetre);
  return f ? f.offset : 0;
}

/** Année civile contenant `reference`, décalée de `offset` années. */
export function anneeCalendaire(reference, offset = 0) {
  const annee = reference.getFullYear() + offset;
  return {
    debut: new Date(annee, 0, 1),
    fin: new Date(annee, 11, 31),
    label: `Année ${annee}`,
    cle: String(annee),
  };
}

/** Trimestre civil contenant `reference`, décalé de `offset` trimestres (changement d'année géré). */
export function trimestreCivil(reference, offset = 0) {
  const indexAbsolu = reference.getFullYear() * 4 + Math.floor(reference.getMonth() / 3) + offset;
  const annee = Math.floor(indexAbsolu / 4);
  const t = indexAbsolu - annee * 4; // 0-3
  const moisDebut = t * 3;
  return {
    debut: new Date(annee, moisDebut, 1),
    fin: new Date(annee, moisDebut + 3, 0), // dernier jour du 3e mois, bissextile inclus (T1)
    label: `T${t + 1} ${annee}`,
    cle: `${annee}-T${t + 1}`,
  };
}

/**
 * Exercice fiscal contenant `reference`, décalé de `offset` exercices.
 * L'exercice est identifié par l'année de son anniversaire de démarrage (cle) :
 * une société clôturant au 31 mars a son exercice 2026 du 01/04/2026 au 31/03/2027.
 */
export function exerciceFiscal(reference, debutExercice, offset = 0) {
  const de = normaliserDebutExercice(debutExercice);
  let annee = reference.getFullYear();
  if (reference < dateAnniversaire(annee, de)) annee -= 1;
  annee += offset;
  const debut = dateAnniversaire(annee, de);
  const fin = veille(dateAnniversaire(annee + 1, de));
  const civil = de.jour === 1 && de.mois === 1;
  return {
    debut,
    fin,
    label: civil
      ? `Exercice ${annee}`
      : `Exercice ${annee}-${annee + 1} (${formatJJ(debut)} au ${formatJJ(fin)})`,
    cle: String(annee),
  };
}

/** Exercice fiscal désigné par sa clé (année de démarrage), sans notion de référence. */
export function exerciceFiscalParCle(cle, debutExercice) {
  const annee = Number(cle);
  if (!Number.isInteger(annee)) return null;
  const de = normaliserDebutExercice(debutExercice);
  return exerciceFiscal(dateAnniversaire(annee, de), de, 0);
}

/**
 * Point d'entrée unique : résout une période { type, fenetre } en bornes concrètes.
 *   type           : 'calendaire' | 'trimestre' | 'fiscale' (défaut 'calendaire')
 *   fenetre        : 'courant' | 'precedent' | 'suivant' (défaut 'courant')
 *   debutExercice  : voir normaliserDebutExercice (objet société accepté)
 *   reference      : Date de référence (défaut aujourd'hui), injectable pour les tests
 */
export function resoudrePeriode({ type = 'calendaire', fenetre = 'courant', debutExercice = null, reference = new Date() } = {}) {
  const ref = reference instanceof Date ? reference : (fromIsoDate(reference) ?? new Date());
  const offset = offsetFenetre(fenetre);
  let base;
  if (type === 'trimestre') base = trimestreCivil(ref, offset);
  else if (type === 'fiscale') base = exerciceFiscal(ref, debutExercice, offset);
  else { type = 'calendaire'; base = anneeCalendaire(ref, offset); }
  return {
    type,
    fenetre: FENETRES_PERIODE.some(f => f.value === fenetre) ? fenetre : 'courant',
    ...base,
    dateDebut: toIsoDate(base.debut),
    dateFin: toIsoDate(base.fin),
  };
}

/** Teste l'appartenance d'une date (Date ou 'YYYY-MM-DD') à une période résolue, bornes incluses. */
export function dateDansPeriode(date, periode) {
  if (!periode?.debut || !periode?.fin) return true;
  const d = date instanceof Date ? date : fromIsoDate(date);
  if (!d) return false;
  return d >= periode.debut && d <= periode.fin;
}

/** Teste le chevauchement d'un intervalle [dateDebut, dateFin] avec une période résolue. */
export function intervalleChevauchePeriode(dateDebut, dateFin, periode) {
  if (!periode?.debut || !periode?.fin) return true;
  const d1 = dateDebut instanceof Date ? dateDebut : fromIsoDate(dateDebut);
  const d2 = dateFin instanceof Date ? dateFin : fromIsoDate(dateFin);
  if (!d1 || !d2) return false;
  return d1 <= periode.fin && d2 >= periode.debut;
}

/** 'JJ/MM/AAAA au JJ/MM/AAAA' */
export function formatBornes(periode) {
  if (!periode?.debut || !periode?.fin) return '-';
  return `${formatJJ(periode.debut)} au ${formatJJ(periode.fin)}`;
}
