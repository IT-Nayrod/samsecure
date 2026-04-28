// ITOpsDashboard — dashboard profil IT Ops
// Widgets : W19 W02 W03 | W01 W20 | W04 W05 | W21 W22 W23
import { Activity, Database } from 'lucide-react';
import BarChartWidget from './widgets/BarChartWidget';
import { EcheancesWidget } from './widgets/HistogramWidget';
import { Usage12MoisWidget } from './widgets/HistogramWidget';
import {
  BalanceUsagesDroitsWidget, RevalidationsWidget,
  QualiteSaisiesWidget, PlaceholderV2Widget,
} from './widgets/KPICard';
import { DernieresSaisiesWidget } from './widgets/ListWidget';
import {
  revalidationsData, qualiteSaisiesData, balanceUsagesDroitsData,
  echeancesContratsData, echeancesCommandesData, dernieresSaisiesData,
} from '../../data/dashboardMockData';

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
  return (
    <div style={GRID}>
      {/* ── Ligne 1 : KPI cards ──────────────────────────────────────────── */}
      <BalanceUsagesDroitsWidget data={balanceUsagesDroitsData} />
      <RevalidationsWidget       data={revalidationsData} />
      <QualiteSaisiesWidget      data={qualiteSaisiesData} />

      {/* ── Ligne 2 : Écart usage (large) + Usage 12 mois ────────────────── */}
      <div style={{ gridColumn: 'span 2' }}>
        <BarChartWidget />
      </div>
      <Usage12MoisWidget />

      {/* ── Ligne 3 : Échéances contrats | Échéances commandes (égales) ──── */}
      <div style={EQUAL2}>
        <EcheancesWidget title="Échéances contrats"  data={echeancesContratsData} />
        <EcheancesWidget title="Échéances commandes" data={echeancesCommandesData} />
      </div>

      {/* ── Ligne 4 : Collecteurs v2 | Qualité données v2 | Saisies ─────── */}
      <PlaceholderV2Widget title="Collecteurs"      icon={Activity} />
      <PlaceholderV2Widget title="Qualité données"  icon={Database} />
      <DernieresSaisiesWidget data={dernieresSaisiesData} />
    </div>
  );
}
