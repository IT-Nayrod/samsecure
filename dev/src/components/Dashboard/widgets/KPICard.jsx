// KPICard — W02 Revalidations | W03 Qualité saisies | W07 Indice confiance
//           W08 Validations en attente | W11 Montants budgétaires | W12 Réel vs prévi
//           W13 Contrats en cours | W19 Balance usages | W21/W22 placeholders v2
import { MoreVertical } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import Card from '../../ui/Card';
import { COMPLIANCE_GREEN, COMPLIANCE_ORANGE, COMPLIANCE_RED } from '../../../data/dashboardMockData';

// ─── Wrapper card partagé ────────────────────────────────────────────────────
export function WidgetCard({ title, children, style = {}, disabled = false }) {
  return (
    <Card style={{
      display: 'flex', flexDirection: 'column', gap: '10px',
      opacity: disabled ? 0.45 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#1A1D23', margin: 0 }}>{title}</h3>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0 }}>
          <MoreVertical size={16} />
        </button>
      </div>
      {children}
    </Card>
  );
}

// ─── Pastille colorée ────────────────────────────────────────────────────────
function Dot({ color }) {
  return <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }} />;
}

// ─── W02 — Revalidations ─────────────────────────────────────────────────────
export function RevalidationsWidget({ data }) {
  const items = [
    { label: '> 30 jours',  count: data.ok,      color: COMPLIANCE_GREEN  },
    { label: '< 30 jours',  count: data.warning,  color: COMPLIANCE_ORANGE },
    { label: 'Dépassées',   count: data.expired,  color: COMPLIANCE_RED    },
  ];
  return (
    <WidgetCard title="Revalidations">
      <div onClick={() => console.log('navigate to /revalidations')}
           style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', cursor: 'pointer' }}>
        {items.map(it => (
          <div key={it.label} style={{
            flex: 1, minWidth: 70,
            background: it.color + '14',
            borderRadius: 8, padding: '10px 8px',
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

// ─── W03 — Qualité des saisies ───────────────────────────────────────────────
export function QualiteSaisiesWidget({ data }) {
  const color = data.anomalies === 0 ? COMPLIANCE_GREEN : COMPLIANCE_RED;
  return (
    <WidgetCard title="Qualité des saisies">
      <div onClick={() => console.log('navigate to /quality-check')}
           style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Dot color={color} />
          <span style={{ fontSize: 26, fontWeight: 700, color }}>{data.anomalies}</span>
          <span style={{ fontSize: 12, color: '#8B9099' }}>anomalie{data.anomalies > 1 ? 's' : ''}</span>
        </div>
        <span style={{ fontSize: 11, color: '#8B9099' }}>
          {data.lienManquants} liens manquants · {data.doublons} doublons potentiels
        </span>
      </div>
    </WidgetCard>
  );
}

// ─── W07 — Indice de confiance données (jauge demi-cercle) ───────────────────
export function IndiceConfianceWidget({ data }) {
  const { score } = data;
  const color = score > 70 ? COMPLIANCE_GREEN : score >= 40 ? COMPLIANCE_ORANGE : COMPLIANCE_RED;
  const gaugeData = [{ value: score }, { value: 100 - score }];
  return (
    <WidgetCard title="Indice de confiance données">
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

// ─── W08 — Validations en attente > 1 jour ───────────────────────────────────
export function ValidationsEnAttenteWidget({ data }) {
  const color = data.count > 0 ? COMPLIANCE_RED : COMPLIANCE_GREEN;
  return (
    <WidgetCard title="Validations en attente">
      <div onClick={() => console.log('navigate to /validations')}
           style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 48, fontWeight: 700, color, lineHeight: 1 }}>{data.count}</span>
        <span style={{ fontSize: 11, color: '#8B9099' }}>saisies non traitées depuis plus de 24h</span>
      </div>
    </WidgetCard>
  );
}

// ─── W11 — Montants période budgétaire ───────────────────────────────────────
export function MontantsBudgetaireWidget({ data }) {
  return (
    <WidgetCard title="Période budgétaire">
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
      <div style={{ fontSize: 10, color: '#8B9099' }}>{data.periode}</div>
    </WidgetCard>
  );
}

// ─── W12 — Réel vs Prévisionnel ──────────────────────────────────────────────
export function ReelVsPrevisionnelWidget({ data }) {
  const conforme = data.ecartPct <= 5;
  const color = conforme ? COMPLIANCE_GREEN : COMPLIANCE_RED;
  const label = conforme ? 'Conforme' : `Dépassement +${data.ecartPct}%`;
  return (
    <WidgetCard title="Réel vs Prévisionnel">
      <div onClick={() => console.log('navigate to /budget-detail')}
           style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color }}>{conforme ? '' : '+'}{data.ecartPct}%</span>
          <span style={{
            fontSize: 11, fontWeight: 600, color,
            background: color + '18', borderRadius: 12, padding: '2px 8px',
          }}>{label}</span>
        </div>
        <div style={{ fontSize: 10, color: '#8B9099' }}>
          Réel : {data.reel.toLocaleString('fr-FR')} € · Prévi : {data.previsionnel.toLocaleString('fr-FR')} €
        </div>
      </div>
    </WidgetCard>
  );
}

// ─── W13 — Contrats en cours ─────────────────────────────────────────────────
export function ContratsEnCoursWidget({ data }) {
  const items = [
    { label: '> 6 mois',  count: data.ok,      color: COMPLIANCE_GREEN  },
    { label: '< 6 mois',  count: data.warning,  color: COMPLIANCE_ORANGE },
    { label: 'Échus',     count: data.expired,  color: COMPLIANCE_RED    },
  ];
  return (
    <WidgetCard title="Contrats en cours">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {items.map(it => (
          <div key={it.label} style={{
            flex: 1, minWidth: 60,
            background: it.color + '14', borderRadius: 8, padding: '10px 8px',
            display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center',
          }}>
            <Dot color={it.color} />
            <span style={{ fontSize: 22, fontWeight: 700, color: it.color, lineHeight: 1.1 }}>{it.count}</span>
            <span style={{ fontSize: 10, color: '#8B9099', textAlign: 'center' }}>{it.label}</span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

// ─── W19 — Balance usages vs droits ──────────────────────────────────────────
export function BalanceUsagesDroitsWidget({ data }) {
  const items = [
    { label: 'Dépassement',    count: data.depassement, color: '#991B1B' },
    { label: '100% utilisé',   count: data.saturation,  color: COMPLIANCE_RED    },
    { label: '< 10% dispo',    count: data.risque,       color: COMPLIANCE_ORANGE },
    { label: '≥ 10% dispo',    count: data.ok,           color: COMPLIANCE_GREEN  },
  ];
  return (
    <WidgetCard title="Balance usages vs droits">
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
