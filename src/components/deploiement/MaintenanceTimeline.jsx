// MaintenanceTimeline - historique de maintenance d'une licence (periodes de
// maintenance_historique) sous forme de frise verticale, avec le repere de
// l'arret de maintenance quand il existe. Le statut de chaque periode (echue,
// en_cours, a_venir) vient de l'API.
import { Pencil, Trash2, ShieldOff } from 'lucide-react';
import { formatMontant } from '../../services/licencesService';

const POINT = {
  en_cours: 'bg-green-500',
  a_venir: 'bg-blue-400',
  echue: 'bg-gray-400',
};

const LIBELLE = {
  en_cours: 'En cours',
  a_venir: 'À venir',
  echue: 'Échue',
};

export default function MaintenanceTimeline({ periodes, licence, canWrite, onEdit, onDelete }) {
  const arret = licence?.date_arret_maintenance;

  if (!periodes.length && !arret) {
    return <p className="text-sm text-gray-500">Aucun historique de maintenance enregistré.</p>;
  }

  return (
    <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-2 flex flex-col gap-4">
      {arret && (
        <li className="ml-4">
          <span className="absolute -left-[7px] mt-1 w-3.5 h-3.5 rounded-full bg-gray-700 dark:bg-gray-300 ring-4 ring-white dark:ring-gray-800 flex items-center justify-center">
            <ShieldOff size={8} className="text-white dark:text-gray-800" />
          </span>
          <p className="text-sm text-gray-800 dark:text-gray-200">
            Maintenance arrêtée le <strong>{arret}</strong>
            {licence.version_figee_label && <> - version figée <strong>{licence.version_figee_label}</strong></>}
          </p>
          <p className="text-xs text-gray-500">Les droits acquis ({licence.quantite} {licence.unite_label ?? ''}) sont conservés, seules les montées de version cessent.</p>
        </li>
      )}
      {periodes.map(p => (
        <li key={p.id} className="ml-4">
          <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-gray-800 ${POINT[p.statut] ?? 'bg-gray-400'}`} />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {p.mainteneur_label ?? 'Mainteneur non renseigné'}
                <span className="ml-2 text-xs text-gray-500">{LIBELLE[p.statut] ?? p.statut}</span>
              </p>
              <p className="text-xs text-gray-500">
                Du {p.date_debut} au {p.date_fin ?? 'en cours'} - {formatMontant(p.cout, p.montants_masques)}
                {p.revendeur_label ? ` - via ${p.revendeur_label}` : ''}
              </p>
            </div>
            {canWrite && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => onEdit(p)} aria-label="Modifier la période" className="p-1 rounded text-gray-400 hover:text-blue-700 hover:bg-gray-100 dark:hover:bg-gray-700"><Pencil size={13} /></button>
                <button onClick={() => onDelete(p)} aria-label="Supprimer la période" className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 size={13} /></button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
