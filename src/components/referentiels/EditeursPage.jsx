// EditeursPage - liste des editeurs (Referentiels).
// Donnees API : /editeurs. Les compteurs de produits et de contrats, ainsi que
// la conformite, sont servis par l'API : ils traversent les deux bases et ne
// sont jamais recalcules ici.
//
// Les contacts ne figurent plus dans cette liste : leur module n'est pas
// branche sur la base, et leurs identifiants de mock ne correspondent a aucun
// editeur reel. La colonne aurait affiche zero partout, ce qui se lit comme
// une information alors que c'en est l'absence.
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { editeursService } from '../../services/referentielsService';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Breadcrumb from '../ui/Breadcrumb';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import ValidationCell from './ValidationCell';
import ConformiteBadge from './ConformiteBadge';
import EditeurFormModal from './EditeurFormModal';
import LogoEditeur from './LogoEditeur';
import useRbac from '../../hooks/useRbac';
import useDebounce from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';

export default function EditeursPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite } = useRbac({ write: 'gerer_referentiels' });
  const [editeurs, setEditeurs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 300);
  const [formModal, setFormModal] = useState({ open: false, editeur: null });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      setEditeurs(await editeursService.list());
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

  const filtered = useMemo(() => {
    if (!debouncedSearch) return editeurs;
    const q = debouncedSearch.toLowerCase();
    return editeurs.filter(e =>
      e.raison_sociale.toLowerCase().includes(q) ||
      (e.pays ?? '').toLowerCase().includes(q));
  }, [editeurs, debouncedSearch]);

  // L'erreur remonte a la modale, qui garde sa saisie ouverte : un doublon de
  // raison sociale se corrige sur place, il ne fait pas perdre le formulaire.
  async function handleSave(data, existing) {
    if (existing) {
      await editeursService.update(existing.id, data);
      addToast({ type: 'success', message: 'Éditeur mis à jour.' });
    } else {
      await editeursService.create(data);
      addToast({ type: 'success', message: 'Éditeur créé.' });
    }
    await load();
  }

  const columns = [
    { key: 'raison_sociale', label: 'Raison sociale', sortable: true, render: r => (
      <button onClick={() => navigate(`/referentiels/editeurs/${r.id}`)} className="flex items-center gap-2.5 font-medium text-blue-800 hover:underline text-left">
        <LogoEditeur editeur={r} size={24} />
        {r.raison_sociale}
      </button>
    ) },
    { key: 'pays', label: 'Pays', sortable: true, render: r => r.pays ?? '-' },
    { key: 'nb_produits', label: 'Nb logiciels', sortable: true },
    { key: 'nb_contrats', label: 'Nb contrats', sortable: true },
    { key: 'conformite', label: 'Conformité', render: r => <ConformiteBadge conformite={r.conformite} /> },
    { key: 'statut_validation', label: 'Statut', sortable: true, render: r => (
      <ValidationCell statut={r.statut_validation} motif={r.message_refus} />
    ) },
  ];

  const entete = (
    <>
      <Breadcrumb items={[{ label: 'Référentiels' }, { label: 'Éditeurs' }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Éditeurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {editeurs.length} éditeur{editeurs.length > 1 ? 's' : ''} au total
          </p>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={() => setFormModal({ open: true, editeur: null })} disabled={isLoading || !!error}>
            <Plus size={15} /> Nouvel éditeur
          </Button>
        )}
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
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par raison sociale ou pays..."
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable
          columns={columns}
          data={filtered}
          filename="editeurs"
          emptyState={{
            message: editeurs.length
              ? 'Aucun éditeur ne correspond à la recherche.'
              : 'Aucun éditeur enregistré.',
            ctaLabel: canWrite ? 'Nouvel éditeur' : undefined,
            onCta: canWrite ? () => setFormModal({ open: true, editeur: null }) : undefined,
          }}
        />
      </div>

      <EditeurFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, editeur: null })}
        onSave={handleSave}
        editeur={formModal.editeur}
      />
    </div>
  );
}
