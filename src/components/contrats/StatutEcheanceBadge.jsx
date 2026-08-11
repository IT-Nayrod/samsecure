// StatutEcheanceBadge - statut d'echeance d'un contrat.
// Les 4 valeurs sont celles renvoyees par l'API (contrats.js, STATUT_ECHEANCE) :
// actif / a_renouveler / expire / perpetuel. Aucune n'est calculee ici.
import Badge from '../ui/Badge';

const CONFIG = {
  actif: { variant: 'success', label: 'Actif' },
  a_renouveler: { variant: 'warning', label: 'A renouveler' },
  expire: { variant: 'error', label: 'Expire' },
  perpetuel: { variant: 'neutral', label: 'Perpetuel' },
};

export default function StatutEcheanceBadge({ statut }) {
  const cfg = CONFIG[statut];
  if (!cfg) return null;
  return <Badge variant={cfg.variant} label={cfg.label} />;
}
