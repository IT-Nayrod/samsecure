// V2 - Modifié - W17 Coût par logiciel (liste triable, visuellement discret)
import { useState } from 'react';
import { MoreVertical, ArrowUp, ArrowDown } from 'lucide-react';
import Card from '../../ui/Card';
import FreshnessBadge from './FreshnessBadge';

export function CoutParLogicielWidget({ data }) {
  const [sortDir, setSortDir] = useState('desc');

  const sorted = [...data].sort((a, b) =>
    sortDir === 'desc' ? b.montant - a.montant : a.montant - b.montant
  );

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>Coût par logiciel</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FreshnessBadge type="cached" minutesAgo={60} />
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            title={sortDir === 'desc' ? 'Trier croissant' : 'Trier décroissant'}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 11, color: '#7C6FCD', background: '#7C6FCD14',
              border: '1px solid #7C6FCD40', borderRadius: 6,
              padding: '3px 8px', cursor: 'pointer', fontWeight: 600,
            }}
          >
            {sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
            {sortDir === 'desc' ? 'Décroissant' : 'Croissant'}
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0 }}>
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {sorted.map((item, i) => (
          <div key={item.name} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '7px 8px',
            background: i % 2 === 0 ? 'transparent' : '#FAFAFA',
            borderRadius: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: item.color, flexShrink: 0,
              }} />
              <span style={{ fontSize: 12, color: '#1A1D23' }}>{item.name}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1D23' }}>
                {item.montant.toLocaleString('fr-FR')} €
              </span>
              <span style={{ fontSize: 10, color: '#8B9099', minWidth: 36, textAlign: 'right' }}>
                {item.pctBudget}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default CoutParLogicielWidget;
