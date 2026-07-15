// ConformiteBadge - badge de synthese de conformite agregee (editeur)
import Badge from '../ui/Badge';

const CONFIG = {
  conforme: { variant: 'success' },
  attention: { variant: 'warning' },
  non_conforme: { variant: 'error' },
};

export default function ConformiteBadge({ conformite }) {
  const cfg = CONFIG[conformite.niveau] ?? CONFIG.attention;
  return <Badge variant={cfg.variant} label={`${conformite.label} (${conformite.pct}%)`} />;
}
