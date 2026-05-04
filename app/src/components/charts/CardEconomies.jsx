import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { MoreVertical, TrendingUp } from 'lucide-react';
import Card from '../ui/Card';
import { economiesData } from '../../data/mockData';

export default function CardEconomies() {
  const { value, percentage, total } = economiesData;

  const donutData = [
    { value: percentage },
    { value: 100 - percentage },
  ];

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '200px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#1A1D23' }}>Économies optimisables</h3>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex' }}>
          <MoreVertical size={16} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: '160px' }}>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            {/* Outer turquoise arc */}
            <Pie
              data={donutData}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={68}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill="#3FC8B8" />
              <Cell fill="#E8ECEF" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#1A1D23', lineHeight: 1.2 }}>
            {(value / 1000).toFixed(0)}.{String(value % 1000).padStart(3, '0')}€
          </div>
        </div>

        {/* Percentage badge bottom-right */}
        <div style={{
          position: 'absolute',
          bottom: '14px',
          right: '22%',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          backgroundColor: '#52C97A15',
          borderRadius: '12px',
          padding: '3px 7px',
          fontSize: '11px',
          color: '#52C97A',
          fontWeight: '600',
        }}>
          <TrendingUp size={10} />
          {percentage}%
        </div>
      </div>
    </Card>
  );
}
