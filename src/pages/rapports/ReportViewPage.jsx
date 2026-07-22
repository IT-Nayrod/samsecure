// ReportViewPage - Page de visualisation d'un rapport genere - SamSecure v0.5
// Route : /rapports/vue/:reportId?du=...&au=...&[extraParams]
// reportId === 'custom' => config lue depuis sessionStorage ('ss_custom_report_config')
import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts';
import { AlertTriangle, ChevronUp, ChevronDown, Info } from 'lucide-react';
import ReportHeader from '../../components/rapports/ReportHeader';
import ReportKPIs from '../../components/rapports/ReportKPIs';
import ReportPeriodModal from '../../components/rapports/ReportPeriodModal';
import { getReportById } from '../../data/reportsCatalog';
import { executerRapportPreconfiguree, executerRapport } from '../../utils/reportEngine';
import { fieldsDictionary } from '../../data/reportFieldsDictionary';
import { exporterExcel } from '../../utils/exportExcel';
import './print.css';

// --- Formatage cellules ---------------------------------------------------------
const fmtEur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtNb  = new Intl.NumberFormat('fr-FR');

function formaterCellule(valeur, format) {
  if (valeur == null || valeur === '') return <span className="text-gray-400">-</span>;
  switch (format) {
    case 'montant':    return fmtEur.format(Number(valeur));
    case 'nombre':     return fmtNb.format(Number(valeur));
    case 'nombre_signe': {
      const n = Number(valeur);
      return <span className={n < 0 ? 'text-red-600 dark:text-red-400 font-medium' : n > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}>{n >= 0 ? '+' : ''}{fmtNb.format(n)}</span>;
    }
    case 'pourcentage': {
      const n = Number(valeur);
      return `${n.toFixed(1)} %`;
    }
    case 'taux_usage': {
      const pct = Math.round(Number(valeur) * 100);
      const color = pct < 20 ? 'bg-red-200 text-red-800' : pct < 50 ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800';
      return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{pct} %</span>;
    }
    case 'date': {
      const d = new Date(valeur);
      if (isNaN(d.getTime())) return valeur;
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    }
    case 'badge_conformite': {
      const map = {
        conforme:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        attention:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        non_conforme: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      };
      const labels = { conforme: 'Conforme', attention: 'Attention', non_conforme: 'Non conforme' };
      return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[valeur] ?? ''}`}>{labels[valeur] ?? valeur}</span>;
    }
    case 'badge_revalidation': {
      const map = {
        a_jour:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        a_revalider: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        depassee:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      };
      const labels = { a_jour: 'À jour', a_revalider: 'À revalider', depassee: 'Dépassée' };
      return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[valeur] ?? ''}`}>{labels[valeur] ?? valeur}</span>;
    }
    case 'badge_recommandation': {
      const map = {
        'Renouveler':  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        'Renegocier':  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        'Abandonner':  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      };
      return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[valeur] ?? 'bg-gray-100 text-gray-600'}`}>{valeur}</span>;
    }
    default: return String(valeur);
  }
}

// --- Tableau de donnees ---------------------------------------------------------
const PIE_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#f97316','#ec4899'];

function DataTable({ colonnes, lignes, titre }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sortedLignes = useMemo(() => {
    if (!sortKey) return lignes;
    return [...lignes].sort((a, b) => {
      const va = a[sortKey]; const vb = b[sortKey];
      let cmp = typeof va === 'string' ? va.localeCompare(vb ?? '', 'fr') : (Number(va) || 0) - (Number(vb) || 0);
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [lignes, sortKey, sortDir]);

  if (!colonnes?.length) return null;

  return (
    <div>
      {titre && <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-6 py-3 border-b border-gray-100 dark:border-gray-700">{titre}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
              {colonnes.map(col => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap select-none ${col.sortable ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200' : ''}`}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedLignes.length === 0 ? (
              <tr><td colSpan={colonnes.length} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">Aucune donnée sur la période sélectionnée</td></tr>
            ) : sortedLignes.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                {colonnes.map(col => (
                  <td key={col.key} className="px-4 py-3 text-gray-800 dark:text-gray-200 whitespace-nowrap">
                    {formaterCellule(row[col.key], col.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 px-4 py-2 text-right">{lignes.length} ligne{lignes.length > 1 ? 's' : ''}</p>
    </div>
  );
}

// --- Rendu du graphique ---------------------------------------------------------
function ReportChart({ graphDef, donneesGraphique }) {
  const data = donneesGraphique?.data ?? [];
  if (!data.length) return null;

  const type = graphDef?.type ?? donneesGraphique?.type;

  if (type === 'bar_horizontal') {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Écart par éditeur</h3>
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
          <BarChart data={data} layout="vertical" margin={{ left: 120, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={v => fmtNb.format(v)} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={115} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [fmtNb.format(v), 'Écart']} />
            <Bar dataKey="ecart" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill ?? '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'pie') {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Répartition par éditeur</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={data} dataKey={donneesGraphique?.valueKey ?? 'value'} nameKey={donneesGraphique?.nameKey ?? 'name'} cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)} %)`} labelLine>
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => fmtEur.format(v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'line') {
    const lines = donneesGraphique?.lines ?? [];
    return (
      <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Évolution mensuelle des coûts</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={donneesGraphique?.nameKey ?? 'periode'} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => fmtEur.format(v)} tick={{ fontSize: 11 }} width={80} />
            <Tooltip formatter={(v) => fmtEur.format(v)} />
            <Legend />
            {lines.map(l => (
              <Line
                key={typeof l === 'string' ? l : l.key}
                type="monotone"
                dataKey={typeof l === 'string' ? l : l.key}
                name={typeof l === 'string' ? l : l.label}
                stroke={typeof l === 'string' ? '#6366f1' : l.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}

// --- Page principale ------------------------------------------------------------
export default function ReportViewPage() {
  const { reportId } = useParams();
  const [searchParams] = useSearchParams();
  const [periodeModalOpen, setPeriodeModalOpen] = useState(false);

  const isCustom = reportId === 'custom';

  // Config du rapport
  const rapport = useMemo(() => {
    if (isCustom) {
      const raw = sessionStorage.getItem('ss_custom_report_config');
      if (!raw) return null;
      try {
        const cfg = JSON.parse(raw);
        const domaineChamps = fieldsDictionary[cfg.domaine]?.champs ?? [];
        const colonnesDef = (cfg.colonnes ?? []).map(key => {
          const champ = domaineChamps.find(c => c.key === key);
          if (!champ) return null;
          const format = ['montant', 'nombre', 'date'].includes(champ.type) ? champ.type : undefined;
          return { key: champ.key, label: champ.label, sortable: true, format };
        }).filter(Boolean);
        return {
          titre: cfg.options?.titre || cfg.titre || 'Rapport personnalisé',
          categorie: 'personnalise',
          kpis: [],
          colonnes: colonnesDef,
          graphique: null,
          _rawCfg: cfg,
        };
      } catch { return null; }
    }
    return getReportById(reportId);
  }, [reportId, isCustom]);

  // Periode depuis les query params
  const periode = useMemo(() => {
    const du = searchParams.get('du');
    const au = searchParams.get('au');
    if (!du || !au) return null;
    return { dateDebut: du, dateFin: au };
  }, [searchParams]);

  // Params supplementaires depuis l'URL
  const extraParams = useMemo(() => {
    const params = {};
    if (rapport?.extraParams) {
      rapport.extraParams.forEach(ep => {
        const v = searchParams.get(ep.key);
        if (v) params[ep.key] = v;
      });
    }
    return params;
  }, [rapport, searchParams]);

  // Calcul du rapport
  const resultat = useMemo(() => {
    if (!rapport) return null;
    if (isCustom) {
      if (!rapport._rawCfg) return { erreur: 'Configuration introuvable.' };
      try {
        return executerRapport(rapport._rawCfg);
      } catch (e) {
        return { erreur: String(e) };
      }
    }
    try {
      return executerRapportPreconfiguree(rapport.computeKey, periode, extraParams);
    } catch (e) {
      return { erreur: String(e) };
    }
  }, [rapport, periode, extraParams, isCustom]);

  // --- Export Excel (SpreadsheetML 2 feuilles : Constat + Donnees) ---
  function handleExport() {
    if (!resultat) return;
    exporterExcel({
      titre: rapport.titre ?? 'Rapport',
      description: rapport.description,
      periode,
      kpisDef: rapport.kpis?.length > 0 ? rapport.kpis : [],
      kpisData: resultat.kpis ?? {},
      colonnes: colonnes ?? null,
      lignes: resultat.lignes ?? null,
      sections: sections ?? null,
      resultSections: resultat.sections ?? null,
      note: resultat.note ?? null,
      filename: `${rapport.id ?? 'rapport-personnalise'}-${periode?.dateDebut ?? 'periode'}`,
    });
  }

  // --- Rendu erreur ---
  if (!rapport) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500 dark:text-gray-400">
        <AlertTriangle className="w-10 h-10" />
        <p className="text-base font-medium">Rapport introuvable</p>
        <p className="text-sm">{isCustom ? 'Aucune configuration de rapport personnalisé en session.' : `Identifiant inconnu : ${reportId}`}</p>
      </div>
    );
  }

  const colonnes = rapport.colonnes;
  const sections = rapport.sections;
  const hasGraphique = rapport.graphique && resultat?.donneesGraphique?.data?.length;

  // Note eventuelle (doublons sans cas)
  const note = resultat?.note;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="print-container">
        <ReportHeader
          rapport={rapport}
          periode={periode}
          onChangerPeriode={!isCustom ? () => setPeriodeModalOpen(true) : null}
          onExporter={resultat && !resultat.erreur ? handleExport : null}
        />

        {/* KPIs */}
        {resultat?.kpis && rapport.kpis?.length > 0 && (
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <ReportKPIs kpisDef={rapport.kpis} kpisData={resultat.kpis} />
          </div>
        )}

        {/* Erreur calcul */}
        {resultat?.erreur && (
          <div className="m-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{resultat.erreur}</p>
          </div>
        )}

        {/* Note (ex: doublons non detectes) */}
        {note && (
          <div className="mx-6 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700 dark:text-blue-300">{note}</p>
          </div>
        )}

        {/* Graphique */}
        {hasGraphique && (
          <div className="mt-0">
            <ReportChart graphDef={rapport.graphique} donneesGraphique={resultat.donneesGraphique} />
          </div>
        )}

        {/* Table simple */}
        {colonnes && resultat?.lignes && (
          <div className="bg-white dark:bg-gray-800 mt-4 mx-0 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <DataTable colonnes={colonnes} lignes={resultat.lignes} />
          </div>
        )}

        {/* Tables multi-sections */}
        {sections && resultat?.sections && (
          <div className="space-y-4 mt-4">
            {resultat.sections.map((section, idx) => {
              const colonnesDef = rapport.sections?.[idx]?.colonnes ?? [];
              return (
                <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <DataTable colonnes={colonnesDef} lignes={section.lignes ?? []} titre={section.titre} />
                </div>
              );
            })}
          </div>
        )}

        <div className="h-12" />
      </div>

      {/* Modal changement de periode */}
      {periodeModalOpen && rapport && (
        <ReportPeriodModal report={rapport} onClose={() => setPeriodeModalOpen(false)} />
      )}
    </div>
  );
}
