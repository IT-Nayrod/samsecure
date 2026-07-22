// fiscalPeriod - calcul des periodes fiscales/civiles a partir de la date d'anniversaire fiscale d'une societe
import { mockSocietes } from '../data/mockReferentiels';
import { mockTenant } from '../data/mockSettings';

export const PERIODE_OPTIONS = [
  { value: 'fiscale_courante', label: 'Année fiscale en cours' },
  { value: 'fiscale_precedente', label: 'Année fiscale précédente' },
  { value: 'civile_courante', label: 'Année civile en cours' },
  { value: 'civile_precedente', label: 'Année civile précédente' },
  { value: 'mois_courant', label: 'Mois en cours' },
  { value: '3_derniers_mois', label: '3 derniers mois' },
  { value: '12_derniers_mois', label: '12 derniers mois' },
  { value: 'personnalisee', label: 'Période personnalisée' },
];

function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0);
}

// Resout le debut d'exercice fiscal applicable : societe unique > defaut tenant
export function getDebutExerciceFiscal(societeId) {
  if (societeId) {
    const societe = mockSocietes.find(s => s.id === societeId);
    if (societe?.debut_exercice_fiscal) return societe.debut_exercice_fiscal;
  }
  return mockTenant.debut_exercice_fiscal ?? { jour: 1, mois: 1 };
}

// Plage [debut, fin] de l'exercice fiscal contenant `reference`, decale de `yearOffset` exercices
function fiscalYearRange(reference, debutExercice, yearOffset = 0) {
  const { jour, mois } = debutExercice;
  let year = reference.getFullYear();
  const anchor = new Date(year, mois - 1, jour);
  if (reference < anchor) year -= 1;
  year += yearOffset;
  const debut = new Date(year, mois - 1, jour);
  const fin = new Date(year + 1, mois - 1, jour);
  fin.setDate(fin.getDate() - 1);
  return { debut, fin };
}

// Resout une periode nommee en plage de dates concretes
// societeId : si fourni, utilise l'exercice fiscal de cette societe ; sinon le defaut tenant (vues agregees)
export function resolveFiscalPeriod(periodeKey, { societeId = null, customDebut = null, customFin = null, now = new Date() } = {}) {
  const debutExercice = getDebutExerciceFiscal(societeId);

  switch (periodeKey) {
    case 'fiscale_courante':
      return fiscalYearRange(now, debutExercice, 0);
    case 'fiscale_precedente':
      return fiscalYearRange(now, debutExercice, -1);
    case 'civile_courante':
      return { debut: new Date(now.getFullYear(), 0, 1), fin: new Date(now.getFullYear(), 11, 31) };
    case 'civile_precedente':
      return { debut: new Date(now.getFullYear() - 1, 0, 1), fin: new Date(now.getFullYear() - 1, 11, 31) };
    case 'mois_courant':
      return { debut: new Date(now.getFullYear(), now.getMonth(), 1), fin: lastDayOfMonth(now.getFullYear(), now.getMonth()) };
    case '3_derniers_mois': {
      const debut = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate() + 1);
      return { debut, fin: now };
    }
    case '12_derniers_mois': {
      const debut = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1);
      return { debut, fin: now };
    }
    case 'personnalisee':
      return {
        debut: customDebut ? new Date(customDebut) : null,
        fin: customFin ? new Date(customFin) : null,
      };
    default:
      return fiscalYearRange(now, debutExercice, 0);
  }
}

// Exercice fiscal identifie par l'annee de son anniversaire de demarrage (ex. exercice qui debute le 01/04/2026 -> '2026')
// Utilise comme cle pour les budgets (mockBudgets.js), independamment de la societe consultee
export function getExerciceFiscalKey(societeId, offsetExercices = 0, now = new Date()) {
  const range = fiscalYearRange(now, getDebutExerciceFiscal(societeId), offsetExercices);
  return String(range.debut.getFullYear());
}

export function getExerciceFiscalRange(exerciceKey, societeId) {
  const { jour, mois } = getDebutExerciceFiscal(societeId);
  const year = Number(exerciceKey);
  const debut = new Date(year, mois - 1, jour);
  const fin = new Date(year + 1, mois - 1, jour);
  fin.setDate(fin.getDate() - 1);
  return { debut, fin };
}

export function isDateInRange(dateString, range) {
  if (!range?.debut || !range?.fin) return true;
  const d = new Date(dateString);
  return d >= range.debut && d <= range.fin;
}

export function formatPeriodeLabel(range) {
  if (!range?.debut || !range?.fin) return '-';
  const fmt = d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${fmt(range.debut)} au ${fmt(range.fin)}`;
}
