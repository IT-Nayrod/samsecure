// ListWidget — W10 Prévision budgétaire N+1 | W23 Dernières saisies à valider
// Ref specs §9.11 §8
import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import Card from '../../ui/Card';
import { THRESHOLD_GREEN, THRESHOLD_YELLOW, THRESHOLD_RED } from '../../../data/dashboardMockData';

// ─── W10 — Prévision budgétaire N+1 (tableau triable) ───────────────────────
export function PrevisionBudgetaireWidget({ data }) {
  const [sortKey, setSortKey] = useState('coutN');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = key => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...data].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey];
    if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va;
    return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  const fmt = v => v.toLocaleString('fr-FR');
  const variationColor = (n, n1) => {
    const pct = ((n - n1) / n1) * 100;
    if (pct > 5) return THRESHOLD_RED;
    if (pct < -5) return THRESHOLD_GREEN;
    return '#8B9099';
  };
  const variationPct = (n, n1) => {
    const pct = ((n - n1) / n1) * 100;
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  };

  const TH = ({ k, label }) => (
    <th onClick={() => handleSort(k)} style={{
      padding: '6px 8px', textAlign: k === 'produit' ? 'left' : 'right',
      color: sortKey === k ? '#7C6FCD' : '#8B9099',
      fontWeight: 500, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
      userSelect: 'none',
    }}>
      {label}{sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>Prévision budgétaire N+1</h3>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0 }}>
          <MoreVertical size={16} />
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #EAECF0' }}>
              <TH k="produit" label="Produit" />
              <TH k="coutN"   label="Coût N (€)" />
              <TH k="coutN1"  label="Coût N-1 (€)" />
              <TH k="coutN"   label="Var." />
              <TH k="prevN1"  label="Prévi N+1 (€)" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr key={row.produit} style={{ borderBottom: '1px solid #F5F5F5' }}>
                <td style={{ padding: '6px 8px', color: '#1A1D23', fontWeight: 500 }}>{row.produit}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1A1D23' }}>{fmt(row.coutN)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#8B9099' }}>{fmt(row.coutN1)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: variationColor(row.coutN, row.coutN1) }}>
                  {variationPct(row.coutN, row.coutN1)}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#7C6FCD' }}>{fmt(row.prevN1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── W23 — Dernières saisies à valider (feed scrollable) ────────────────────
const STATUT_CONFIG = {
  en_attente: { label: 'En attente', color: THRESHOLD_YELLOW },
  valide:     { label: 'Validé',     color: THRESHOLD_GREEN  },
  refuse:     { label: 'Refusé',     color: THRESHOLD_RED    },
};

export function DernieresSaisiesWidget({ data }) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>Dernières saisies à valider</h3>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0 }}>
          <MoreVertical size={16} />
        </button>
      </div>
      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
            <tr style={{ borderBottom: '1px solid #EAECF0' }}>
              {['Statut', 'Date', 'Type', 'Nom', 'Soumis par'].map(h => (
                <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: '#8B9099', fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(row => {
              const cfg = STATUT_CONFIG[row.statut] || STATUT_CONFIG.en_attente;
              return (
                <tr key={row.id} style={{ borderBottom: '1px solid #F5F5F5' }}>
                  <td style={{ padding: '5px 8px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 10, fontWeight: 600,
                      color: cfg.color, background: cfg.color + '18',
                      borderRadius: 12, padding: '2px 8px', whiteSpace: 'nowrap',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
                      {cfg.label}
                    </span>
                  </td>
                  <td style={{ padding: '5px 8px', color: '#8B9099', whiteSpace: 'nowrap' }}>{row.date}</td>
                  <td style={{ padding: '5px 8px', color: '#8B9099', whiteSpace: 'nowrap' }}>{row.type}</td>
                  <td style={{ padding: '5px 8px', color: '#1A1D23', fontWeight: 500 }}>{row.nom}</td>
                  <td style={{ padding: '5px 8px', color: '#8B9099' }}>{row.soumis}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
