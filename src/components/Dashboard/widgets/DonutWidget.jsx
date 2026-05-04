// V2 - Modifié - W09 Indice de conformité | W16 Valorisation licences non utilisées
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { MoreVertical } from 'lucide-react';
import Card from '../../ui/Card';
import {
  THRESHOLD_GREEN, THRESHOLD_YELLOW, THRESHOLD_ORANGE, THRESHOLD_RED,
} from '../../../data/dashboardMockData';
import { THRESHOLDS } from '../../../data/thresholds';
import FreshnessBadge from './FreshnessBadge';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1A1D23', color: '#fff', borderRadius: 8,
      padding: '7px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    }}>
      <strong>{payload[0].name}</strong>
      {' — '}
      {typeof payload[0].value === 'number' && payload[0].value > 1000
        ? payload[0].value.toLocaleString('fr-FR') + ' €'
        : payload[0].value}
    </div>
  );
};

// ─── W09 — Indice de conformité global (V2 — sous-titre clarifié) ─────────────
export function IndiceConformiteWidget({ data }) {
  return (
    <Card id="indice-conformite" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>Indice de conformité global</h3>
          <p style={{ fontSize: 10, color: '#8B9099', margin: '2px 0 0 0' }}>Conformité contractuelle et optimisation</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FreshnessBadge type="cached" minutesAgo={30} />
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0 }}>
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie data={data.segments} cx="50%" cy="50%"
              innerRadius={48} outerRadius={64}
              dataKey="value" strokeWidth={2} stroke="white">
              {data.segments.map((seg, i) => <Cell key={i} fill={seg.color} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#E8534A', lineHeight: 1.1 }}>+{data.score}</div>
          <div style={{ fontSize: 9, color: '#8B9099', fontWeight: 500 }}>À optimiser</div>
        </div>
      </div>

      <button onClick={() => console.log('navigate to /compliance')} style={{
        alignSelf: 'center', border: '1px solid #EAECF0', borderRadius: 6,
        padding: '5px 20px', fontSize: 12, color: '#1A1D23',
        backgroundColor: 'white', cursor: 'pointer', fontWeight: 500,
      }}>
        J'optimise
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        {data.segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#8B9099' }}>{seg.name}</span>
            <span style={{ fontSize: 10, color: '#1A1D23', fontWeight: 600, marginLeft: 'auto' }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── W16 — Valorisation des licences non utilisées (V2 — couleur sur % parc) ─
export function ValorisationLicencesWidget({ data }) {
  const T = THRESHOLDS.valorisation_licences.pct;
  const pct = data.pctNonUtilisees;
  const color = pct < T[0] ? THRESHOLD_GREEN
    : pct < T[1] ? THRESHOLD_YELLOW
    : pct < T[2] ? THRESHOLD_ORANGE
    : THRESHOLD_RED;

  return (
    <Card id="valorisation-licences" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>Valorisation licences non utilisées</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FreshnessBadge type="cached" minutesAgo={60} />
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0 }}>
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', height: 150 }}>
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie data={data.segments} cx="50%" cy="50%"
              innerRadius={48} outerRadius={64}
              dataKey="value" strokeWidth={2} stroke="white">
              {data.segments.map((seg, i) => <Cell key={i} fill={seg.color} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color, lineHeight: 1.2 }}>
            {data.total.toLocaleString('fr-FR')} €
          </div>
          <div style={{ fontSize: 9, color, fontWeight: 700, marginTop: 2 }}>
            {pct.toFixed(1)}% non utilisées
          </div>
        </div>
      </div>

      <button onClick={() => console.log('navigate to /savings')} style={{
        alignSelf: 'center', border: '1px solid #EAECF0', borderRadius: 6,
        padding: '5px 20px', fontSize: 12, color: '#1A1D23',
        backgroundColor: 'white', cursor: 'pointer', fontWeight: 500,
      }}>
        Voir le détail
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        {data.segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#8B9099' }}>{seg.name}</span>
            <span style={{ fontSize: 10, color: '#1A1D23', fontWeight: 600, marginLeft: 'auto' }}>
              {seg.value.toLocaleString('fr-FR')} €
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Alias rétrocompatibilité
export const EconomiesOptimisablesWidget = ValorisationLicencesWidget;
