// periodUtils - Gestion des periodes pour le module Rapports - SamSecure v0.5
// Fonctions pures sans dependance React. Objets Date uniquement dans les calculs.
// Retourne { dateDebut: 'YYYY-MM-DD', dateFin: 'YYYY-MM-DD', label: string }.

const NOMS_MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function padZ(n) { return String(n).padStart(2, '0'); }
function dateToISO(d) { return `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}`; }
function formatJJ(d) { return `${padZ(d.getDate())}/${padZ(d.getMonth() + 1)}/${d.getFullYear()}`; }

/** Retourne les 4 annees disponibles : 3 ans d'anteriorite + annee courante */
export function getAnneesDisponibles() {
  const year = new Date().getFullYear();
  return [year - 3, year - 2, year - 1, year];
}

/** Periode annee calendaire complete */
export function getPeriodeAnneeCalendaire(annee) {
  return {
    dateDebut: `${annee}-01-01`,
    dateFin: `${annee}-12-31`,
    label: `Année ${annee}`,
  };
}

/**
 * Liste des exercices fiscaux disponibles : 3 passes + exercice courant.
 * debutExercice : 'MM-DD' (ex: '04-01' pour un exercice au 1er avril).
 * Si debut = '01-01', l'exercice est calque sur l'annee civile, label simplifie.
 *
 * TODO: brancher sur societe.debut_exercice_fiscal au lieu du parametre fixe.
 */
export function getExercicesFiscaux(debutExercice = '01-01') {
  const [mStr, jStr] = debutExercice.split('-');
  const mois = parseInt(mStr, 10) - 1; // 0-indexed
  const jour = parseInt(jStr, 10);
  const now = new Date();

  const result = [];
  for (let offset = -3; offset <= 0; offset++) {
    let anneeDebut = now.getFullYear();
    const anniversaire = new Date(anneeDebut, mois, jour);
    if (now < anniversaire) anneeDebut -= 1;
    anneeDebut += offset;

    const debut = new Date(anneeDebut, mois, jour);
    const finRaw = new Date(anneeDebut + 1, mois, jour);
    finRaw.setDate(finRaw.getDate() - 1);

    let label;
    if (mois === 0 && jour === 1) {
      label = `Exercice ${anneeDebut}`;
    } else {
      label = `Exercice ${anneeDebut}-${anneeDebut + 1} (${formatJJ(debut)} - ${formatJJ(finRaw)})`;
    }

    result.push({ dateDebut: dateToISO(debut), dateFin: dateToISO(finRaw), label });
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

/** Periode d'un mois precis (mois : 1-12) */
export function getPeriodeMois(annee, mois) {
  const debut = new Date(annee, mois - 1, 1);
  const fin = new Date(annee, mois, 0);
  return {
    dateDebut: dateToISO(debut),
    dateFin: dateToISO(fin),
    label: `${NOMS_MOIS[mois - 1]} ${annee}`,
  };
}

/** Verifie si une date ISO string est dans une periode { dateDebut, dateFin } */
export function estDansPeriode(dateStr, periode) {
  if (!dateStr || !periode?.dateDebut || !periode?.dateFin) return false;
  const d = new Date(dateStr);
  return d >= new Date(periode.dateDebut) && d <= new Date(periode.dateFin);
}

/** Labellise une periode {dateDebut, dateFin} en 'JJ/MM/AAAA - JJ/MM/AAAA' */
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
