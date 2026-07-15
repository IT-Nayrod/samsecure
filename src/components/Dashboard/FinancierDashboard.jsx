// V2 - Modifié - FinancierDashboard : nouveau layout, nouveaux widgets
// L1(×3) | L2(×2) | L3(×2) | L4(1 col)
import { useMemo, useState } from 'react';
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
import PeriodeFiscaleSelector from '../ui/PeriodeFiscaleSelector';
import { formatPeriodeLabel } from '../../utils/fiscalPeriod';

const MOIS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

// "Jan 25" -> Date(2025, 0, 1) - seule la serie avec annee explicite (coutEcartsData) est filtrable par periode reelle
function parseMoisAnnee(label) {
  const [moisAbbr, anneeAbbr] = label.toLowerCase().split(' ');
  const moisIndex = MOIS_FR.indexOf(moisAbbr);
  if (moisIndex === -1) return null;
  return new Date(2000 + Number(anneeAbbr), moisIndex, 1);
}

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
  const [periode, setPeriode] = useState(null);

  // Le seul widget dont les points portent une annee explicite ("Jan 25") peut etre recoupe avec la periode reelle.
  // Les autres series du dashboard (V1/V2) sont des totaux agreges statiques sans date par enregistrement.
  const coutEcartsFiltre = useMemo(() => {
    if (!periode?.debut || !periode?.fin) return coutEcartsData;
    const filtre = coutEcartsData.filter(p => {
      const d = parseMoisAnnee(p.mois);
      return d && d >= periode.debut && d <= periode.fin;
    });
    return filtre.length > 0 ? filtre : coutEcartsData;
  }, [periode]);

  const montantsBudgetairePeriode = useMemo(() => ({
    ...montantsBudgetaireData,
    periode: periode ? formatPeriodeLabel(periode) : montantsBudgetaireData.periode,
  }), [periode]);

  return (
    <div className="flex flex-col gap-5">
      <PeriodeFiscaleSelector defaultPeriode="fiscale_courante" onChange={setPeriode} />
      <AlertBanner alerts={alerts} />

      <div style={GRID3}>
        {/* ── Ligne 1 : Période budgétaire | Conformité réel/prévi | Échéances contrats */}
        <MontantsBudgetaireWidget       data={montantsBudgetairePeriode} />
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
          <CoutLicencesManquantesWidget data={coutEcartsFiltre} />
        </div>

        {/* ── Ligne 4 : Coût par logiciel (liste pleine largeur) ────────────── */}
        <div style={{ gridColumn: 'span 3' }}>
          <CoutParLogicielWidget data={coutParLogicielData} />
        </div>
      </div>
    </div>
  );
}
