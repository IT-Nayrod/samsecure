// V2 - Modifié - ITOpsDashboard : changements transversaux (4 couleurs, AlertBanner, fraîcheur)
import { Activity, Database } from 'lucide-react';
import { EcartUsageDroitsWidget } from './widgets/BarChartWidget';
import { EcheancesWidget } from './widgets/HistogramWidget';
import { Usage12MoisWidget } from './widgets/HistogramWidget';
import {
  BalanceUsagesDroitsWidget, RevalidationsWidget,
  QualiteSaisiesWidget, PlaceholderV2Widget,
} from './widgets/KPICard';
import { DernieresSaisiesWidget } from './widgets/ListWidget';
import AlertBanner from './widgets/AlertBanner';
import {
  revalidationsData, qualiteSaisiesData, balanceUsagesDroitsData,
  echeancesContratsData, echeancesCommandesData, dernieresSaisiesData,
  editeursData,
  THRESHOLD_DARK_RED, THRESHOLD_RED,
} from '../../data/dashboardMockData';
import { THRESHOLDS } from '../../data/thresholds';

function computeAlerts() {
  const alerts = [];
  const T = THRESHOLDS.ecart_usage_droits;

  for (const ed of editeursData) {
    const det = ed.logiciels.reduce((s, l) => s + l.detenues, 0);
    const aff = ed.logiciels.reduce((s, l) => s + l.affectees, 0);
    const ecartPct = ((det - aff) / det) * 100;
    if (ecartPct > T.positif[2] || Math.abs(Math.min(ecartPct, 0)) > T.negatif[2]) {
      alerts.push({ id: 'ecart-usage-droits', label: `Écart usage vs droits — ${ed.name}` });
    }
  }

  if (balanceUsagesDroitsData.depassement > 0) {
    alerts.push({ id: 'balance-usages-droits', label: `${balanceUsagesDroitsData.depassement} logiciel${balanceUsagesDroitsData.depassement > 1 ? 's' : ''} en dépassement de droits` });
  }

  const rougeContrats = echeancesContratsData.reduce((s, m) => s + m.rouge, 0);
  if (rougeContrats > 0) {
    alerts.push({ id: 'echeances-contrats', label: `${rougeContrats} contrat${rougeContrats > 1 ? 's' : ''} échu${rougeContrats > 1 ? 's' : ''}` });
  }

  return alerts.filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i);
}

const GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 20,
};
const EQUAL2 = {
  gridColumn: 'span 3',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 20,
};

export default function ITOpsDashboard() {
  const alerts = computeAlerts();

  return (
    <div>
      <AlertBanner alerts={alerts} />

      <div style={GRID}>
        {/* ── Ligne 1 : KPI cards ──────────────────────────────────────────── */}
        <BalanceUsagesDroitsWidget data={balanceUsagesDroitsData} />
        <RevalidationsWidget       data={revalidationsData} />
        <QualiteSaisiesWidget      data={qualiteSaisiesData} />

        {/* ── Ligne 2 : Écart usage vs droits (large) + Usage 12 mois ──────── */}
        <div style={{ gridColumn: 'span 2' }}>
          <EcartUsageDroitsWidget />
        </div>
        <Usage12MoisWidget />

        {/* ── Ligne 3 : Échéances contrats | Échéances commandes (égales) ──── */}
        <div style={EQUAL2}>
          <EcheancesWidget
            title="Échéances contrats"
            data={echeancesContratsData}
            widgetId="echeances-contrats"
          />
          <EcheancesWidget
            title="Échéances commandes"
            data={echeancesCommandesData}
            widgetId="echeances-commandes"
          />
        </div>

        {/* ── Ligne 4 : Collecteurs v2 | Qualité données v2 | Saisies ──────── */}
        <PlaceholderV2Widget title="Collecteurs"     icon={Activity} />
        <PlaceholderV2Widget title="Qualité données" icon={Database} />
        <DernieresSaisiesWidget data={dernieresSaisiesData} />
      </div>
    </div>
  );
}
