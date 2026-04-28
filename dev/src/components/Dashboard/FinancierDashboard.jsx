// FinancierDashboard — dashboard profil Financier
// Widgets : W11 W12 W13 | W06 W14 | W15 W16 | W17 W18
import {
  MontantsBudgetaireWidget, ReelVsPrevisionnelWidget, ContratsEnCoursWidget,
} from './widgets/KPICard';
import { MontantsTotauxWidget, EcheancesTresorerieWidget } from './widgets/HistogramWidget';
import { EconomiesOptimisablesWidget } from './widgets/DonutWidget';
import HorizontalBarWidget from './widgets/HorizontalBarWidget';
import LineAreaWidget from './widgets/LineAreaWidget';
import {
  montantsBudgetaireData, reelVsPrevisionnelData, contratsEnCoursData,
  economiesOptimisablesData, topLogicielsCouteuxData,
  echeancesTresorerieData, coutEcartsData,
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

export default function FinancierDashboard() {
  return (
    <div style={GRID}>
      {/* ── Ligne 1 : KPI cards ──────────────────────────────────────────── */}
      <MontantsBudgetaireWidget   data={montantsBudgetaireData} />
      <ReelVsPrevisionnelWidget   data={reelVsPrevisionnelData} />
      <ContratsEnCoursWidget      data={contratsEnCoursData} />

      {/* ── Ligne 2 : Montants totaux | Coûts annuels ────────────────────── */}
      <div style={EQUAL2}>
        <MontantsTotauxWidget title="Montants totaux" showPeriod />
        <MontantsTotauxWidget title="Coûts annuels" showPeriod={false} />
      </div>

      {/* ── Ligne 3 : Échéances trésorerie | Économies optimisables ─────── */}
      <div style={EQUAL2}>
        <EcheancesTresorerieWidget data={echeancesTresorerieData} />
        <EconomiesOptimisablesWidget data={economiesOptimisablesData} />
      </div>

      {/* ── Ligne 4 : Top coûteux (1/3) | Coût des écarts (2/3) ──────────── */}
      <HorizontalBarWidget data={topLogicielsCouteuxData} />
      <div style={{ gridColumn: 'span 2' }}>
        <LineAreaWidget data={coutEcartsData} />
      </div>
    </div>
  );
}
