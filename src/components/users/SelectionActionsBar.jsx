// SelectionActionsBar - actions sur les comptes cochés de la liste (#212).
//
// N'apparaît qu'avec une sélection. Deux actions seulement dans cette
// version : exporter les lignes cochées (même format CSV que l'export de la
// liste) et les désactiver. Aucune suppression, aucune action groupée sur les
// droits. Le lien « Tout désélectionner » ne touche pas aux comptes.
import { Download, UserX } from 'lucide-react';
import Button from '../ui/Button';

export default function SelectionActionsBar({ nombre, onExporter, onDesactiver, onEffacer, enCours = false }) {
  if (!nombre) return null;
  const s = nombre > 1 ? 's' : '';
  return (
    <div
      role="region"
      aria-label="Actions sur la sélection"
      className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3"
    >
      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
        {nombre} compte{s} sélectionné{s}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onExporter} disabled={enCours}>
          <Download size={13} /> Exporter la sélection
        </Button>
        <Button variant="destructive" size="sm" onClick={onDesactiver} isLoading={enCours}>
          <UserX size={13} /> Désactiver la sélection
        </Button>
        <button
          type="button"
          onClick={onEffacer}
          disabled={enCours}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline-offset-2 hover:underline disabled:opacity-50 px-1"
        >
          Tout désélectionner
        </button>
      </div>
    </div>
  );
}
