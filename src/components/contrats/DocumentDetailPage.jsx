// DocumentDetailPage - fiche détail d'une preuve.
// Unification de l'affichage (#215) : une seule forme de fiche, celle de la
// preuve, quel que soit son type documentaire. Une preuve support d'une facture
// (#204) porte id_facture : sa validation vise la facture, sa suppression passe
// par la facture (qui emporte la preuve et le fichier), rien de cela ne se
// voit. Le paramètre de requête ?ressource= des anciens liens est ignoré.
// Un ancien lien portant l'identifiant d'une facture (tableau de bord,
// dernières saisies du workflow) reste exploitable : la facture est lue puis la
// fiche bascule sur sa preuve support, les identifiants étant des UUID sans
// collision possible entre les deux tables.
// Badge et actions de validation sont branchés sur l'API depuis la #54.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Trash2, ExternalLink, Copy, Check, FileWarning, XCircle } from 'lucide-react';
import { preuvesService, facturesService } from '../../services/documentsService';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import DocumentIcon from './DocumentIcon';
import DocumentUploadField from './DocumentUploadField';
import { contratDeLaPreuve, idContratDeLaPreuve, cibleValidation, fichierDepose } from './preuveAffichage';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import StatutValidationBadge from '../referentiels/StatutValidationBadge';
import ValidationActions from '../referentiels/ValidationActions';
import useValidation from '../../hooks/useValidation';
import { appliquerStatut } from '../../services/validationService';

const FIL = [
  { label: 'Droits d\'usage', to: '/contrats/factures' },
  { label: 'Preuves', to: '/contrats/factures' },
];

function Champ({ label, children }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
      <div className="text-sm text-gray-900 dark:text-white">{children ?? '-'}</div>
    </div>
  );
}

export default function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canDelete, canValidate } = useRbac({ write: 'deposer_facture_preuve', validate: 'valider_saisie' });

  const [doc, setDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [ouverture, setOuverture] = useState(false);
  const [copie, setCopie] = useState(false);
  const [fichier, setFichier] = useState(null);
  const [depot, setDepot] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      try {
        setDoc(await preuvesService.get(id));
        return;
      } catch (err) {
        // Un 404 sur la preuve n'est pas une erreur : l'identifiant peut être
        // celui d'une facture (ancien lien). Toute autre panne remonte telle quelle.
        if (err.status !== 404) throw err;
      }
      try {
        const facture = await facturesService.get(id);
        if (facture?.id_preuve) {
          navigate(`/contrats/factures/${facture.id_preuve}`, { replace: true });
          return;
        }
      } catch (err) {
        if (err.status !== 404) throw err;
      }
      setError('Ce document n\'existe pas ou a été supprimé.');
    } catch (err) {
      setError(err.message);
      setErrorStatus(err.status);
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const appliquer = useCallback(reponse => setDoc(d => appliquerStatut(d, reponse)), []);
  const { valider, refuser } = useValidation(appliquer);

  // Le fichier est protégé par le jeton : un lien direct répondrait 401 puisque
  // le navigateur n'envoie pas d'en-tête Authorization sur une navigation. On
  // télécharge donc avec le jeton, puis on ouvre l'objet URL local, que le
  // lecteur natif du navigateur affiche comme n'importe quel PDF.
  async function ouvrirFichier() {
    setOuverture(true);
    try {
      const url = await preuvesService.fichierUrl(doc.id);
      window.open(url, '_blank', 'noopener');
      // Libération différée : révoquer immédiatement fermerait l'onglet avant
      // que le lecteur ait fini de lire le flux.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setOuverture(false);
    }
  }

  // Reprise du dépôt pour une preuve créée sans fichier : le cas se produit
  // quand le second appel du formulaire a échoué après la création réussie.
  // Sans ce point de reprise, la preuve resterait indéfiniment sans pièce.
  async function deposer() {
    setDepot(true);
    try {
      await preuvesService.deposerFichier(doc.id, fichier);
      addToast({ type: 'success', message: 'Fichier déposé.' });
      setFichier(null);
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setDepot(false);
    }
  }

  async function copierHash() {
    try {
      await navigator.clipboard.writeText(doc.hash_sha256);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      addToast({ type: 'error', message: 'Copie impossible depuis ce navigateur.' });
    }
  }

  // Suppression : par la facture quand la preuve en est le support (elle
  // emporte la preuve et le fichier, #204), par la preuve sinon. Le refus du
  // serveur fait foi, affiché tel quel.
  async function handleDelete() {
    try {
      if (doc.id_facture) await facturesService.remove(doc.id_facture);
      else await preuvesService.remove(doc.id);
      addToast({ type: 'success', message: 'Preuve supprimée.' });
      navigate('/contrats/factures');
    } catch (err) {
      addToast({ type: 'error', message: err.message });
      setDeleteOpen(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[...FIL, { label: 'Chargement' }]} />
        <Skeleton lines={6} />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[...FIL, { label: 'Introuvable' }]} />
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <ErrorState message={error} status={errorStatus} onRetry={load} />
        </div>
      </div>
    );
  }

  const cible = cibleValidation(doc);
  const depose = fichierDepose(doc) && !!doc.hash_sha256;
  const contratAffiche = contratDeLaPreuve(doc);
  const idContrat = idContratDeLaPreuve(doc);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[...FIL, { label: doc.label }]} />

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <DocumentIcon nomFichier={doc.nom_origine || doc.url_fichier} size={44} />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{doc.label}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{doc.type_label ?? 'Preuve'}</p>
            <div className="mt-1.5"><StatutValidationBadge statut={doc.statut_validation} /></div>
          </div>
        </div>
        <div className="flex gap-2">
          {canValidate && <ValidationActions
            statut={doc.statut_validation}
            onValidate={() => valider(cible.entite, cible.id)}
            onRefuse={motif => refuser(cible.entite, cible.id, motif)}
          />}
          {depose && (
            <Button variant="primary" onClick={ouvrirFichier} isLoading={ouverture}>
              <ExternalLink size={15} /> Ouvrir le fichier
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={15} /> Supprimer
            </Button>
          )}
        </div>
      </div>

      {doc.statut_validation === 'refuse' && doc.message_refus && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <XCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Saisie refusée</p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">{doc.message_refus}</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 grid grid-cols-2 md:grid-cols-3 gap-5">
        <Champ label="Libellé">{doc.label}</Champ>
        <Champ label="Type">{doc.type_label}</Champ>
        <Champ label="Déposé le">{formatDate(doc.created_at)}</Champ>
        <Champ label="Nom du fichier d'origine">{doc.nom_origine}</Champ>
        <Champ label="Contrat">
          {idContrat
            ? <Link to={`/contrats/liste/${idContrat}`} className="text-blue-800 hover:underline">{contratAffiche}</Link>
            : null}
        </Champ>
        <Champ label="Commande">
          {doc.id_commande
            ? <Link to={`/contrats/commandes/${doc.id_commande}`} className="text-blue-800 hover:underline">{doc.commande_label}</Link>
            : null}
        </Champ>
        <Champ label="Licence">
          {doc.id_licence
            ? <Link to={`/conformite/licences/${doc.id_licence}`} className="text-blue-800 hover:underline">{doc.licence_label ?? 'Licence'}</Link>
            : null}
        </Champ>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Empreinte du fichier</h2>
        {depose ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs font-mono bg-gray-50 dark:bg-gray-900/60 text-gray-800 dark:text-gray-200 px-3 py-2 rounded-lg break-all">
                {doc.hash_sha256}
              </code>
              <button onClick={copierHash} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-2" aria-label="Copier l'empreinte">
                {copie ? <><Check size={14} className="text-green-600" /> Copié</> : <><Copy size={14} /> Copier</>}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Empreinte SHA-256 calculée au dépôt. Elle prouve en audit que le fichier servi est
              exactement celui qui a été déposé.
            </p>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <FileWarning size={15} className="text-amber-500" />
              Aucun fichier n&apos;a encore été déposé pour cette preuve.
            </p>
            {canWrite && (
              <>
                <DocumentUploadField file={fichier} onChange={setFichier} disabled={depot} />
                <div>
                  <Button variant="primary" onClick={deposer} isLoading={depot} disabled={!fichier}>
                    Déposer le fichier
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer cette preuve ?"
        message="Le fichier associé sera également supprimé. Cette action est irréversible."
        confirmLabel="Supprimer"
        isDestructive
      />
    </div>
  );
}
