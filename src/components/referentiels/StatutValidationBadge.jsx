// StatutValidationBadge - badge de statut du workflow de validation des saisies
import Badge from '../ui/Badge';

const CONFIG = {
  en_attente: { variant: 'neutral', label: 'En attente' },
  valide: { variant: 'success', label: 'Validé' },
  refuse: { variant: 'error', label: 'Refusé' },
  // Statut de lecture des affectations (#106) : validee dont l'echeance de
  // revalidation est depassee. Jamais persiste, servi par l'API.
  a_revalider: { variant: 'warning', label: 'À revalider' },
};

export default function StatutValidationBadge({ statut }) {
  const cfg = CONFIG[statut] ?? CONFIG.en_attente;
  return <Badge variant={cfg.variant} label={cfg.label} />;
}
