import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Dot,
} from 'recharts';
import { CheckCircle } from 'lucide-react';
import Card from '../ui/Card';
import { coutEcartsData } from '../../data/mockData';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    if (val === 50000) {
      return (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #EAECF0',
          borderRadius: '8px',
          padding: '6px 10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '12px',
          fontWeight: '600',
          color: '#1A1D23',
        }}>
          <span>50.000€</span>
          <CheckCircle size={12} color="#52C97A" />
        </div>
      );
    }
  }
  return null;
};

const CustomDot = (props) => {
  const { cx, cy, value } = props;
  if (value === 50000) {
    return (
      <circle cx={cx} cy={cy} r={5} fill="#F4E842" stroke="#D4C020" strokeWidth={2} />
    );
  }
  return null;
};

export default function CardCoutEcarts() {
  const [view, setView] = useState('Chart');

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle size={13} color="#52C97A" />
            <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#1A1D23' }}>Coût des écarts</h3>
          </div>
          <span style={{ fontSize: '11px', color: '#8B9099' }}>(ou dépenses globales?)</span>
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          {['Chart', 'Table'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '3px 9px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: '500',
                border: '1px solid #EAECF0',
                backgroundColor: view === v ? '#7C6FCD' : 'white',
                color: view === v ? 'white' : '#8B9099',
                cursor: 'pointer',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'Chart' ? (
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={coutEcartsData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="coutGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F4E842" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#F4E842" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
            <XAxis
              dataKey="x"
              tick={{ fontSize: 10, fill: '#8B9099' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#8B9099' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v / 1000}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#D4C020"
              strokeWidth={2}
              fill="url(#coutGrad)"
              dot={<CustomDot />}
              activeDot={{ r: 4, fill: '#F4E842', stroke: '#D4C020' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #EAECF0' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#8B9099', fontWeight: '500' }}>Période</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: '#8B9099', fontWeight: '500' }}>Coût</th>
              </tr>
            </thead>
            <tbody>
              {coutEcartsData.map((d) => (
                <tr key={d.x} style={{ borderBottom: '1px solid #F5F5F5' }}>
                  <td style={{ padding: '6px 8px', color: '#1A1D23' }}>Sem. {d.x}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1A1D23' }}>
                    {d.value.toLocaleString()}€
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
