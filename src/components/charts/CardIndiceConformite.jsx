import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { MoreVertical } from 'lucide-react';
import Card from '../ui/Card';
import { conformiteData } from '../../data/mockData';

export default function CardIndiceConformite() {
  const { score, segments } = conformiteData;

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#1A1D23' }}>Indice de conformité</h3>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex' }}>
          <MoreVertical size={16} />
        </button>
      </div>

      {/* Donut + center */}
      <div style={{ position: 'relative', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <Pie
              data={segments}
              cx="50%"
              cy="50%"
              innerRadius={46}
              outerRadius={62}
              dataKey="value"
              strokeWidth={2}
              stroke="white"
            >
              {segments.map((seg, i) => (
                <Cell key={i} fill={seg.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#E8534A', lineHeight: 1.1 }}>+{score}</div>
          <div style={{ fontSize: '10px', color: '#8B9099', fontWeight: '500' }}>À optimiser</div>
        </div>
      </div>

      {/* Optimise button */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button style={{
          border: '1px solid #EAECF0',
          borderRadius: '6px',
          padding: '6px 20px',
          fontSize: '12px',
          color: '#1A1D23',
          backgroundColor: 'white',
          cursor: 'pointer',
          fontWeight: '500',
        }}>
          J'optimise
        </button>
      </div>

      {/* Legend */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px 8px',
        marginTop: '4px',
      }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              width: '8px', height: '8px',
              borderRadius: '50%',
              backgroundColor: seg.color,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: '10px', color: '#8B9099' }}>{seg.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
