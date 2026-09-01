// Coût par logiciel (Financier), branche sur les agregats dashboards (#192).
// Somme des couts des licences non expirees du parc, par produit, avec la
// part de chaque produit dans le total. Le clic sur une ligne ouvre la liste
// des licences filtree sur le produit.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, ArrowDown } from 'lucide-react';
import CadreWidget from './CadreWidget';
import useSourceDashboard from '../useSourceDashboard';
import { couleurSerie } from '../couleurs';
import { ROUTES_DRILL } from '../drill';
import { dashboardService } from '../../../services/dashboardService';

export function CoutParLogicielWidget() {
  const navigate = useNavigate();
  const [sortDir, setSortDir] = useState('desc');
  const { data, chargement, erreur, relancer } = useSourceDashboard(
    'montants-totaux:produit:parc', () => dashboardService.montantsTotaux({ axe: 'produit' }));

  const total = data?.total ?? 0;
  const lignes = [...(data?.lignes ?? [])]
    .sort((a, b) => (sortDir === 'desc' ? b.montant - a.montant : a.montant - b.montant))
    .map((l, i) => ({
      ...l,
      couleur: couleurSerie(i),
      pct: total > 0 ? Math.round((l.montant / total) * 1000) / 10 : 0,
    }));

  return (
    <CadreWidget
      widgetId="cout-par-logiciel"
      titre="Coût par logiciel"
      info={"Somme des coûts des licences non expirées du parc, par produit, et part de chaque produit dans le coût total. Le clic sur une ligne ouvre les licences du produit."}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && lignes.length === 0}
      videMessage="Aucune licence valorisée sur le parc."
      onOuvrir={() => navigate(ROUTES_DRILL.licences())}
      actions={(
        <button
          onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
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
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
           onClick={(e) => e.stopPropagation()}>
        {lignes.map((item, i) => (
          <div
            key={item.id ?? item.label}
            onClick={() => item.id && navigate(ROUTES_DRILL.licences({ produit: item.id }))}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '7px 8px',
              background: i % 2 === 0 ? 'transparent' : '#FAFAFA',
              borderRadius: 6, cursor: item.id ? 'pointer' : 'default',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: item.couleur, flexShrink: 0,
              }} />
              <span style={{ fontSize: 12, color: '#1A1D23' }}>{item.label}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1D23' }}>
                {Number(item.montant).toLocaleString('fr-FR')} €
              </span>
              <span style={{ fontSize: 10, color: '#8B9099', minWidth: 36, textAlign: 'right' }}>
                {item.pct}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </CadreWidget>
  );
}

export default CoutParLogicielWidget;
