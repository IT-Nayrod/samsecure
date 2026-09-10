// Gestion des périodes du module Rapports.
// Fonctions pures sans dépendance React. Objets Date uniquement dans les calculs.
// Retourne { dateDebut: 'YYYY-MM-DD', dateFin: 'YYYY-MM-DD', label: string }.
// Le calcul d'exercice fiscal est délégué à src/utils/periode.js (US #164).
import { exerciceFiscal } from './periode';

const NOMS_MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function padZ(n) { return String(n).padStart(2, '0'); }
function dateToISO(d) { return `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}`; }
function formatJJ(d) { return `${padZ(d.getDate())}/${padZ(d.getMonth() + 1)}/${d.getFullYear()}`; }

/** Retourne les 4 années disponibles : 3 ans d'antériorité + année courante */
export function getAnneesDisponibles() {
  const year = new Date().getFullYear();
  return [year - 3, year - 2, year - 1, year];
}

/** Période année calendaire complète */
export function getPeriodeAnneeCalendaire(annee) {
  return {
    dateDebut: `${annee}-01-01`,
    dateFin: `${annee}-12-31`,
    label: `Année ${annee}`,
  };
}

/**
 * Liste des exercices fiscaux disponibles : 3 passes + exercice courant.
 * debutExercice : tout format accepte par periode.normaliserDebutExercice
 * ('MM-DD', 'YYYY-MM-DD', { jour, mois }, objet société ; défaut 1er janvier).
 * Si l'exercice démarre au 1er janvier, il est calqué sur l'année civile, label simplifié.
 */
export function getExercicesFiscaux(debutExercice = '01-01') {
  const now = new Date();
  const result = [];
  for (let offset = -3; offset <= 0; offset++) {
    const { debut, fin, cle } = exerciceFiscal(now, debutExercice, offset);
    const anneeDebut = Number(cle);
    const civil = debut.getMonth() === 0 && debut.getDate() === 1;
    const label = civil
      ? `Exercice ${anneeDebut}`
      : `Exercice ${anneeDebut}-${anneeDebut + 1} (${formatJJ(debut)} - ${formatJJ(fin)})`;
    result.push({ dateDebut: dateToISO(debut), dateFin: dateToISO(fin), label });
  }
  return result;
}

/** 3 derniers mois glissants depuis aujourd'hui */
export function getPeriodeTroisDerniersMois() {
  const now = new Date();
  const debut = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate() + 1);
  return {
    dateDebut: dateToISO(debut),
    dateFin: dateToISO(now),
    label: `3 derniers mois (${formatJJ(debut)} - ${formatJJ(now)})`,
  };
}

/** Période d'un mois précis (mois : 1-12) */
export function getPeriodeMois(annee, mois) {
  const debut = new Date(annee, mois - 1, 1);
  const fin = new Date(annee, mois, 0);
  return {
    dateDebut: dateToISO(debut),
    dateFin: dateToISO(fin),
    label: `${NOMS_MOIS[mois - 1]} ${annee}`,
  };
}

/** Vérifie si une date ISO string est dans une période { dateDebut, dateFin } */
export function estDansPeriode(dateStr, periode) {
  if (!dateStr || !periode?.dateDebut || !periode?.dateFin) return false;
  const d = new Date(dateStr);
  return d >= new Date(periode.dateDebut) && d <= new Date(periode.dateFin);
}

/** Labellise une période {dateDebut, dateFin} en 'JJ/MM/AAAA - JJ/MM/AAAA' */
export function labelPeriode(periode) {
  if (!periode?.dateDebut) return '';
  const d1 = new Date(periode.dateDebut);
  const d2 = new Date(periode.dateFin);
  return `${formatJJ(d1)} - ${formatJJ(d2)}`;
}

/** Formate une date ISO en JJ/MM/AAAA */
export function formatDateFR(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return formatJJ(d);
}
