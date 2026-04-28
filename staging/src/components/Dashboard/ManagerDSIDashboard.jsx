// ManagerDSIDashboard — dashboard profil Manager DSI
// Widgets : W07 W08 W03 | W01 W09 | W04 W02 | W10 W06 W05
import { Server } from 'lucide-react';
import BarChartWidget from './widgets/BarChartWidget';
import { EcheancesWidget, MontantsTotauxWidget } from './widgets/HistogramWidget';
import { IndiceConformiteWidget } from './widgets/DonutWidget';
import {
  IndiceConfianceWidget, ValidationsEnAttenteWidget,
  QualiteSaisiesWidget, RevalidationsWidget,
} from './widgets/KPICard';
import { PrevisionBudgetaireWidget } from './widgets/ListWidget';
import {
  indicConfianceData, validationsEnAttenteData, qualiteSaisiesData,
  revalidationsData, indiceConformiteData, previsionBudgetaireData,
  echeancesContratsData, echeancesCommandesData,
} from '../../data/dashboardMockData';

const GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 20,
};

export default function ManagerDSIDashboard() {
  return (
    <div style={GRID}>
      {/* ── Ligne 1 : KPI cards ──────────────────────────────────────────── */}
      <IndiceConfianceWidget    data={indicConfianceData} />
      <ValidationsEnAttenteWidget data={validationsEnAttenteData} />
      <QualiteSaisiesWidget     data={qualiteSaisiesData} />

      {/* ── Ligne 2 : Écart usage (large) + Conformité donut ─────────────── */}
      <div style={{ gridColumn: 'span 2' }}>
        <BarChartWidget />
      </div>
      <IndiceConformiteWidget data={indiceConformiteData} />

      {/* ── Ligne 3 : Échéances contrats (large) + Revalidations ─────────── */}
      <div style={{ gridColumn: 'span 2' }}>
        <EcheancesWidget title="Échéances contrats" data={echeancesContratsData} />
      </div>
      <RevalidationsWidget data={revalidationsData} />

      {/* ── Ligne 4 : Prévision N+1 | Montants totaux | Échéances commandes ─ */}
      <PrevisionBudgetaireWidget data={previsionBudgetaireData} />
      <MontantsTotauxWidget title="Montants totaux" showPeriod />
      <EcheancesWidget title="Échéances commandes" data={echeancesCommandesData} />
    </div>
  );
}
