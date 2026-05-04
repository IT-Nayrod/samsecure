// V2 - Modifié - FinancierDashboard : nouveau layout, nouveaux widgets
// L1(×3) | L2(×2) | L3(×2) | L4(1 col)
import {
  MontantsBudgetaireWidget, ConformiteReelPrevisionnelWidget, EcheancesContratsKpiWidget,
} from './widgets/KPICard';
import { EcheancesTresorerieWidget } from './widgets/HistogramWidget';
import { ValorisationLicencesWidget } from './widgets/DonutWidget';
import CoutParLogicielWidget from './widgets/HorizontalBarWidget';
import CoutLicencesManquantesWidget from './widgets/LineAreaWidget';
import { EngagedVsPaidWidget } from './widgets/EngagedVsPaidWidget';
import AlertBanner from './widgets/AlertBanner';
import {
  montantsBudgetaireData, reelVsPrevisionnelData, contratsEnCoursData,
  valorisationLicencesData, coutParLogicielData,
  echeancesTresorerieData, coutEcartsData,
} from '../../data/dashboardMockData';
import { THRESHOLDS } from '../../data/thresholds';

function computeAlerts() {
  const alerts = [];
  const T = THRESHOLDS.conformite_reel_previsionnel.pct;

  if (reelVsPrevisionnelData.conformitePct < T[2]) {
    alerts.push({ id: 'conformite-reel-previ', label: `Conformité budget : ${reelVsPrevisionnelData.conformitePct.toFixed(1)}% (seuil ${T[2]}%)` });
  }
  if (contratsEnCoursData.expired > 0) {
    alerts.push({ id: 'echeances-contrats-kpi', label: `${contratsEnCoursData.expired} contrat${contratsEnCoursData.expired > 1 ? 's' : ''} échu${contratsEnCoursData.expired > 1 ? 's' : ''}` });
  }
  const Tv = THRESHOLDS.valorisation_licences.pct;
  if (valorisationLicencesData.pctNonUtilisees > Tv[2]) {
    alerts.push({ id: 'valorisation-licences', label: `${valorisationLicencesData.pctNonUtilisees.toFixed(1)}% de licences non utilisées` });
  }
  return alerts;
}

const GRID3 = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 };
const SPAN3_EQUAL2 = {
  gridColumn: 'span 3',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 20,
};

export default function FinancierDashboard() {
  const alerts = computeAlerts();

  return (
    <div>
      <AlertBanner alerts={alerts} />

      <div style={GRID3}>
        {/* ── Ligne 1 : Période budgétaire | Conformité réel/prévi | Échéances contrats */}
        <MontantsBudgetaireWidget       data={montantsBudgetaireData} />
        <ConformiteReelPrevisionnelWidget data={reelVsPrevisionnelData} />
        <EcheancesContratsKpiWidget     data={contratsEnCoursData} />

        {/* ── Ligne 2 : Montants engagés vs payés | Échéances trésorerie ──── */}
        <div style={SPAN3_EQUAL2}>
          <EngagedVsPaidWidget />
          <EcheancesTresorerieWidget data={echeancesTresorerieData} />
        </div>

        {/* ── Ligne 3 : Valorisation licences (donut) | Coût licences manquantes (line) */}
        <div style={SPAN3_EQUAL2}>
          <ValorisationLicencesWidget data={valorisationLicencesData} />
          <CoutLicencesManquantesWidget data={coutEcartsData} />
        </div>

        {/* ── Ligne 4 : Coût par logiciel (liste pleine largeur) ────────────── */}
        <div style={{ gridColumn: 'span 3' }}>
          <CoutParLogicielWidget data={coutParLogicielData} />
        </div>
      </div>
    </div>
  );
}
