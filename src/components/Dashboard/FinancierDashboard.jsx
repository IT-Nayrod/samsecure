// Dashboard Financier (#192) : suivi budgetaire et financier, donnees reelles.
// Le selecteur de periode fiscale alimente les widgets budget, tresorerie et
// engages/payes ; la composition vient de la configuration API.
import { useState } from 'react';
import GrilleDashboard from './GrilleDashboard';
import AlertesWidget from './widgets/AlertesWidget';
import {
  MontantsBudgetaireWidget, ConformiteReelPrevisionnelWidget, EcheancesContratsKpiWidget,
} from './widgets/KPICard';
import { EcheancesTresorerieWidget } from './widgets/HistogramWidget';
import { ValorisationLicencesWidget } from './widgets/DonutWidget';
import CoutParLogicielWidget from './widgets/HorizontalBarWidget';
import CoutLicencesManquantesWidget from './widgets/LineAreaWidget';
import { EngagedVsPaidWidget } from './widgets/EngagedVsPaidWidget';
import PeriodeFiscaleSelector from '../ui/PeriodeFiscaleSelector';

export default function FinancierDashboard() {
  const [periode, setPeriode] = useState(null);

  const rendus = {
    'alertes':                  { element: <AlertesWidget />, span: 12 },
    'periode-budgetaire':       { element: <MontantsBudgetaireWidget periode={periode} />, span: 4 },
    'conformite-reel-previ':    { element: <ConformiteReelPrevisionnelWidget periode={periode} />, span: 4 },
    'echeances-contrats-kpi':   { element: <EcheancesContratsKpiWidget />, span: 4 },
    'montants-engages-payes':   { element: <EngagedVsPaidWidget periode={periode} />, span: 6 },
    'echeances-tresorerie':     { element: <EcheancesTresorerieWidget periode={periode} />, span: 6 },
    'valorisation-licences':    { element: <ValorisationLicencesWidget />, span: 6 },
    'cout-licences-manquantes': { element: <CoutLicencesManquantesWidget />, span: 6 },
    'cout-par-logiciel':        { element: <CoutParLogicielWidget />, span: 12 },
  };

  return (
    <div className="flex flex-col gap-5">
      <PeriodeFiscaleSelector defaultPeriode="fiscale_courante" onChange={setPeriode} />
      <GrilleDashboard profil="financier" rendus={rendus} />
    </div>
  );
}
