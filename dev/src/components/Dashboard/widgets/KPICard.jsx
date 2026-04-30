// V2 - Modifié - KPICard : W02 W03 W07 W08 W11 W12 W13 W19 W21/W22
import { MoreVertical } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import Card from '../../ui/Card';
import {
  THRESHOLD_GREEN, THRESHOLD_YELLOW, THRESHOLD_ORANGE, THRESHOLD_RED, THRESHOLD_DARK_RED,
} from '../../../data/dashboardMockData';
import { THRESHOLDS } from '../../../data/thresholds';
import FreshnessBadge from './FreshnessBadge';

// ─── Wrapper card partagé (V2 : widgetId, freshness) ────────────────────────
export function WidgetCard({ title, children, style = {}, disabled = false, widgetId, freshness }) {
  return (
    <Card id={widgetId} style={{
      display: 'flex', flexDirection: 'column', gap: '10px',
      opacity: disabled ? 0.45 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#1A1D23', margin: 0 }}>{title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {freshness && <FreshnessBadge {...freshness} />}
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0 }}>
            <MoreVertical size={16} />
          </button>
        </div>
      </div>
      {children}
    </Card>
  );
}

function Dot({ color }) {
  return <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }} />;
}

// ─── W02 — Revalidations ─────────────────────────────────────────────────────
export function RevalidationsWidget({ data }) {
  const items = [
    { label: '> 30 jours', count: data.ok,      color: THRESHOLD_GREEN  },
    { label: '< 30 jours', count: data.warning,  color: THRESHOLD_YELLOW },
    { label: 'Dépassées',  count: data.expired,  color: THRESHOLD_RED    },
  ];
  return (
    <WidgetCard title="Revalidations" widgetId="revalidations" freshness={{ type: 'cached', minutesAgo: 30 }}>
      <div onClick={() => console.log('navigate to /revalidations')}
           style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', cursor: 'pointer' }}>
        {items.map(it => (
          <div key={it.label} style={{
            flex: 1, minWidth: 70,
            background: it.color + '14', borderRadius: 8, padding: '10px 8px',
            display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center',
          }}>
            <Dot color={it.color} />
            <span style={{ fontSize: 22, fontWeight: 700, color: it.color, lineHeight: 1.1 }}>{it.count.toLocaleString('fr-FR')}</span>
            <span style={{ fontSize: 10, color: '#8B9099', textAlign: 'center', lineHeight: 1.3 }}>{it.label}</span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

// ─── W03 — Qualité des saisies (V2 — détail granulaire) ──────────────────────
export function QualiteSaisiesWidget({ data }) {
  const color = data.anomalies === 0 ? THRESHOLD_GREEN : THRESHOLD_RED;
  const details = [
    data.licencesSansContrat > 0 && `${data.licencesSansContrat} licence${data.licencesSansContrat > 1 ? 's' : ''} sans contrat`,
    data.contratsSansFacture > 0 && `${data.contratsSansFacture} contrat${data.contratsSansFacture > 1 ? 's' : ''} sans facture`,
    data.doublonsPotentiels > 0  && `${data.doublonsPotentiels} doublon${data.doublonsPotentiels > 1 ? 's' : ''} potentiel${data.doublonsPotentiels > 1 ? 's' : ''}`,
  ].filter(Boolean).join(', ');

  return (
    <WidgetCard title="Qualité des saisies" widgetId="qualite-saisies" freshness={{ type: 'realtime' }}>
      <div onClick={() => console.log('navigate to /quality-check')}
           style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Dot color={color} />
          <span style={{ fontSize: 26, fontWeight: 700, color }}>{data.anomalies}</span>
          <span style={{ fontSize: 12, color: '#8B9099' }}>anomalie{data.anomalies > 1 ? 's' : ''}</span>
        </div>
        <span style={{ fontSize: 11, color: '#8B9099', lineHeight: 1.4 }}>{details}</span>
      </div>
    </WidgetCard>
  );
}

// ─── W07 — Indice de confiance données (jauge demi-cercle) ───────────────────
export function IndiceConfianceWidget({ data }) {
  const { score } = data;
  const color = score > 70 ? THRESHOLD_GREEN : score >= 40 ? THRESHOLD_YELLOW : THRESHOLD_RED;
  const gaugeData = [{ value: score }, { value: 100 - score }];
  return (
    <WidgetCard title="Indice de confiance données" widgetId="indice-confiance" freshness={{ type: 'cached', minutesAgo: 30 }}>
      <div style={{ position: 'relative', height: 110 }}>
        <ResponsiveContainer width="100%" height={110}>
          <PieChart>
            <Pie data={gaugeData} cx="50%" cy="90%" startAngle={180} endAngle={0}
              innerRadius={52} outerRadius={72} dataKey="value" strokeWidth={0}>
              <Cell fill={color} />
              <Cell fill="#EAECF0" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 9, color: '#8B9099', marginTop: 2 }}>/100</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#8B9099', textAlign: 'center', lineHeight: 1.4 }}>
        Basé sur la qualité des saisies et le respect des revalidations
      </div>
    </WidgetCard>
  );
}

// ─── W08 — Validations en attente > 1 jour (V2 — bouton Voir les validations) ─
export function ValidationsEnAttenteWidget({ data }) {
  const color = data.count > 0 ? THRESHOLD_RED : THRESHOLD_GREEN;
  return (
    <WidgetCard title="Validations en attente" widgetId="validations-attente" freshness={{ type: 'realtime' }}>
      <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}
           onClick={() => console.log('navigate to /validations')}>
        <span style={{ fontSize: 48, fontWeight: 700, color, lineHeight: 1 }}>{data.count}</span>
        <span style={{ fontSize: 11, color: '#8B9099' }}>saisies non traitées depuis plus de 24h</span>
      </div>
      <button
        onClick={() => console.log('navigate to /validations')}
        style={{
          marginTop: 4, alignSelf: 'flex-start',
          fontSize: 11, fontWeight: 600, color: '#7C6FCD',
          background: '#7C6FCD14', border: '1px solid #7C6FCD40',
          borderRadius: 20, padding: '4px 14px', cursor: 'pointer',
        }}
      >
        Voir les validations →
      </button>
    </WidgetCard>
  );
}

// ─── W11 — Montants période budgétaire (V2 — période sous le titre) ──────────
export function MontantsBudgetaireWidget({ data }) {
  return (
    <WidgetCard title="Période budgétaire" widgetId="periode-budgetaire" freshness={{ type: 'cached', minutesAgo: 60 }}>
      <div style={{ fontSize: 11, color: '#8B9099', marginTop: -4 }}>{data.periode}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { label: 'Montants engagés',  value: data.engages,       color: '#7C6FCD' },
          { label: 'Reste à engager',   value: data.resteAEngager,  color: '#3FC8B8' },
        ].map(it => (
          <div key={it.label} style={{
            flex: 1, minWidth: 100,
            background: it.color + '14', borderRadius: 8, padding: '10px 10px',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: it.color }}>
              {it.value.toLocaleString('fr-FR')} €
            </div>
            <div style={{ fontSize: 10, color: '#8B9099', marginTop: 3 }}>{it.label}</div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

// ─── W12 — Conformité réel vs prévisionnel (V2 — affiche conformité %) ────────
export function ConformiteReelPrevisionnelWidget({ data }) {
  const T = THRESHOLDS.conformite_reel_previsionnel.pct;
  const pct = data.conformitePct;
  const color = pct >= T[0] ? THRESHOLD_GREEN
    : pct >= T[1] ? THRESHOLD_YELLOW
    : pct >= T[2] ? THRESHOLD_ORANGE
    : THRESHOLD_RED;

  return (
    <WidgetCard title="Conformité réel vs prévisionnel" widgetId="conformite-reel-previ" freshness={{ type: 'cached', minutesAgo: 60 }}>
      <div onClick={() => console.log('navigate to /budget-detail')}
           style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color }}>
            {pct.toFixed(1)}%
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, color,
            background: color + '18', borderRadius: 12, padding: '2px 8px',
          }}>
            {pct >= T[0] ? 'Conforme' : pct >= T[1] ? 'Attention' : pct >= T[2] ? 'Problématique' : 'Hors budget'}
          </span>
        </div>
        <div style={{ fontSize: 10, color: '#8B9099' }}>
          Réel : {data.reel.toLocaleString('fr-FR')} € · Prévi : {data.previsionnel.toLocaleString('fr-FR')} €
        </div>
      </div>
    </WidgetCard>
  );
}

// Alias pour rétrocompatibilité
export const ReelVsPrevisionnelWidget = ConformiteReelPrevisionnelWidget;

// ─── W13 — Échéances des contrats (V2 — 4 catégories) ────────────────────────
export function EcheancesContratsKpiWidget({ data }) {
  const items = [
    { label: '> 3 mois',     count: data.ok,       color: THRESHOLD_GREEN  },
    { label: '2-3 mois',     count: data.warning,   color: THRESHOLD_YELLOW },
    { label: 'Dernier mois', count: data.critique,  color: THRESHOLD_ORANGE },
    { label: 'Échus',        count: data.expired,   color: THRESHOLD_RED    },
  ];
  return (
    <WidgetCard title="Échéances des contrats" widgetId="echeances-contrats-kpi" freshness={{ type: 'cached', minutesAgo: 30 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {items.map(it => (
          <div key={it.label} style={{
            flex: 1, minWidth: 56,
            background: it.color + '14', borderRadius: 8, padding: '10px 6px',
            display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center',
          }}>
            <Dot color={it.color} />
            <span style={{ fontSize: 20, fontWeight: 700, color: it.color, lineHeight: 1.1 }}>{it.count}</span>
            <span style={{ fontSize: 9, color: '#8B9099', textAlign: 'center', lineHeight: 1.3 }}>{it.label}</span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

// Alias rétrocompatibilité
export const ContratsEnCoursWidget = EcheancesContratsKpiWidget;

// ─── W19 — Balance usages vs droits ──────────────────────────────────────────
export function BalanceUsagesDroitsWidget({ data }) {
  const items = [
    { label: 'Dépassement',  count: data.depassement, color: THRESHOLD_DARK_RED },
    { label: '100% utilisé', count: data.saturation,  color: THRESHOLD_RED      },
    { label: '< 10% dispo',  count: data.risque,       color: THRESHOLD_ORANGE   },
    { label: '≥ 10% dispo',  count: data.ok,           color: THRESHOLD_GREEN    },
  ];
  return (
    <WidgetCard title="Balance usages vs droits" widgetId="balance-usages-droits" freshness={{ type: 'realtime' }}>
      <div onClick={() => console.log('navigate to /compliance-detail')}
           style={{ cursor: 'pointer', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {items.map(it => (
          <div key={it.label} style={{
            flex: 1, minWidth: 60,
            background: it.color + '14', borderRadius: 8, padding: '8px 6px',
            display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center',
          }}>
            <Dot color={it.color} />
            <span style={{ fontSize: 20, fontWeight: 700, color: it.color, lineHeight: 1 }}>{it.count}</span>
            <span style={{ fontSize: 9, color: '#8B9099', textAlign: 'center', lineHeight: 1.3 }}>{it.label}</span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

// ─── W21 / W22 — Placeholder v2 ──────────────────────────────────────────────
export function PlaceholderV2Widget({ title, icon: Icon }) {
  return (
    <WidgetCard title={title} disabled>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0' }}>
        {Icon && <Icon size={28} color="#8B9099" />}
        <span style={{ fontSize: 12, color: '#8B9099', fontWeight: 600 }}>0 actif / 0 défaillant</span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#7C6FCD',
          background: '#7C6FCD18', borderRadius: 20, padding: '2px 10px',
        }}>Disponible en v2</span>
      </div>
    </WidgetCard>
  );
}
