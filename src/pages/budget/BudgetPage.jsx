// BudgetPage - Section Budget - SamSecure v0.5
// Onglets Visualisation / Saisie, perimetre organisation + periode dans le
// state, onglet actif via query param ?tab=visualisation|saisie.
// Donnees API : lignes (GET /budget), indicateurs (GET /budget/synthese),
// engage par licence (GET /budget/engage). La periode resolue par
// PeriodeSelector est transmise en plage date_debut / date_fin : le trimestre
// n'a pas d'exercice, et en vue consolidee l'exercice de la societe mere
// s'applique aux filiales (#164). L'API n'accepte qu'un id_societe : la
// consolidation fait un appel de synthese par societe du perimetre et cumule.
// Acces : page sur consulter_budget (route), creation et modification sur
// saisir_budget, suppression sur supprimer_budget ; l'API reste l'autorite.
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import Breadcrumb from '../../components/ui/Breadcrumb';
import Button from '../../components/ui/Button';
import ConfirmModal from '../../components/ui/ConfirmModal';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import BudgetOrgSelector from '../../components/budget/BudgetOrgSelector';
import PeriodeSelector from '../../components/ui/PeriodeSelector';
import BudgetKPIBar from '../../components/budget/BudgetKPIBar';
import BudgetOrgBreakdown from '../../components/budget/BudgetOrgBreakdown';
import BudgetTable from '../../components/budget/BudgetTable';
import BudgetFormModal from '../../components/budget/BudgetFormModal';
import { budgetService } from '../../services/budgetService';
import { licencesService } from '../../services/licencesService';
import { societesService } from '../../services/adminService';
import { optionnel } from '../../services/http';
import { sortByHierarchy } from '../../utils/societeHierarchy';
import {
  parametresPeriode, exerciceDePeriode, perimetreSocietes, cumulerTotaux, libelleLicence, libelleType, formatDateIso,
} from '../../components/budget/budgetCalculs';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';

export default function BudgetPage() {
  const { addToast } = useToast();
  const { canWrite, canDelete } = useRbac({ write: 'saisir_budget', delete: 'supprimer_budget' });
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') ?? 'visualisation';

  // Filtres depuis query params : ?licence=<id> ou ?contrat=<id> (fiches)
  const licenceFilter = searchParams.get('licence') ?? '';
  const contratFilter = searchParams.get('contrat') ?? '';

  // Referentiels accessoires : organisations (hierarchie, exercice fiscal) et
  // licences (formulaire). Un droit manquant sur eux prive de ces commodites,
  // pas de la page.
  const [societes, setSocietes] = useState([]);
  const [licences, setLicences] = useState([]);

  // Organisation : perimetre controle depuis la page
  const [societeId, setSocieteId] = useState('');
  const [consolider, setConsolider] = useState(true);
  const [periode, setPeriode] = useState(null);

  // Donnees budget
  const [lignes, setLignes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [synthesesParSociete, setSynthesesParSociete] = useState(new Map());
  const [totaux, setTotaux] = useState(null);
  const [syntheseLoading, setSyntheseLoading] = useState(true);
  const [syntheseErreur, setSyntheseErreur] = useState(null);
  const [engageParLicence, setEngageParLicence] = useState(new Map());
  // Jeton de la derniere demande : une reponse tardive n'ecrase pas la plus recente.
  const demande = useRef(0);
  // Referentiel des societes lu au moment de la demande, sans relancer le
  // chargement quand il arrive.
  const societesRef = useRef([]);
  societesRef.current = societes;

  const [formOpen, setFormOpen] = useState(false);
  const [ligneEnEdition, setLigneEnEdition] = useState(null);
  const [ligneASupprimer, setLigneASupprimer] = useState(null);

  const loadReferentiels = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        optionnel(societesService.list()),
        optionnel(licencesService.list()),
      ]);
      setSocietes(s);
      setLicences(l);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadReferentiels(); }, [loadReferentiels]);

  const societesTriees = useMemo(() => sortByHierarchy(societes), [societes]);

  // Perimetre effectif : null = toutes, [ids] = perimetre restreint
  const societeIds = useMemo(
    () => perimetreSocietes(societeId || null, consolider, societes),
    [societeId, consolider, societes]
  );

  // Exercice fiscal du selecteur de periode : celui de l'organisation
  // selectionnee (en consolidation, l'exercice de la societe mere s'applique
  // aux filiales). Sans organisation, defaut du composant (1er janvier) : aucune
  // route ne sert le defaut du tenant.
  const debutExercice = useMemo(
    () => societes.find(x => x.id === societeId)?.debut_exercice_fiscal ?? null,
    [societes, societeId]
  );

  const filtresBase = useMemo(() => ({
    ...parametresPeriode(periode),
    id_licence: licenceFilter || undefined,
    id_contrat: contratFilter || undefined,
  }), [periode, licenceFilter, contratFilter]);

  const loadBudget = useCallback(async () => {
    if (!periode?.dateDebut || !periode?.dateFin) return;
    const jeton = ++demande.current;
    const base = filtresBase;
    const perimetre = societeIds;
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    setSyntheseLoading(true);
    setSyntheseErreur(null);

    // Syntheses lancees en parallele de la liste : une par societe du
    // perimetre, ou une seule sans filtre (lignes sans societe comprises).
    const synthesePromise = perimetre
      ? Promise.all(perimetre.map(id => budgetService.synthese({ ...base, id_societe: id }).then(r => [id, r])))
      : budgetService.synthese(base).then(r => [[null, r]]);
    // Un rejet consomme ici, puis relu plus bas : sans ce catch, un echec avant
    // la liste ferait un rejet sans consommateur.
    synthesePromise.catch(() => {});

    let lignesPerimetre;
    try {
      const liste = perimetre && perimetre.length === 1
        ? await budgetService.list({ ...base, id_societe: perimetre[0] })
        : await budgetService.list(base);
      if (jeton !== demande.current) return;
      lignesPerimetre = perimetre
        ? liste.filter(l => l.id_societe && perimetre.includes(l.id_societe))
        : liste;
      setLignes(lignesPerimetre);
      setIsLoading(false);
    } catch (err) {
      if (jeton !== demande.current) return;
      setError(err.message);
      setErrorStatus(err.status);
      setIsLoading(false);
      setSyntheseLoading(false);
      addToast({ type: 'error', message: err.message });
      return;
    }

    // Engage par licence distincte de la liste affichee (GET /budget/engage).
    // Un echec isole laisse la ligne sans engage, il ne condamne pas la page.
    const idsLicences = [...new Set(lignesPerimetre.map(l => l.id_licence))];
    setEngageParLicence(new Map());
    Promise.all(idsLicences.map(id =>
      budgetService.engage({ ...parametresPeriode(periode), id_licence: id })
        .then(r => [id, { montant: r.totaux?.montant_commande ?? 0, indisponible: false }])
        .catch(err => [id, { montant: null, indisponible: true, message: err.message }])
    )).then(resultats => {
      if (jeton !== demande.current) return;
      setEngageParLicence(new Map(resultats));
    });

    // Indicateurs et repartition par organisation.
    try {
      const syntheses = await synthesePromise;
      if (jeton !== demande.current) return;
      const parSociete = new Map(syntheses);
      if (perimetre) {
        setTotaux(cumulerTotaux(syntheses.map(([, s]) => s.totaux)));
      } else {
        setTotaux(parSociete.get(null)?.totaux ?? null);
        // Repartition : une synthese par societe connue (referentiel) ou
        // presente dans les lignes, pour ne pas oublier une societe qui n'a
        // que de l'engage. Les lignes sans societe payeuse ne peuvent pas etre
        // filtrees par l'API : comptees dans les indicateurs, signalees sous
        // la repartition.
        const cibles = [...new Set([
          ...societesRef.current.map(s => s.id),
          ...lignesPerimetre.map(l => l.id_societe).filter(Boolean),
        ])];
        const supplement = await Promise.all(cibles.map(id =>
          budgetService.synthese({ ...base, id_societe: id }).then(r => [id, r])));
        if (jeton !== demande.current) return;
        for (const [id, s] of supplement) parSociete.set(id, s);
      }
      setSynthesesParSociete(parSociete);
      setSyntheseLoading(false);
    } catch (err) {
      if (jeton !== demande.current) return;
      setTotaux(null);
      setSynthesesParSociete(new Map());
      setSyntheseErreur(err.message);
      setSyntheseLoading(false);
      addToast({ type: 'error', message: err.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode, filtresBase, societeIds]);

  useEffect(() => { loadBudget(); }, [loadBudget]);

  // Lignes de la repartition, dans l'ordre hierarchique des organisations ;
  // une societe absente du referentiel (droit manquant) garde le libelle
  // servi par les lignes budgetaires.
  const repartition = useMemo(() => {
    const rows = [];
    const vues = new Set();
    for (const s of societesTriees) {
      if (!synthesesParSociete.has(s.id)) continue;
      vues.add(s.id);
      rows.push({ societe: s, totaux: synthesesParSociete.get(s.id).totaux });
    }
    for (const [id, s] of synthesesParSociete) {
      if (!id || vues.has(id)) continue;
      const label = lignes.find(l => l.id_societe === id)?.societe_label ?? 'Organisation';
      rows.push({ societe: { id, raison_sociale: label, depth: 0 }, totaux: s.totaux });
    }
    return rows;
  }, [societesTriees, synthesesParSociete, lignes]);

  // Libelles des chips de filtre : lignes servies, a defaut liste des licences.
  const licenceFilterLabel = useMemo(() => {
    if (!licenceFilter) return null;
    const ligne = lignes.find(l => l.id_licence === licenceFilter);
    if (ligne) return libelleLicence({ label: ligne.licence_label, produit_label: ligne.produit_label });
    const lic = licences.find(l => l.id === licenceFilter);
    return lic ? libelleLicence({ label: lic.label, produit_label: lic.produit_label }) : 'licence sélectionnée';
  }, [licenceFilter, lignes, licences]);

  const contratFilterLabel = useMemo(() => {
    if (!contratFilter) return null;
    return lignes.find(l => l.id_contrat === contratFilter)?.contrat_label
      ?? licences.find(l => l.id_contrat === contratFilter)?.contrat_label
      ?? 'contrat sélectionné';
  }, [contratFilter, lignes, licences]);

  // Lignes sans societe payeuse (licence sans commande) : dans les indicateurs
  // de la vue "Toutes les organisations", hors repartition.
  const nbSansSociete = useMemo(() => lignes.filter(l => !l.id_societe).length, [lignes]);

  const handlePeriodChange = useCallback((p) => setPeriode(p), []);

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

  // Apres toute ecriture : liste, indicateurs et engage recharges.
  function handleSaved() {
    setLigneEnEdition(null);
    loadBudget();
  }

  async function handleConfirmDelete() {
    try {
      await budgetService.remove(ligneASupprimer.id);
      addToast({ type: 'success', message: 'Ligne budgétaire supprimée.' });
      await loadBudget();
    } catch (err) {
      addToast({ type: 'error', message: err.message, persistent: true });
    }
  }

  // Bornes ISO calendaires fournies par le selecteur (toISOString basculerait en UTC et reculerait d'un jour)
  const defaultDateDebut = periode?.dateDebut;
  const defaultDateFin = periode?.dateFin;
  const exerciceCible = exerciceDePeriode(periode);

  const enTete = (
    <>
      <Breadcrumb items={[{ label: 'Budget' }]} />
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Budget</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {periode?.label ?? 'Chargement de la période…'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <BudgetOrgSelector
            societes={societes}
            societeId={societeId}
            consolider={consolider}
            onSocieteChange={setSocieteId}
            onConsoliderChange={setConsolider}
          />
          <PeriodeSelector debutExercice={debutExercice} onChange={handlePeriodChange} afficherBornes={false} />
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
          {licenceFilter && (
            <span className="flex items-center gap-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-full">
              Licence : {licenceFilterLabel}
              <button onClick={() => removeFilter('licence')} aria-label="Retirer le filtre licence" className="hover:text-blue-900 dark:hover:text-blue-200">
                <X size={14} />
              </button>
            </span>
          )}
          {contratFilter && (
            <span className="flex items-center gap-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-full">
              Contrat : {contratFilterLabel}
              <button onClick={() => removeFilter('contrat')} aria-label="Retirer le filtre contrat" className="hover:text-blue-900 dark:hover:text-blue-200">
                <X size={14} />
              </button>
            </span>
          )}
        </div>
      )}
    </>
  );

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {enTete}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <ErrorState message={error} status={errorStatus} onRetry={loadBudget} />
        </div>
      </div>
    );
  }

  const vide = !isLoading && lignes.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {enTete}

      {/* Indicateurs (periode + organisation), servis par la synthese */}
      <BudgetKPIBar totaux={totaux} isLoading={syntheseLoading} erreur={syntheseErreur} />

      {/* Repartition par organisation (visualisation uniquement, masquee si 1 seule org) */}
      {tab === 'visualisation' && !syntheseLoading && (
        <>
          <BudgetOrgBreakdown lignes={repartition} onSelectSociete={handleSelectSociete} />
          {!societeIds && nbSansSociete > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {nbSansSociete} ligne{nbSansSociete > 1 ? 's' : ''} sans organisation payeuse (licence sans commande) : comprise{nbSansSociete > 1 ? 's' : ''} dans les indicateurs, absente{nbSansSociete > 1 ? 's' : ''} de la répartition par organisation.
            </p>
          )}
        </>
      )}

      {/* Bouton ajouter (onglet Saisie, droit saisir_budget) */}
      {tab === 'saisie' && canWrite && (
        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={handleCreate}>
            <Plus size={14} /> Ajouter une ligne
          </Button>
        </div>
      )}

      {/* Tableau des lignes ; etat vide avec acces a la saisie si le droit le permet */}
      {vide ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <EmptyState
            title="Aucune ligne budgétaire"
            description={`Aucune ligne budgétaire ${licenceFilter || contratFilter ? 'pour ce filtre ' : ''}sur la période et le périmètre sélectionnés.`}
            ctaLabel={canWrite ? 'Saisir une ligne budgétaire' : undefined}
            onCta={canWrite ? () => { setTab('saisie'); handleCreate(); } : undefined}
          />
        </div>
      ) : (
        <BudgetTable
          lignes={lignes}
          engageParLicence={engageParLicence}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          canEdit={tab === 'saisie' && canWrite}
          canDelete={tab === 'saisie' && canDelete}
        />
      )}

      {/* Modal creation / edition */}
      <BudgetFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setLigneEnEdition(null); }}
        onSaved={handleSaved}
        ligne={ligneEnEdition}
        licences={licences}
        defaultDateDebut={defaultDateDebut}
        defaultDateFin={defaultDateFin}
        exercice={exerciceCible}
      />

      {/* Confirm suppression */}
      <ConfirmModal
        isOpen={!!ligneASupprimer}
        onClose={() => setLigneASupprimer(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer la ligne budgétaire"
        message={`Supprimer la ligne ${ligneASupprimer ? libelleType(ligneASupprimer.type).toLowerCase() : ''} de ${ligneASupprimer?.produit_label ?? ligneASupprimer?.licence_label ?? 'cette licence'} (${ligneASupprimer ? `${formatDateIso(ligneASupprimer.date_debut)} au ${formatDateIso(ligneASupprimer.date_fin)}` : ''}) ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        isDestructive
      />
    </div>
  );
}
