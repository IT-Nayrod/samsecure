// LineAreaWidget — W18 Coût des écarts (line + area + toggle Chart/Table)
// Ref specs §9.18 dérivé
import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { MoreVertical } from 'lucide-react';
import Card from '../../ui/Card';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1A1D23', color: '#fff', borderRadius: 8,
      padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div>{payload[0].value.toLocaleString('fr-FR')} €</div>
    </div>
  );
};

export default function LineAreaWidget({ data }) {
  const [view, setView] = useState('Chart');

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>Coût des écarts</h3>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {['Chart', 'Table'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 500,
              border: '1px solid #EAECF0', cursor: 'pointer',
              background: view === v ? '#7C6FCD' : 'white',
              color: view === v ? 'white' : '#8B9099',
              transition: 'all 0.15s ease',
            }}>{v}</button>
          ))}
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0, marginLeft: 4 }}>
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      <div style={{ overflow: 'hidden', transition: 'opacity 0.2s ease', opacity: 1 }}>
        {view === 'Chart' ? (
          <ResponsiveContainer width="100%" height={185}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
              <defs>
                <linearGradient id="coutEcartsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#F4C842" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#F4C842" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="mois" tick={{ fontSize: 9, fill: '#8B9099' }} axisLine={false} tickLine={false} interval={2} />
              <YAxis
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone" dataKey="valeur" name="Coût écarts"
                stroke="#F4C842" strokeWidth={2}
                fill="url(#coutEcartsGrad)"
                dot={false} activeDot={{ r: 4, fill: '#F4C842', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ maxHeight: 185, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#fff' }}>
                <tr style={{ borderBottom: '1px solid #EAECF0' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#8B9099', fontWeight: 500 }}>Mois</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', color: '#8B9099', fontWeight: 500 }}>Coût écarts</th>
                </tr>
              </thead>
              <tbody>
                {data.map(d => (
                  <tr key={d.mois} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '5px 8px', color: '#1A1D23' }}>{d.mois}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: '#1A1D23', fontWeight: 500 }}>
                      {d.valeur.toLocaleString('fr-FR')} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
