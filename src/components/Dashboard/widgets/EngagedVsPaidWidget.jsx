// Montants engagés vs payés par éditeur (Financier), branches sur le
// precalcul financier via GET /dashboards/engages-payes (#192).
// Le montant paye vient de la meme table : il reste a zero tant qu'aucune
// facture ne porte de montant (note migration 016), la donnee est servie
// telle quelle. Le clic sur un editeur ouvre la liste des contrats filtree.
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import CadreWidget from './CadreWidget';
import useSourceDashboard from '../useSourceDashboard';
import { couleurSerie } from '../couleurs';
import { ROUTES_DRILL } from '../drill';
import { dashboardService } from '../../../services/dashboardService';
import { toIsoDate } from '../../../utils/fiscalPeriod';

const TooltipEngage = ({ active, payload, label }) => {
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
          <strong>{Number(p.value).toLocaleString('fr-FR')} €</strong>
        </div>
      ))}
      <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 6, fontSize: 10, opacity: 0.65 }}>
        {"Cliquez pour ouvrir les contrats de l'éditeur"}
      </div>
    </div>
  );
};

export function EngagedVsPaidWidget({ periode }) {
  const navigate = useNavigate();
  const debut = periode?.debut ? toIsoDate(periode.debut) : '';
  const fin = periode?.fin ? toIsoDate(periode.fin) : '';
  const cle = `engages-payes:${debut}:${fin}`;
  const { data, chargement, erreur, relancer } = useSourceDashboard(cle,
    () => dashboardService.engagesPayes(debut && fin ? { date_debut: debut, date_fin: fin } : {}));

  const lignes = (data?.lignes ?? []).map((l, i) => ({
    ...l,
    editeur: l.editeur_label ?? 'Sans éditeur',
    couleur: couleurSerie(i),
  }));

  return (
    <CadreWidget
      widgetId="montants-engages-payes"
      titre="Montants engagés vs payés"
      info={"Par éditeur, montants commandés (engagés) et montants payés sur la période, lus dans le précalcul financier des commandes. Le montant payé reste à zéro tant que les factures ne portent pas de montant."}
      derniereMaj={data?.derniere_maj}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && lignes.length === 0}
      videMessage="Aucune commande sur la période."
      onOuvrir={() => navigate(ROUTES_DRILL.commandes())}
    >
      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#8B9099' }}>
        {[
          { color: '#7C6FCD', label: 'Commandé' },
          { color: '#3FC8B8', label: 'Payé' },
        ].map((l) => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
        <span style={{ opacity: 0.6 }}>- Cliquez sur un éditeur pour ses contrats</span>
      </div>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart
          data={lignes}
          margin={{ top: 4, right: 4, left: -4, bottom: 0 }}
          barCategoryGap="30%"
          onClick={(d) => {
            const entree = d?.activePayload?.[0]?.payload;
            if (entree?.id_editeur) navigate(ROUTES_DRILL.contrats({ editeur: entree.id_editeur }));
          }}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
          <XAxis dataKey="editeur" tick={{ fontSize: 11, fill: '#8B9099' }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
            tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false}
          />
          <Tooltip content={<TooltipEngage />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="montant_commande" name="Commandé" maxBarSize={36} radius={[3, 3, 0, 0]}>
            {lignes.map((l, i) => <Cell key={i} fill={l.couleur + 'CC'} />)}
          </Bar>
          <Bar dataKey="montant_paye" name="Payé" maxBarSize={36} radius={[3, 3, 0, 0]}>
            {lignes.map((l, i) => <Cell key={i} fill={l.couleur + '80'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </CadreWidget>
  );
}

export default EngagedVsPaidWidget;
