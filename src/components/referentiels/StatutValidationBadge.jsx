// StatutValidationBadge - badge de statut du workflow de validation des saisies
import Badge from '../ui/Badge';

const CONFIG = {
  en_attente: { variant: 'neutral', label: 'En attente' },
  valide: { variant: 'success', label: 'Validé' },
  refuse: { variant: 'error', label: 'Refusé' },
};

export default function StatutValidationBadge({ statut }) {
  const cfg = CONFIG[statut] ?? CONFIG.en_attente;
  return <Badge variant={cfg.variant} label={cfg.label} />;
}
