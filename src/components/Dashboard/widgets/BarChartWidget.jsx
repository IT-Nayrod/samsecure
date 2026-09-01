// Écart usage vs droits par éditeur, branche sur le contrat conformite (#192).
// Colorimetrie inversee : vert = usage proche des droits, rouge = ecart eleve,
// rouge sombre = depassement (usage superieur aux droits). Les montants
// presents dans la reponse (prix, ecart valorise) ne sont jamais affiches ici :
// le widget est partage avec le profil IT Ops.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import CadreWidget from './CadreWidget';
import useSourceDashboard from '../useSourceDashboard';
import { useSeuils } from '../ContexteDashboard';
import { borneSeuil } from '../seuils';
import {
  THRESHOLD_GREEN, THRESHOLD_YELLOW, THRESHOLD_ORANGE,
  THRESHOLD_RED, THRESHOLD_DARK_RED,
} from '../couleurs';
import { ROUTES_DRILL } from '../drill';
import { conformiteService } from '../../../services/dashboardService';
import { societesService } from '../../../services/adminService';
import { optionnel } from '../../../services/http';

const SELECT_STYLE = {
  fontSize: 11, border: '1px solid #EAECF0', borderRadius: 6,
  padding: '3px 8px', color: '#1A1D23', background: 'white', cursor: 'pointer',
};

function fabriqueCouleur(seuils) {
  const b2 = borneSeuil(seuils, 2, 10);
  const b3 = borneSeuil(seuils, 3, 20);
  const b4 = borneSeuil(seuils, 4, 30);
  return (droits, usages) => {
    if (!droits && !usages) return THRESHOLD_GREEN;
    if (usages > droits) {
      // Manque de droits : l'ampleur se mesure sur les droits detenus.
      const abs = droits > 0 ? ((usages - droits) / droits) * 100 : 100;
      if (abs > b4) return THRESHOLD_DARK_RED;
      if (abs > b3) return THRESHOLD_RED;
      if (abs > b2) return THRESHOLD_ORANGE;
      return THRESHOLD_YELLOW;
    }
    const ecartPct = droits > 0 ? ((droits - usages) / droits) * 100 : 0;
    if (ecartPct > b4) return THRESHOLD_RED;
    if (ecartPct > b3) return THRESHOLD_ORANGE;
    if (ecartPct > b2) return THRESHOLD_YELLOW;
    return THRESHOLD_GREEN;
  };
}

export function EcartUsageDroitsWidget() {
  const navigate = useNavigate();
  const seuils = useSeuils('ecart-usage-droits');
  const [idSociete, setIdSociete] = useState('');

  const { data, chargement, erreur, relancer } = useSourceDashboard(
    `conformite:${idSociete}`,
    () => conformiteService.list(idSociete ? { id_societe: idSociete } : {}));
  const { data: societes } = useSourceDashboard('societes',
    () => optionnel(societesService.list(), []));

  const couleurDe = fabriqueCouleur(seuils);

  // Agregation des lignes produit par editeur, en quantites uniquement.
  const parEditeur = new Map();
  for (const l of data?.lignes ?? []) {
    const cle = l.id_editeur ?? 'sans-editeur';
    if (!parEditeur.has(cle)) {
      parEditeur.set(cle, {
        id_editeur: l.id_editeur, editeur: l.editeur_label ?? 'Sans éditeur',
        droits: 0, usages: 0, produits: [],
      });
    }
    const e = parEditeur.get(cle);
    e.droits += l.droits_total ?? 0;
    e.usages += l.usages_total ?? 0;
    e.produits.push(l);
  }
  const serie = [...parEditeur.values()].map((e) => ({
    ...e, color: couleurDe(e.droits, e.usages),
  }));

  const b2 = borneSeuil(seuils, 2, 10);
  const b3 = borneSeuil(seuils, 3, 20);
  const b4 = borneSeuil(seuils, 4, 30);
  const legende = [
    { color: THRESHOLD_GREEN, label: `Conforme (< ${b2} % d'écart)` },
    { color: THRESHOLD_YELLOW, label: `Attention (${b2}-${b3} %)` },
    { color: THRESHOLD_ORANGE, label: `Problématique (${b3}-${b4} %)` },
    { color: THRESHOLD_RED, label: `Critique (> ${b4} %)` },
    { color: THRESHOLD_DARK_RED, label: 'Dépassement (usage > droits)' },
  ];

  const TooltipEditeur = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const entree = serie.find((d) => d.editeur === label);
    if (!entree) return null;
    return (
      <div style={{
        background: '#1A1D23', color: '#fff', borderRadius: 10,
        padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        minWidth: 240,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>{label}</div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ opacity: 0.6, fontSize: 10 }}>
              <th style={{ textAlign: 'left', paddingRight: 8, fontWeight: 500 }}>Produit</th>
              <th style={{ textAlign: 'right', paddingRight: 8 }}>Droits</th>
              <th style={{ textAlign: 'right', paddingRight: 8 }}>Usage</th>
              <th style={{ textAlign: 'right' }}>Écart</th>
            </tr>
          </thead>
          <tbody>
            {entree.produits.slice(0, 8).map((p) => {
              const droits = p.droits_total ?? 0;
              const usages = p.usages_total ?? 0;
              const pct = droits > 0 ? Math.round(((droits - usages) / droits) * 100) : 0;
              return (
                <tr key={p.id_produit} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <td style={{ paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>{p.produit_label}</td>
                  <td style={{ textAlign: 'right', paddingRight: 8, opacity: 0.7 }}>{droits}</td>
                  <td style={{ textAlign: 'right', paddingRight: 8, opacity: 0.7 }}>{usages}</td>
                  <td style={{ textAlign: 'right', color: couleurDe(droits, usages), fontWeight: 700 }}>
                    {pct >= 0 ? '+' : ''}{pct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <CadreWidget
      widgetId="ecart-usage-droits"
      titre="Écart usage vs droits"
      info={"Pour chaque éditeur, droits acquis (licences non expirées) face à l'usage déclaré (affectations validées), en quantités. La couleur suit l'écart en pourcentage des droits, selon les seuils configurés. Le clic sur un éditeur ouvre sa fiche."}
      derniereMaj={data?.agregats?.derniere_maj}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && serie.length === 0}
      videMessage="Aucun produit avec droits ou usage sur ce périmètre."
      onOuvrir={() => navigate(ROUTES_DRILL.licences())}
      actions={(societes ?? []).length > 0 && (
        <select value={idSociete} onChange={(e) => setIdSociete(e.target.value)} style={SELECT_STYLE}>
          <option value="">Toutes les sociétés</option>
          {(societes ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.raison_sociale ?? s.label}</option>
          ))}
        </select>
      )}
    >
      <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#8B9099', flexWrap: 'wrap' }}>
        {legende.map((l) => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: l.color, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={serie} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap="25%"
          onClick={(d) => {
            const entree = d?.activePayload?.[0]?.payload;
            if (entree?.id_editeur) navigate(ROUTES_DRILL.editeur(entree.id_editeur));
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
          <XAxis dataKey="editeur" tick={{ fontSize: 11, fill: '#8B9099' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} />
          <Tooltip content={<TooltipEditeur />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="droits" name="Droits acquis" maxBarSize={28}
            shape={(props) => (
              <rect x={props.x} y={props.y} width={props.width} height={props.height}
                fill={props.payload.color} rx={3} />
            )} />
          <Bar dataKey="usages" name="Usage déclaré" maxBarSize={28}
            shape={(props) => (
              <rect x={props.x} y={props.y} width={props.width} height={props.height}
                fill={props.payload.color + 'CC'} rx={3} />
            )} />
        </BarChart>
      </ResponsiveContainer>
    </CadreWidget>
  );
}

export default EcartUsageDroitsWidget;
