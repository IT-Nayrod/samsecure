import { MoreVertical } from 'lucide-react';
import Card from '../ui/Card';
import { topLogiciels } from '../../data/mockData';

export default function CardTopLogiciels() {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#1A1D23' }}>Top logiciels coûteux</h3>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex' }}>
          <MoreVertical size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {topLogiciels.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#1A1D23' }}>{item.name}</span>
                <span style={{ fontSize: '11px', color: '#8B9099' }}>${item.amount.toLocaleString()}</span>
              </div>
              <span style={{ fontSize: '11px', color: '#8B9099', fontWeight: '500' }}>{item.percentage}%</span>
            </div>
            <div style={{
              height: '6px',
              backgroundColor: '#F0F0F5',
              borderRadius: '3px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${item.percentage}%`,
                backgroundColor: item.color,
                borderRadius: '3px',
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
