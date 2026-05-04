// V2 - Modifié - ManagerDSIDashboard : grille 12 col, 4 KPIs L1, AlertBanner
// Layout : L1(×4) | L2(×2) | L3(×2) | L4(×3)
import { Server } from 'lucide-react';
import { EcartUsageDroitsWidget } from './widgets/BarChartWidget';
import { EcheancesWidget, MontantsTotauxWidget } from './widgets/HistogramWidget';
import { IndiceConformiteWidget } from './widgets/DonutWidget';
import {
  IndiceConfianceWidget, ValidationsEnAttenteWidget,
  QualiteSaisiesWidget, RevalidationsWidget,
} from './widgets/KPICard';
import { PrevisionBudgetaireWidget } from './widgets/ListWidget';
import AlertBanner from './widgets/AlertBanner';
import {
  indicConfianceData, validationsEnAttenteData, qualiteSaisiesData,
  revalidationsData, indiceConformiteData, previsionBudgetaireData,
  echeancesContratsData, echeancesCommandesData, editeursData,
  THRESHOLD_RED, THRESHOLD_DARK_RED,
} from '../../data/dashboardMockData';
import { THRESHOLDS } from '../../data/thresholds';

// Calcul des alertes critiques (widgets en rouge)
function computeAlerts() {
  const alerts = [];
  const T = THRESHOLDS.ecart_usage_droits;

  for (const ed of editeursData) {
    const det = ed.logiciels.reduce((s, l) => s + l.detenues, 0);
    const aff = ed.logiciels.reduce((s, l) => s + l.affectees, 0);
    const ecartPct = ((det - aff) / det) * 100;
    if (ecartPct > T.positif[2] || Math.abs(Math.min(ecartPct, 0)) > T.negatif[2]) {
      alerts.push({ id: 'ecart-usage-droits', label: `Écart usage vs droits — ${ed.name} (${ecartPct > 0 ? '+' : ''}${ecartPct.toFixed(0)}%)` });
    }
  }

  if (validationsEnAttenteData.count > 5) {
    alerts.push({ id: 'validations-attente', label: `${validationsEnAttenteData.count} validations en attente > 24h` });
  }

  const rougeContrats = echeancesContratsData.reduce((s, m) => s + m.rouge, 0);
  if (rougeContrats > 0) {
    alerts.push({ id: 'echeances-contrats', label: `${rougeContrats} contrat${rougeContrats > 1 ? 's' : ''} échu${rougeContrats > 1 ? 's' : ''}` });
  }

  // Dédoublonnage par id
  return alerts.filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i);
}

const GRID12 = { display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 20 };

export default function ManagerDSIDashboard() {
  const alerts = computeAlerts();

  return (
    <div>
      <AlertBanner alerts={alerts} />

      <div className="dash-grid-12" style={GRID12}>
        {/* ── Ligne 1 : 4 KPI cards (span 3 chacune) ───────────────────────── */}
        <div style={{ gridColumn: 'span 3' }}>
          <IndiceConfianceWidget data={indicConfianceData} />
        </div>
        <div style={{ gridColumn: 'span 3' }}>
          <ValidationsEnAttenteWidget data={validationsEnAttenteData} />
        </div>
        <div style={{ gridColumn: 'span 3' }}>
          <QualiteSaisiesWidget data={qualiteSaisiesData} />
        </div>
        <div style={{ gridColumn: 'span 3' }}>
          <RevalidationsWidget data={revalidationsData} />
        </div>

        {/* ── Ligne 2 : Écart usage vs droits | Conformité (span 6/6) ─────── */}
        <div style={{ gridColumn: 'span 6' }}>
          <EcartUsageDroitsWidget />
        </div>
        <div style={{ gridColumn: 'span 6' }}>
          <IndiceConformiteWidget data={indiceConformiteData} />
        </div>

        {/* ── Ligne 3 : Échéances contrats | Échéances commandes (span 6/6) ─ */}
        <div style={{ gridColumn: 'span 6' }}>
          <EcheancesWidget
            title="Échéances contrats"
            data={echeancesContratsData}
            widgetId="echeances-contrats"
          />
        </div>
        <div style={{ gridColumn: 'span 6' }}>
          <EcheancesWidget
            title="Échéances commandes"
            data={echeancesCommandesData}
            widgetId="echeances-commandes"
          />
        </div>

        {/* ── Ligne 4 : Prévision N+1 | Montants totaux | espace (span 4/4/4) */}
        <div style={{ gridColumn: 'span 4' }}>
          <PrevisionBudgetaireWidget data={previsionBudgetaireData} />
        </div>
        <div style={{ gridColumn: 'span 4' }}>
          <MontantsTotauxWidget title="Montants totaux" showPeriod />
        </div>
        <div style={{ gridColumn: 'span 4' }} />
      </div>
    </div>
  );
}
