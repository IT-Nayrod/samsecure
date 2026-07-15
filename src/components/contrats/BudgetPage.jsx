// BudgetPage - saisie du budget par licence pour un exercice fiscal + comparaison budget vs reel
// Le budget est saisi par licence ; agrege bottom-up vers le contrat puis le global.
// Reel = montant des commandes du contrat realisees pendant l'exercice fiscal (cf. utils/fiscalPeriod).
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { mockLicences } from '../../data/mockDeploiement';
import { mockCommandes, getContrat } from '../../data/mockContrats';
import { mockProduits } from '../../data/mockReferentiels';
import { mockBudgets as initialBudgets, getExercicesDisponibles } from '../../data/mockBudgets';
import { getExerciceFiscalKey, getExerciceFiscalRange, isDateInRange, formatPeriodeLabel } from '../../utils/fiscalPeriod';
import Breadcrumb from '../ui/Breadcrumb';
import DeploiementKpiCard from '../deploiement/DeploiementKpiCard';
import useRbac from '../../hooks/useRbac';

const SELECT_CLS = 'text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

function getProduitLabel(idProduit) {
  return mockProduits.find(p => p.id === idProduit)?.label ?? idProduit;
}

function ecartBadge(ecartPct) {
  if (ecartPct > 100) return { color: '#EF4444', label: 'Au-dessus du budget' };
  if (ecartPct >= 90) return { color: '#F59E0B', label: 'Proche du budget' };
  return { color: '#22C55E', label: 'Sous le budget' };
}

export default function BudgetPage() {
  const navigate = useNavigate();
  const { canEditBudget } = useRbac();
  const [budgets, setBudgets] = useState(initialBudgets);
  const [vue, setVue] = useState('saisie'); // 'saisie' | 'budget_vs_reel'

  // Exercice par defaut : exercice fiscal en cours selon le defaut tenant (vue agregee, multi-societes)
  const exerciceCourant = getExerciceFiscalKey(null);
  const exercicesConnus = useMemo(() => {
    const set = new Set([...getExercicesDisponibles(), exerciceCourant]);
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [exerciceCourant]);
  const [exercice, setExercice] = useState(exerciceCourant);

  const estExerciceCourant = exercice === exerciceCourant;
  const editable = canEditBudget && estExerciceCourant;

  const periodeExercice = useMemo(() => getExerciceFiscalRange(exercice, null), [exercice]);

  function getBudgetMontant(idLicence) {
    return budgets.find(b => b.id_licence === idLicence && b.exercice === exercice)?.montant ?? 0;
  }

  function setBudgetMontant(idLicence, montant) {
    setBudgets(prev => {
      const existe = prev.some(b => b.id_licence === idLicence && b.exercice === exercice);
      if (existe) {
        return prev.map(b => b.id_licence === idLicence && b.exercice === exercice ? { ...b, montant } : b);
      }
      return [...prev, { id: `bg-${idLicence}-${exercice}`, id_licence: idLicence, exercice, montant }];
    });
  }

  // Licences regroupees par contrat, avec budget par licence et sous-total par contrat
  const licencesParContrat = useMemo(() => {
    const groupes = new Map();
    mockLicences.forEach(l => {
      if (!l.id_contrat) return;
      if (!groupes.has(l.id_contrat)) groupes.set(l.id_contrat, []);
      groupes.get(l.id_contrat).push(l);
    });
    return [...groupes.entries()].map(([idContrat, licences]) => ({
      contrat: getContrat(idContrat),
      licences,
      sousTotal: licences.reduce((s, l) => s + (budgets.find(b => b.id_licence === l.id && b.exercice === exercice)?.montant ?? 0), 0),
    }));
  }, [budgets, exercice]);

  const budgetGlobal = useMemo(() => licencesParContrat.reduce((s, g) => s + g.sousTotal, 0), [licencesParContrat]);

  // Reel par contrat : commandes du contrat realisees pendant l'exercice fiscal selectionne
  const budgetVsReelParContrat = useMemo(() => {
    return licencesParContrat
      .filter(g => g.contrat)
      .map(g => {
        const reel = mockCommandes
          .filter(k => k.id_contrat === g.contrat.id && isDateInRange(k.date, periodeExercice))
          .reduce((s, k) => s + k.montant, 0);
        const ecartPct = g.sousTotal > 0 ? Math.round((reel / g.sousTotal) * 1000) / 10 : (reel > 0 ? Infinity : 0);
        return { contrat: g.contrat, budget: g.sousTotal, reel, ecart: g.sousTotal - reel, ecartPct };
      });
  }, [licencesParContrat, periodeExercice]);

  const reelGlobal = useMemo(() => budgetVsReelParContrat.reduce((s, g) => s + g.reel, 0), [budgetVsReelParContrat]);
  const ecartGlobal = budgetGlobal - reelGlobal;
  const ecartGlobalPct = budgetGlobal > 0 ? Math.round((reelGlobal / budgetGlobal) * 1000) / 10 : 0;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Droits d\'usage' }, { label: 'Budget' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Budget</h1>
          <p className="text-sm text-gray-500 mt-0.5">Budget saisi par licence, agrege par contrat et au global</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={exercice} onChange={e => setExercice(e.target.value)} className={SELECT_CLS}>
            {exercicesConnus.map(ex => (
              <option key={ex} value={ex}>Exercice {ex}{ex === exerciceCourant ? ' (en cours)' : ''}</option>
            ))}
          </select>
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button onClick={() => setVue('saisie')} className={`px-3 py-1.5 rounded text-sm ${vue === 'saisie' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-800 font-medium' : 'text-gray-500'}`}>Saisie</button>
            <button onClick={() => setVue('budget_vs_reel')} className={`px-3 py-1.5 rounded text-sm ${vue === 'budget_vs_reel' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-800 font-medium' : 'text-gray-500'}`}>Budget vs reel</button>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-500">Periode de l'exercice : {formatPeriodeLabel(periodeExercice)}</p>

      {!estExerciceCourant && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Exercice passe : consultation uniquement, la saisie n'est ouverte que sur l'exercice en cours ({exerciceCourant}).
        </div>
      )}
      {estExerciceCourant && !canEditBudget && (
        <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          Consultation uniquement : la saisie du budget est reservee au Financier et au Manager DSI.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DeploiementKpiCard label="Budget global" value={`${budgetGlobal.toLocaleString('fr-FR')} €`} icon={Wallet} color="#1F4E79" />
        <DeploiementKpiCard label="Reel realise" value={`${reelGlobal.toLocaleString('fr-FR')} €`} icon={TrendingUp} color="#7C6FCD" />
        <DeploiementKpiCard
          label="Ecart global"
          value={`${ecartGlobal >= 0 ? '+' : ''}${ecartGlobal.toLocaleString('fr-FR')} € (${ecartGlobalPct}%)`}
          icon={ecartGlobal >= 0 ? TrendingDown : TrendingUp}
          color={ecartBadge(ecartGlobalPct).color}
        />
      </div>

      {vue === 'saisie' ? (
        <div className="flex flex-col gap-4">
          {licencesParContrat.map(({ contrat, licences, sousTotal }) => (
            <section key={contrat?.id ?? 'sans-contrat'} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => contrat && navigate(`/contrats/liste/${contrat.id}`)}
                  className="text-sm font-semibold text-blue-800 hover:underline text-left"
                >
                  {contrat?.label ?? 'Sans contrat'}
                </button>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Sous-total : {sousTotal.toLocaleString('fr-FR')} €</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="py-1.5 font-medium">Licence</th>
                    <th className="py-1.5 font-medium">Quantite</th>
                    <th className="py-1.5 font-medium text-right">Budget {exercice}</th>
                  </tr>
                </thead>
                <tbody>
                  {licences.map(l => (
                    <tr key={l.id} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="py-2 text-gray-800 dark:text-gray-200">{getProduitLabel(l.id_produit)}</td>
                      <td className="py-2 text-gray-500">{l.quantite} {l.unite_mesure}</td>
                      <td className="py-2 text-right">
                        {editable ? (
                          <input
                            type="number"
                            min="0"
                            value={getBudgetMontant(l.id)}
                            onChange={e => setBudgetMontant(l.id, Number(e.target.value))}
                            className="w-32 text-right text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="text-gray-700 dark:text-gray-300">{getBudgetMontant(l.id).toLocaleString('fr-FR')} €</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="py-2 font-medium">Contrat</th>
                <th className="py-2 font-medium text-right">Budget</th>
                <th className="py-2 font-medium text-right">Reel</th>
                <th className="py-2 font-medium text-right">Ecart</th>
                <th className="py-2 font-medium text-right">% consomme</th>
                <th className="py-2 font-medium text-right">Statut</th>
                <th className="py-2 font-medium text-right">Commandes</th>
              </tr>
            </thead>
            <tbody>
              {budgetVsReelParContrat.map(({ contrat, budget, reel, ecart, ecartPct }) => {
                const badge = ecartBadge(ecartPct);
                return (
                  <tr key={contrat.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="py-2.5">
                      <button onClick={() => navigate(`/contrats/liste/${contrat.id}`)} className="text-blue-800 hover:underline text-left">{contrat.label}</button>
                    </td>
                    <td className="py-2.5 text-right text-gray-800 dark:text-gray-200">{budget.toLocaleString('fr-FR')} €</td>
                    <td className="py-2.5 text-right text-gray-800 dark:text-gray-200">{reel.toLocaleString('fr-FR')} €</td>
                    <td className="py-2.5 text-right" style={{ color: ecart < 0 ? '#EF4444' : '#22C55E' }}>
                      {ecart >= 0 ? '+' : ''}{ecart.toLocaleString('fr-FR')} €
                    </td>
                    <td className="py-2.5 text-right text-gray-800 dark:text-gray-200">{Number.isFinite(ecartPct) ? `${ecartPct}%` : '-'}</td>
                    <td className="py-2.5 text-right">
                      <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: `${badge.color}18`, color: badge.color }}>{badge.label}</span>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => navigate(`/contrats/commandes?contrat=${contrat.id}`)}
                        className="inline-flex items-center gap-1 text-sm text-blue-800 hover:underline"
                      >
                        Voir <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
