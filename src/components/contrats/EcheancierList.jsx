// EcheancierList - echeancier des contrats proches de leur fin ou de leur renouvellement
// Element distinctif de la page Contrat, meme principe que la file de travail des Affectations.
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import StatutEcheanceBadge from './StatutEcheanceBadge';
import { getEditeurLabel } from '../../data/mockContrats';

function rank(statut) {
  if (statut === 'expire') return 0;
  if (statut === 'a_renouveler') return 1;
  return 2;
}

export default function EcheancierList({ entries }) {
  const navigate = useNavigate();
  const echeances = entries
    .filter(({ echeance }) => echeance.statut !== 'actif')
    .sort((a, b) => rank(a.echeance.statut) - rank(b.echeance.statut) || (a.echeance.joursRestants ?? 0) - (b.echeance.joursRestants ?? 0));

  if (echeances.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
        <CheckCircle2 size={16} className="text-green-500" /> Aucun contrat proche de son echeance. Tout est a jour.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {echeances.map(({ contrat, echeance }) => {
        const borderColor = echeance.statut === 'expire' ? '#EF4444' : '#F59E0B';
        return (
          <div key={contrat.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40" style={{ borderLeft: `3px solid ${borderColor}` }}>
            <button onClick={() => navigate(`/contrats/liste/${contrat.id}`)} className="flex flex-col items-start text-left min-w-0">
              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{contrat.label}</span>
              <span className="text-xs text-gray-500">{getEditeurLabel(contrat.id_editeur)}</span>
            </button>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-gray-500">
                {echeance.statut === 'expire'
                  ? `Echu depuis ${-echeance.joursRestants} jours`
                  : `Echeance dans ${echeance.joursRestants} jours`
                }
              </span>
              <StatutEcheanceBadge statut={echeance.statut} />
              <button onClick={() => navigate(`/contrats/liste/${contrat.id}`)} aria-label="Voir le detail" className="p-1.5 text-gray-400 hover:text-gray-700">
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
