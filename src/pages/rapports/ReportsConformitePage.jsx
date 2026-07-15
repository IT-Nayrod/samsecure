// ReportsConformitePage - Liste des 6 rapports de conformite - SamSecure v0.5
import { Link } from 'react-router-dom';
import { SlidersHorizontal, ShieldCheck } from 'lucide-react';
import ReportCard from '../../components/rapports/ReportCard';
import { getReportsByCategorie } from '../../data/reportsCatalog';

const rapports = getReportsByCategorie('conformite');

export default function ReportsConformitePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* En-tete */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Conformité</p>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rapports de conformité</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Contrôle des droits acquis, des usages déclarés et de l'exhaustivité documentaire.
          </p>
        </div>
        <Link
          to="/rapports/personnalise"
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Rapport personnalisé
        </Link>
      </div>

      {/* Grille de cartes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rapports.map(r => (
          <ReportCard key={r.id} report={r} />
        ))}
      </div>

      {/* Lien vers optimisation */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-center">
        <Link to="/rapports/optimisation" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          Voir aussi les rapports d'optimisation
        </Link>
      </div>
    </div>
  );
}
