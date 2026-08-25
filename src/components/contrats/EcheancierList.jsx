// EcheancierList - echeancier des contrats proches de leur fin ou de leur renouvellement
// Element distinctif de la page Contrat, meme principe que la file de travail des Affectations.
// Statut et jours restants viennent de l'API, aucun calcul local.
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import StatutEcheanceBadge from './StatutEcheanceBadge';

function rank(statut) {
  if (statut === 'expire') return 0;
  if (statut === 'a_renouveler') return 1;
  return 2;
}

export default function EcheancierList({ contrats }) {
  const navigate = useNavigate();
  // Un contrat perpetuel n'a pas d'echeance : il n'a rien a faire dans l'echeancier,
  // contrairement a ce que produisait le filtre "different de actif".
  const echeances = contrats
    .filter(c => c.statut_echeance !== 'actif' && c.statut_echeance !== 'perpetuel')
    .sort((a, b) => rank(a.statut_echeance) - rank(b.statut_echeance)
      || (a.jours_restants ?? 0) - (b.jours_restants ?? 0));

  if (echeances.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
        <CheckCircle2 size={16} className="text-green-500" /> Aucun contrat proche de son échéance. Tout est à jour.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {echeances.map(contrat => {
        const borderColor = contrat.statut_echeance === 'expire' ? '#EF4444' : '#F59E0B';
        return (
          <div key={contrat.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40" style={{ borderLeft: `3px solid ${borderColor}` }}>
            <button onClick={() => navigate(`/contrats/liste/${contrat.id}`)} className="flex flex-col items-start text-left min-w-0">
              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{contrat.label}</span>
              <span className="text-xs text-gray-500">{contrat.editeur_label ?? '-'}</span>
            </button>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-gray-500">
                {contrat.statut_echeance === 'expire'
                  ? `Échu depuis ${-contrat.jours_restants} jours`
                  : `Échéance dans ${contrat.jours_restants} jours`
                }
              </span>
              <StatutEcheanceBadge statut={contrat.statut_echeance} />
              <button onClick={() => navigate(`/contrats/liste/${contrat.id}`)} aria-label="Voir le détail" className="p-1.5 text-gray-400 hover:text-gray-700">
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
