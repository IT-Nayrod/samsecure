// V2 - Modifié - W01 Écart usage vs droits (colorimétrie inversée, 6 seuils)
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MoreVertical } from 'lucide-react';
import Card from '../../ui/Card';
import {
  editeursData, societes,
  THRESHOLD_GREEN, THRESHOLD_YELLOW, THRESHOLD_ORANGE,
  THRESHOLD_RED, THRESHOLD_DARK_RED,
} from '../../../data/dashboardMockData';
import { THRESHOLDS } from '../../../data/thresholds';
import FreshnessBadge from './FreshnessBadge';

const T = THRESHOLDS.ecart_usage_droits;

// Colorimétrie inversée V2 : vert = usage proche des droits, rouge = écart élevé
function getEcartColor(detenues, affectees) {
  if (detenues === 0) return THRESHOLD_GREEN;
  const ecartPct = ((detenues - affectees) / detenues) * 100;

  if (ecartPct < 0) {
    // Manque de droits (usage > droits)
    const abs = Math.abs(ecartPct);
    if (abs > T.negatif[2]) return THRESHOLD_DARK_RED;
    if (abs > T.negatif[1]) return THRESHOLD_RED;
    if (abs > T.negatif[0]) return THRESHOLD_ORANGE;
    return THRESHOLD_YELLOW;
  }
  // Excès de droits
  if (ecartPct > T.positif[2]) return THRESHOLD_RED;
  if (ecartPct > T.positif[1]) return THRESHOLD_ORANGE;
  if (ecartPct > T.positif[0]) return THRESHOLD_YELLOW;
  return THRESHOLD_GREEN;
}

function buildChartData() {
  return editeursData.map(ed => {
    const detenues  = ed.logiciels.reduce((s, l) => s + l.detenues, 0);
    const affectees = ed.logiciels.reduce((s, l) => s + l.affectees, 0);
    return {
      editeur: ed.name,
      detenues,
      affectees,
      color: getEcartColor(detenues, affectees),
      logiciels: ed.logiciels,
    };
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const entry = buildChartData().find(d => d.editeur === label);
  if (!entry) return null;
  return (
    <div style={{
      background: '#1A1D23', color: '#fff', borderRadius: 10,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      minWidth: 240,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>{label}</div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ opacity: 0.6, fontSize: 10 }}>
            <th style={{ textAlign: 'left', paddingRight: 8, fontWeight: 500 }}>Logiciel</th>
            <th style={{ textAlign: 'right', paddingRight: 8 }}>Droits</th>
            <th style={{ textAlign: 'right', paddingRight: 8 }}>Usage</th>
            <th style={{ textAlign: 'right' }}>Écart</th>
          </tr>
        </thead>
        <tbody>
          {entry.logiciels.map(l => {
            const ecartPct = Math.round(((l.detenues - l.affectees) / l.detenues) * 100);
            const c = getEcartColor(l.detenues, l.affectees);
            return (
              <tr key={l.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <td style={{ paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>{l.name}</td>
                <td style={{ textAlign: 'right', paddingRight: 8, opacity: 0.7 }}>{l.detenues}</td>
                <td style={{ textAlign: 'right', paddingRight: 8, opacity: 0.7 }}>{l.affectees}</td>
                <td style={{ textAlign: 'right', color: c, fontWeight: 700 }}>
                  {ecartPct >= 0 ? '+' : ''}{ecartPct}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

function ColoredBar(props) {
  const { x, y, width, height, editeur, dataKey } = props;
  const data = buildChartData().find(d => d.editeur === editeur);
  if (!data) return null;
  const fill = dataKey === 'affectees' ? data.color + 'CC' : data.color;
  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={3} />;
}

// Export nommé V2 + default pour rétrocompatibilité des imports existants
export function EcartUsageDroitsWidget() {
  const [societe, setSociete] = useState('Toutes');
  const chartData = buildChartData();

  const handleBarClick = (data) => {
    console.log('navigate to éditeur detail:', data?.editeur);
  };

  return (
    <Card id="ecart-usage-droits" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>Écart usage vs droits</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FreshnessBadge type="realtime" />
          <select value={societe} onChange={e => setSociete(e.target.value)} style={{
            fontSize: 11, border: '1px solid #EAECF0', borderRadius: 6,
            padding: '3px 8px', color: '#1A1D23', background: 'white', cursor: 'pointer',
          }}>
            {societes.map(s => <option key={s}>{s}</option>)}
          </select>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0 }}>
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#8B9099', flexWrap: 'wrap' }}>
        {[
          { color: THRESHOLD_GREEN,    label: 'Conforme (< 10% écart)'  },
          { color: THRESHOLD_YELLOW,   label: 'Attention (10-20%)'       },
          { color: THRESHOLD_ORANGE,   label: 'Problématique (20-30%)'   },
          { color: THRESHOLD_RED,      label: 'Critique (> 30%)'         },
          { color: THRESHOLD_DARK_RED, label: 'Dépassement (usage > droits)' },
        ].map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: l.color, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap="25%"
          onClick={d => d?.activePayload && handleBarClick(d.activePayload[0]?.payload)}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
          <XAxis dataKey="editeur" tick={{ fontSize: 11, fill: '#8B9099' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="detenues"  name="Droits détenus" shape={<ColoredBar dataKey="detenues" />}  maxBarSize={28} />
          <Bar dataKey="affectees" name="Usage réel"     shape={<ColoredBar dataKey="affectees" />} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export default EcartUsageDroitsWidget;
