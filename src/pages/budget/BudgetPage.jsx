// BudgetPage - Section Budget - SamSecure v0.5
// Onglets Visualisation / Saisie. Perimetre organisation + periode persistees dans le state.
// Onglet actif via query param ?tab=visualisation|saisie.
import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import Breadcrumb from '../../components/ui/Breadcrumb';
import Button from '../../components/ui/Button';
import ConfirmModal from '../../components/ui/ConfirmModal';
import BudgetOrgSelector from '../../components/budget/BudgetOrgSelector';
import BudgetPeriodSelector from '../../components/budget/BudgetPeriodSelector';
import BudgetKPIBar from '../../components/budget/BudgetKPIBar';
import BudgetOrgBreakdown from '../../components/budget/BudgetOrgBreakdown';
import BudgetTable from '../../components/budget/BudgetTable';
import BudgetFormModal from '../../components/budget/BudgetFormModal';
import { mockBudget } from '../../data/mockBudget';
import { mockLicences, getLicencesByContrat } from '../../data/mockDeploiement';
import { mockContrats, mockCommandes } from '../../data/mockContrats';
import { mockSocietes, mockProduits } from '../../data/mockReferentiels';
import { getPerimetre, ligneDansPerimetre } from '../../utils/orgUtils';
import useRbac from '../../hooks/useRbac';

const SOURCES = { licences: mockLicences, commandes: mockCommandes, societes: mockSocietes };

export default function BudgetPage() {
  const { canDeleteBudget } = useRbac();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') ?? 'visualisation';

  const [budgetLines, setBudgetLines] = useState(mockBudget);
  const [period, setPeriod] = useState(null);
  // Organisation : perimetre controle depuis la page
  const [societeId, setSocieteId] = useState('');
  const [consolider, setConsolider] = useState(true);

  // Filtres depuis query params : ?licence=<id> ou ?contrat=<id>
  const licenceFilter = searchParams.get('licence') ?? '';
  const contratFilter = searchParams.get('contrat') ?? '';

  // Labels des chips de filtre
  const licenceFilterLabel = useMemo(() => {
    if (!licenceFilter) return null;
    const lic = mockLicences.find(l => l.id === licenceFilter);
    return mockProduits.find(p => p.id === lic?.id_produit)?.label ?? licenceFilter;
  }, [licenceFilter]);

  const contratFilterLabel = useMemo(() => {
    if (!contratFilter) return null;
    return mockContrats.find(c => c.id === contratFilter)?.label ?? contratFilter;
  }, [contratFilter]);

  // Perimetre effectif : null = toutes, [ids] = perimetre restreint
  const societeIds = useMemo(
    () => getPerimetre(societeId || null, consolider, mockSocietes),
    [societeId, consolider]
  );

  // Lignes pre-filtrees par licence/contrat (avant les filtres periode/org)
  const budgetLinesDisplay = useMemo(() => {
    if (licenceFilter) return budgetLines.filter(b => b.id_licence === licenceFilter);
    if (contratFilter) {
      const licIds = new Set(getLicencesByContrat(contratFilter).map(l => l.id));
      return budgetLines.filter(b => licIds.has(b.id_licence));
    }
    return budgetLines;
  }, [budgetLines, licenceFilter, contratFilter]);

  // Lignes filtrées : periode seule (pour le Breakdown qui fait son propre filtrage periode)
  const lignesPeriode = useMemo(() => {
    if (!period?.debut || !period?.fin) return budgetLinesDisplay;
    return budgetLinesDisplay.filter(b =>
      new Date(b.date_debut) <= period.fin && new Date(b.date_fin) >= period.debut
    );
  }, [budgetLinesDisplay, period]);

  // Lignes filtrées : periode + organisation (pour les KPIs)
  const lignesFiltrees = useMemo(
    () => lignesPeriode.filter(b => ligneDansPerimetre(b, societeIds, SOURCES)),
    [lignesPeriode, societeIds]
  );

  const handlePeriodChange = useCallback((p) => setPeriod(p), []);

  // Drill-down depuis le tableau de repartition
  function handleSelectSociete(id) {
    setSocieteId(id);
    setConsolider(false);
  }

  function setTab(t) {
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('tab', t); return p; });
  }

  function removeFilter(key) {
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete(key); return p; });
  }

  function handleCreate() {
    setLigneEnEdition(null);
    setFormOpen(true);
  }

  function handleEdit(ligne) {
    setLigneEnEdition(ligne);
    setFormOpen(true);
  }

  function handleDelete(ligne) {
    setLigneASupprimer(ligne);
  }

  function handleSave(formData) {
    // TODO API: POST/PUT /api/budget - remplacer par appel fetch
    if (ligneEnEdition) {
      setBudgetLines(prev => prev.map(b => b.id === ligneEnEdition.id ? { ...ligneEnEdition, ...formData } : b));
    } else {
      const newId = `b-new-${budgetLines.length + 1}`;
      setBudgetLines(prev => [...prev, { id: newId, ...formData }]);
    }
    setLigneEnEdition(null);
  }

  function handleConfirmDelete() {
    // TODO API: DELETE /api/budget/:id - remplacer par appel fetch
    setBudgetLines(prev => prev.filter(b => b.id !== ligneASupprimer.id));
    setLigneASupprimer(null);
  }

  const [formOpen, setFormOpen] = useState(false);
  const [ligneEnEdition, setLigneEnEdition] = useState(null);
  const [ligneASupprimer, setLigneASupprimer] = useState(null);

  const defaultDateDebut = period?.debut?.toISOString?.()?.slice(0, 10);
  const defaultDateFin = period?.fin?.toISOString?.()?.slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Budget' }]} />

      {/* En-tete */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Budget</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {period?.label ?? 'Chargement de la periode...'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <BudgetOrgSelector
            societeId={societeId}
            consolider={consolider}
            onSocieteChange={setSocieteId}
            onConsoliderChange={setConsolider}
          />
          <BudgetPeriodSelector onChange={handlePeriodChange} />
          {/* Onglets */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setTab('visualisation')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${tab === 'visualisation' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-800 dark:text-blue-400 font-medium' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Visualisation
            </button>
            <button
              onClick={() => setTab('saisie')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${tab === 'saisie' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-800 dark:text-blue-400 font-medium' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Saisie
            </button>
          </div>
        </div>
      </div>

      {/* Chips de filtre contextuels (depuis une fiche Contrat ou Licence) */}
      {(licenceFilter || contratFilter) && (
        <div className="flex flex-wrap gap-2 items-center">
          {licenceFilter && licenceFilterLabel && (
            <span className="flex items-center gap-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-full">
              Licence : {licenceFilterLabel}
              <button onClick={() => removeFilter('licence')} aria-label="Retirer le filtre licence" className="hover:text-blue-900 dark:hover:text-blue-200">
                <X size={14} />
              </button>
            </span>
          )}
          {contratFilter && contratFilterLabel && (
            <span className="flex items-center gap-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-full">
              Contrat : {contratFilterLabel}
              <button onClick={() => removeFilter('contrat')} aria-label="Retirer le filtre contrat" className="hover:text-blue-900 dark:hover:text-blue-200">
                <X size={14} />
              </button>
            </span>
          )}
        </div>
      )}

      {/* KPIs (filtres periode + organisation) */}
      <BudgetKPIBar lignes={lignesFiltrees} />

      {/* Repartition par organisation (visualisation uniquement, masque si 1 seule org) */}
      {tab === 'visualisation' && (
        <BudgetOrgBreakdown
          lignes={budgetLinesDisplay}
          period={period}
          societeIds={societeIds}
          onSelectSociete={handleSelectSociete}
        />
      )}

      {/* Bouton ajouter (onglet Saisie uniquement) */}
      {tab === 'saisie' && (
        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={handleCreate}>
            <Plus size={14} /> Ajouter une ligne
          </Button>
        </div>
      )}

      {/* Tableau (filtre organisation passe en prop) */}
      <BudgetTable
        budgetLines={budgetLinesDisplay}
        period={period}
        societeIds={societeIds}
        onEdit={handleEdit}
        onDelete={handleDelete}
        canEdit={tab === 'saisie'}
        canDelete={tab === 'saisie' && canDeleteBudget}
      />

      {/* Modal creation / edition */}
      <BudgetFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setLigneEnEdition(null); }}
        onSave={handleSave}
        ligne={ligneEnEdition}
        defaultDateDebut={defaultDateDebut}
        defaultDateFin={defaultDateFin}
      />

      {/* Confirm suppression */}
      <ConfirmModal
        isOpen={!!ligneASupprimer}
        onClose={() => setLigneASupprimer(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer la ligne budgetaire"
        message={`Supprimer la ligne ${ligneASupprimer?.type === 'previsionnel' ? 'previsionnelle' : 'allouee'} pour cette licence ? Cette action est irreversible.`}
        confirmLabel="Supprimer"
        isDestructive
      />
    </div>
  );
}
