// BuilderPreview - Apercu en direct du rapport personnalise (debounce 400ms) - SamSecure v0.5
import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { Loader2, AlertTriangle } from 'lucide-react';
import { executerRapport, resoudreChamp } from '../../../utils/reportEngine';
import {
  getPeriodeAnneeCalendaire, getExercicesFiscaux, getPeriodeTroisDerniersMois, getPeriodeMois,
} from '../../../utils/periodUtils';

const fmtEur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtNb  = new Intl.NumberFormat('fr-FR');
const PIE_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#f97316','#ec4899'];

function resolvePeriode(periodeConfig) {
  if (!periodeConfig) return null;
  const { mode, annee, exerciceIdx, moisAnnee, moisMois, persoDebut, persoFin } = periodeConfig;
  const exercices = getExercicesFiscaux();
  switch (mode) {
    case 'annee_calendaire': return getPeriodeAnneeCalendaire(annee ?? new Date().getFullYear());
    case 'annee_fiscale':    return exercices[exerciceIdx ?? exercices.length - 1] ?? exercices[0];
    case 'trois_mois':       return getPeriodeTroisDerniersMois();
    case 'mois':             return getPeriodeMois(moisAnnee ?? new Date().getFullYear(), moisMois ?? 1);
    case 'personnalisee':    return persoDebut && persoFin ? { dateDebut: persoDebut, dateFin: persoFin } : null;
    default: return null;
  }
}

function formaterVal(val, champs, key) {
  if (val == null) return '-';
  const champ = champs.find(c => c.key === key);
  if (!champ) return String(val);
  switch (champ.type) {
    case 'montant': return fmtEur.format(Number(val));
    case 'nombre':  return fmtNb.format(Number(val));
    case 'date': {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    }
    default: return String(val);
  }
}

export default function BuilderPreview({ config, champsDisponibles }) {
  const [debouncedConfig, setDebouncedConfig] = useState(config);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const t = setTimeout(() => {
      setDebouncedConfig(config);
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, [config]);

  const resultat = useMemo(() => {
    if (!debouncedConfig?.domaine) return null;
    const periode = resolvePeriode(debouncedConfig.periode);
    try {
      return executerRapport({
        ...debouncedConfig,
        periode,
        colonnes: debouncedConfig.colonnes,
      });
    } catch (e) {
      return { erreur: String(e) };
    }
  }, [debouncedConfig]);

  const colonnesDef = useMemo(() => {
    const keys = debouncedConfig?.colonnes ?? [];
    return keys.map(k => champsDisponibles.find(c => c.key === k)).filter(Boolean);
  }, [debouncedConfig?.colonnes, champsDisponibles]);

  const lignes = resultat?.lignes ?? [];
  const nbTotal = resultat?.nbLignesTotal ?? lignes.length;
  const titre = debouncedConfig?.options?.titre || 'Apercu';
  const showRowNumbers = debouncedConfig?.options?.afficherNumerosLignes ?? false;

  // Donnees graphique
  const graphiqueConfig = debouncedConfig?.graphique;
  const groupement = debouncedConfig?.groupement;
  const graphiqueData = useMemo(() => {
    if (!graphiqueConfig?.valueKey || !groupement || !lignes.length) return null;
    const groups = new Map();
    lignes.forEach(row => {
      const gKey = resoudreChamp(row, groupement) ?? '(vide)';
      const vKey = graphiqueConfig.valueKey.endsWith('_agg') ? graphiqueConfig.valueKey : `${graphiqueConfig.valueKey}_agg`;
      const val = Number(row[vKey] ?? resoudreChamp(row, graphiqueConfig.valueKey) ?? 0);
      groups.set(gKey, (groups.get(gKey) ?? 0) + val);
    });
    return Array.from(groups.entries()).map(([name, value]) => ({ name, value })).slice(0, 20);
  }, [lignes, groupement, graphiqueConfig]);

  return (
    <div className="h-full flex flex-col">
      {/* En-tete apercu */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white text-base">{titre}</h2>
          {resultat && !resultat.erreur && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{nbTotal} ligne{nbTotal > 1 ? 's' : ''} {nbTotal !== lignes.length ? `(affichage limité à ${lignes.length})` : ''}</p>
          )}
        </div>
        {isLoading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
      </div>

      {/* Erreur */}
      {resultat?.erreur && (
        <div className="m-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-300">{resultat.erreur}</p>
        </div>
      )}

      {/* Graphique */}
      {graphiqueData?.length > 0 && graphiqueConfig && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <ResponsiveContainer width="100%" height={220}>
            {graphiqueConfig.type === 'pie' ? (
              <PieChart>
                <Pie data={graphiqueData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {graphiqueData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmtNb.format(v)} />
              </PieChart>
            ) : graphiqueConfig.type === 'line' ? (
              <LineChart data={graphiqueData}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                <Tooltip /><Legend />
                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={graphiqueData} layout={graphiqueConfig.type === 'bar_horizontal' ? 'vertical' : 'horizontal'}>
                <CartesianGrid strokeDasharray="3 3" />
                {graphiqueConfig.type === 'bar_horizontal' ? (
                  <>
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => fmtNb.format(v)} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  </>
                ) : (
                  <>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtNb.format(v)} />
                  </>
                )}
                <Tooltip formatter={v => fmtNb.format(v)} />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Tableau */}
      <div className="flex-1 overflow-auto">
        {!debouncedConfig?.domaine ? (
          <div className="flex items-center justify-center h-64 text-sm text-gray-400 dark:text-gray-500">Sélectionnez une source de données pour commencer.</div>
        ) : colonnesDef.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-sm text-gray-400 dark:text-gray-500">Sélectionnez au moins une colonne.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                {showRowNumbers && <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 w-10">#</th>}
                {colonnesDef.map(c => (
                  <th key={c.key} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 ? (
                <tr><td colSpan={colonnesDef.length + (showRowNumbers ? 1 : 0)} className="px-4 py-8 text-center text-sm text-gray-400">Aucune donnée</td></tr>
              ) : lignes.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  {showRowNumbers && <td className="px-3 py-2.5 text-xs text-gray-400">{i + 1}</td>}
                  {colonnesDef.map(c => (
                    <td key={c.key} className="px-4 py-2.5 text-gray-800 dark:text-gray-200 whitespace-nowrap text-sm">
                      {formaterVal(resoudreChamp(row, c.key), champsDisponibles, c.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
