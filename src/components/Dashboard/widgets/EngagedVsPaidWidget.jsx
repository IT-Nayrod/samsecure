// V2 - Nouveau - Widget Montants engagés vs payés avec drill-down par éditeur → produit
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { MoreVertical, ChevronLeft } from 'lucide-react';
import Card from '../../ui/Card';
import { montantsEngagesPayesData } from '../../../data/dashboardMockData';
import FreshnessBadge from './FreshnessBadge';

const DrillTooltip = ({ active, payload, label, level }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1A1D23', color: '#fff', borderRadius: 10,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      minWidth: 200,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill }} />
          <span style={{ opacity: 0.85 }}>{p.name} : </span>
          <strong>{p.value.toLocaleString('fr-FR')} €</strong>
        </div>
      ))}
      {level === 'editeur' && (
        <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 6, fontSize: 10, opacity: 0.65 }}>
          Cliquez pour plus d'informations
        </div>
      )}
    </div>
  );
};

export function EngagedVsPaidWidget() {
  const [drillLevel, setDrillLevel] = useState('editeur');
  const [selectedEditeur, setSelectedEditeur] = useState(null);

  const editeurColor = drillLevel === 'produit'
    ? montantsEngagesPayesData.parEditeur.find(e => e.editeur === selectedEditeur)?.color || '#7C6FCD'
    : null;

  const chartData = drillLevel === 'editeur'
    ? montantsEngagesPayesData.parEditeur
    : (montantsEngagesPayesData.parProduit[selectedEditeur] || []);

  const handleClick = (barData) => {
    if (drillLevel === 'editeur' && barData?.activePayload) {
      const ed = barData.activePayload[0]?.payload?.editeur;
      if (ed && montantsEngagesPayesData.parProduit[ed]) {
        setSelectedEditeur(ed);
        setDrillLevel('produit');
      }
    }
  };

  const handleBack = () => {
    setDrillLevel('editeur');
    setSelectedEditeur(null);
  };

  const xKey = drillLevel === 'editeur' ? 'editeur' : 'produit';

  return (
    <Card id="montants-engages-payes" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {drillLevel === 'produit' && (
            <button
              onClick={handleBack}
              style={{
                display: 'flex', alignItems: 'center', gap: 2,
                fontSize: 11, color: '#7C6FCD', background: '#7C6FCD14',
                border: '1px solid #7C6FCD30', borderRadius: 20,
                padding: '3px 10px', cursor: 'pointer', fontWeight: 600,
              }}
            >
              <ChevronLeft size={12} />Retour
            </button>
          )}
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>
            {drillLevel === 'editeur'
              ? 'Montants engagés vs payés'
              : `${selectedEditeur} — détail produits`}
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FreshnessBadge type="cached" minutesAgo={60} />
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0 }}>
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#8B9099' }}>
        {[
          { color: '#7C6FCD', label: 'Commandé' },
          { color: '#3FC8B8', label: 'Payé'     },
        ].map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
        {drillLevel === 'editeur' && (
          <span style={{ opacity: 0.6 }}>— Cliquez sur un éditeur pour le détail</span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={210}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 4, left: -4, bottom: drillLevel === 'produit' ? 20 : 0 }}
          barCategoryGap="30%"
          onClick={handleClick}
          style={{ cursor: drillLevel === 'editeur' ? 'pointer' : 'default' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: drillLevel === 'produit' ? 9 : 11, fill: '#8B9099' }}
            axisLine={false} tickLine={false}
            angle={drillLevel === 'produit' ? -20 : 0}
            textAnchor={drillLevel === 'produit' ? 'end' : 'middle'}
          />
          <YAxis
            tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
            tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false}
          />
          <Tooltip content={<DrillTooltip level={drillLevel} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="commande" name="Commandé" fill="#7C6FCD" maxBarSize={36} radius={[3, 3, 0, 0]}>
            {drillLevel === 'editeur' && montantsEngagesPayesData.parEditeur.map((entry, i) => (
              <Cell key={i} fill={entry.color + 'CC'} />
            ))}
          </Bar>
          <Bar dataKey="paye" name="Payé" fill="#3FC8B8" maxBarSize={36} radius={[3, 3, 0, 0]}>
            {drillLevel === 'editeur' && montantsEngagesPayesData.parEditeur.map((entry, i) => (
              <Cell key={i} fill={entry.color + '80'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export default EngagedVsPaidWidget;
