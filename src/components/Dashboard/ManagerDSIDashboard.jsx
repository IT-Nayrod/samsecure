// Dashboard Manager DSI (#192) : pilotage global, donnees reelles.
// La composition (visibilite, ordre) vient de la configuration API et des
// preferences individuelles, rendue par GrilleDashboard.
import GrilleDashboard from './GrilleDashboard';
import AlertesWidget from './widgets/AlertesWidget';
import { EcartUsageDroitsWidget } from './widgets/BarChartWidget';
import { EcheancesWidget, MontantsTotauxWidget } from './widgets/HistogramWidget';
import { IndiceConformiteWidget } from './widgets/DonutWidget';
import {
  IndiceConfianceWidget, ValidationsEnAttenteWidget,
  QualiteSaisiesWidget, RevalidationsWidget,
} from './widgets/KPICard';
import { PrevisionBudgetaireWidget } from './widgets/ListWidget';

const RENDUS = {
  'alertes':              { element: <AlertesWidget />, span: 12 },
  'indice-confiance':     { element: <IndiceConfianceWidget />, span: 3 },
  'validations-attente':  { element: <ValidationsEnAttenteWidget />, span: 3 },
  'qualite-saisies':      { element: <QualiteSaisiesWidget />, span: 3 },
  'revalidations':        { element: <RevalidationsWidget />, span: 3 },
  'ecart-usage-droits':   { element: <EcartUsageDroitsWidget />, span: 6 },
  'indice-conformite':    { element: <IndiceConformiteWidget />, span: 6 },
  'echeances-contrats':   { element: <EcheancesWidget variante="contrats" />, span: 6 },
  'echeances-commandes':  { element: <EcheancesWidget variante="commandes" />, span: 6 },
  'prevision-budgetaire': { element: <PrevisionBudgetaireWidget />, span: 6 },
  'montants-totaux':      { element: <MontantsTotauxWidget />, span: 6 },
};

export default function ManagerDSIDashboard() {
  return <GrilleDashboard profil="manager_dsi" rendus={RENDUS} />;
}
