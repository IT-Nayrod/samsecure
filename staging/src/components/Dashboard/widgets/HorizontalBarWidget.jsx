// HorizontalBarWidget — W17 Top logiciels coûteux
// Ref specs §9.12 dérivé
import { MoreVertical } from 'lucide-react';
import Card from '../../ui/Card';

export default function HorizontalBarWidget({ data }) {
  const max = data[0]?.montant || 1;
  // Dégradé du plus coûteux (bleu foncé) au moins coûteux (bleu clair / rouge)
  const COLORS = ['#1E3A5F', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD'];

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>Top logiciels coûteux</h3>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0 }}>
          <MoreVertical size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.map((item, i) => (
          <div key={item.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#1A1D23', fontWeight: 500 }}>{item.name}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1D23' }}>
                  {item.montant.toLocaleString('fr-FR')} €
                </span>
                <span style={{ fontSize: 10, color: '#8B9099' }}>{item.pctBudget}%</span>
              </div>
            </div>
            <div style={{ height: 8, background: '#F5F5F5', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(item.montant / max) * 100}%`,
                background: COLORS[i] || COLORS[COLORS.length - 1],
                borderRadius: 4,
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
