// Dashboard IT Ops (#192) : suivi operationnel, donnees reelles.
// Aucun widget de ce dashboard n'affiche de montant : la composition seedee
// (migration 050) refuse explicitement les widgets financiers au profil
// it_ops, et l'API refuse les agregats financiers a qui n'a pas
// consulter_kpi_financiers.
import GrilleDashboard from './GrilleDashboard';
import AlertesWidget from './widgets/AlertesWidget';
import { EcartUsageDroitsWidget } from './widgets/BarChartWidget';
import { EcheancesWidget, Usage12MoisWidget } from './widgets/HistogramWidget';
import {
  BalanceUsagesDroitsWidget, RevalidationsWidget, QualiteSaisiesWidget,
} from './widgets/KPICard';
import { DernieresSaisiesWidget } from './widgets/ListWidget';
import { EcartsInventaireWidget, CollecteursWidget } from './widgets/ITOpsWidgets';

const RENDUS = {
  'alertes':               { element: <AlertesWidget />, span: 12 },
  'balance-usages-droits': { element: <BalanceUsagesDroitsWidget />, span: 4 },
  'revalidations':         { element: <RevalidationsWidget />, span: 4 },
  'qualite-saisies':       { element: <QualiteSaisiesWidget />, span: 4 },
  'ecart-usage-droits':    { element: <EcartUsageDroitsWidget />, span: 8 },
  'usage-12-mois':         { element: <Usage12MoisWidget />, span: 4 },
  'echeances-contrats':    { element: <EcheancesWidget variante="contrats" />, span: 6 },
  'echeances-commandes':   { element: <EcheancesWidget variante="commandes" />, span: 6 },
  'collecteurs':           { element: <CollecteursWidget />, span: 4 },
  'ecarts-inventaire':     { element: <EcartsInventaireWidget />, span: 4 },
  'dernieres-saisies':     { element: <DernieresSaisiesWidget />, span: 4 },
};

export default function ITOpsDashboard() {
  return <GrilleDashboard profil="it_ops" rendus={RENDUS} />;
}
