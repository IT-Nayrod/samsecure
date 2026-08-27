// LogicielsPage - liste des logiciels, vue arborescente ou liste plate.
// Donnees API : /logiciels, qui sert le catalogue global (BDD Commune) et les
// logiciels propres au client (BDD Tenant) sous une forme unique. Chaque ligne
// porte source et modifiable : seuls les logiciels client s'ecrivent, le
// catalogue est partage par tous les clients.
//
// La colonne et le filtre Maintenance ont ete retires : le modele ne porte plus
// a_maintenir sur le produit (modif 12), la maintenance est un choix client
// porte par la licence, ou elle reste visible.
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, List, GitBranch, ChevronRight, ChevronDown } from 'lucide-react';
import { logicielsService, editeursService, editeurDuProduit } from '../../services/referentielsService';
import { optionnel } from '../../services/http';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Breadcrumb from '../ui/Breadcrumb';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import StatutValidationBadge from './StatutValidationBadge';
import ProduitFormModal from './ProduitFormModal';
import LogoEditeur from './LogoEditeur';
import useRbac from '../../hooks/useRbac';
import useDebounce from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';

function SourceBadge({ source }) {
  return <Badge variant={source === 'catalogue' ? 'neutral' : 'success'} label={source === 'catalogue' ? 'Catalogue' : 'Client'} />;
}

function TreeNode({ produit, enfantsParParent, depth, navigate }) {
  const [open, setOpen] = useState(depth === 0);
  const enfants = enfantsParParent.get(produit.id) ?? [];
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
        <LogoEditeur editeur={editeurDuProduit(produit)} size={20} />
        <span className="text-sm text-blue-800 hover:underline">{produit.label}</span>
        <SourceBadge source={produit.source} />
      </div>
      {open && hasEnfants && enfants.map(e => (
        <TreeNode key={e.id} produit={e} enfantsParParent={enfantsParParent} depth={depth + 1} navigate={navigate} />
      ))}
    </div>
  );
}

export default function LogicielsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite } = useRbac({ write: 'gerer_referentiels' });
  const [produits, setProduits] = useState([]);
  const [editeurs, setEditeurs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [vueArbo, setVueArbo] = useState(true);
  const [filterEditeur, setFilterEditeur] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 300);
  const [formModal, setFormModal] = useState({ open: false, produit: null });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      // Seuls les logiciels sont indispensables a cet ecran. Les editeurs
      // alimentent un filtre et le formulaire : un droit manquant sur eux doit
      // priver de ces commodites, pas de la liste.
      const [p, e] = await Promise.all([
        logicielsService.list(),
        optionnel(editeursService.list(), []),
      ]);
      setProduits(p);
      setEditeurs(e);
    } catch (err) {
      setError(err.message);
      setErrorStatus(err.status);
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => produits.filter(p => {
    if (filterEditeur && p.id_editeur !== filterEditeur) return false;
    if (filterSource && p.source !== filterSource) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      if (!`${p.label} ${p.sku ?? ''}`.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [produits, filterEditeur, filterSource, debouncedSearch]);

  // L'arbre se construit sur la liste filtree, jamais sur la liste complete :
  // un produit qui passe le filtre est toujours affiche. S'il a un parent, il
  // est rendu sous lui quand le parent passe aussi, sinon il devient racine.
  // Sans filtre, l'ensemble filtre est la liste entiere et l'arbre est inchange.
  const enfantsParParent = useMemo(() => {
    const index = new Map();
    for (const p of filtered) {
      if (!p.id_produit_parent) continue;
      const fratrie = index.get(p.id_produit_parent) ?? [];
      fratrie.push(p);
      index.set(p.id_produit_parent, fratrie);
    }
    return index;
  }, [filtered]);

  const racinesArbo = useMemo(() => {
    const visibles = new Set(filtered.map(p => p.id));
    return filtered.filter(p => !p.id_produit_parent || !visibles.has(p.id_produit_parent));
  }, [filtered]);

  async function handleSave(data, existing) {
    if (existing) {
      await logicielsService.update(existing.id, data);
      addToast({ type: 'success', message: 'Logiciel mis à jour.' });
    } else {
      await logicielsService.create(data);
      addToast({ type: 'success', message: 'Logiciel client créé.' });
    }
    await load();
  }

  const columns = [
    { key: 'label', label: 'Libellé', sortable: true, render: r => (
      <button onClick={() => navigate(`/referentiels/logiciels/${r.id}`)} className="flex items-center gap-2.5 font-medium text-blue-800 hover:underline text-left">
        <LogoEditeur editeur={editeurDuProduit(r)} size={22} />
        {r.label}
      </button>
    ) },
    { key: 'editeur_label', label: 'Éditeur', sortable: true, render: r => r.editeur_label ?? '-' },
    { key: 'sku', label: 'SKU', render: r => r.sku ?? '-' },
    { key: 'source', label: 'Source', sortable: true, render: r => <SourceBadge source={r.source} /> },
    { key: 'niveau', label: 'Niveau', getValue: r => r.id_produit_parent ? 'Sous-produit' : 'Produit', render: r => r.id_produit_parent ? 'Sous-produit' : 'Produit' },
    { key: 'nb_versions', label: 'Nb versions', getValue: r => r.versions.length, render: r => r.versions.length },
    { key: 'nb_editions', label: 'Nb éditions', getValue: r => r.editions.length, render: r => r.editions.length },
    { key: 'nb_licences', label: 'Nb licences', sortable: true },
    { key: 'statut', label: 'Statut', render: r => r.source === 'client'
      ? <StatutValidationBadge statut={r.statut_validation} />
      : <Badge variant="neutral" label="Catalogue commun" /> },
  ];

  const entete = (
    <>
      <Breadcrumb items={[{ label: 'Référentiels' }, { label: 'Logiciels' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Logiciels</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {produits.length} produit{produits.length > 1 ? 's' : ''} au total (catalogue commun + logiciels client)
          </p>
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
            <Button variant="primary" onClick={() => setFormModal({ open: true, produit: null })} disabled={isLoading || !!error}>
              <Plus size={15} /> Nouveau logiciel client
            </Button>
          )}
        </div>
      </div>
    </>
  );

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {entete}
        <ErrorState message={error} status={errorStatus} onRetry={load} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {entete}
        <Skeleton height="h-16" />
        <Skeleton height="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {entete}

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterEditeur} onChange={e => setFilterEditeur(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les éditeurs</option>
          {editeurs.map(ed => <option key={ed.id} value={ed.id}>{ed.raison_sociale}</option>)}
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les sources</option>
          <option value="catalogue">Catalogue commun</option>
          <option value="client">Logiciel client</option>
        </select>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par libellé ou SKU..."
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
        />
      </div>

      {vueArbo ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          {racinesArbo.length === 0
            ? <EmptyState title="Aucun logiciel" description={produits.length ? 'Aucun logiciel ne correspond aux filtres.' : 'Aucun logiciel dans le référentiel.'} />
            : racinesArbo.map(p => <TreeNode key={p.id} produit={p} enfantsParParent={enfantsParParent} depth={0} navigate={navigate} />)
          }
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <DataTable
            columns={columns}
            data={filtered}
            filename="logiciels"
            emptyState={{
              message: produits.length ? 'Aucun logiciel ne correspond aux filtres.' : 'Aucun logiciel dans le référentiel.',
              ctaLabel: canWrite ? 'Nouveau logiciel client' : undefined,
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
        editeurs={editeurs}
      />
    </div>
  );
}
