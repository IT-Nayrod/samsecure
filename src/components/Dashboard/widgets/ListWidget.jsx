// Widgets listes des dashboards, branches sur les donnees reelles (#192) :
// prevision budgetaire par produit (Manager DSI) et fil des dernieres
// saisies du workflow de validation (IT Ops).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CadreWidget from './CadreWidget';
import useSourceDashboard from '../useSourceDashboard';
import { THRESHOLD_GREEN, THRESHOLD_YELLOW, THRESHOLD_RED, THRESHOLD_ORANGE } from '../couleurs';
import { ROUTES_DRILL, routeEntite } from '../drill';
import { dashboardService } from '../../../services/dashboardService';
import { budgetService } from '../../../services/budgetService';

// ─── Prévision budgétaire N+1 (Manager DSI) ─────────────────────────────────
// Lignes budgetaires groupees par produit : alloue de l'exercice courant (N),
// alloue de l'exercice precedent (N-1), previsionnel de l'exercice suivant
// (N+1). L'exercice de chaque ligne est celui calcule par l'API (ancrage
// fiscal de la societe payeuse).
export function PrevisionBudgetaireWidget() {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState('coutN');
  const [sortDir, setSortDir] = useState('desc');
  const { data, chargement, erreur, relancer } = useSourceDashboard(
    'budget-lignes', () => budgetService.list());

  const exerciceN = new Date().getFullYear();
  const parProduit = new Map();
  for (const ligne of data ?? []) {
    const cle = ligne.id_produit ?? ligne.licence_label ?? ligne.id_licence;
    if (!parProduit.has(cle)) {
      parProduit.set(cle, {
        produit: ligne.produit_label ?? ligne.licence_label ?? 'Produit local',
        coutN: 0, coutN1: 0, prevN1: 0,
      });
    }
    const p = parProduit.get(cle);
    const montant = ligne.montant_total ?? 0;
    if (ligne.type === 'alloue' && ligne.exercice === exerciceN) p.coutN += montant;
    else if (ligne.type === 'alloue' && ligne.exercice === exerciceN - 1) p.coutN1 += montant;
    else if (ligne.type === 'previsionnel' && ligne.exercice === exerciceN + 1) p.prevN1 += montant;
  }
  const lignes = [...parProduit.values()].filter((p) => p.coutN || p.coutN1 || p.prevN1);

  const handleSort = (key) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };
  const triees = [...lignes].sort((a, b) => {
    const va = a[sortKey]; const vb = b[sortKey];
    if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va;
    return sortDir === 'asc'
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va));
  });

  const fmt = (v) => Number(v).toLocaleString('fr-FR');
  const variationColor = (n, n1) => {
    if (!n1) return '#8B9099';
    const pct = ((n - n1) / n1) * 100;
    if (pct > 5) return THRESHOLD_RED;
    if (pct < -5) return THRESHOLD_GREEN;
    return '#8B9099';
  };
  const variationPct = (n, n1) => {
    if (!n1) return '-';
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
    <CadreWidget
      widgetId="prevision-budgetaire"
      titre="Prévision budgétaire N+1"
      info={`Lignes budgétaires groupées par produit : budget alloué de l'exercice ${exerciceN} (N) et de l'exercice précédent, budget prévisionnel de l'exercice ${exerciceN + 1}. L'exercice de chaque ligne suit l'ancrage fiscal de la société payeuse. Le clic ouvre le module budget.`}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && lignes.length === 0}
      videMessage="Aucune ligne budgétaire saisie sur les exercices affichés."
      onOuvrir={() => navigate(ROUTES_DRILL.budget())}
    >
      <div style={{ overflowX: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #EAECF0' }}>
              <TH k="produit" label="Produit" />
              <TH k="coutN" label={`Alloué ${exerciceN} (€)`} />
              <TH k="coutN1" label={`Alloué ${exerciceN - 1} (€)`} />
              <TH k="prevN1" label={`Prévi ${exerciceN + 1} (€)`} />
            </tr>
          </thead>
          <tbody>
            {triees.map((row) => (
              <tr key={row.produit} style={{ borderBottom: '1px solid #F5F5F5' }}>
                <td style={{ padding: '6px 8px', color: '#1A1D23', fontWeight: 500 }}>{row.produit}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1A1D23' }}>
                  {fmt(row.coutN)}
                  <span style={{ marginLeft: 6, fontWeight: 600, color: variationColor(row.coutN, row.coutN1) }}>
                    {variationPct(row.coutN, row.coutN1)}
                  </span>
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#8B9099' }}>{fmt(row.coutN1)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#7C6FCD' }}>{fmt(row.prevN1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CadreWidget>
  );
}

// ─── Dernières saisies (IT Ops) ─────────────────────────────────────────────
const STATUT_CONFIG = {
  en_attente: { label: 'En attente', color: THRESHOLD_YELLOW },
  valide: { label: 'Validé', color: THRESHOLD_GREEN },
  refuse: { label: 'Refusé', color: THRESHOLD_RED },
  a_revalider: { label: 'À revalider', color: THRESHOLD_ORANGE },
};

const TYPE_LABEL = {
  contrat: 'Contrat', commande: 'Commande', facture: 'Facture', preuve: 'Preuve',
  licence: 'Licence', affectation: 'Affectation', editeur: 'Éditeur',
  produit_client: 'Logiciel',
};

export function DernieresSaisiesWidget() {
  const navigate = useNavigate();
  const { data, chargement, erreur, relancer } = useSourceDashboard('synthese', dashboardService.synthese);

  const lignes = data?.dernieres_saisies ?? [];

  return (
    <CadreWidget
      widgetId="dernieres-saisies"
      titre="Dernières saisies"
      info={"Les dix dernières entrées du circuit de validation, tous types confondus, avec leur statut courant. Le clic sur une ligne ouvre la fiche de l'élément saisi."}
      derniereMaj={data?.derniere_maj}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && lignes.length === 0}
      videMessage="Aucune saisie soumise au circuit de validation pour le moment."
      onOuvrir={() => navigate(ROUTES_DRILL.contrats())}
    >
      <div style={{ maxHeight: 240, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
            <tr style={{ borderBottom: '1px solid #EAECF0' }}>
              {['Statut', 'Date', 'Type', 'Nom', 'Soumis par'].map((h) => (
                <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: '#8B9099', fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((row, i) => {
              const cfg = STATUT_CONFIG[row.statut] || STATUT_CONFIG.en_attente;
              return (
                <tr
                  key={`${row.entite_type}-${row.entite_id}-${i}`}
                  onClick={() => navigate(routeEntite(row.entite_type, row.entite_id))}
                  style={{ borderBottom: '1px solid #F5F5F5', cursor: 'pointer' }}
                >
                  <td style={{ padding: '5px 8px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 10, fontWeight: 600,
                      color: cfg.color, background: cfg.color + '18',
                      borderRadius: 12, padding: '2px 8px', whiteSpace: 'nowrap',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
                      {row.statut_label ?? cfg.label}
                    </span>
                  </td>
                  <td style={{ padding: '5px 8px', color: '#8B9099', whiteSpace: 'nowrap' }}>
                    {row.created_at ? new Date(row.created_at).toLocaleDateString('fr-FR') : ''}
                  </td>
                  <td style={{ padding: '5px 8px', color: '#8B9099', whiteSpace: 'nowrap' }}>
                    {TYPE_LABEL[row.entite_type] ?? row.entite_type}
                  </td>
                  <td style={{ padding: '5px 8px', color: '#1A1D23', fontWeight: 500 }}>{row.label ?? '-'}</td>
                  <td style={{ padding: '5px 8px', color: '#8B9099' }}>{row.soumis_par || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CadreWidget>
  );
}
