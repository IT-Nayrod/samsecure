// HistogramWidget — W04 Échéances contrats | W05 Échéances commandes
//                  W06 Montants totaux | W14 Coûts annuels
//                  W15 Échéances trésorerie | W20 Usage 12 mois glissants
// Ref specs §9.2 §9.3 §9.7 §9.12 §9.13 §9.15
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ComposedChart, Line, ReferenceLine,
} from 'recharts';
import { MoreVertical } from 'lucide-react';
import Card from '../../ui/Card';
import {
  COMPLIANCE_GREEN, COMPLIANCE_ORANGE, COMPLIANCE_RED,
  societes, usage12MoisData, montantsTotauxData,
} from '../../../data/dashboardMockData';

const DarkTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1A1D23', color: '#fff', borderRadius: 8,
      padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.9 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill || p.color }} />
          <span>{p.name} : </span>
          <strong>{formatter ? formatter(p.value) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ─── W04 / W05 — Histogramme échéances (barres empilées vert/orange/rouge) ───
export function EcheancesWidget({ title, data }) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>{title}</h3>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0 }}>
          <MoreVertical size={16} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#8B9099' }}>
        {[
          { color: COMPLIANCE_GREEN,  label: '≥ 3 mois' },
          { color: COMPLIANCE_ORANGE, label: '< 3 mois' },
          { color: COMPLIANCE_RED,    label: 'Échu'      },
        ].map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
          <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="vert"   name="≥ 3 mois" stackId="a" fill={COMPLIANCE_GREEN}  />
          <Bar dataKey="orange" name="< 3 mois"  stackId="a" fill={COMPLIANCE_ORANGE} />
          <Bar dataKey="rouge"  name="Échu"      stackId="a" fill={COMPLIANCE_RED}    radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ─── W06 / W14 — Montants totaux / Coûts annuels ────────────────────────────
const AXES_OPTIONS = ['Par éditeur', 'Par société', 'Par produit'];
const PERIODS = ['1 an', '3 ans', '5 ans', 'Illimité'];

export function MontantsTotauxWidget({ title = 'Montants totaux', showPeriod = true }) {
  const [axe, setAxe]       = useState('Par éditeur');
  const [period, setPeriod] = useState('1 an');

  const dataMap = {
    'Par éditeur':  montantsTotauxData.parEditeur,
    'Par société':  montantsTotauxData.parSociete,
    'Par produit':  montantsTotauxData.parProduit,
  };
  const chartData = dataMap[axe] || montantsTotauxData.parEditeur;

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>{title}</h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={axe} onChange={e => setAxe(e.target.value)} style={{
            fontSize: 11, border: '1px solid #EAECF0', borderRadius: 6,
            padding: '3px 8px', color: '#1A1D23', background: 'white',
          }}>
            {AXES_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
          {showPeriod && (
            <div style={{ display: 'flex', gap: 2 }}>
              {PERIODS.map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: '3px 7px', borderRadius: 5, fontSize: 10,
                  border: '1px solid #EAECF0', cursor: 'pointer',
                  background: period === p ? '#7C6FCD' : 'white',
                  color: period === p ? 'white' : '#8B9099',
                  fontWeight: period === p ? 600 : 400,
                }}>{p}</button>
              ))}
            </div>
          )}
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0 }}>
            <MoreVertical size={16} />
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
            tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false}
          />
          <Tooltip
            content={<DarkTooltip formatter={v => v.toLocaleString('fr-FR') + ' €'} />}
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          />
          <Bar dataKey="value" name="Montant" radius={[3, 3, 0, 0]} maxBarSize={40}
            onClick={(d) => console.log('drill down', d.label)}>
            {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ─── W15 — Échéances de trésorerie ───────────────────────────────────────────
export function EcheancesTresorerieWidget({ data }) {
  const max = Math.max(...data.map(d => d.montant));
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>Échéances de trésorerie</h3>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0 }}>
          <MoreVertical size={16} />
        </button>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
          <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={v => `${(v/1000).toFixed(0)}k`}
            tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false}
          />
          <Tooltip content={<DarkTooltip formatter={v => v.toLocaleString('fr-FR') + ' €'} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="montant" name="Montant" radius={[3, 3, 0, 0]} maxBarSize={30}>
            {data.map((entry, i) => {
              const intensity = 0.35 + (entry.montant / max) * 0.65;
              const r = Math.round(28 * intensity);
              const g = Math.round(174 * intensity);
              const b = Math.round(184 * intensity);
              return <Cell key={i} fill={`rgb(${r},${g},${b})`} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ─── W20 — Usage 12 mois glissants ───────────────────────────────────────────
export function Usage12MoisWidget() {
  const [produit, setProduit] = useState('Tous');
  const [societe, setSociete] = useState('Toutes');

  const series = usage12MoisData.series[produit] || usage12MoisData.series['Tous'];
  const reelsData  = series.filter(d => d.affectees !== null);
  const projData   = series.filter(d => d.projection !== null);

  // Fusion pour ComposedChart (on a besoin de toutes les lignes du même tableau)
  const chartData = series.map(d => ({
    ...d,
    affecteesAff: d.affectees,
    projectionAff: d.projection ?? undefined,
  }));

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>Usage 12 mois glissants</h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={produit} onChange={e => setProduit(e.target.value)} style={{
            fontSize: 11, border: '1px solid #EAECF0', borderRadius: 6,
            padding: '3px 8px', color: '#1A1D23', background: 'white',
          }}>
            {usage12MoisData.produits.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={societe} onChange={e => setSociete(e.target.value)} style={{
            fontSize: 11, border: '1px solid #EAECF0', borderRadius: 6,
            padding: '3px 8px', color: '#1A1D23', background: 'white',
          }}>
            {usage12MoisData.societes.map(s => <option key={s}>{s}</option>)}
          </select>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0 }}>
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#8B9099' }}>
        {[
          { color: '#7C6FCD', label: 'Affectations réelles' },
          { color: '#3FC8B8', label: 'Droits d\'usage'       },
          { color: '#F4C842', label: 'Projection',           dashed: true },
        ].map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 16, height: 2,
              display: 'inline-block',
              borderTop: l.dashed ? `2px dashed ${l.color}` : 'none',
              background: l.dashed ? 'none' : l.color,
            }} />
            {l.label}
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={185}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
          <XAxis dataKey="mois" tick={{ fontSize: 9, fill: '#8B9099' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} />
          <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="affecteesAff" name="Affectations" fill="#7C6FCD" radius={[2, 2, 0, 0]} maxBarSize={20} />
          <Line dataKey="droits" name="Droits" type="monotone" stroke="#3FC8B8" strokeWidth={2} dot={false} />
          <Line dataKey="projectionAff" name="Projection" type="monotone" stroke="#F4C842"
            strokeWidth={2} strokeDasharray="5 4" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
