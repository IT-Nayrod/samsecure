// ReportCard - Carte d'un rapport dans la grille de liste - SamSecure v0.5
import { useState } from 'react';
import { FileBarChart } from 'lucide-react';
import { REPORT_ICONS } from '../../data/reportsCatalog';
import ReportPeriodModal from './ReportPeriodModal';

export default function ReportCard({ report }) {
  const [modalOpen, setModalOpen] = useState(false);

  const IconComponent = REPORT_ICONS[report.icone] ?? FileBarChart;
  const categorieLabel = report.categorie === 'conformite' ? 'Conformité' : 'Optimisation';
  const categorieColor = report.categorie === 'conformite'
    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';

  return (
    <>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
            <IconComponent className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categorieColor}`}>
                {categorieLabel}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono uppercase">{report.id}</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{report.titre}</h3>
          </div>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed flex-1">{report.description}</p>

        <button
          onClick={() => setModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <FileBarChart className="w-4 h-4" />
          Générer ce rapport
        </button>
      </div>

      {modalOpen && (
        <ReportPeriodModal
          report={report}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
