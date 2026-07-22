// StatutRevalidationBadge - statut du cycle de revalidation d'une affectation
import Badge from '../ui/Badge';

const CONFIG = {
  a_jour: { variant: 'success', label: 'A jour' },
  a_revalider: { variant: 'warning', label: 'A revalider' },
  depasse: { variant: 'error', label: 'Revalidation depassee' },
};

export default function StatutRevalidationBadge({ revalidation }) {
  if (!revalidation) return <Badge variant="neutral" label="Non revalidee" />;
  const cfg = CONFIG[revalidation.statut] ?? CONFIG.a_jour;
  return <Badge variant={cfg.variant} label={cfg.label} />;
}
