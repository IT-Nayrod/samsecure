// Donuts des dashboards, branches sur le contrat conformite (#192) :
// indice de conformite global (Manager DSI) et valorisation des licences
// non utilisees (Financier).
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import CadreWidget from './CadreWidget';
import useSourceDashboard from '../useSourceDashboard';
import { useSeuils } from '../ContexteDashboard';
import { couleurSeuil } from '../seuils';
import {
  THRESHOLD_GREEN, THRESHOLD_ORANGE, THRESHOLD_RED, couleurSerie,
} from '../couleurs';
import { ROUTES_DRILL } from '../drill';
import { conformiteService } from '../../../services/dashboardService';

const TooltipDonut = ({ active, payload, euros = false }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1A1D23', color: '#fff', borderRadius: 8,
      padding: '7px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    }}>
      <strong>{payload[0].name}</strong>
      {' - '}
      {euros
        ? `${Number(payload[0].value).toLocaleString('fr-FR')} €`
        : payload[0].value}
    </div>
  );
};

// ─── Indice de conformité global (Manager DSI) ──────────────────────────────
export function IndiceConformiteWidget() {
  const navigate = useNavigate();
  const seuils = useSeuils('indice-conformite');
  const { data, chargement, erreur, relancer } = useSourceDashboard(
    'conformite-global', () => conformiteService.synthese('global'));

  // Le niveau global renvoie les agregats, en tete de reponse ou en ligne
  // unique selon le contrat : les deux formes sont acceptees.
  const ag = data?.agregats ?? data?.lignes?.[0] ?? null;
  const nbProduits = ag?.nb_produits ?? 0;
  const segments = ag ? [
    { name: 'Conforme', value: ag.nb_conforme ?? 0, color: THRESHOLD_GREEN },
    { name: 'Attention', value: ag.nb_attention ?? 0, color: THRESHOLD_ORANGE },
    { name: 'Dépassement', value: ag.nb_depassement ?? 0, color: THRESHOLD_RED },
  ].filter((s) => s.value > 0) : [];
  const pctConforme = nbProduits > 0 ? ((ag.nb_conforme ?? 0) / nbProduits) * 100 : null;
  const color = couleurSeuil(pctConforme, seuils);

  return (
    <CadreWidget
      widgetId="indice-conformite"
      titre="Indice de conformité global"
      sousTitre="Conformité contractuelle du parc"
      info={"Répartition des produits du parc par statut de conformité (usage déclaré face aux droits acquis) et part de produits conformes, colorée selon les seuils configurés. Le clic ouvre la liste des licences."}
      derniereMaj={ag?.derniere_maj}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && nbProduits === 0}
      videMessage="Aucun produit avec droits ou usage pour le moment."
      onOuvrir={() => navigate(ROUTES_DRILL.licences())}
    >
      <div style={{ position: 'relative', height: 150 }}>
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie data={segments} cx="50%" cy="50%"
              innerRadius={48} outerRadius={64}
              dataKey="value" strokeWidth={2} stroke="white" isAnimationActive={false}>
              {segments.map((seg, i) => <Cell key={i} fill={seg.color} />)}
            </Pie>
            <Tooltip content={<TooltipDonut />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>
            {pctConforme == null ? '-' : `${pctConforme.toFixed(0)}%`}
          </div>
          <div style={{ fontSize: 9, color: '#8B9099', fontWeight: 500 }}>conformes</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#8B9099' }}>{seg.name}</span>
            <span style={{ fontSize: 10, color: '#1A1D23', fontWeight: 600, marginLeft: 'auto' }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </CadreWidget>
  );
}

// ─── Valorisation des licences non utilisées (Financier) ────────────────────
export function ValorisationLicencesWidget() {
  const navigate = useNavigate();
  const seuils = useSeuils('valorisation-licences');
  const { data, chargement, erreur, relancer } = useSourceDashboard(
    'conformite:', () => conformiteService.list({}));

  // Ecart valorise positif = droits payes au-dela de l'usage declare,
  // agrege par editeur pour les segments du donut.
  const parEditeur = new Map();
  let totalDroits = 0;
  let ecartQuantite = 0;
  for (const l of data?.lignes ?? []) {
    totalDroits += l.droits_total ?? 0;
    const ecart = (l.droits_total ?? 0) - (l.usages_total ?? 0);
    if (ecart > 0) ecartQuantite += ecart;
    const valorise = l.ecart_valorise ?? 0;
    if (valorise > 0) {
      const cle = l.editeur_label ?? 'Sans éditeur';
      parEditeur.set(cle, (parEditeur.get(cle) ?? 0) + valorise);
    }
  }
  const segments = [...parEditeur.entries()]
    .map(([name, value], i) => ({ name, value: Math.round(value * 100) / 100, color: couleurSerie(i) }))
    .sort((a, b) => b.value - a.value);
  const total = data?.agregats?.ecart_valorise_positif
    ?? segments.reduce((t, s) => t + s.value, 0);
  const pct = totalDroits > 0 ? (ecartQuantite / totalDroits) * 100 : null;
  const color = couleurSeuil(pct, seuils);

  return (
    <CadreWidget
      widgetId="valorisation-licences"
      titre="Valorisation licences non utilisées"
      info={"Valeur des droits acquis au-delà de l'usage déclaré (écart valorisé positif), répartie par éditeur. Le pourcentage rapporte les quantités non utilisées au parc détenu, coloré selon les seuils configurés."}
      derniereMaj={data?.agregats?.derniere_maj}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && segments.length === 0}
      videMessage="Aucune licence excédentaire valorisée sur le parc."
      onOuvrir={() => navigate(ROUTES_DRILL.licences())}
    >
      <div style={{ position: 'relative', height: 150 }}>
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie data={segments} cx="50%" cy="50%"
              innerRadius={48} outerRadius={64}
              dataKey="value" strokeWidth={2} stroke="white" isAnimationActive={false}>
              {segments.map((seg, i) => <Cell key={i} fill={seg.color} />)}
            </Pie>
            <Tooltip content={<TooltipDonut euros />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color, lineHeight: 1.2 }}>
            {Number(total).toLocaleString('fr-FR')} €
          </div>
          <div style={{ fontSize: 9, color, fontWeight: 700, marginTop: 2 }}>
            {pct == null ? '' : `${pct.toFixed(1)}% non utilisées`}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        {segments.slice(0, 6).map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#8B9099' }}>{seg.name}</span>
            <span style={{ fontSize: 10, color: '#1A1D23', fontWeight: 600, marginLeft: 'auto' }}>
              {seg.value.toLocaleString('fr-FR')} €
            </span>
          </div>
        ))}
      </div>
    </CadreWidget>
  );
}

// Alias retrocompatibilite
export const EconomiesOptimisablesWidget = ValorisationLicencesWidget;
