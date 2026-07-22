// BuilderPeriodSection - Selecteur de periode inline pour le builder - SamSecure v0.5
import { useMemo } from 'react';
import {
  getAnneesDisponibles, getPeriodeAnneeCalendaire, getExercicesFiscaux,
  getPeriodeTroisDerniersMois, getPeriodeMois,
} from '../../../utils/periodUtils';

const NOMS_MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MODES = [
  { value: 'annee_calendaire', label: 'Année' },
  { value: 'annee_fiscale',    label: 'Exercice fiscal' },
  { value: 'trois_mois',       label: '3 derniers mois' },
  { value: 'mois',             label: 'Mois' },
  { value: 'personnalisee',    label: 'Personnalisée' },
];

export default function BuilderPeriodSection({ periode, onChange, champDate, onChampDateChange, champsDateOptions }) {
  const annees = useMemo(() => getAnneesDisponibles(), []);
  const exercices = useMemo(() => getExercicesFiscaux(), []);

  const mode = periode.mode ?? 'annee_calendaire';
  const annee = periode.annee ?? annees[annees.length - 1];
  const exerciceIdx = periode.exerciceIdx ?? exercices.length - 1;
  const moisAnnee = periode.moisAnnee ?? annees[annees.length - 1];
  const moisMois = periode.moisMois ?? 1;
  const persoDebut = periode.persoDebut ?? '';
  const persoFin = periode.persoFin ?? '';

  function update(patch) {
    onChange({ ...periode, ...patch });
  }

  function resolvedPeriode() {
    switch (mode) {
      case 'annee_calendaire': return getPeriodeAnneeCalendaire(annee);
      case 'annee_fiscale':    return exercices[exerciceIdx] ?? exercices[0];
      case 'trois_mois':       return getPeriodeTroisDerniersMois();
      case 'mois':             return getPeriodeMois(moisAnnee, moisMois);
      case 'personnalisee':
        if (persoDebut && persoFin) return { dateDebut: persoDebut, dateFin: persoFin };
        return null;
      default: return null;
    }
  }
  const resolved = resolvedPeriode();

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Periode</h3>

      {/* Mode tabs */}
      <div className="flex flex-wrap gap-1">
        {MODES.map(m => (
          <button
            key={m.value}
            type="button"
            onClick={() => update({ mode: m.value })}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${mode === m.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'annee_calendaire' && (
        <select value={annee} onChange={e => update({ annee: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
          {[...annees].reverse().map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      )}

      {mode === 'annee_fiscale' && (
        <select value={exerciceIdx} onChange={e => update({ exerciceIdx: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
          {[...exercices].map((ex, i) => <option key={ex.dateDebut} value={i}>{ex.label}</option>)}
        </select>
      )}

      {mode === 'mois' && (
        <div className="flex gap-2">
          <select value={moisAnnee} onChange={e => update({ moisAnnee: Number(e.target.value) })} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
            {[...annees].reverse().map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={moisMois} onChange={e => update({ moisMois: Number(e.target.value) })} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
            {NOMS_MOIS.map((nm, i) => <option key={i+1} value={i+1}>{nm}</option>)}
          </select>
        </div>
      )}

      {mode === 'personnalisee' && (
        <div className="flex gap-2">
          <input type="date" value={persoDebut} onChange={e => update({ persoDebut: e.target.value })} className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
          <input type="date" value={persoFin} min={persoDebut} onChange={e => update({ persoFin: e.target.value })} className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
        </div>
      )}

      {resolved && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{resolved.label ?? `${resolved.dateDebut} - ${resolved.dateFin}`}</p>
      )}

      {/* Champ date d'application */}
      {champsDateOptions?.length > 0 && (
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Appliquer la periode sur</label>
          <select value={champDate ?? ''} onChange={e => onChampDateChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
            <option value="">(tous)</option>
            {champsDateOptions.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
