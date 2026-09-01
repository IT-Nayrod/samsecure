// RevendeurDetailPage - fiche detail d'un revendeur.
// Donnees API : /revendeurs/:id. Les compteurs de contrats, commandes et
// licences sont servis par l'API.
//
// Pas de suppression : quatre tables referencent un revendeur et doivent
// continuer de le nommer. Le retrait est une desactivation, reversible, qui le
// sort des selecteurs de saisie sans rien effacer.
//
// La section des contacts a ete retiree : leur module n'est pas branche et ses
// identifiants de mock ne correspondent a aucun revendeur reel.
import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Eye, EyeOff, Ban, RotateCcw } from 'lucide-react';
import { revendeursService } from '../../services/referentielsService';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import RevendeurFormModal from './RevendeurFormModal';
import ModalDoublonRevendeur from './ModalDoublonRevendeur';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';

// L'IBAN est une coordonnee bancaire : il ne s'affiche pas en clair par defaut,
// meme aux profils qui peuvent le modifier.
function maskIban(iban) {
  if (!iban) return '-';
  return `${iban.slice(0, 4)} **** **** **** ${iban.slice(-4)}`;
}

export default function RevendeurDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite } = useRbac({ write: 'gerer_referentiels' });
  const [revendeur, setRevendeur] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [etatOpen, setEtatOpen] = useState(false);
  const [ibanVisible, setIbanVisible] = useState(false);
  const [doublon, setDoublon] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      setRevendeur(await revendeursService.get(id));
    } catch (err) {
      setError(err.message);
      setErrorStatus(err.status);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data, existing) {
    try {
      await revendeursService.update(existing.id, data);
      addToast({ type: 'success', message: 'Revendeur mis à jour.' });
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

  async function changerEtat() {
    const desactiver = revendeur.actif;
    try {
      if (desactiver) await revendeursService.desactiver(id);
      else await revendeursService.reactiver(id);
      addToast({ type: 'success', message: desactiver ? 'Revendeur désactivé.' : 'Revendeur réactivé.' });
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  const fil = (
    <Breadcrumb items={[
      { label: 'Référentiels', to: '/referentiels/revendeurs' },
      { label: 'Revendeurs', to: '/referentiels/revendeurs' },
      { label: revendeur?.raison_sociale ?? '...' },
    ]} />
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {fil}
        <Skeleton height="h-20" />
        <Skeleton height="h-64" />
      </div>
    );
  }

  if (error) {
    if (errorStatus === 404) {
      return (
        <div className="flex flex-col gap-6">
          {fil}
          <EmptyState title="Revendeur introuvable" description="Ce revendeur n'existe pas." ctaLabel="Retour à la liste" onCta={() => navigate('/referentiels/revendeurs')} />
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-6">
        {fil}
        <ErrorState message={error} status={errorStatus} onRetry={load} />
      </div>
    );
  }

  const nbLiens = revendeur.nb_contrats + revendeur.nb_commandes + revendeur.nb_licences;

  return (
    <div className="flex flex-col gap-6">
      {fil}

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{revendeur.raison_sociale}</h1>
            <Badge variant={revendeur.actif ? 'success' : 'neutral'} label={revendeur.actif ? 'Actif' : 'Désactivé'} />
          </div>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}>
              <Pencil size={14} /> Éditer
            </Button>
            {revendeur.actif ? (
              <Button variant="destructive" size="sm" onClick={() => setEtatOpen(true)}>
                <Ban size={14} /> Désactiver
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setEtatOpen(true)}>
                <RotateCcw size={14} /> Réactiver
              </Button>
            )}
          </div>
        )}
      </div>

      {!revendeur.actif && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Revendeur désactivé. Il n&apos;est plus proposé à la saisie des contrats et des commandes,
          mais reste nommé par ceux qui le portent déjà.
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">SIRET</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">{revendeur.siret ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">IBAN</p>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-800 dark:text-gray-200 font-mono">
              {ibanVisible ? (revendeur.iban ?? '-') : maskIban(revendeur.iban)}
            </p>
            {revendeur.iban && (
              <button
                onClick={() => setIbanVisible(v => !v)}
                aria-label={ibanVisible ? 'Masquer l\'IBAN' : 'Afficher l\'IBAN'}
                className="text-gray-400 hover:text-gray-600"
              >
                {ibanVisible ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Email</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">{revendeur.email ?? '-'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Contrats ({revendeur.nb_contrats})</h2>
          {revendeur.nb_contrats === 0
            ? <p className="text-sm text-gray-500">Aucun contrat rattaché.</p>
            : <Link to={`/contrats/liste?revendeur=${revendeur.id}`} className="text-sm text-blue-800 hover:underline">Voir les contrats</Link>}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Commandes ({revendeur.nb_commandes})</h2>
          {revendeur.nb_commandes === 0
            ? <p className="text-sm text-gray-500">Aucune commande rattachée.</p>
            : <Link to={`/contrats/commandes?revendeur=${revendeur.id}`} className="text-sm text-blue-800 hover:underline">Voir les commandes</Link>}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Licences ({revendeur.nb_licences})</h2>
          {revendeur.nb_licences === 0
            ? <p className="text-sm text-gray-500">Aucune licence rattachée.</p>
            : <Link to={`/conformite/licences?revendeur=${revendeur.id}`} className="text-sm text-blue-800 hover:underline">Voir les licences</Link>}
        </section>
      </div>

      <RevendeurFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        revendeur={revendeur}
        onOuvrirExistant={(e) => { setDoublon(null); setFormOpen(false); navigate(`/referentiels/revendeurs/${e.id}`); }}
      />

      {doublon && (
        <ModalDoublonRevendeur
          doublon={doublon}
          onClose={() => setDoublon(null)}
          onOuvrirFiche={(e) => { setDoublon(null); setFormOpen(false); navigate(`/referentiels/revendeurs/${e.id}`); }}
        />
      )}

      <ConfirmModal
        isOpen={etatOpen}
        onClose={() => setEtatOpen(false)}
        onConfirm={changerEtat}
        title={revendeur.actif ? 'Désactiver le revendeur' : 'Réactiver le revendeur'}
        isDestructive={revendeur.actif}
        confirmLabel={revendeur.actif ? 'Désactiver' : 'Réactiver'}
        message={
          revendeur.actif
            ? `${revendeur.raison_sociale} ne sera plus proposé à la saisie.` +
              (nbLiens > 0
                ? ` Les ${nbLiens} élément${nbLiens > 1 ? 's' : ''} qui le portent déjà (contrats, commandes, licences) ne changent pas.`
                : '') +
              ' Cette action est réversible.'
            : `${revendeur.raison_sociale} sera de nouveau proposé à la saisie des contrats et des commandes.`
        }
      />
    </div>
  );
}