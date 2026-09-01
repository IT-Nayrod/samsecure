// ProduitDetailPage - fiche detail d'un logiciel.
// Donnees API : /logiciels/:id. La hierarchie, les declinaisons, le nombre de
// licences et le caractere supprimable sont servis par l'API.
//
// Un produit du catalogue commun se consulte mais ne se modifie pas depuis un
// espace client : l'API refuse toute ecriture le visant, et modifiable porte
// cette regle jusqu'a l'ecran.
import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2, Plus, X } from 'lucide-react';
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
import useRbac from '../../hooks/useRbac';
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
  const [produit, setProduit] = useState(null);
  const [tousProduits, setTousProduits] = useState([]);
  const [editeurs, setEditeurs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [newEdition, setNewEdition] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      // La fiche est indispensable. La liste complete alimente le selecteur de
      // parent du formulaire, les editeurs son selecteur d'editeur : un droit
      // manquant sur eux prive de ces commodites, pas de la fiche.
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

  // Les quatre gestes de declinaison partagent leur traitement d'erreur : le
  // message du serveur, doublon compris, part en toast et la fiche est
  // rechargee pour rester alignee sur la base.
  async function gesteDeclinaison(action, succes) {
    try {
      await action();
      addToast({ type: 'success', message: succes });
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  const ajouterVersion = () => gesteDeclinaison(
    async () => { await logicielsService.addVersion(id, newVersion.trim()); setNewVersion(''); },
    'Version ajoutée.');
  const retirerVersion = (idVersion) => gesteDeclinaison(
    () => logicielsService.removeVersion(id, idVersion), 'Version supprimée.');
  const ajouterEdition = () => gesteDeclinaison(
    async () => { await logicielsService.addEdition(id, newEdition.trim()); setNewEdition(''); },
    'Édition ajoutée.');
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
          Catalogue commun, non modifiable. Ce produit est partagé par tous les clients SamSecure.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Hiérarchie</h2>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Produit parent</p>
              {produit.id_produit_parent
                ? <Link to={`/referentiels/logiciels/${produit.id_produit_parent}`} className="text-sm text-blue-800 hover:underline">{produit.parent_label ?? 'Produit parent'}</Link>
                : <p className="text-sm text-gray-500">Aucun (produit racine)</p>
              }
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Sous-produits ({enfants.length})</p>
              {enfants.length === 0
                ? <p className="text-sm text-gray-500">Aucun sous-produit.</p>
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
                  <span className="text-sm text-gray-700 dark:text-gray-300">{v.label}</span>
                  {!isCatalogue && canWrite && (
                    <button onClick={() => retirerVersion(v.id)} aria-label="Supprimer la version" className="text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
          </div>
          {!isCatalogue && canWrite && (
            <div className="flex gap-2">
              <input
                value={newVersion}
                onChange={e => setNewVersion(e.target.value)}
                placeholder="Nouvelle version..."
                className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button variant="secondary" size="sm" onClick={ajouterVersion} disabled={!newVersion.trim()}>
                <Plus size={14} /> Ajouter
              </Button>
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Éditions ({editions.length})</h2>
          <div className="flex flex-col gap-1.5 mb-3">
            {editions.length === 0
              ? <p className="text-sm text-gray-500">Aucune édition enregistrée.</p>
              : editions.map(e => (
                <div key={e.id} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{e.label}</span>
                  {!isCatalogue && canWrite && (
                    <button onClick={() => retirerEdition(e.id)} aria-label="Supprimer l'édition" className="text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
          </div>
          {!isCatalogue && canWrite && (
            <div className="flex gap-2">
              <input
                value={newEdition}
                onChange={e => setNewEdition(e.target.value)}
                placeholder="Nouvelle édition..."
                className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button variant="secondary" size="sm" onClick={ajouterEdition} disabled={!newEdition.trim()}>
                <Plus size={14} /> Ajouter
              </Button>
            </div>
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
