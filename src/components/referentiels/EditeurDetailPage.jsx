// EditeurDetailPage - fiche detail d'un editeur.
// Donnees API : /editeurs/:id. Les logiciels rattaches, le nombre de contrats,
// la conformite et le caractere supprimable sont servis par l'API : ils
// traversent les deux bases et ne sont jamais recalcules ici.
//
// La section des contacts a ete retiree : leur module n'est pas branche sur la
// base et ses identifiants de mock ne correspondent a aucun editeur reel. Elle
// aurait affiche "aucun contact" quoi qu'il arrive.
import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { editeursService } from '../../services/referentielsService';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import StatutValidationBadge from './StatutValidationBadge';
import ConformiteBadge from './ConformiteBadge';
import ValidationActions from './ValidationActions';
import EditeurFormModal from './EditeurFormModal';
import LogoEditeur from './LogoEditeur';
import useRbac from '../../hooks/useRbac';
import useValidation from '../../hooks/useValidation';
import { appliquerStatut } from '../../services/validationService';
import { useToast } from '../../hooks/useToast';

export default function EditeurDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canValidate, canDelete } = useRbac({
    write: 'gerer_referentiels', validate: 'valider_saisie',
  });
  const [editeur, setEditeur] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [blocage, setBlocage] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      setEditeur(await editeursService.get(id));
    } catch (err) {
      setError(err.message);
      setErrorStatus(err.status);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // La reponse de traitement porte les trois champs de statut servis par le
  // detail : l'appliquer suffit, recharger la fiche serait inutile.
  const appliquer = useCallback(reponse => {
    setEditeur(prev => prev ? appliquerStatut(prev, reponse) : prev);
  }, []);
  const { valider, refuser } = useValidation(appliquer);

  async function handleSave(data, existing) {
    await editeursService.update(existing.id, data);
    addToast({ type: 'success', message: 'Éditeur mis à jour.' });
    await load();
  }

  async function handleDelete() {
    try {
      await editeursService.remove(id);
      addToast({ type: 'success', message: 'Éditeur supprimé.' });
      navigate('/referentiels/editeurs');
    } catch (err) {
      // 409 : rattachements. Le message du serveur enumere ce qui bloque, il
      // remplace la modale de confirmation plutot que de la doubler.
      setDeleteOpen(false);
      setBlocage(err.message);
      addToast({ type: 'error', message: err.message });
    }
  }

  const fil = (
    <Breadcrumb items={[
      { label: 'Référentiels', to: '/referentiels/editeurs' },
      { label: 'Éditeurs', to: '/referentiels/editeurs' },
      { label: editeur?.raison_sociale ?? '...' },
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
    // 404 : l'editeur n'existe pas ou a ete supprime depuis un autre onglet.
    if (errorStatus === 404) {
      return (
        <div className="flex flex-col gap-6">
          {fil}
          <EmptyState title="Éditeur introuvable" description="Cet éditeur n'existe pas ou a été supprimé." ctaLabel="Retour à la liste" onCta={() => navigate('/referentiels/editeurs')} />
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

  const produits = editeur.produits ?? [];

  return (
    <div className="flex flex-col gap-6">
      {fil}

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <LogoEditeur editeur={editeur} size={48} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{editeur.raison_sociale}</h1>
              <StatutValidationBadge statut={editeur.statut_validation} />
              <ConformiteBadge conformite={editeur.conformite} />
            </div>
            {editeur.pays && <p className="text-sm text-gray-500 mt-1">{editeur.pays}</p>}
            {editeur.statut_validation === 'refuse' && editeur.message_refus && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">Motif du refus : {editeur.message_refus}</p>
            )}
            {editeur.soumis_par && (
              <p className="text-xs text-gray-400 mt-1">Soumis par {editeur.soumis_par}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canValidate && (
            <ValidationActions
              statut={editeur.statut_validation}
              onValidate={() => valider('editeur', editeur.id)}
              onRefuse={motif => refuser('editeur', editeur.id, motif)}
            />
          )}
          {canWrite && (
            <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}>
              <Pencil size={14} /> Éditer
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={14} /> Supprimer
            </Button>
          )}
        </div>
      </div>

      {blocage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{blocage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Logiciels associés ({produits.length})</h2>
          {produits.length === 0
            ? <p className="text-sm text-gray-500">Aucun logiciel rattaché.</p>
            : (
              <ul className="flex flex-col gap-1.5">
                {produits.map(p => (
                  <li key={p.id} className="flex items-center gap-2">
                    <Link to={`/referentiels/logiciels/${p.id}`} className="text-sm text-blue-800 hover:underline">{p.label}</Link>
                    {p.sku && <span className="text-xs text-gray-400">{p.sku}</span>}
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Contrats associés ({editeur.nb_contrats})</h2>
          {editeur.nb_contrats === 0
            ? <p className="text-sm text-gray-500">Aucun contrat rattaché.</p>
            : (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {editeur.nb_contrats} contrat{editeur.nb_contrats > 1 ? 's' : ''} rattaché{editeur.nb_contrats > 1 ? 's' : ''}.
                </p>
                <Link to={`/contrats/liste?editeur=${editeur.id}`} className="text-sm text-blue-800 hover:underline">Voir les contrats</Link>
              </div>
            )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Synthèse conformité</h2>
          <div className="flex flex-col gap-2">
            <ConformiteBadge conformite={editeur.conformite} />
            {editeur.conformite
              ? (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {editeur.conformite.usage_declare} usage{editeur.conformite.usage_declare > 1 ? 's' : ''} déclaré{editeur.conformite.usage_declare > 1 ? 's' : ''} pour {editeur.conformite.droits} droit{editeur.conformite.droits > 1 ? 's' : ''} acquis.
                </p>
              )
              : <p className="text-sm text-gray-500">Aucun logiciel de cet éditeur ne porte de licence : il n&apos;y a rien à rapprocher.</p>}
            <Link to={`/conformite/licences?editeur=${editeur.id}`} className="text-sm text-blue-800 hover:underline">Voir le détail dans le Dashboard</Link>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Informations</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Pays</dt>
              <dd className="text-gray-700 dark:text-gray-300">{editeur.pays ?? '-'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Taux de hausse annuelle</dt>
              <dd className="text-gray-700 dark:text-gray-300">
                {editeur.taux_hausse_annuelle === null ? 'Défaut du tenant' : `${editeur.taux_hausse_annuelle} %`}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <EditeurFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} editeur={editeur} />

      {/* supprimable vient de l'API, qui compte les rattachements des deux
          bases. Quand il est faux, la modale explique le blocage au lieu de
          proposer une action qui finirait en 409. */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={editeur.supprimable ? handleDelete : () => setDeleteOpen(false)}
        title="Supprimer l'éditeur"
        isDestructive={editeur.supprimable}
        confirmLabel={editeur.supprimable ? 'Supprimer' : 'Compris'}
        message={
          editeur.supprimable
            ? `Supprimer définitivement ${editeur.raison_sociale} ? Cette action est irréversible.`
            : `Suppression impossible : ${editeur.raison_sociale} est rattaché à ${produits.length} logiciel${produits.length > 1 ? 's' : ''} et ${editeur.nb_contrats} contrat${editeur.nb_contrats > 1 ? 's' : ''}. Détachez ou supprimez d'abord ces éléments.`
        }
      />
    </div>
  );
}
