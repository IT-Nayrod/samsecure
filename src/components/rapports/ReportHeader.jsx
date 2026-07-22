// ReportHeader - En-tete d'un rapport genere - SamSecure v0.5
import { Download, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDateFR } from '../../utils/periodUtils';

export default function ReportHeader({ rapport, periode, onChangerPeriode, onExporter }) {
  const navigate = useNavigate();
  const aujourdhui = new Date();
  const dateGen = `${String(aujourdhui.getDate()).padStart(2,'0')}/${String(aujourdhui.getMonth()+1).padStart(2,'0')}/${aujourdhui.getFullYear()}`;

  const labelPeriode = periode
    ? `${formatDateFR(periode.dateDebut)} - ${formatDateFR(periode.dateFin)}`
    : 'Toutes périodes';

  return (
    <div className="no-print bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{rapport?.categorie === 'conformite' ? 'Rapport de conformité' : rapport?.categorie === 'optimisation' ? "Rapport d'optimisation" : 'Rapport personnalisé'}</p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{rapport?.titre ?? 'Rapport'}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Periode : <strong className="text-gray-700 dark:text-gray-200">{labelPeriode}</strong>
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Généré le <strong className="text-gray-700 dark:text-gray-200">{dateGen}</strong>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onChangerPeriode && (
            <button
              onClick={onChangerPeriode}
              className="no-print flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Changer la période
            </button>
          )}
          {onExporter && (
            <button
              onClick={onExporter}
              className="no-print flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Télécharger Excel
            </button>
          )}
          <button
            onClick={() => navigate('/rapports/personnalise')}
            className="no-print flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Rapport personnalisé
          </button>
        </div>
      </div>
    </div>
  );
}
