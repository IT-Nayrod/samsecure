// fiscalPeriod - periodes nommees (fiscale_courante, civile_precedente, glissantes...) pour Commandes et Dashboard
// Le calcul d'exercice fiscal est delegue a src/utils/periode.js (US #164), seule implementation du projet.
import { mockSocietes } from '../data/mockReferentiels';
import { mockTenant } from '../data/mockSettings';
import {
  exerciceFiscal, exerciceFiscalParCle, normaliserDebutExercice, toIsoDate as toIsoDatePartage,
} from './periode';

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

// Resout le debut d'exercice fiscal applicable.
// debutExercice fourni par l'appelant prime : c'est la voie des ecrans branches
// sur l'API. Le repli sur les mocks reste en place pour budget et dashboard,
// qui ne sont pas encore branches (module 4).
export function getDebutExerciceFiscal(societeId, debutExercice = null) {
  if (debutExercice) return debutExercice;
  if (societeId) {
    const societe = mockSocietes.find(s => s.id === societeId);
    if (societe?.debut_exercice_fiscal) return societe.debut_exercice_fiscal;
  }
  return mockTenant.debut_exercice_fiscal ?? { jour: 1, mois: 1 };
}

// societe.debut_exercice_fiscal est une colonne DATE cote base : seuls le jour
// et le mois portent du sens, l'annee est arbitraire.
export function debutExerciceDepuisDate(dateIso) {
  if (!dateIso) return null;
  return normaliserDebutExercice(dateIso);
}

// Plage [debut, fin] de l'exercice fiscal contenant `reference`, decale de `yearOffset` exercices
function fiscalYearRange(reference, debutExercice, yearOffset = 0) {
  const { debut, fin } = exerciceFiscal(reference, debutExercice, yearOffset);
  return { debut, fin };
}

// Resout une periode nommee en plage de dates concretes
// societeId : si fourni, utilise l'exercice fiscal de cette societe ; sinon le defaut tenant (vues agregees)
export function resolveFiscalPeriod(periodeKey, { societeId = null, debutExercice = null, customDebut = null, customFin = null, now = new Date() } = {}) {
  const debut = getDebutExerciceFiscal(societeId, debutExercice);

  switch (periodeKey) {
    case 'fiscale_courante':
      return fiscalYearRange(now, debut, 0);
    case 'fiscale_precedente':
      return fiscalYearRange(now, debut, -1);
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
      return fiscalYearRange(now, debut, 0);
  }
}

// Exercice fiscal identifie par l'annee de son anniversaire de demarrage (ex. exercice qui debute le 01/04/2026 -> '2026')
// Utilise comme cle pour les budgets (mockBudgets.js), independamment de la societe consultee
export function getExerciceFiscalKey(societeId, offsetExercices = 0, now = new Date()) {
  const range = fiscalYearRange(now, getDebutExerciceFiscal(societeId), offsetExercices);
  return String(range.debut.getFullYear());
}

export function getExerciceFiscalRange(exerciceKey, societeId) {
  const p = exerciceFiscalParCle(exerciceKey, getDebutExerciceFiscal(societeId));
  return p ? { debut: p.debut, fin: p.fin } : { debut: null, fin: null };
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

// Bornes en YYYY-MM-DD, sans passer par toISOString qui bascule en UTC et
// pourrait reculer d'un jour selon le fuseau. Meme implementation que periode.js.
export function toIsoDate(d) {
  return toIsoDatePartage(d);
}