// OrganisationPage - liste des organisations (donnees reelles), vue arborescente ou liste plate
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, List, GitBranch, ChevronRight, ChevronDown } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Breadcrumb from '../ui/Breadcrumb';
import EmptyState from '../ui/EmptyState';
import OrganisationFormModal from './OrganisationFormModal';
import useDebounce from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';
import { societesService } from '../../services/adminService';
import { sortByHierarchy } from '../../utils/societeHierarchy';

function TreeNode({ organisation, depth, navigate, organisations }) {
  const [open, setOpen] = useState(depth === 0);
  const filiales = organisations.filter(o => o.id_societe_parent === organisation.id);
  const hasFiliales = filiales.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => navigate(`/referentiels/organisation/${organisation.id}`)}
      >
        {hasFiliales
          ? <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }} className="text-gray-400 flex-shrink-0">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
          : <span className="w-3.5 flex-shrink-0" />
        }
        <span className="text-sm text-blue-800 hover:underline">{organisation.raison_sociale}</span>
        <Badge variant={organisation.actif ? 'success' : 'neutral'} label={organisation.actif ? 'Active' : 'Inactive'} />
      </div>
      {open && hasFiliales && filiales.map(f => (
        <TreeNode key={f.id} organisation={f} depth={depth + 1} navigate={navigate} organisations={organisations} />
      ))}
    </div>
  );
}

export default function OrganisationPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [organisations, setOrganisations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [vueArbo, setVueArbo] = useState(true);
  const [filterParent, setFilterParent] = useState('');
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 300);
  const [formModal, setFormModal] = useState({ open: false, organisation: null });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await societesService.list();
      setOrganisations(rows);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // Ordre hiérarchique (parent avant ses enfants, profondeur pour
  // l'indentation) calculé sur l'ensemble des organisations, puis filtré en
  // conservant cet ordre : les filtres/recherche ne doivent pas casser la
  // lecture de l'arborescence dans la vue liste.
  const hierarchical = useMemo(() => sortByHierarchy(organisations), [organisations]);

  const filtered = useMemo(() => {
    return hierarchical.filter(o => {
      if (filterParent && o.id_societe_parent !== filterParent) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (!`${o.raison_sociale} ${o.siret}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [hierarchical, filterParent, debouncedSearch]);

  const racinesArbo = useMemo(() => organisations.filter(o => !o.id_societe_parent), [organisations]);
  const organisationsMeres = useMemo(() => organisations.filter(o => !o.id_societe_parent), [organisations]);

  async function handleSubmit(data, existing) {
    if (existing) {
      await societesService.update(existing.id, data);
      addToast({ type: 'success', message: 'Organisation mise à jour.' });
    } else {
      await societesService.create(data);
      addToast({ type: 'success', message: 'Organisation créée.' });
    }
    await load();
  }

  const columns = [
    { key: 'raison_sociale', label: 'Raison sociale', sortable: true, render: r => (
      <button onClick={() => navigate(`/referentiels/organisation/${r.id}`)} className="font-medium text-blue-800 hover:underline text-left whitespace-pre">
        {r.depth > 0 ? `${'  '.repeat(r.depth - 1)}|_ ` : ''}{r.raison_sociale}
      </button>
    ) },
    { key: 'siret', label: 'SIRET', sortable: true },
    { key: 'organisation_parente', label: 'Organisation parente', getValue: r => organisations.find(o => o.id === r.id_societe_parent)?.raison_sociale ?? '', render: r => organisations.find(o => o.id === r.id_societe_parent)?.raison_sociale ?? '-' },
    { key: 'duree_amortissement', label: 'Durée amort.', sortable: true, render: r => r.duree_amortissement ? `${r.duree_amortissement} mois` : '-' },
    { key: 'actif', label: 'Statut', sortable: true, render: r => <Badge variant={r.actif ? 'success' : 'neutral'} label={r.actif ? 'Active' : 'Inactive'} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'Organisation' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Organisation</h1>
          <p className="text-sm text-gray-500 mt-0.5">{organisations.length} organisation{organisations.length > 1 ? 's' : ''} au total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button onClick={() => setVueArbo(true)} aria-label="Vue arborescente" className={`p-1.5 rounded ${vueArbo ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-800' : 'text-gray-500'}`}>
              <GitBranch size={15} />
            </button>
            <button onClick={() => setVueArbo(false)} aria-label="Vue liste" className={`p-1.5 rounded ${!vueArbo ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-800' : 'text-gray-500'}`}>
              <List size={15} />
            </button>
          </div>
          <Button variant="primary" onClick={() => setFormModal({ open: true, organisation: null })}>
            <Plus size={15} /> Nouvelle organisation
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterParent} onChange={e => setFilterParent(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les organisations parentes</option>
          {organisationsMeres.map(o => <option key={o.id} value={o.id}>{o.raison_sociale}</option>)}
        </select>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par raison sociale ou SIRET..."
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
        />
      </div>

      {vueArbo ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          {isLoading
            ? <p className="text-sm text-gray-400">Chargement…</p>
            : racinesArbo.length === 0
            ? <EmptyState title="Aucune organisation" description="Aucune organisation dans le référentiel." ctaLabel="Nouvelle organisation" onCta={() => setFormModal({ open: true, organisation: null })} />
            : racinesArbo.map(o => <TreeNode key={o.id} organisation={o} depth={0} navigate={navigate} organisations={organisations} />)
          }
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <DataTable
            columns={columns}
            data={filtered}
            filename="organisations"
            isLoading={isLoading}
            emptyState={{
              message: 'Aucune organisation ne correspond aux filtres.',
              ctaLabel: 'Nouvelle organisation',
              onCta: () => setFormModal({ open: true, organisation: null }),
            }}
          />
        </div>
      )}

      <OrganisationFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, organisation: null })}
        onSubmit={handleSubmit}
        organisation={formModal.organisation}
        existingOrganisations={organisations}
      />
    </div>
  );
}
