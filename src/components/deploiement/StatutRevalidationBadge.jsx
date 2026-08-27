// StatutRevalidationBadge - statut du cycle de revalidation d'une affectation.
// Le statut est evalue par l'API a la lecture (statut_revalidation : a_jour,
// a_revalider, depasse), jamais recalcule ici. Accepte soit l'objet
// { statut } soit directement le code.
import Badge from '../ui/Badge';

const CONFIG = {
  a_jour: { variant: 'success', label: 'À jour' },
  a_revalider: { variant: 'warning', label: 'À revalider' },
  depasse: { variant: 'error', label: 'Revalidation dépassée' },
};

export default function StatutRevalidationBadge({ revalidation }) {
  const statut = typeof revalidation === 'string' ? revalidation : revalidation?.statut;
  if (!statut) return <Badge variant="neutral" label="Non revalidée" />;
  const cfg = CONFIG[statut] ?? CONFIG.a_jour;
  return <Badge variant={cfg.variant} label={cfg.label} />;
}
