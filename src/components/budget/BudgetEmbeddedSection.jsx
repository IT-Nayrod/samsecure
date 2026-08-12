// BudgetEmbeddedSection - Bloc budget embarque dans fiches Contrat et Licence - SamSecure v0.5
// mode='licence': lignes budgetaires d'une licence avec CRUD et selecteur d'annee
// mode='contrat': mini KPIs + tableau par licence, lien vers la page Budget globale
import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import { mockBudget } from '../../data/mockBudget';
import { getLicencesByContrat } from '../../data/mockDeploiement';
import { mockProduits } from '../../data/mockReferentiels';
import BudgetProgressBar from './BudgetProgressBar';
import BudgetFormModal from './BudgetFormModal';
import ConfirmModal from '../ui/ConfirmModal';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import { calcBudgetKpis } from './budgetCalculs';
import { getAnneesDisponibles, getPeriodeAnneeCalendaire } from '../../utils/periodUtils';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';

const fmtEur = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const SELECT_CLS = 'text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const TH_CLS = 'px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap';

function anneeToPeriod(annee) {
  const p = getPeriodeAnneeCalendaire(annee);
  return {
    debut: new Date(p.dateDebut),
    fin: new Date(p.dateFin),
    dateDebut: p.dateDebut,
    dateFin: p.dateFin,
    label: p.label,
  };
}

function isLineInPeriod(ligne, period) {
  return new Date(ligne.date_debut) <= period.fin && new Date(ligne.date_fin) >= period.debut;
}

function MiniKpiBar({ kpis }) {
  const items = [
    { label: 'CAPEX alloue', valeur: kpis.capex_alloue, isEcart: false },
    { label: 'CAPEX engage', valeur: kpis.capex_engage, isEcart: false },
    { label: 'Ecart CAPEX', valeur: kpis.ecart_capex, isEcart: true },
    { label: 'OPEX alloue', valeur: kpis.opex_alloue, isEcart: false },
    { label: 'OPEX engage', valeur: kpis.opex_engage, isEcart: false },
    { label: 'Ecart OPEX', valeur: kpis.ecart_opex, isEcart: true },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {items.map(item => {
        const pos = item.valeur >= 0;
        return (
          <div key={item.label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 p-3 flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight">{item.label}</span>
            {item.isEcart ? (
              <div className={`flex items-center gap-1 text-sm font-bold ${pos ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {pos ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                <span>{pos ? '+' : ''}{fmtEur(item.valeur)}</span>
              </div>
            ) : (
              <span className="text-sm font-bold text-gray-900 dark:text-white">{fmtEur(item.valeur)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ModeLicence({ id }) {
  const { canWriteBudget, canDeleteBudget } = useRbac();
  const { addToast } = useToast();
  const annees = getAnneesDisponibles();
  const [annee, setAnnee] = useState(annees[annees.length - 1]);
  const [budgetLines, setBudgetLines] = useState(mockBudget);
  const [formOpen, setFormOpen] = useState(false);
  const [ligneEnEdition, setLigneEnEdition] = useState(null);
  const [ligneASupprimer, setLigneASupprimer] = useState(null);

  const period = useMemo(() => anneeToPeriod(annee), [annee]);

  const lines = useMemo(
    () => budgetLines.filter(b => b.id_licence === id && isLineInPeriod(b, period)),
    [budgetLines, id, period]
  );

  const kpis = useMemo(() => calcBudgetKpis(lines), [lines]);

  function openCreate() {
    setLigneEnEdition(null);
    setFormOpen(true);
  }

  function handleSave(formData) {
    // TODO API: POST/PUT /api/budget
    if (ligneEnEdition) {
      setBudgetLines(prev => prev.map(b => b.id === ligneEnEdition.id ? { ...ligneEnEdition, ...formData } : b));
      addToast({ type: 'success', message: 'Ligne budgetaire mise a jour.' });
    } else {
      const newId = `b-lic-${budgetLines.length + 1}`;
      setBudgetLines(prev => [...prev, { id: newId, ...formData }]);
      addToast({ type: 'success', message: 'Ligne budgetaire ajoutee.' });
    }
    setLigneEnEdition(null);
  }

  function handleConfirmDelete() {
    // TODO API: DELETE /api/budget/:id
    setBudgetLines(prev => prev.filter(b => b.id !== ligneASupprimer.id));
    addToast({ type: 'success', message: 'Ligne budgetaire supprimee.' });
    setLigneASupprimer(null);
  }

  const showActions = canWriteBudget || canDeleteBudget;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <select value={annee} onChange={e => setAnnee(Number(e.target.value))} className={SELECT_CLS} aria-label="Annee">
          {annees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {canWriteBudget && (
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={14} /> Ajouter
          </Button>
        )}
      </div>

      {lines.length === 0 ? (
        <EmptyState
          title="Aucune ligne budgetaire"
          description={`Aucun budget saisi pour cette licence en ${annee}.`}
          ctaLabel={canWriteBudget ? 'Ajouter une ligne' : undefined}
          onCta={canWriteBudget ? openCreate : undefined}
        />
      ) : (
        <>
          <MiniKpiBar kpis={kpis} />
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                  <th className={`${TH_CLS} text-left`}>Type</th>
                  <th className={`${TH_CLS} text-right`}>CAPEX</th>
                  <th className={`${TH_CLS} text-right`}>OPEX</th>
                  <th className={`${TH_CLS} text-left`}>Periode</th>
                  {showActions && <th className="w-16 px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {lines.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${b.type === 'alloue' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {b.type === 'alloue' ? 'Alloue' : 'Previsionnel'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{fmtEur(b.montant_CAPEX)}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{fmtEur(b.montant_OPEX)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{b.date_debut} au {b.date_fin}</td>
                    {showActions && (
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {canWriteBudget && (
                            <button
                              onClick={() => { setLigneEnEdition(b); setFormOpen(true); }}
                              aria-label="Modifier"
                              className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {canDeleteBudget && (
                            <button
                              onClick={() => setLigneASupprimer(b)}
                              aria-label="Supprimer"
                              className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <BudgetFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setLigneEnEdition(null); }}
        onSave={handleSave}
        ligne={ligneEnEdition}
        defaultDateDebut={period.dateDebut}
        defaultDateFin={period.dateFin}
        lockedLicenceId={id}
      />
      <ConfirmModal
        isOpen={!!ligneASupprimer}
        onClose={() => setLigneASupprimer(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer la ligne budgetaire"
        message="Supprimer definitivement cette ligne budgetaire ? Cette action est irreversible."
        confirmLabel="Supprimer"
        isDestructive
      />
    </div>
  );
}

function ModeContrat({ id }) {
  const navigate = useNavigate();
  const annees = getAnneesDisponibles();
  const [annee, setAnnee] = useState(annees[annees.length - 1]);
  const period = useMemo(() => anneeToPeriod(annee), [annee]);

  const licences = useMemo(() => getLicencesByContrat(id), [id]);
  const licenceIds = useMemo(() => licences.map(l => l.id), [licences]);

  const lines = useMemo(
    () => mockBudget.filter(b => licenceIds.includes(b.id_licence) && isLineInPeriod(b, period)),
    [licenceIds, period]
  );

  const kpis = useMemo(() => calcBudgetKpis(lines), [lines]);

  const breakdownRows = useMemo(() =>
    licences.map(l => {
      const lLines = lines.filter(b => b.id_licence === l.id);
      const alloue = lLines.filter(b => b.type === 'alloue');
      const prev   = lLines.filter(b => b.type === 'previsionnel');
      const capex_alloue = prev.reduce((s, b) => s + b.montant_CAPEX, 0);
      const capex_engage = alloue.reduce((s, b) => s + b.montant_CAPEX, 0);
      const opex_alloue  = prev.reduce((s, b) => s + b.montant_OPEX, 0);
      const opex_engage  = alloue.reduce((s, b) => s + b.montant_OPEX, 0);
      const produit = mockProduits.find(p => p.id === l.id_produit);
      return { licence: l, produit, capex_alloue, capex_engage, opex_alloue, opex_engage };
    }).filter(r => r.capex_alloue > 0 || r.capex_engage > 0 || r.opex_alloue > 0 || r.opex_engage > 0),
    [licences, lines]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <select value={annee} onChange={e => setAnnee(Number(e.target.value))} className={SELECT_CLS} aria-label="Annee">
          {annees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <Link to={`/budget?contrat=${id}`} className="flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-400 hover:underline">
          <ExternalLink size={14} /> Voir tout le budget
        </Link>
      </div>

      {lines.length === 0 ? (
        <EmptyState
          title="Aucune ligne budgetaire"
          description={`Aucun budget saisi pour ce contrat en ${annee}.`}
          ctaLabel="Ouvrir la page Budget"
          onCta={() => navigate(`/budget?contrat=${id}`)}
        />
      ) : (
        <>
          <MiniKpiBar kpis={kpis} />
          {breakdownRows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                    <th className={`${TH_CLS} text-left`}>Produit / Licence</th>
                    <th className={`${TH_CLS} text-right`}>CAPEX alloue</th>
                    <th className={`${TH_CLS} text-left`}>CAPEX engage</th>
                    <th className={`${TH_CLS} text-right`}>OPEX alloue</th>
                    <th className={`${TH_CLS} text-left`}>OPEX engage</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {breakdownRows.map(r => (
                    <tr key={r.licence.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">{r.produit?.label ?? r.licence.id}</td>
                      <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{fmtEur(r.capex_alloue)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5 min-w-[100px]">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{fmtEur(r.capex_engage)}</span>
                          <BudgetProgressBar valeur={r.capex_engage} total={r.capex_alloue} />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{fmtEur(r.opex_alloue)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5 min-w-[100px]">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{fmtEur(r.opex_engage)}</span>
                          <BudgetProgressBar valeur={r.opex_engage} total={r.opex_alloue} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function BudgetEmbeddedSection({ mode, id }) {
  if (mode === 'licence') return <ModeLicence id={id} />;
  if (mode === 'contrat') return <ModeContrat id={id} />;
  return null;
}
