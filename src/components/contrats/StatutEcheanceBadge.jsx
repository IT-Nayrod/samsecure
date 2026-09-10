// StatutEcheanceBadge - statut d'échéance d'un contrat.
// Les 4 valeurs sont celles renvoyées par l'API (contrats.js, STATUT_ECHEANCE) :
// actif / a_renouveler / expire / perpetuel. Aucune n'est calculée ici.
import Badge from '../ui/Badge';

const CONFIG = {
  actif: { variant: 'success', label: 'Actif' },
  a_renouveler: { variant: 'warning', label: 'À renouveler' },
  expire: { variant: 'error', label: 'Expiré' },
  perpetuel: { variant: 'neutral', label: 'Perpétuel' },
};

export default function StatutEcheanceBadge({ statut }) {
  const cfg = CONFIG[statut];
  if (!cfg) return null;
  return <Badge variant={cfg.variant} label={cfg.label} />;
}
