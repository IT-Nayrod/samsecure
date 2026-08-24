// StatutRevalidationBadge - statut du cycle de revalidation d'une affectation.
// Le statut est evalue par l'API a la lecture (statut_revalidation : a_jour,
// a_revalider, depasse), jamais recalcule ici. Accepte soit l'objet
// { statut } soit directement le code.
import Badge from '../ui/Badge';

const CONFIG = {
  a_jour: { variant: 'success', label: 'A jour' },
  a_revalider: { variant: 'warning', label: 'A revalider' },
  depasse: { variant: 'error', label: 'Revalidation depassee' },
};

export default function StatutRevalidationBadge({ revalidation }) {
  const statut = typeof revalidation === 'string' ? revalidation : revalidation?.statut;
  if (!statut) return <Badge variant="neutral" label="Non revalidee" />;
  const cfg = CONFIG[statut] ?? CONFIG.a_jour;
  return <Badge variant={cfg.variant} label={cfg.label} />;
}
