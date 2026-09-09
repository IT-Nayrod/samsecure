// ConformiteBadge - balance droits contre usages, agrégée par éditeur.
//
// La donnée vient de l'API (server/utils/conformite.js), qui la calcule à la
// lecture sur les licences et les affectations réelles. Elle vaut null quand
// l'éditeur n'a aucun produit sous licence : il n'y a alors rien à rapprocher,
// et un badge "conforme" laisserait croire à un contrôle qui n'a pas eu lieu.
import Badge from '../ui/Badge';

const CONFIG = {
  conforme:    { variant: 'success', label: 'Conforme' },
  attention:   { variant: 'warning', label: 'Attention' },
  depassement: { variant: 'error',   label: 'Dépassement' },
};

export default function ConformiteBadge({ conformite }) {
  if (!conformite) {
    return <Badge variant="neutral" label="Non applicable" />;
  }
  const cfg = CONFIG[conformite.niveau] ?? CONFIG.attention;
  const detail = `${conformite.usage_declare} / ${conformite.droits}`;
  return <Badge variant={cfg.variant} label={`${cfg.label} (${detail})`} />;
}
