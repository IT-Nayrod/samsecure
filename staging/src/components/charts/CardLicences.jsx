import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckCircle } from 'lucide-react';
import Card from '../ui/Card';
import { licencesData } from '../../data/mockData';

export default function CardLicences() {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '200px' }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '28px', fontWeight: '700', color: '#1A1D23', lineHeight: 1 }}>2,326</span>
          <div style={{
            width: '20px', height: '20px', borderRadius: '50%',
            backgroundColor: '#52C97A20', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle size={12} color="#52C97A" />
          </div>
        </div>
        <button style={{
          border: '1px solid #EAECF0',
          borderRadius: '6px',
          padding: '4px 10px',
          fontSize: '11px',
          color: '#1A1D23',
          backgroundColor: 'white',
          cursor: 'pointer',
          fontWeight: '500',
        }}>
          Détails
        </button>
      </div>

      {/* Sublabel */}
      <p style={{ fontSize: '11px', color: '#8B9099' }}>Besoin réels en licence</p>

      {/* Tag */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        backgroundColor: '#52C97A15',
        borderRadius: '20px',
        padding: '4px 10px',
        width: 'fit-content',
      }}>
        <CheckCircle size={11} color="#52C97A" />
        <span style={{ fontSize: '11px', color: '#52C97A', fontWeight: '600' }}>3,200 licences déployées</span>
      </div>

      {/* Area chart */}
      <div style={{ flex: 1, minHeight: '80px', marginTop: '4px' }}>
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={licencesData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="licencesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C6FCD" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#7C6FCD" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Tooltip
              formatter={(v) => [v.toLocaleString(), 'Licences']}
              contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #EAECF0' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#7C6FCD"
              strokeWidth={2}
              fill="url(#licencesGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
