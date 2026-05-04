import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import Card from '../ui/Card';
import { ecartUsageData } from '../../data/mockData';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length && label === 'Sep') {
    return (
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #EAECF0',
        borderRadius: '8px',
        padding: '8px 12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: '#52C97A20',
          color: '#52C97A',
          borderRadius: '12px',
          padding: '2px 8px',
          fontSize: '12px',
          fontWeight: '700',
        }}>
          50.000€ ✓
        </div>
      </div>
    );
  }
  return null;
};

export default function CardEcartUsage() {
  const [view, setView] = useState('Chart');

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '200px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#1A1D23' }}>Écart usage VS licences</h3>
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
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={ecartUsageData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: '#8B9099' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 400]}
              tick={{ fontSize: 10, fill: '#8B9099' }}
              axisLine={false}
              tickLine={false}
              ticks={[0, 100, 200, 300, 400]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {ecartUsageData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.month === 'Sep' ? '#E8534A' : '#F4A8A8'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #EAECF0' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#8B9099', fontWeight: '500' }}>Mois</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: '#8B9099', fontWeight: '500' }}>Écart</th>
              </tr>
            </thead>
            <tbody>
              {ecartUsageData.map((d) => (
                <tr key={d.month} style={{ borderBottom: '1px solid #F5F5F5' }}>
                  <td style={{ padding: '6px 8px', color: '#1A1D23' }}>{d.month}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: d.month === 'Sep' ? '#E8534A' : '#1A1D23', fontWeight: d.month === 'Sep' ? '600' : '400' }}>
                    {d.value.toLocaleString()}
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
