// Widgets histogrammes des dashboards, branches sur les donnees reelles (#192).
// Echeanciers contrats et commandes (12 mois glissants a partir du mois
// courant), montants totaux par axe, echeances de tresorerie. L'usage 12 mois
// glissants attend une source d'historisation qui n'existe pas encore.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import CadreWidget from './CadreWidget';
import useSourceDashboard from '../useSourceDashboard';
import { useSeuils } from '../ContexteDashboard';
import { borneSeuil } from '../seuils';
import { COULEUR_NIVEAU, couleurSerie } from '../couleurs';
import { ROUTES_DRILL } from '../drill';
import { dashboardService } from '../../../services/dashboardService';
import { contratsService, referentielsContratsService } from '../../../services/contratsService';
import { commandesService } from '../../../services/commandesService';
import { optionnel } from '../../../services/http';
import { toIsoDate } from '../../../utils/fiscalPeriod';

const JOURS_PAR_MOIS = 30.4375;
const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const SELECT_STYLE = {
  fontSize: 11, border: '1px solid #EAECF0', borderRadius: 6,
  padding: '3px 8px', color: '#1A1D23', background: 'white', cursor: 'pointer',
};

function libelleMois(periode) {
  const [annee, mois] = periode.split('-').map(Number);
  return `${MOIS_COURTS[mois - 1]} ${String(annee).slice(2)}`;
}

// Douze periodes YYYY-MM a partir du mois courant.
function fenetre12Mois() {
  const out = [];
  const d = new Date();
  let a = d.getFullYear();
  let m = d.getMonth() + 1;
  for (let i = 0; i < 12; i++) {
    out.push(`${a}-${String(m).padStart(2, '0')}`);
    if (++m > 12) { m = 1; a++; }
  }
  return out;
}

const TooltipSombre = ({ active, payload, label, details }) => {
  if (!active || !payload?.length) return null;
  const detail = details?.get(label) ?? [];
  return (
    <div style={{
      background: '#1A1D23', color: '#fff', borderRadius: 10,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      minWidth: 190,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.filter((p) => p.value > 0).map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill }} />
          <span style={{ opacity: 0.8 }}>{p.name} :</span>
          <strong>{p.value}</strong>
        </div>
      ))}
      {detail.length > 0 && (
        <>
          <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 6, fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
            Détail :
          </div>
          {detail.slice(0, 6).map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ flex: 1 }}>{d.label}</span>
              <span style={{ color: d.couleur, fontWeight: 700 }}>{d.nb}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

// ─── Échéances contrats / commandes (12 mois glissants) ─────────────────────
// variante 'contrats' : liste des contrats, detail par editeur.
// variante 'commandes' : liste des commandes, detail par contrat de
// rattachement (la commande ne porte pas d'editeur en propre).
export function EcheancesWidget({ variante }) {
  const navigate = useNavigate();
  const codeWidget = variante === 'commandes' ? 'echeances-commandes' : 'echeances-contrats';
  const seuils = useSeuils(codeWidget);
  const { data, chargement, erreur, relancer } = useSourceDashboard(
    variante === 'commandes' ? 'commandes' : 'contrats',
    variante === 'commandes' ? () => commandesService.list() : () => contratsService.list(),
  );

  const b1 = borneSeuil(seuils, 1, 3);
  const b2 = borneSeuil(seuils, 2, 2);
  const b3 = borneSeuil(seuils, 3, 1);
  const niveauDe = (joursRestants) => {
    const mois = joursRestants / JOURS_PAR_MOIS;
    return mois >= b1 ? 1 : mois >= b2 ? 2 : mois >= b3 ? 3 : 4;
  };

  const fenetre = fenetre12Mois();
  const parMois = new Map(fenetre.map((p) => [libelleMois(p), { mois: libelleMois(p), n1: 0, n2: 0, n3: 0, n4: 0 }]));
  const details = new Map(fenetre.map((p) => [libelleMois(p), []]));
  const moisCourant = fenetre[0];

  for (const ligne of data ?? []) {
    if (!ligne.date_fin || ligne.jours_restants == null) continue;  // perpetuel ou sans date
    // Une echeance deja passee reste a piloter : elle est portee au mois
    // courant, en rouge, plutot que perdue hors fenetre.
    const periode = ligne.date_fin.slice(0, 7) < moisCourant ? moisCourant : ligne.date_fin.slice(0, 7);
    if (!fenetre.includes(periode)) continue;
    const cle = libelleMois(periode);
    const niveau = niveauDe(ligne.jours_restants);
    parMois.get(cle)[`n${niveau}`] += 1;
    const label = variante === 'commandes'
      ? (ligne.contrat_label ?? ligne.label)
      : (ligne.editeur_label ?? ligne.label);
    const detail = details.get(cle);
    const existant = detail.find((d) => d.label === label && d.niveau === niveau);
    if (existant) existant.nb += 1;
    else detail.push({ label, niveau, nb: 1, couleur: COULEUR_NIVEAU[niveau] });
  }
  const serie = [...parMois.values()];
  const total = serie.reduce((t, m) => t + m.n1 + m.n2 + m.n3 + m.n4, 0);

  const legende = [
    { color: COULEUR_NIVEAU[1], label: `> ${b1} mois` },
    { color: COULEUR_NIVEAU[2], label: `${b2}-${b1} mois` },
    { color: COULEUR_NIVEAU[3], label: `${b3}-${b2} mois` },
    { color: COULEUR_NIVEAU[4], label: `< ${b3} mois / échu` },
  ];

  return (
    <CadreWidget
      widgetId={codeWidget}
      titre={variante === 'commandes' ? 'Échéances commandes' : 'Échéances contrats'}
      info={variante === 'commandes'
        ? "Commandes à échéance sur les 12 prochains mois, réparties par mois de date de fin et colorées selon le délai restant (seuils configurés). Une échéance déjà passée est portée au mois courant."
        : "Contrats à échéance sur les 12 prochains mois, répartis par mois de date de fin et colorés selon le délai restant (seuils configurés). Une échéance déjà passée est portée au mois courant."}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && total === 0}
      videMessage="Aucune échéance sur les 12 prochains mois."
      onOuvrir={() => navigate(variante === 'commandes' ? ROUTES_DRILL.commandes() : ROUTES_DRILL.contrats())}
    >
      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#8B9099', flexWrap: 'wrap' }}>
        {legende.map((l) => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={serie} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
          <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<TooltipSombre details={details} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="n1" name={legende[0].label} stackId="a" fill={COULEUR_NIVEAU[1]} />
          <Bar dataKey="n2" name={legende[1].label} stackId="a" fill={COULEUR_NIVEAU[2]} />
          <Bar dataKey="n3" name={legende[2].label} stackId="a" fill={COULEUR_NIVEAU[3]} />
          <Bar dataKey="n4" name={legende[3].label} stackId="a" fill={COULEUR_NIVEAU[4]} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </CadreWidget>
  );
}

// ─── Montants totaux par axe (Manager DSI) ──────────────────────────────────
const AXES = [
  { valeur: 'editeur', label: 'Par éditeur' },
  { valeur: 'societe', label: 'Par société' },
  { valeur: 'produit', label: 'Par produit' },
];
const PERIODES = [
  { valeur: 1, label: '1 an' },
  { valeur: 3, label: '3 ans' },
  { valeur: 5, label: '5 ans' },
  { valeur: 0, label: 'Illimité' },
];

export function MontantsTotauxWidget() {
  const navigate = useNavigate();
  const [axe, setAxe] = useState('editeur');
  const [annees, setAnnees] = useState(1);

  const bornes = (() => {
    if (axe === 'produit' || annees === 0) return {};
    const fin = new Date();
    const debut = new Date(fin.getFullYear() - annees, fin.getMonth(), fin.getDate());
    return { date_debut: toIsoDate(debut), date_fin: toIsoDate(fin) };
  })();
  const cle = `montants-totaux:${axe}:${axe === 'produit' ? 'parc' : annees}`;
  const { data, chargement, erreur, relancer } = useSourceDashboard(cle,
    () => dashboardService.montantsTotaux({ axe, ...bornes }));

  const lignes = data?.lignes ?? [];

  const ouvrirLigne = (ligne) => {
    if (!ligne?.id) return;
    if (axe === 'editeur') navigate(ROUTES_DRILL.contrats({ editeur: ligne.id }));
    else if (axe === 'societe') navigate(ROUTES_DRILL.contrats({ societe: ligne.id }));
    else navigate(ROUTES_DRILL.licences({ produit: ligne.id }));
  };

  return (
    <CadreWidget
      widgetId="montants-totaux"
      titre="Montants totaux"
      info={"Par éditeur ou par société : somme des montants de commandes sur la période choisie. Par produit : somme des coûts des licences non expirées du parc (le montant d'une commande ne se ventile pas par produit). Le clic sur une barre ouvre la liste filtrée."}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && !lignes.length}
      videMessage="Aucun montant sur la période."
      onOuvrir={() => navigate(ROUTES_DRILL.contrats())}
      actions={(
        <>
          <select value={axe} onChange={(e) => setAxe(e.target.value)} style={SELECT_STYLE}>
            {AXES.map((o) => <option key={o.valeur} value={o.valeur}>{o.label}</option>)}
          </select>
          {axe !== 'produit' && (
            <div style={{ display: 'flex', gap: 2 }}>
              {PERIODES.map((p) => (
                <button key={p.valeur} onClick={() => setAnnees(p.valeur)} style={{
                  padding: '3px 7px', borderRadius: 5, fontSize: 10,
                  border: '1px solid #EAECF0', cursor: 'pointer',
                  background: annees === p.valeur ? '#7C6FCD' : 'white',
                  color: annees === p.valeur ? 'white' : '#8B9099',
                  fontWeight: annees === p.valeur ? 600 : 400,
                }}>{p.label}</button>
              ))}
            </div>
          )}
        </>
      )}
    >
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={lignes} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
            tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) => (active && payload?.length ? (
              <div style={{
                background: '#1A1D23', color: '#fff', borderRadius: 8,
                padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}>
                <div style={{ fontWeight: 600 }}>{label}</div>
                <div>{Number(payload[0].value).toLocaleString('fr-FR')} €</div>
              </div>
            ) : null)}
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          />
          <Bar dataKey="montant" name="Montant" radius={[3, 3, 0, 0]} maxBarSize={40}
            onClick={(d) => ouvrirLigne(d)} style={{ cursor: 'pointer' }}>
            {lignes.map((l, i) => <Cell key={l.id ?? i} fill={couleurSerie(i)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </CadreWidget>
  );
}

// ─── Échéances de trésorerie (Financier) ────────────────────────────────────
export function EcheancesTresorerieWidget({ periode }) {
  const navigate = useNavigate();
  const [idEditeur, setIdEditeur] = useState('');

  const debut = periode?.debut ? toIsoDate(periode.debut) : '';
  const fin = periode?.fin ? toIsoDate(periode.fin) : '';
  const cle = `agregats:${debut}:${fin}:${idEditeur}`;
  const { data, chargement, erreur, relancer } = useSourceDashboard(cle,
    () => commandesService.agregats({
      ...(debut && fin ? { dateDebut: debut, dateFin: fin } : {}),
      ...(idEditeur ? { idEditeur } : {}),
    }));
  const { data: editeurs } = useSourceDashboard('editeurs',
    () => optionnel(referentielsContratsService.editeurs(), []));

  const serie = (data?.mois ?? []).map((m) => ({
    mois: libelleMois(m.periode),
    montant: m.montant_a_renouveler ?? 0,
    nb: m.nb_a_renouveler ?? 0,
  }));
  const max = Math.max(0, ...serie.map((d) => d.montant));
  const total = serie.reduce((t, m) => t + m.montant, 0);

  return (
    <CadreWidget
      widgetId="echeances-tresorerie"
      titre="Échéances de trésorerie"
      info={"Montants des commandes arrivant à renouvellement, mois par mois sur la période sélectionnée (source : précalcul financier des commandes). Le filtre restreint à un éditeur."}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && total === 0}
      videMessage="Aucune échéance de trésorerie sur la période."
      onOuvrir={() => navigate(ROUTES_DRILL.commandes())}
      actions={(editeurs ?? []).length > 0 && (
        <select value={idEditeur} onChange={(e) => setIdEditeur(e.target.value)} style={SELECT_STYLE}>
          <option value="">Tous les éditeurs</option>
          {(editeurs ?? []).map((e) => (
            <option key={e.id} value={e.id}>{e.raison_sociale ?? e.label}</option>
          ))}
        </select>
      )}
    >
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={serie} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
          <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 10, fill: '#8B9099' }} axisLine={false} tickLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) => (active && payload?.length ? (
              <div style={{
                background: '#1A1D23', color: '#fff', borderRadius: 10,
                padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
                <div>Montant : <strong>{Number(payload[0].value).toLocaleString('fr-FR')} €</strong></div>
                <div style={{ opacity: 0.8 }}>
                  {serie.find((s) => s.mois === label)?.nb ?? 0} commande(s) à renouveler
                </div>
              </div>
            ) : null)}
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          />
          <Bar dataKey="montant" name="Montant" radius={[3, 3, 0, 0]} maxBarSize={30}>
            {serie.map((entry, i) => {
              const intensite = max > 0 ? 0.35 + (entry.montant / max) * 0.65 : 0.5;
              const r = Math.round(28 * intensite);
              const g = Math.round(174 * intensite);
              const b = Math.round(184 * intensite);
              return <Cell key={i} fill={`rgb(${r},${g},${b})`} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </CadreWidget>
  );
}

// ─── Usage 12 mois glissants (IT Ops) ───────────────────────────────────────
// L'historique mensuel des affectations n'est enregistre nulle part : aucune
// table ne photographie l'usage passe. Etat propre en attendant le module.
export function Usage12MoisWidget() {
  return (
    <CadreWidget
      widgetId="usage-12-mois"
      titre="Usage 12 mois glissants"
      info={"Évolution mensuelle des affectations face aux droits d'usage. Cette courbe nécessite une historisation mensuelle des usages, qui n'est pas encore collectée."}
      moduleAbsent="historisation des usages"
    />
  );
}
