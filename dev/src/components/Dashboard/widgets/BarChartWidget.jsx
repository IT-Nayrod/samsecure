// BarChartWidget — W01 Écart usage vs licences (groupées par éditeur)
// Ref specs §9.4 + brainstorming
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { MoreVertical } from 'lucide-react';
import Card from '../../ui/Card';
import {
  editeursData, societes,
  COMPLIANCE_GREEN, COMPLIANCE_ORANGE, COMPLIANCE_RED, COMPLIANCE_DARK_RED,
} from '../../../data/dashboardMockData';

function getBarColor(detenues, affectees) {
  const ratio = affectees / detenues;
  const dispo = 1 - ratio;
  if (ratio > 1)        return COMPLIANCE_DARK_RED;
  if (ratio === 1)      return COMPLIANCE_RED;
  if (dispo < 0.1)      return COMPLIANCE_ORANGE;
  return COMPLIANCE_GREEN;
}

// Construit les données pour le BarChart groupé
function buildChartData() {
  return editeursData.map(ed => {
    const detenues  = ed.logiciels.reduce((s, l) => s + l.detenues, 0);
    const affectees = ed.logiciels.reduce((s, l) => s + l.affectees, 0);
    return {
      editeur: ed.name,
      detenues,
      affectees,
      color: getBarColor(detenues, affectees),
      logiciels: ed.logiciels,
    };
  });
}

// Tooltip personnalisé : détail des logiciels dans la famille
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const entry = buildChartData().find(d => d.editeur === label);
  if (!entry) return null;
  return (
    <div style={{
      background: '#1A1D23', color: '#fff', borderRadius: 10,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      minWidth: 220,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>{label}</div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ opacity: 0.6, fontSize: 10 }}>
            <th style={{ textAlign: 'left', paddingRight: 8, fontWeight: 500 }}>Logiciel</th>
            <th style={{ textAlign: 'right', paddingRight: 8 }}>Dét.</th>
            <th style={{ textAlign: 'right', paddingRight: 8 }}>Aff.</th>
            <th style={{ textAlign: 'right' }}>Dispo</th>
          </tr>
        </thead>
        <tbody>
          {entry.logiciels.map(l => {
            const dispo = Math.round((1 - l.affectees / l.detenues) * 100);
            const c = getBarColor(l.detenues, l.affectees);
            return (
              <tr key={l.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <td style={{ paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>{l.name}</td>
                <td style={{ textAlign: 'right', paddingRight: 8, opacity: 0.7 }}>{l.detenues}</td>
                <td style={{ textAlign: 'right', paddingRight: 8, opacity: 0.7 }}>{l.affectees}</td>
                <td style={{ textAlign: 'right', color: c, fontWeight: 700 }}>{dispo}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Barre colorée dynamiquement par disponibilité
function ColoredBar(props) {
  const { x, y, width, height, editeur, dataKey } = props;
  const data = buildChartData().find(d => d.editeur === editeur);
  if (!data) return null;
  const baseColor = data.color;
  const fill = dataKey === 'affectees' ? baseColor + 'CC' : baseColor;
  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={3} />;
}

export default function BarChartWidget() {
  const [societe, setSociete] = useState('Toutes');
  const chartData = buildChartData();

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>Écart usage vs licences</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          { color: COMPLIANCE_GREEN,    label: '≥ 10% dispo'  },
          { color: COMPLIANCE_ORANGE,   label: '< 10% dispo'  },
          { color: COMPLIANCE_RED,      label: '100% utilisé' },
          { color: COMPLIANCE_DARK_RED, label: 'Dépassement'  },
        ].map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: l.color, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#1A1D2360', display: 'inline-block', border: '1px dashed #8B9099' }} />
          Licences affectées
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
          <XAxis dataKey="editeur" tick={{ fontSize: 11, fill: '#8B9099' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="detenues" name="Licences détenues" shape={<ColoredBar dataKey="detenues" />} maxBarSize={28} />
          <Bar dataKey="affectees" name="Licences affectées" shape={<ColoredBar dataKey="affectees" />} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
