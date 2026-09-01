// Widgets KPI des dashboards, branches sur les donnees reelles (#192).
// Chaque widget lit sa source via useSourceDashboard (une requete par source,
// partagee entre widgets), porte sa bulle d'information, ses etats de
// chargement, de vide et d'erreur, et mene par clic a l'ecran concerne.
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import CadreWidget from './CadreWidget';
import useSourceDashboard from '../useSourceDashboard';
import { useSeuils } from '../ContexteDashboard';
import { couleurSeuil, borneSeuil } from '../seuils';
import {
  THRESHOLD_GREEN, THRESHOLD_ORANGE, THRESHOLD_RED, THRESHOLD_DARK_RED,
  COULEUR_NIVEAU,
} from '../couleurs';
import { ROUTES_DRILL, routeEntite } from '../drill';
import { dashboardService, qualiteService, confianceService } from '../../../services/dashboardService';
import { budgetService } from '../../../services/budgetService';
import { contratsService } from '../../../services/contratsService';
import { affectationsService } from '../../../services/affectationsService';
import { toIsoDate } from '../../../utils/fiscalPeriod';

function Dot({ color }) {
  return <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }} />;
}

// Rangee de tuiles colorees, gabarit commun des KPI a repartition.
function Tuiles({ tuiles }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {tuiles.map((t) => (
        <div key={t.label} style={{
          flex: 1, minWidth: 56,
          background: t.color + '14', borderRadius: 8, padding: '10px 6px',
          display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center',
        }}>
          <Dot color={t.color} />
          <span style={{ fontSize: 20, fontWeight: 700, color: t.color, lineHeight: 1.1 }}>
            {Number(t.count ?? 0).toLocaleString('fr-FR')}
          </span>
          <span style={{ fontSize: 9, color: '#8B9099', textAlign: 'center', lineHeight: 1.3 }}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

const fmtEuros = (v) => `${Number(v ?? 0).toLocaleString('fr-FR')} €`;

// Cle de source budget : la periode fait partie de l'identite de la donnee.
function cleBudget(periode) {
  const debut = periode?.debut ? toIsoDate(periode.debut) : '';
  const fin = periode?.fin ? toIsoDate(periode.fin) : '';
  return { cle: `budget-synthese:${debut}:${fin}`, debut, fin };
}

// ─── Revalidations (Manager DSI, IT Ops) ────────────────────────────────────
export function RevalidationsWidget() {
  const navigate = useNavigate();
  const { data, chargement, erreur, relancer } = useSourceDashboard('synthese', dashboardService.synthese);

  const r = data?.revalidations;
  const bornes = r?.bornes_jours?.length === 4 ? r.bornes_jours : [30, 15, 7, 0];
  const tuiles = r ? [
    { label: `> ${bornes[0]} jours`, count: r.niveau_1, color: COULEUR_NIVEAU[1] },
    { label: `${bornes[1]}-${bornes[0]} jours`, count: r.niveau_2, color: COULEUR_NIVEAU[2] },
    { label: `${bornes[2]}-${bornes[1]} jours`, count: r.niveau_3, color: COULEUR_NIVEAU[3] },
    { label: `< ${bornes[2]} jours ou dépassées`, count: r.niveau_4, color: COULEUR_NIVEAU[4] },
  ] : [];

  return (
    <CadreWidget
      widgetId="revalidations"
      titre="Revalidations"
      info={"Affectations validées, réparties selon les jours restants avant leur date de revalidation. Les bornes sont les seuils configurés du widget. Une affectation sans échéance compte dans le premier niveau."}
      derniereMaj={data?.derniere_maj}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && !r}
      onOuvrir={() => navigate(ROUTES_DRILL.affectations())}
    >
      <Tuiles tuiles={tuiles} />
    </CadreWidget>
  );
}

// ─── Qualité des saisies (Manager DSI, IT Ops) ──────────────────────────────
export function QualiteSaisiesWidget() {
  const navigate = useNavigate();
  const seuils = useSeuils('qualite-saisies');
  const { data, chargement, erreur, relancer } = useSourceDashboard('qualite', qualiteService.list);

  const total = data?.total ?? 0;
  const color = couleurSeuil(total, seuils);
  const parType = Array.isArray(data?.par_type)
    ? data.par_type.map((t) => [t.libelle ?? t.type_anomalie ?? t.type, t.nb ?? t.count ?? 0])
    : Object.entries(data?.par_type ?? {});

  // L'ecran concerne est celui de l'entite la plus touchee par les anomalies.
  const typesEntites = (data?.elements ?? []).map((e) => e.entite_type).filter(Boolean);
  const dominant = typesEntites.sort((a, b) =>
    typesEntites.filter((t) => t === b).length - typesEntites.filter((t) => t === a).length)[0];

  return (
    <CadreWidget
      widgetId="qualite-saisies"
      titre="Qualité des saisies"
      info={"Nombre d'anomalies détectées dans les saisies (rattachements manquants, incohérences, doublons potentiels), détaillé par type. Le clic ouvre l'écran de l'entité la plus touchée."}
      derniereMaj={data?.derniere_maj}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && !data}
      onOuvrir={() => navigate(routeEntite(dominant))}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Dot color={color} />
          <span style={{ fontSize: 26, fontWeight: 700, color }}>{total}</span>
          <span style={{ fontSize: 12, color: '#8B9099' }}>anomalie{total > 1 ? 's' : ''}</span>
        </div>
        <span style={{ fontSize: 11, color: '#8B9099', lineHeight: 1.4 }}>
          {total === 0
            ? 'Aucune anomalie détectée.'
            : parType.slice(0, 3).map(([label, nb]) => `${nb} ${label}`).join(', ')}
        </span>
      </div>
    </CadreWidget>
  );
}

// ─── Indice de confiance des données (Manager DSI) ──────────────────────────
export function IndiceConfianceWidget() {
  const navigate = useNavigate();
  const seuils = useSeuils('indice-confiance');
  const { data, chargement, erreur, relancer } = useSourceDashboard('confiance', () => confianceService.get());

  const score = data?.indice ?? null;
  const color = couleurSeuil(score, seuils);
  const gaugeData = score == null ? [] : [{ value: score }, { value: Math.max(0, 100 - score) }];

  return (
    <CadreWidget
      widgetId="indice-confiance"
      titre="Indice de confiance données"
      info={"Indice sur 100 combinant l'exhaustivité des saisies, leur cohérence et leur fraîcheur, diminué des malus constatés. Le clic ouvre l'inventaire, principale source d'exhaustivité."}
      derniereMaj={data?.derniere_maj}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && score == null}
      onOuvrir={() => navigate(ROUTES_DRILL.inventaire())}
    >
      <div style={{ position: 'relative', height: 110 }}>
        <ResponsiveContainer width="100%" height={110}>
          <PieChart>
            <Pie data={gaugeData} cx="50%" cy="90%" startAngle={180} endAngle={0}
              innerRadius={52} outerRadius={72} dataKey="value" strokeWidth={0} isAnimationActive={false}>
              <Cell fill={color} />
              <Cell fill="#EAECF0" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 9, color: '#8B9099', marginTop: 2 }}>/100</div>
        </div>
      </div>
      {data && (
        <div style={{ fontSize: 10, color: '#8B9099', textAlign: 'center', lineHeight: 1.4 }}>
          Exhaustivité {data.exhaustivite ?? '-'} · Cohérence {data.coherence ?? '-'} · Fraîcheur {data.fraicheur ?? '-'}
        </div>
      )}
    </CadreWidget>
  );
}

// ─── Validations en attente > 24 h (Manager DSI) ────────────────────────────
export function ValidationsEnAttenteWidget() {
  const navigate = useNavigate();
  const seuils = useSeuils('validations-attente');
  const { data, chargement, erreur, relancer } = useSourceDashboard('synthese', dashboardService.synthese);

  const v = data?.validations;
  const count = v?.en_attente_plus_24h ?? 0;
  const color = couleurSeuil(count, seuils);

  return (
    <CadreWidget
      widgetId="validations-attente"
      titre="Validations en attente"
      info={"Saisies dont la dernière entrée du circuit de validation est en attente depuis plus de 24 heures, tous types confondus. Les pastilles détaillent par type et ouvrent la liste concernée."}
      derniereMaj={data?.derniere_maj}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && !v}
      onOuvrir={() => navigate(ROUTES_DRILL.contrats())}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 48, fontWeight: 700, color, lineHeight: 1 }}>{count}</span>
        <span style={{ fontSize: 11, color: '#8B9099' }}>
          saisies non traitées depuis plus de 24 h ({v?.total_en_attente ?? 0} en attente au total)
        </span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}
             onClick={(e) => e.stopPropagation()}>
          {(v?.par_type ?? []).filter((t) => t.en_attente > 0).map((t) => (
            <button
              key={t.entite_type}
              onClick={() => navigate(routeEntite(t.entite_type))}
              style={{
                fontSize: 10, fontWeight: 600, color: '#7C6FCD',
                background: '#7C6FCD14', border: '1px solid #7C6FCD40',
                borderRadius: 20, padding: '2px 10px', cursor: 'pointer',
              }}
            >
              {t.entite_type} : {t.en_attente}
            </button>
          ))}
        </div>
      </div>
    </CadreWidget>
  );
}

// ─── Période budgétaire (Financier) ─────────────────────────────────────────
export function MontantsBudgetaireWidget({ periode }) {
  const navigate = useNavigate();
  const { cle, debut, fin } = cleBudget(periode);
  const { data, chargement, erreur, relancer } = useSourceDashboard(cle,
    () => budgetService.synthese(debut && fin ? { date_debut: debut, date_fin: fin } : {}));

  const totaux = data?.totaux;
  const tuiles = totaux ? [
    { label: 'Montants engagés', value: totaux.engage, color: '#7C6FCD' },
    { label: 'Reste à engager', value: totaux.ecart_alloue_engage, color: '#3FC8B8' },
  ] : [];

  return (
    <CadreWidget
      widgetId="periode-budgetaire"
      titre="Période budgétaire"
      sousTitre={periode?.label}
      info={"Montants engagés (commandes réelles) et reste à engager (budget alloué moins engagé) sur la période sélectionnée. Source : synthèse budget de l'API."}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && !totaux}
      onOuvrir={() => navigate(ROUTES_DRILL.budget())}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tuiles.map((it) => (
          <div key={it.label} style={{
            flex: 1, minWidth: 100,
            background: it.color + '14', borderRadius: 8, padding: '10px 10px',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: it.color }}>{fmtEuros(it.value)}</div>
            <div style={{ fontSize: 10, color: '#8B9099', marginTop: 3 }}>{it.label}</div>
          </div>
        ))}
      </div>
    </CadreWidget>
  );
}

// ─── Conformité réel vs prévisionnel (Financier) ────────────────────────────
export function ConformiteReelPrevisionnelWidget({ periode }) {
  const navigate = useNavigate();
  const seuils = useSeuils('conformite-reel-previ');
  const { cle, debut, fin } = cleBudget(periode);
  const { data, chargement, erreur, relancer } = useSourceDashboard(cle,
    () => budgetService.synthese(debut && fin ? { date_debut: debut, date_fin: fin } : {}));

  const totaux = data?.totaux;
  const reel = totaux?.engage ?? 0;
  const previsionnel = totaux?.previsionnel ?? 0;
  const pct = previsionnel > 0 || reel > 0
    ? (Math.min(reel, previsionnel) / Math.max(reel, previsionnel)) * 100
    : null;
  const color = couleurSeuil(pct, seuils);
  const b1 = borneSeuil(seuils, 1, 95);
  const b2 = borneSeuil(seuils, 2, 90);
  const etiquette = pct == null ? '' : pct >= b1 ? 'Conforme' : pct >= b2 ? 'Attention' : 'Hors budget';

  return (
    <CadreWidget
      widgetId="conformite-reel-previ"
      titre="Conformité réel vs prévisionnel"
      info={"Rapport entre le montant réellement engagé (commandes) et le budget prévisionnel de la période : 100 % signifie un réel aligné sur le prévisionnel, dans un sens comme dans l'autre. Seuils configurables."}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && (data?.nb_lignes?.previsionnel === 0 && reel === 0)}
      videMessage="Aucune ligne budgétaire prévisionnelle sur la période."
      onOuvrir={() => navigate(ROUTES_DRILL.budget({ tab: 'visualisation' }))}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color }}>
            {pct == null ? '-' : `${pct.toFixed(1)}%`}
          </span>
          {etiquette && (
            <span style={{
              fontSize: 11, fontWeight: 600, color,
              background: color + '18', borderRadius: 12, padding: '2px 8px',
            }}>
              {etiquette}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: '#8B9099' }}>
          Réel : {fmtEuros(reel)} · Prévisionnel : {fmtEuros(previsionnel)}
        </div>
      </div>
    </CadreWidget>
  );
}

// Alias pour retrocompatibilite
export const ReelVsPrevisionnelWidget = ConformiteReelPrevisionnelWidget;

// ─── Échéances des contrats en KPI (Financier) ──────────────────────────────
const JOURS_PAR_MOIS = 30.4375;

export function EcheancesContratsKpiWidget() {
  const navigate = useNavigate();
  const seuils = useSeuils('echeances-contrats-kpi');
  const { data, chargement, erreur, relancer } = useSourceDashboard('contrats', () => contratsService.list());

  const b1 = borneSeuil(seuils, 1, 3);
  const b2 = borneSeuil(seuils, 2, 2);
  const b3 = borneSeuil(seuils, 3, 1);
  const compte = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const c of data ?? []) {
    if (c.jours_restants == null) { compte[1] += 1; continue; }  // perpetuel
    const mois = c.jours_restants / JOURS_PAR_MOIS;
    const niveau = mois >= b1 ? 1 : mois >= b2 ? 2 : mois >= b3 ? 3 : 4;
    compte[niveau] += 1;
  }
  const tuiles = [
    { label: `> ${b1} mois`, count: compte[1], color: COULEUR_NIVEAU[1] },
    { label: `${b2} à ${b1} mois`, count: compte[2], color: COULEUR_NIVEAU[2] },
    { label: `${b3} à ${b2} mois`, count: compte[3], color: COULEUR_NIVEAU[3] },
    { label: `< ${b3} mois ou échus`, count: compte[4], color: COULEUR_NIVEAU[4] },
  ];

  return (
    <CadreWidget
      widgetId="echeances-contrats-kpi"
      titre="Échéances des contrats"
      info={"Contrats actifs répartis selon le délai restant avant leur date de fin. Un contrat perpétuel compte dans le premier niveau. Les bornes en mois sont les seuils configurés du widget."}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && !(data ?? []).length}
      videMessage="Aucun contrat saisi pour le moment."
      onOuvrir={() => navigate(ROUTES_DRILL.contrats())}
    >
      <Tuiles tuiles={tuiles} />
    </CadreWidget>
  );
}

// Alias retrocompatibilite
export const ContratsEnCoursWidget = EcheancesContratsKpiWidget;

// ─── Balance usages vs droits (IT Ops) ──────────────────────────────────────
export function BalanceUsagesDroitsWidget() {
  const navigate = useNavigate();
  const seuils = useSeuils('balance-usages-droits');
  const { data, chargement, erreur, relancer } = useSourceDashboard('decompte', () => affectationsService.decompte());

  const margeMin = borneSeuil(seuils, 1, 10);
  const compte = { depassement: 0, saturation: 0, risque: 0, ok: 0 };
  for (const p of data?.par_produit ?? []) {
    const droits = p.droits_total ?? 0;
    const declare = p.quantite_declaree ?? 0;
    if (declare > droits) compte.depassement += 1;
    else if (droits > 0 && declare === droits) compte.saturation += 1;
    else if (droits > 0 && ((droits - declare) / droits) * 100 < margeMin) compte.risque += 1;
    else compte.ok += 1;
  }
  const tuiles = [
    { label: 'Dépassement', count: compte.depassement, color: THRESHOLD_DARK_RED },
    { label: '100 % utilisé', count: compte.saturation, color: THRESHOLD_RED },
    { label: `< ${margeMin} % dispo`, count: compte.risque, color: THRESHOLD_ORANGE },
    { label: `≥ ${margeMin} % dispo`, count: compte.ok, color: THRESHOLD_GREEN },
  ];

  return (
    <CadreWidget
      widgetId="balance-usages-droits"
      titre="Balance usages vs droits"
      info={"Produits répartis selon la marge entre droits acquis (licences) et usage déclaré (affectations validées) : dépassement, saturation, marge faible ou marge suffisante. La borne de marge est le seuil configuré."}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && !(data?.par_produit ?? []).length}
      videMessage="Aucune affectation validée pour le moment."
      onOuvrir={() => navigate(ROUTES_DRILL.affectations())}
    >
      <Tuiles tuiles={tuiles} />
    </CadreWidget>
  );
}
