// ProduitDetailPage - fiche détail d'un logiciel.
// Données API : /logiciels/:id. La hiérarchie, les déclinaisons, le nombre de
// licences et le caractère supprimable sont servis par l'API.
//
// Un produit du catalogue commun se consulte mais ne se modifie pas depuis un
// espace client : l'API refuse toute écriture le visant, et modifiable porte
// cette règle jusqu'à l'écran.
//
// #217 : versions et éditions s'ajoutent depuis la fiche dans les deux cas,
// par le geste des formulaires licence et maintenance (LicenceDeclinaisonAjout).
// Logiciel du catalogue : complément du client (POST /produits/:id/versions et
// /editions, droit saisir_licence, celui que la route exige). Logiciel créé
// localement : routes /logiciels/:id/versions et /editions (gerer_referentiels).
// Avant ce ticket, la fiche d'un logiciel du catalogue n'offrait aucun ajout et
// n'affichait pas les compléments saisis ailleurs.
import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2, X } from 'lucide-react';
import { logicielsService, editeursService, editeurDuProduit } from '../../services/referentielsService';
import { optionnel } from '../../services/http';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import StatutValidationBadge from './StatutValidationBadge';
import ValidationActions from './ValidationActions';
import ProduitFormModal from './ProduitFormModal';
import LogoEditeur from './LogoEditeur';
import LicenceDeclinaisonAjout from '../deploiement/LicenceDeclinaisonAjout';
import useRbac from '../../hooks/useRbac';
import useAuth from '../../hooks/useAuth';
import useValidation from '../../hooks/useValidation';
import { appliquerStatut } from '../../services/validationService';
import { useToast } from '../../hooks/useToast';

export default function ProduitDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canValidate, canDelete } = useRbac({
    write: 'gerer_referentiels', validate: 'valider_saisie',
  });
  const { hasPermission } = useAuth();
  const [produit, setProduit] = useState(null);
  const [tousProduits, setTousProduits] = useState([]);
  const [editeurs, setEditeurs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      // La fiche est indispensable. La liste complète alimente le sélecteur de
      // parent du formulaire, les éditeurs son sélecteur d'éditeur : un droit
      // manquant sur eux prive de ces commodités, pas de la fiche.
      const [p, tous, e] = await Promise.all([
        logicielsService.get(id),
        optionnel(logicielsService.list()),
        optionnel(editeursService.list()),
      ]);
      setProduit(p);
      setTousProduits(tous);
      setEditeurs(e);
    } catch (err) {
      setError(err.message);
      setErrorStatus(err.status);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const appliquer = useCallback(reponse => {
    setProduit(prev => prev ? appliquerStatut(prev, reponse) : prev);
  }, []);
  const { valider, refuser } = useValidation(appliquer);

  async function handleSave(data, existing) {
    await logicielsService.update(existing.id, data);
    addToast({ type: 'success', message: 'Logiciel mis à jour.' });
    await load();
  }

  async function handleDelete() {
    try {
      await logicielsService.remove(id);
      addToast({ type: 'success', message: 'Logiciel supprimé.' });
      navigate('/referentiels/logiciels');
    } catch (err) {
      setDeleteOpen(false);
      addToast({ type: 'error', message: err.message });
    }
  }

  // Les retraits de déclinaison partagent leur traitement d'erreur : le
  // message du serveur part en toast et la fiche est rechargée pour rester
  // alignée sur la base. L'ajout est porté par LicenceDeclinaisonAjout.
  async function gesteDeclinaison(action, succes) {
    try {
      await action();
      addToast({ type: 'success', message: succes });
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  const retirerVersion = (idVersion) => gesteDeclinaison(
    () => logicielsService.removeVersion(id, idVersion), 'Version supprimée.');
  const retirerEdition = (idEdition) => gesteDeclinaison(
    () => logicielsService.removeEdition(id, idEdition), 'Édition supprimée.');

  const fil = (
    <Breadcrumb items={[
      { label: 'Référentiels', to: '/referentiels/logiciels' },
      { label: 'Logiciels', to: '/referentiels/logiciels' },
      { label: produit?.label ?? '...' },
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
          <EmptyState title="Logiciel introuvable" description="Ce logiciel n'existe pas ou a été supprimé." ctaLabel="Retour à la liste" onCta={() => navigate('/referentiels/logiciels')} />
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

  const isCatalogue = !produit.modifiable;
  const enfants = produit.enfants ?? [];
  const versions = produit.versions ?? [];
  const editions = produit.editions ?? [];
  // Le droit affiché est celui que la route exige : complément du catalogue
  // sous saisir_licence, déclinaison d'un logiciel client sous
  // gerer_referentiels. Un bouton visible ne mène jamais à un refus.
  const peutAjouterDeclinaison = isCatalogue ? hasPermission('saisir_licence') : canWrite;
  const ajoutVersion = isCatalogue ? null : logicielsService.addVersion;
  const ajoutEdition = isCatalogue ? null : logicielsService.addEdition;

  return (
    <div className="flex flex-col gap-6">
      {fil}

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <LogoEditeur editeur={editeurDuProduit(produit)} size={48} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{produit.label}</h1>
              <Badge variant={isCatalogue ? 'neutral' : 'success'} label={isCatalogue ? 'Catalogue' : 'Client'} />
              {!isCatalogue && <StatutValidationBadge statut={produit.statut_validation} />}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {produit.editeur_label ?? 'Aucun éditeur'}{produit.sku ? ` - SKU ${produit.sku}` : ''}
            </p>
            {!isCatalogue && produit.statut_validation === 'refuse' && produit.message_refus && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">Motif du refus : {produit.message_refus}</p>
            )}
            {!isCatalogue && produit.soumis_par && (
              <p className="text-xs text-gray-400 mt-1">Soumis par {produit.soumis_par}</p>
            )}
          </div>
        </div>
        {!isCatalogue && (
          <div className="flex items-center gap-2 flex-wrap">
            {canValidate && (
              <ValidationActions
                statut={produit.statut_validation}
                onValidate={() => valider('produit_client', produit.id)}
                onRefuse={motif => refuser('produit_client', produit.id, motif)}
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
        )}
      </div>

      {isCatalogue && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Catalogue commun : ce logiciel est partagé par tous les clients SamSecure, sa fiche n'est pas modifiable. Les versions et éditions que vous ajoutez restent propres à votre espace.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Hiérarchie</h2>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Logiciel parent</p>
              {produit.id_produit_parent
                ? <Link to={`/referentiels/logiciels/${produit.id_produit_parent}`} className="text-sm text-blue-800 hover:underline">{produit.parent_label ?? 'Logiciel parent'}</Link>
                : <p className="text-sm text-gray-500">Aucun (logiciel racine)</p>
              }
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Sous-logiciels ({enfants.length})</p>
              {enfants.length === 0
                ? <p className="text-sm text-gray-500">Aucun sous-logiciel.</p>
                : (
                  <ul className="flex flex-col gap-1">
                    {enfants.map(e => (
                      <li key={e.id}><Link to={`/referentiels/logiciels/${e.id}`} className="text-sm text-blue-800 hover:underline">{e.label}</Link></li>
                    ))}
                  </ul>
                )}
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Licences liées ({produit.nb_licences})</h2>
          {produit.nb_licences === 0
            ? <p className="text-sm text-gray-500">Aucune licence ne référence ce logiciel.</p>
            : <Link to={`/conformite/licences?produit=${produit.id}`} className="text-sm text-blue-800 hover:underline">Voir les {produit.nb_licences} licence{produit.nb_licences > 1 ? 's' : ''} liée{produit.nb_licences > 1 ? 's' : ''}</Link>
          }
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Versions ({versions.length})</h2>
          <div className="flex flex-col gap-1.5 mb-3">
            {versions.length === 0
              ? <p className="text-sm text-gray-500">Aucune version enregistrée.</p>
              : versions.map(v => (
                <div key={v.id} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {v.label}
                    {v.source === 'complement' && <span className="ml-2 text-xs text-gray-400">Ajoutée par votre espace</span>}
                  </span>
                  {!isCatalogue && canWrite && (
                    <button onClick={() => retirerVersion(v.id)} aria-label="Supprimer la version" className="text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
          </div>
          {peutAjouterDeclinaison && (
            <LicenceDeclinaisonAjout type="versions" idProduit={produit.id} onAjout={load} ajouter={ajoutVersion} />
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Éditions ({editions.length})</h2>
          <div className="flex flex-col gap-1.5 mb-3">
            {editions.length === 0
              ? <p className="text-sm text-gray-500">Aucune édition enregistrée.</p>
              : editions.map(e => (
                <div key={e.id} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {e.label}
                    {e.source === 'complement' && <span className="ml-2 text-xs text-gray-400">Ajoutée par votre espace</span>}
                  </span>
                  {!isCatalogue && canWrite && (
                    <button onClick={() => retirerEdition(e.id)} aria-label="Supprimer l'édition" className="text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
          </div>
          {peutAjouterDeclinaison && (
            <LicenceDeclinaisonAjout type="editions" idProduit={produit.id} onAjout={load} ajouter={ajoutEdition} />
          )}
        </section>
      </div>

      {!isCatalogue && (
        <ProduitFormModal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
          produit={produit}
          allProduits={tousProduits}
          editeurs={editeurs}
        />
      )}

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={produit.supprimable ? handleDelete : () => setDeleteOpen(false)}
        title="Supprimer le logiciel"
        isDestructive={produit.supprimable}
        confirmLabel={produit.supprimable ? 'Supprimer' : 'Compris'}
        message={
          produit.supprimable
            ? `Supprimer définitivement ${produit.label} ? Cette action est irréversible.`
            : `Suppression impossible : ${produit.label} est rattaché à ${produit.nb_licences} licence${produit.nb_licences > 1 ? 's' : ''} et ${enfants.length} sous-produit${enfants.length > 1 ? 's' : ''}. Détachez ou supprimez d'abord ces éléments.`
        }
      />
    </div>
  );
}
