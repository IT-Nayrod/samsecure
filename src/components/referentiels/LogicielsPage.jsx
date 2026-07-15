// LogicielsPage - liste des logiciels (catalogue commun + produits client), vue arborescente ou liste plate
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, List, GitBranch, ChevronRight, ChevronDown } from 'lucide-react';
import {
  mockProduits as initialProduits, mockEditeurs, getVersionsByProduit, getEditionsByProduit, getSousProduits,
} from '../../data/mockReferentiels';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Breadcrumb from '../ui/Breadcrumb';
import EmptyState from '../ui/EmptyState';
import StatutValidationBadge from './StatutValidationBadge';
import ProduitFormModal from './ProduitFormModal';
import LogoEditeur from './LogoEditeur';
import useRbac from '../../hooks/useRbac';
import useDebounce from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';

function getEditeur(idEditeur) {
  return mockEditeurs.find(e => e.id === idEditeur) ?? null;
}

function editeurLabel(idEditeur) {
  return getEditeur(idEditeur)?.raison_sociale ?? '-';
}

function TreeNode({ produit, produits, depth, navigate }) {
  const [open, setOpen] = useState(depth === 0);
  const enfants = getSousProduits(produit.id);
  const hasEnfants = enfants.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => navigate(`/referentiels/logiciels/${produit.id}`)}
      >
        {hasEnfants
          ? <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }} className="text-gray-400 flex-shrink-0">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
          : <span className="w-3.5 flex-shrink-0" />
        }
        <LogoEditeur editeur={getEditeur(produit.id_editeur)} size={20} />
        <span className="text-sm text-blue-800 hover:underline">{produit.label}</span>
        <Badge variant={produit.source === 'catalogue' ? 'neutral' : 'success'} label={produit.source === 'catalogue' ? 'Catalogue' : 'Client'} />
        {produit.a_maintenir && <Badge variant="success" label="Maintenance" />}
      </div>
      {open && hasEnfants && enfants.map(e => (
        <TreeNode key={e.id} produit={e} produits={produits} depth={depth + 1} navigate={navigate} />
      ))}
    </div>
  );
}

export default function LogicielsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, submitsForValidation } = useRbac();
  const [produits, setProduits] = useState(initialProduits);
  const [vueArbo, setVueArbo] = useState(true);
  const [filterEditeur, setFilterEditeur] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterMaintenir, setFilterMaintenir] = useState('');
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 300);
  const [formModal, setFormModal] = useState({ open: false, produit: null });

  const filtered = useMemo(() => {
    return produits.filter(p => {
      if (filterEditeur && p.id_editeur !== filterEditeur) return false;
      if (filterSource && p.source !== filterSource) return false;
      if (filterMaintenir === 'oui' && !p.a_maintenir) return false;
      if (filterMaintenir === 'non' && p.a_maintenir) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (!`${p.label} ${p.sku ?? ''}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [produits, filterEditeur, filterSource, filterMaintenir, debouncedSearch]);

  const racinesArbo = useMemo(() => produits.filter(p => !p.id_produit_parent), [produits]);

  function handleSave(data) {
    const newProduit = {
      id: `pc-${Date.now()}`, ...data, source: 'client', sku: null,
      statut_validation: submitsForValidation ? 'en_attente' : 'valide',
    };
    setProduits(prev => [...prev, newProduit]);
    addToast({ type: 'success', message: submitsForValidation ? 'Produit soumis a validation.' : 'Produit client cree.' });
  }

  const columns = [
    { key: 'label', label: 'Label', sortable: true, render: r => (
      <button onClick={() => navigate(`/referentiels/logiciels/${r.id}`)} className="flex items-center gap-2.5 font-medium text-blue-800 hover:underline text-left">
        <LogoEditeur editeur={getEditeur(r.id_editeur)} size={22} />
        {r.label}
      </button>
    ) },
    { key: 'editeur', label: 'Editeur', getValue: r => editeurLabel(r.id_editeur), render: r => editeurLabel(r.id_editeur) },
    { key: 'sku', label: 'SKU', render: r => r.sku ?? '-' },
    { key: 'source', label: 'Source', sortable: true, render: r => <Badge variant={r.source === 'catalogue' ? 'neutral' : 'success'} label={r.source === 'catalogue' ? 'Catalogue' : 'Client'} /> },
    { key: 'niveau', label: 'Niveau', getValue: r => r.id_produit_parent ? 'Sous-produit' : 'Produit', render: r => r.id_produit_parent ? 'Sous-produit' : 'Produit' },
    { key: 'a_maintenir', label: 'Maintenance', sortable: true, render: r => r.a_maintenir ? <Badge variant="success" label="Oui" /> : <Badge variant="neutral" label="Non" /> },
    { key: 'nb_versions', label: 'Nb versions', getValue: r => getVersionsByProduit(r.id).length, render: r => getVersionsByProduit(r.id).length },
    { key: 'nb_editions', label: 'Nb editions', getValue: r => getEditionsByProduit(r.id).length, render: r => getEditionsByProduit(r.id).length },
    { key: 'statut', label: 'Statut', render: r => r.source === 'client' ? <StatutValidationBadge statut={r.statut_validation} /> : <Badge variant="neutral" label="Catalogue commun" /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Referentiels' }, { label: 'Logiciels' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Logiciels</h1>
          <p className="text-sm text-gray-500 mt-0.5">{produits.length} produit{produits.length > 1 ? 's' : ''} au total (catalogue commun + produits client)</p>
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
          {canWrite && (
            <Button variant="primary" onClick={() => setFormModal({ open: true, produit: null })}>
              <Plus size={15} /> Nouveau produit client
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterEditeur} onChange={e => setFilterEditeur(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les editeurs</option>
          {mockEditeurs.map(ed => <option key={ed.id} value={ed.id}>{ed.raison_sociale}</option>)}
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les sources</option>
          <option value="catalogue">Catalogue commun</option>
          <option value="client">Produit client</option>
        </select>
        <select value={filterMaintenir} onChange={e => setFilterMaintenir(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Maintenance : tous</option>
          <option value="oui">A maintenir</option>
          <option value="non">Non maintenu</option>
        </select>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par label ou SKU..."
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
        />
      </div>

      {vueArbo ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          {racinesArbo.length === 0
            ? <EmptyState title="Aucun produit" description="Aucun produit dans le referentiel." />
            : racinesArbo.map(p => <TreeNode key={p.id} produit={p} produits={produits} depth={0} navigate={navigate} />)
          }
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <DataTable
            columns={columns}
            data={filtered}
            filename="logiciels"
            emptyState={{
              message: 'Aucun produit ne correspond aux filtres.',
              ctaLabel: canWrite ? 'Nouveau produit client' : undefined,
              onCta: canWrite ? () => setFormModal({ open: true, produit: null }) : undefined,
            }}
          />
        </div>
      )}

      <ProduitFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, produit: null })}
        onSave={handleSave}
        produit={formModal.produit}
        allProduits={produits}
      />
    </div>
  );
}
