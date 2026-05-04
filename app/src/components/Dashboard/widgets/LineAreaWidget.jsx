// V2 - Modifié - W18 Coût des licences manquantes (lignes seuil + gradient coloré)
import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { MoreVertical } from 'lucide-react';
import Card from '../../ui/Card';
import {
  THRESHOLD_GREEN, THRESHOLD_YELLOW, THRESHOLD_ORANGE, THRESHOLD_RED,
} from '../../../data/dashboardMockData';
import { THRESHOLDS } from '../../../data/thresholds';
import FreshnessBadge from './FreshnessBadge';

// Coût annuel du parc détenu : Microsoft 1 300 000 + Oracle 2 100 000 + SAP 1 100 000 + IBM 1 050 000 + Adobe 180 000 = 5 730 000 €
const PARC_ANNUEL = 5730000;

function computeThresholds() {
  return THRESHOLDS.cout_licences_manquantes.pct.map(p => Math.round(PARC_ANNUEL / 12 * p / 100));
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const [t1, t2, t3] = computeThresholds();
  const color = val > t3 ? THRESHOLD_RED : val > t2 ? THRESHOLD_ORANGE : val > t1 ? THRESHOLD_YELLOW : THRESHOLD_GREEN;
  return (
    <div style={{
      background: '#1A1D23', color: '#fff', borderRadius: 8,
      padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ color, fontWeight: 700 }}>{val.toLocaleString('fr-FR')} €</div>
    </div>
  );
};

export function CoutLicencesManquantesWidget({ data }) {
  const [view, setView] = useState('Chart');
  const thresh = computeThresholds();
  const yMax = Math.max(...data.map(d => d.valeur)) * 1.15;

  // Calcul des offsets gradient (0=top → 1=bottom)
  const toOff = v => Math.max(0, Math.min(100, (1 - v / yMax) * 100)).toFixed(1) + '%';

  return (
    <Card id="cout-licences-manquantes" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>Coût des licences manquantes</h3>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <FreshnessBadge type="cached" minutesAgo={30} />
          {['Chart', 'Table'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 500,
              border: '1px solid #EAECF0', cursor: 'pointer',
              background: view === v ? '#7C6FCD' : 'white',
              color: view === v ? 'white' : '#8B9099',
              transition: 'all 0.15s ease',
            }}>{v}</button>
          ))}
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B9099', display: 'flex', padding: 0, marginLeft: 4 }}>
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {view === 'Chart' ? (
        <ResponsiveContainer width="100%" height={185}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
            <defs>
              <linearGradient id="coutLicGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"           stopColor={THRESHOLD_RED}    stopOpacity={0.75} />
                <stop offset={toOff(thresh[3])} stopColor={THRESHOLD_RED}    stopOpacity={0.65} />
                <stop offset={toOff(thresh[3])} stopColor={THRESHOLD_ORANGE} stopOpacity={0.55} />
                <stop offset={toOff(thresh[2])} stopColor={THRESHOLD_ORANGE} stopOpacity={0.50} />
                <stop offset={toOff(thresh[2])} stopColor={THRESHOLD_YELLOW} stopOpacity={0.45} />
                <stop offset={toOff(thresh[1])} stopColor={THRESHOLD_YELLOW} stopOpacity={0.40} />
                <stop offset={toOff(thresh[1])} stopColor={THRESHOLD_GREEN}  stopOpacity={0.35} />
                <stop offset="100%"         stopColor={THRESHOLD_GREEN}  stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
            <XAxis dataKey="mois" tick={{ fontSize: 9, fill: '#8B9099' }} axisLine={false} tickLine={false} interval={2} />
            <YAxis
              tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false}
              domain={[0, yMax]}
            />
            <Tooltip content={<CustomTooltip />} />
            {[
              { val: thresh[0], color: THRESHOLD_YELLOW, label: '5%'  },
              { val: thresh[1], color: THRESHOLD_ORANGE, label: '10%' },
              { val: thresh[2], color: THRESHOLD_RED,    label: '15%' },
              { val: thresh[3], color: THRESHOLD_RED,    label: '20%' },
            ].map(t => (
              <ReferenceLine key={t.label} y={t.val} stroke={t.color} strokeDasharray="4 3" strokeWidth={1.5}
                label={{ value: t.label, position: 'insideTopRight', fontSize: 9, fill: t.color, fontWeight: 600 }} />
            ))}
            <Area
              type="monotone" dataKey="valeur" name="Coût licences manquantes"
              stroke={THRESHOLD_RED} strokeWidth={2}
              fill="url(#coutLicGrad)"
              dot={false} activeDot={{ r: 4, fill: THRESHOLD_RED, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ maxHeight: 185, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#fff' }}>
              <tr style={{ borderBottom: '1px solid #EAECF0' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#8B9099', fontWeight: 500 }}>Mois</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: '#8B9099', fontWeight: 500 }}>Coût</th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => {
                const c = d.valeur > thresh[2] ? THRESHOLD_RED : d.valeur > thresh[1] ? THRESHOLD_ORANGE : d.valeur > thresh[0] ? THRESHOLD_YELLOW : THRESHOLD_GREEN;
                return (
                  <tr key={d.mois} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '5px 8px', color: '#1A1D23' }}>{d.mois}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: c, fontWeight: 600 }}>
                      {d.valeur.toLocaleString('fr-FR')} €
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default CoutLicencesManquantesWidget;
