// StatutEcheanceBadge - statut d'echeance d'un contrat (actif / a renouveler / expire)
import Badge from '../ui/Badge';

const CONFIG = {
  actif: { variant: 'success', label: 'Actif' },
  a_renouveler: { variant: 'warning', label: 'A renouveler' },
  expire: { variant: 'error', label: 'Expire' },
};

export default function StatutEcheanceBadge({ statut }) {
  const cfg = CONFIG[statut] ?? CONFIG.actif;
  return <Badge variant={cfg.variant} label={cfg.label} />;
}
