// ReportPeriodModal - Selecteur de periode + parametres supplementaires - SamSecure v0.5
// Navigue vers /rapports/vue/:reportId?du=...&au=... apres validation.
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronDown } from 'lucide-react';
import {
  getAnneesDisponibles, getPeriodeAnneeCalendaire, getExercicesFiscaux,
  getPeriodeTroisDerniersMois, getPeriodeMois,
} from '../../utils/periodUtils';
import { mockEditeurs } from '../../data/mockReferentiels';

const NOMS_MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const MODE_OPTIONS = [
  { value: 'annee_calendaire', label: 'Année calendaire' },
  { value: 'annee_fiscale',    label: 'Année fiscale' },
  { value: 'trois_mois',       label: '3 derniers mois' },
  { value: 'mois',             label: 'Mois' },
  { value: 'personnalisee',    label: 'Période personnalisée' },
];

export default function ReportPeriodModal({ report, onClose }) {
  const navigate = useNavigate();
  const annees = useMemo(() => getAnneesDisponibles(), []);
  const exercices = useMemo(() => getExercicesFiscaux(), []);

  const [mode, setMode] = useState('annee_calendaire');
  const [annee, setAnnee] = useState(annees[annees.length - 1]);
  const [exerciceIdx, setExerciceIdx] = useState(exercices.length - 1);
  const [moisAnnee, setMoisAnnee] = useState(annees[annees.length - 1]);
  const [moisMois, setMoisMois] = useState(new Date().getMonth() + 1);
  const [perisoDebut, setPerisoDebut] = useState('');
  const [perisoFin, setPerisoFin] = useState('');

  // Parametres supplementaires (extraParams)
  const [extraValues, setExtraValues] = useState({});

  const periode = useMemo(() => {
    switch (mode) {
      case 'annee_calendaire': return getPeriodeAnneeCalendaire(annee);
      case 'annee_fiscale':    return exercices[exerciceIdx] ?? exercices[0];
      case 'trois_mois':       return getPeriodeTroisDerniersMois();
      case 'mois':             return getPeriodeMois(moisAnnee, moisMois);
      case 'personnalisee': {
        if (!perisoDebut || !perisoFin) return null;
        const d = new Date(perisoDebut);
        const f = new Date(perisoFin);
        if (isNaN(d) || isNaN(f) || d > f) return null;
        return { dateDebut: perisoDebut, dateFin: perisoFin, label: `${perisoDebut} - ${perisoFin}` };
      }
      default: return null;
    }
  }, [mode, annee, exerciceIdx, moisAnnee, moisMois, perisoDebut, perisoFin, exercices]);

  const extraParamsMissing = (report.extraParams ?? []).some(p => p.required && !extraValues[p.key]);
  const canSubmit = !!periode && !extraParamsMissing;

  function handleGenerer() {
    if (!canSubmit) return;
    const params = new URLSearchParams({ du: periode.dateDebut, au: periode.dateFin });
    Object.entries(extraValues).forEach(([k, v]) => { if (v) params.set(k, v); });
    navigate(`/rapports/vue/${report.id}?${params.toString()}`);
    onClose();
  }

  function renderSourceOptions(source) {
    if (source === 'editeurs') return mockEditeurs.map(e => <option key={e.id} value={e.id}>{e.raison_sociale}</option>);
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white text-lg">Paramètres du rapport</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{report.titre}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{report.description}</p>
          </div>

          {/* Mode periode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Periode</label>
            <div className="grid grid-cols-1 gap-1.5">
              {MODE_OPTIONS.map(opt => (
                <label key={opt.value} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${mode === opt.value ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                  <input type="radio" name="mode" value={opt.value} checked={mode === opt.value} onChange={() => setMode(opt.value)} className="sr-only" />
                  <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${mode === opt.value ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 dark:border-gray-500'}`} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sous-selecteurs selon le mode */}
          {mode === 'annee_calendaire' && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Année</label>
              <select value={annee} onChange={e => setAnnee(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
                {[...annees].reverse().map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}

          {mode === 'annee_fiscale' && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Exercice</label>
              <select value={exerciceIdx} onChange={e => setExerciceIdx(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
                {[...exercices].reverse().map((ex, i) => <option key={ex.dateDebut} value={exercices.length - 1 - i}>{ex.label}</option>)}
              </select>
            </div>
          )}

          {mode === 'mois' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Année</label>
                <select value={moisAnnee} onChange={e => setMoisAnnee(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
                  {[...annees].reverse().map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Mois</label>
                <select value={moisMois} onChange={e => setMoisMois(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
                  {NOMS_MOIS.map((nm, i) => <option key={i+1} value={i+1}>{nm}</option>)}
                </select>
              </div>
            </div>
          )}

          {mode === 'personnalisee' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Du</label>
                <input type="date" value={perisoDebut} onChange={e => setPerisoDebut(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Au</label>
                <input type="date" value={perisoFin} min={perisoDebut} onChange={e => setPerisoFin(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
              </div>
            </div>
          )}

          {/* Apercu de la periode calculee */}
          {periode && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {periode.label}
            </p>
          )}

          {/* Parametres supplementaires (ex: id_editeur pour R-C06) */}
          {(report.extraParams ?? []).map(param => (
            <div key={param.key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {param.label}{param.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {param.type === 'select' && (
                <select
                  value={extraValues[param.key] ?? ''}
                  onChange={e => setExtraValues(prev => ({ ...prev, [param.key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">-- Choisir --</option>
                  {renderSourceOptions(param.source)}
                </select>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Annuler
          </button>
          <button onClick={handleGenerer} disabled={!canSubmit} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
            Générer
          </button>
        </div>
      </div>
    </div>
  );
}
