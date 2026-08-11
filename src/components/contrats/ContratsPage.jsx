// ContratsPage - echeancier et hierarchie des contrats (Droits d'usage)
// Donnees API : /contrats, /editeurs, /types-contrat, /revendeurs, /societes.
// Le statut d'echeance et les jours restants viennent de l'API, jamais recalcules ici.
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Layers, List, FileText, AlertTriangle, RefreshCw, FolderTree, ChevronRight, ChevronDown, X } from 'lucide-react';
import { contratsService, referentielsContratsService } from '../../services/contratsService';
import { societesService } from '../../services/adminService';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Breadcrumb from '../ui/Breadcrumb';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import StatutEcheanceBadge from './StatutEcheanceBadge';
import EcheancierList from './EcheancierList';
import ContratFormModal from './ContratFormModal';
import DeploiementKpiCard from '../deploiement/DeploiementKpiCard';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';

function TreeNode({ contrat, depth, enfantsParParent, navigate }) {
  const [open, setOpen] = useState(depth === 0);
  const enfants = enfantsParParent.get(contrat.id) ?? [];
  const hasEnfants = enfants.length > 0;

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
        <span className="text-xs text-gray-400">{contrat.editeur_label ?? '-'} - {contrat.societe_label ?? '-'}</span>
        {contrat.type_code === 'cadre' && <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">Cadre</span>}
        <StatutEcheanceBadge statut={contrat.statut_echeance} />
      </div>
      {open && hasEnfants && enfants.map(e => (
        <TreeNode key={e.id} contrat={e} depth={depth + 1} enfantsParParent={enfantsParParent} navigate={navigate} />
      ))}
    </div>
  );
}

export default function ContratsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite } = useRbac();

  const [contrats, setContrats] = useState([]);
  const [editeurs, setEditeurs] = useState([]);
  const [societes, setSocietes] = useState([]);
  const [typesContrat, setTypesContrat] = useState([]);
  const [revendeurs, setRevendeurs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [c, e, s, t, r] = await Promise.all([
        contratsService.list(),
        referentielsContratsService.editeurs(),
        societesService.list(),
        referentielsContratsService.typesContrat(),
        referentielsContratsService.revendeurs(),
      ]);
      setContrats(c);
      setEditeurs(e);
      setSocietes(s);
      setTypesContrat(t);
      setRevendeurs(r);
    } catch (err) {
      setError(err.message);
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // Index parent -> enfants, construit une fois : l'API renvoie une liste plate.
  const enfantsParParent = useMemo(() => {
    const index = new Map();
    for (const c of contrats) {
      if (!c.id_contrat_parent) continue;
      const fratrie = index.get(c.id_contrat_parent) ?? [];
      fratrie.push(c);
      index.set(c.id_contrat_parent, fratrie);
    }
    return index;
  }, [contrats]);

  function matchesKpi(contrat, kpi) {
    const st = contrat.statut_echeance;
    if (kpi === 'actifs') return st === 'actif';
    if (kpi === 'a_echeance') return st !== 'actif' && st !== 'perpetuel'
      && contrat.jours_restants !== null && contrat.jours_restants >= 0 && contrat.jours_restants <= 90;
    if (kpi === 'a_renouveler') return st === 'a_renouveler';
    if (kpi === 'cadres') return contrat.type_code === 'cadre';
    return true;
  }

  const filtres = useMemo(() => contrats.filter(contrat => {
    if ((filterEditeur || editeurParam) && contrat.id_editeur !== (filterEditeur || editeurParam)) return false;
    if ((filterSociete || societeParam) && contrat.id_societe !== (filterSociete || societeParam)) return false;
    if (filterType && contrat.id_type_contrat !== filterType) return false;
    if (filterStatut && contrat.statut_echeance !== filterStatut) return false;
    if (activeKpi && !matchesKpi(contrat, activeKpi)) return false;
    return true;
  }), [contrats, filterEditeur, filterSociete, filterType, filterStatut, activeKpi, editeurParam, societeParam]);

  const kpis = useMemo(() => ({
    actifs: contrats.filter(c => matchesKpi(c, 'actifs')).length,
    aEcheance: contrats.filter(c => matchesKpi(c, 'a_echeance')).length,
    aRenouveler: contrats.filter(c => matchesKpi(c, 'a_renouveler')).length,
    cadres: contrats.filter(c => matchesKpi(c, 'cadres')).length,
  }), [contrats]);

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

  const racinesArbo = useMemo(() => filtres.filter(c => !c.id_contrat_parent), [filtres]);

  const columns = [
    { key: 'label', label: 'Label', sortable: true, render: r => (
      <button onClick={() => navigate(`/contrats/liste/${r.id}`)} className="font-medium text-blue-800 hover:underline text-left">{r.label}</button>
    ) },
    { key: 'type_label', label: 'Type', sortable: true, render: r => r.type_code === 'cadre'
      ? <span className="text-xs font-semibold text-blue-700 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">Cadre</span>
      : (r.type_label ?? '-') },
    { key: 'editeur_label', label: 'Editeur', sortable: true, render: r => r.editeur_label ?? '-' },
    { key: 'societe_label', label: 'Societe signataire', sortable: true, render: r => r.societe_label ?? '-' },
    { key: 'revendeur_label', label: 'Revendeur', sortable: true, render: r => r.revendeur_label ?? '-' },
    { key: 'date_debut', label: 'Date debut', sortable: true, render: r => r.date_debut ?? '-' },
    { key: 'date_fin', label: 'Date fin', sortable: true, render: r => r.date_fin ?? 'Perpetuel' },
    { key: 'statut_echeance', label: 'Statut', sortable: true, render: r => <StatutEcheanceBadge statut={r.statut_echeance} /> },
  ];

  const enTete = (
    <>
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
            <Button variant="primary" onClick={() => setFormModal({ open: true, contrat: null })} disabled={isLoading || !!error}>
              <Plus size={15} /> Nouveau contrat
            </Button>
          )}
        </div>
      </div>
    </>
  );

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {enTete}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <ErrorState message={error} onRetry={load} />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {enTete}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} height="h-20" />)}
        </div>
        <Skeleton height="h-40" />
        <Skeleton height="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {enTete}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DeploiementKpiCard label="Contrats actifs" value={kpis.actifs} icon={FileText} color="#22C55E" onClick={() => toggleKpi('actifs')} active={activeKpi === 'actifs'} />
        <DeploiementKpiCard label="A echeance sous 90 jours" value={kpis.aEcheance} icon={AlertTriangle} color="#F59E0B" onClick={() => toggleKpi('a_echeance')} active={activeKpi === 'a_echeance'} />
        <DeploiementKpiCard label="A renouveler" value={kpis.aRenouveler} icon={RefreshCw} color="#7C6FCD" onClick={() => toggleKpi('a_renouveler')} active={activeKpi === 'a_renouveler'} />
        <DeploiementKpiCard label="Contrats cadres" value={kpis.cadres} icon={Layers} color="#1F4E79" onClick={() => toggleKpi('cadres')} active={activeKpi === 'cadres'} />
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Echeancier</h2>
        <EcheancierList contrats={contrats} />
      </section>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterEditeur} onChange={e => setFilterEditeur(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les editeurs</option>
          {editeurs.filter(e => contrats.some(c => c.id_editeur === e.id)).map(e => <option key={e.id} value={e.id}>{e.raison_sociale}</option>)}
        </select>
        <select value={filterSociete} onChange={e => setFilterSociete(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les societes</option>
          {societes.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les types</option>
          {typesContrat.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="a_renouveler">A renouveler</option>
          <option value="expire">Expire</option>
          <option value="perpetuel">Perpetuel</option>
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
            ? <EmptyState title="Aucun contrat" description={contrats.length === 0 ? 'Aucun contrat enregistre pour le moment.' : 'Aucun contrat ne correspond aux filtres.'} />
            : racinesArbo.map(c => <TreeNode key={c.id} contrat={c} depth={0} enfantsParParent={enfantsParParent} navigate={navigate} />)
          }
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <DataTable
            columns={columns}
            data={filtres}
            filename="contrats"
            emptyState={{ message: contrats.length === 0 ? 'Aucun contrat enregistre.' : 'Aucun contrat ne correspond aux filtres.' }}
          />
        </div>
      )}

      <ContratFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, contrat: null })}
        onSaved={load}
        contrat={formModal.contrat}
        contrats={contrats}
        typesContrat={typesContrat}
        editeurs={editeurs}
        societes={societes}
        revendeurs={revendeurs}
      />
    </div>
  );
}
