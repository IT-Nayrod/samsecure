// RevendeursPage - liste des revendeurs (Referentiels).
// Donnees API : /revendeurs. Les compteurs de contrats, commandes et licences
// sont servis par l'API et ne sont jamais recalcules ici.
//
// Les desactives sont masques par defaut, comme cote serveur : un revendeur
// retire du catalogue n'a pas a encombrer la liste courante. Une case les
// ramene, la colonne Statut permettant de les distinguer.
//
// La colonne "Nb contacts" a ete retiree : le module contacts n'est pas branche
// et ses identifiants de mock ne correspondent a aucun revendeur reel. Elle
// aurait affiche zero partout, ce qui se lit comme une information alors que
// c'en est l'absence.
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { revendeursService } from '../../services/referentielsService';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Breadcrumb from '../ui/Breadcrumb';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import RevendeurFormModal from './RevendeurFormModal';
import ModalDoublonRevendeur from './ModalDoublonRevendeur';
import useRbac from '../../hooks/useRbac';
import useDebounce from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';

export default function RevendeursPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite } = useRbac({ write: 'gerer_referentiels' });
  const [revendeurs, setRevendeurs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [afficherInactifs, setAfficherInactifs] = useState(false);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 300);
  const [formModal, setFormModal] = useState({ open: false, revendeur: null });
  const [doublon, setDoublon] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      setRevendeurs(await revendeursService.list({ inclureInactifs: afficherInactifs }));
    } catch (err) {
      setError(err.message);
      setErrorStatus(err.status);
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afficherInactifs]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return revendeurs;
    const q = debouncedSearch.toLowerCase();
    return revendeurs.filter(r =>
      r.raison_sociale.toLowerCase().includes(q) ||
      (r.siret ?? '').includes(q) ||
      (r.email ?? '').toLowerCase().includes(q));
  }, [revendeurs, debouncedSearch]);

  // Le 409 de doublon n'est pas une erreur a jeter en toast : il porte
  // l'existant, et c'est lui qui interesse l'utilisateur. L'erreur est relancee
  // pour que le formulaire reste ouvert et garde la saisie.
  async function handleSave(data, existing) {
    try {
      if (existing) {
        await revendeursService.update(existing.id, data);
        addToast({ type: 'success', message: 'Revendeur mis à jour.' });
      } else {
        await revendeursService.create(data);
        addToast({ type: 'success', message: 'Revendeur créé.' });
      }
      await load();
    } catch (err) {
      if (err?.status === 409 && err?.details?.existant) {
        setDoublon({ existant: err.details.existant, motif: err.details.motif });
      } else if (err?.status !== 400) {
        addToast({ type: 'error', message: err.message });
      }
      throw err;
    }
  }

  function ouvrirExistant(existant) {
    setDoublon(null);
    setFormModal({ open: false, revendeur: null });
    navigate(`/referentiels/revendeurs/${existant.id}`);
  }

  async function reactiverExistant(existant) {
    try {
      await revendeursService.reactiver(existant.id);
      addToast({ type: 'success', message: 'Revendeur réactivé.' });
      setDoublon(null);
      setFormModal({ open: false, revendeur: null });
      await load();
      navigate(`/referentiels/revendeurs/${existant.id}`);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  const columns = [
    { key: 'raison_sociale', label: 'Raison sociale', sortable: true, render: r => (
      <button onClick={() => navigate(`/referentiels/revendeurs/${r.id}`)} className="font-medium text-blue-800 hover:underline text-left">
        {r.raison_sociale}
      </button>
    ) },
    { key: 'siret', label: 'SIRET', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'nb_contrats', label: 'Nb contrats', sortable: true },
    { key: 'nb_commandes', label: 'Nb commandes', sortable: true },
    { key: 'nb_licences', label: 'Nb licences', sortable: true },
    { key: 'actif', label: 'Statut', sortable: true, render: r => (
      <Badge variant={r.actif ? 'success' : 'neutral'} label={r.actif ? 'Actif' : 'Désactivé'} />
    ) },
  ];

  const entete = (
    <>
      <Breadcrumb items={[{ label: 'Référentiels' }, { label: 'Revendeurs' }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Revendeurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {revendeurs.length} revendeur{revendeurs.length > 1 ? 's' : ''}
            {afficherInactifs ? ' au total, désactivés compris' : ' actif' + (revendeurs.length > 1 ? 's' : '')}
          </p>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={() => setFormModal({ open: true, revendeur: null })} disabled={isLoading || !!error}>
            <Plus size={15} /> Nouveau revendeur
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

      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par raison sociale, SIRET ou email..."
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={afficherInactifs}
            onChange={e => setAfficherInactifs(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Afficher les désactivés
        </label>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable
          columns={columns}
          data={filtered}
          filename="revendeurs"
          emptyState={{
            message: revendeurs.length
              ? 'Aucun revendeur ne correspond à la recherche.'
              : 'Aucun revendeur enregistré.',
            ctaLabel: canWrite ? 'Nouveau revendeur' : undefined,
            onCta: canWrite ? () => setFormModal({ open: true, revendeur: null }) : undefined,
          }}
        />
      </div>

      <RevendeurFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, revendeur: null })}
        onSave={handleSave}
        revendeur={formModal.revendeur}
        onOuvrirExistant={ouvrirExistant}
      />

      {doublon && (
        <ModalDoublonRevendeur
          doublon={doublon}
          onClose={() => setDoublon(null)}
          onOuvrirFiche={ouvrirExistant}
          onReactiver={canWrite ? reactiverExistant : undefined}
        />
      )}
    </div>
  );
}