// ContratsPage - echeancier et hierarchie des contrats (Droits d'usage)
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Layers, List, FileText, AlertTriangle, RefreshCw, FolderTree, ChevronRight, ChevronDown, X } from 'lucide-react';
import {
  mockContrats as initialContrats, getSousContrats, getEditeurLabel, getSocieteLabelContrat, getEcheanceContrat,
} from '../../data/mockContrats';
import { mockEditeurs, mockSocietes } from '../../data/mockReferentiels';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Breadcrumb from '../ui/Breadcrumb';
import EmptyState from '../ui/EmptyState';
import StatutValidationBadge from '../referentiels/StatutValidationBadge';
import StatutEcheanceBadge from './StatutEcheanceBadge';
import EcheancierList from './EcheancierList';
import ContratFormModal from './ContratFormModal';
import DeploiementKpiCard from '../deploiement/DeploiementKpiCard';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';

function TreeNode({ contrat, depth, navigate }) {
  const [open, setOpen] = useState(depth === 0);
  const enfants = getSousContrats(contrat.id);
  const hasEnfants = enfants.length > 0;
  const echeance = getEcheanceContrat(contrat);

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => navigate(`/contrats/liste/${contrat.id}`)}
      >
        {hasEnfants
          ? <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }} className="text-gray-400 flex-shrink-0">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
          : <span className="w-3.5 flex-shrink-0" />
        }
        <span className="text-sm text-blue-800 hover:underline">{contrat.label}</span>
        <span className="text-xs text-gray-400">{getEditeurLabel(contrat.id_editeur)} - {getSocieteLabelContrat(contrat.id_societe)}</span>
        {contrat.type === 'cadre' && <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">Cadre</span>}
        <StatutEcheanceBadge statut={echeance.statut} />
        <StatutValidationBadge statut={contrat.statut_validation} />
      </div>
      {open && hasEnfants && enfants.map(e => (
        <TreeNode key={e.id} contrat={e} depth={depth + 1} navigate={navigate} />
      ))}
    </div>
  );
}

export default function ContratsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, submitsForValidation } = useRbac();
  const { user } = useAuth();
  const [contrats, setContrats] = useState(initialContrats);
  const [vueArbo, setVueArbo] = useState(true);
  const [filterEditeur, setFilterEditeur] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterSociete, setFilterSociete] = useState('');
  const [activeKpi, setActiveKpi] = useState(null);
  const [searchParams] = useSearchParams();
  const editeurParam = searchParams.get('editeur');
  const societeParam = searchParams.get('societe');
  const [formModal, setFormModal] = useState({ open: false, contrat: null });

  const enrichis = useMemo(() => contrats.map(c => ({ contrat: c, echeance: getEcheanceContrat(c) })), [contrats]);

  function matchesKpi(contrat, echeance, kpi) {
    if (kpi === 'actifs') return echeance.statut === 'actif';
    if (kpi === 'a_echeance') return echeance.statut !== 'actif' && echeance.joursRestants !== null && echeance.joursRestants >= 0 && echeance.joursRestants <= 90;
    if (kpi === 'a_renouveler') return echeance.statut === 'a_renouveler';
    if (kpi === 'cadres') return contrat.type === 'cadre';
    return true;
  }

  const filtres = useMemo(() => {
    return enrichis.filter(({ contrat, echeance }) => {
      if ((filterEditeur || editeurParam) && contrat.id_editeur !== (filterEditeur || editeurParam)) return false;
      if ((filterSociete || societeParam) && contrat.id_societe !== (filterSociete || societeParam)) return false;
      if (filterType && contrat.type !== filterType) return false;
      if (filterStatut && echeance.statut !== filterStatut) return false;
      if (activeKpi && !matchesKpi(contrat, echeance, activeKpi)) return false;
      return true;
    });
  }, [enrichis, filterEditeur, filterSociete, filterType, filterStatut, activeKpi, editeurParam, societeParam]);

  const kpis = useMemo(() => ({
    actifs: enrichis.filter(e => e.echeance.statut === 'actif').length,
    aEcheance: enrichis.filter(e => e.echeance.statut !== 'actif' && e.echeance.joursRestants !== null && e.echeance.joursRestants >= 0 && e.echeance.joursRestants <= 90).length,
    aRenouveler: enrichis.filter(e => e.echeance.statut === 'a_renouveler').length,
    cadres: contrats.filter(c => c.type === 'cadre').length,
  }), [enrichis, contrats]);

  function toggleKpi(kpi) {
    setActiveKpi(prev => prev === kpi ? null : kpi);
  }

  function resetFiltres() {
    setFilterEditeur('');
    setFilterSociete('');
    setFilterType('');
    setFilterStatut('');
    setActiveKpi(null);
  }

  const hasActiveFiltres = !!(filterEditeur || filterSociete || filterType || filterStatut || activeKpi);

  function handleSave(data, existing) {
    if (existing) {
      const resoumis = submitsForValidation;
      setContrats(prev => prev.map(c => c.id === existing.id ? {
        ...c, ...data,
        statut_validation: resoumis ? 'en_attente' : 'valide',
        soumis_par: `${user.prenom} ${user.nom}`,
      } : c));
      addToast({ type: 'success', message: resoumis ? 'Modification soumise a validation.' : 'Contrat mis a jour.' });
    } else {
      const newContrat = {
        id: `ctr-${Date.now()}`, ...data,
        statut_validation: submitsForValidation ? 'en_attente' : 'valide',
        soumis_par: `${user.prenom} ${user.nom}`,
      };
      setContrats(prev => [...prev, newContrat]);
      addToast({ type: 'success', message: submitsForValidation ? 'Contrat soumis a validation.' : 'Contrat cree.' });
    }
  }

  const racinesArbo = useMemo(() => filtres.filter(({ contrat }) => !contrat.id_contrat_parent).map(e => e.contrat), [filtres]);

  const columns = [
    { key: 'label', label: 'Label', sortable: true, render: r => (
      <button onClick={() => navigate(`/contrats/liste/${r.id}`)} className="font-medium text-blue-800 hover:underline text-left">{r.label}</button>
    ) },
    { key: 'type', label: 'Type', sortable: true, render: r => r.type === 'cadre' ? <span className="text-xs font-semibold text-blue-700 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">Cadre</span> : 'Simple' },
    { key: 'editeur', label: 'Editeur', getValue: r => getEditeurLabel(r.id_editeur) ?? '', render: r => getEditeurLabel(r.id_editeur) ?? '-' },
    { key: 'societe', label: 'Societe', getValue: r => getSocieteLabelContrat(r.id_societe) ?? '', render: r => getSocieteLabelContrat(r.id_societe) ?? '-' },
    { key: 'date_debut', label: 'Date debut', sortable: true },
    { key: 'date_fin', label: 'Date fin', sortable: true, render: r => r.date_fin ?? 'Perpetuel' },
    { key: 'echeance', label: 'Statut', render: r => <StatutEcheanceBadge statut={getEcheanceContrat(r).statut} /> },
    { key: 'statut_validation', label: 'Validation', sortable: true, render: r => <StatutValidationBadge statut={r.statut_validation} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Droits d\'usage' }, { label: 'Contrat' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Contrat</h1>
          <p className="text-sm text-gray-500 mt-0.5">Echeancier et hierarchie des engagements contractuels</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button onClick={() => setVueArbo(true)} aria-label="Vue arborescente" className={`p-1.5 rounded ${vueArbo ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-800' : 'text-gray-500'}`}>
              <FolderTree size={15} />
            </button>
            <button onClick={() => setVueArbo(false)} aria-label="Vue liste" className={`p-1.5 rounded ${!vueArbo ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-800' : 'text-gray-500'}`}>
              <List size={15} />
            </button>
          </div>
          {canWrite && (
            <Button variant="primary" onClick={() => setFormModal({ open: true, contrat: null })}>
              <Plus size={15} /> Nouveau contrat
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DeploiementKpiCard label="Contrats actifs" value={kpis.actifs} icon={FileText} color="#22C55E" onClick={() => toggleKpi('actifs')} active={activeKpi === 'actifs'} />
        <DeploiementKpiCard label="A echeance sous 90 jours" value={kpis.aEcheance} icon={AlertTriangle} color="#F59E0B" onClick={() => toggleKpi('a_echeance')} active={activeKpi === 'a_echeance'} />
        <DeploiementKpiCard label="A renouveler" value={kpis.aRenouveler} icon={RefreshCw} color="#7C6FCD" onClick={() => toggleKpi('a_renouveler')} active={activeKpi === 'a_renouveler'} />
        <DeploiementKpiCard label="Contrats cadres" value={kpis.cadres} icon={Layers} color="#1F4E79" onClick={() => toggleKpi('cadres')} active={activeKpi === 'cadres'} />
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Echeancier</h2>
        <EcheancierList entries={enrichis} />
      </section>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterEditeur} onChange={e => setFilterEditeur(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les editeurs</option>
          {mockEditeurs.filter(e => contrats.some(c => c.id_editeur === e.id)).map(e => <option key={e.id} value={e.id}>{e.raison_sociale}</option>)}
        </select>
        <select value={filterSociete} onChange={e => setFilterSociete(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les societes</option>
          {mockSocietes.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les types</option>
          <option value="cadre">Cadre</option>
          <option value="simple">Simple</option>
        </select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="a_renouveler">A renouveler</option>
          <option value="expire">Expire</option>
        </select>
        {hasActiveFiltres && (
          <button onClick={resetFiltres} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-2">
            <X size={14} /> Reinitialiser les filtres
          </button>
        )}
      </div>

      {vueArbo ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          {racinesArbo.length === 0
            ? <EmptyState title="Aucun contrat" description="Aucun contrat ne correspond aux filtres." />
            : racinesArbo.map(c => <TreeNode key={c.id} contrat={c} depth={0} navigate={navigate} />)
          }
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <DataTable
            columns={columns}
            data={filtres.map(({ contrat }) => contrat)}
            filename="contrats"
            emptyState={{ message: 'Aucun contrat ne correspond aux filtres.' }}
          />
        </div>
      )}

      <ContratFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, contrat: null })}
        onSave={handleSave}
        contrat={formModal.contrat}
        existingContrats={contrats}
      />
    </div>
  );
}
