// DocumentDetailPage - fiche detail d'une preuve ou d'une facture.
// La ressource est portee par le parametre de requete, la liste unifiee la
// transmet en naviguant. Un lien copie sans ce parametre reste exploitable :
// on tente la preuve puis la facture, les identifiants etant des UUID sans
// collision possible entre les deux tables.
// Badge et actions de validation ont disparu avec le mock : ils reviennent
// avec la story #19, decision de sequencement inchangee.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Trash2, ExternalLink, Copy, Check, FileWarning } from 'lucide-react';
import { preuvesService, facturesService } from '../../services/documentsService';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import DocumentIcon from './DocumentIcon';
import DocumentUploadField from './DocumentUploadField';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';

const FIL = [
  { label: 'Droits d\'usage', to: '/contrats/factures' },
  { label: 'Factures & Preuves', to: '/contrats/factures' },
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
  const { canWrite, canDelete } = useRbac();
  const [searchParams] = useSearchParams();

  const [doc, setDoc] = useState(null);
  const [ressource, setRessource] = useState(searchParams.get('ressource'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [ouverture, setOuverture] = useState(false);
  const [copie, setCopie] = useState(false);
  const [fichier, setFichier] = useState(null);
  const [depot, setDepot] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const demandee = searchParams.get('ressource');
    const ordre = demandee === 'facture' ? ['facture', 'preuve'] : ['preuve', 'facture'];
    try {
      for (const r of ordre) {
        try {
          const data = r === 'preuve' ? await preuvesService.get(id) : await facturesService.get(id);
          setDoc(data);
          setRessource(r);
          return;
        } catch (err) {
          // Un 404 sur la premiere ressource n'est pas une erreur : on essaie
          // l'autre. Toute autre panne remonte telle quelle.
          if (err.status !== 404) throw err;
        }
      }
      setError('Ce document n\'existe pas ou a ete supprime.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [id, searchParams]);

  useEffect(() => { load(); }, [load]);

  const estPreuve = ressource === 'preuve';

  // Le fichier est protege par le jeton : un lien direct repondrait 401 puisque
  // le navigateur n'envoie pas d'en-tete Authorization sur une navigation. On
  // telecharge donc avec le jeton, puis on ouvre l'objet URL local, que le
  // lecteur natif du navigateur affiche comme n'importe quel PDF.
  async function ouvrirFichier() {
    setOuverture(true);
    try {
      const url = await preuvesService.fichierUrl(doc.id);
      window.open(url, '_blank', 'noopener');
      // Liberation differee : revoquer immediatement fermerait l'onglet avant
      // que le lecteur ait fini de lire le flux.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setOuverture(false);
    }
  }

  // Reprise du depot pour une preuve creee sans fichier : le cas se produit
  // quand le second appel du formulaire a echoue apres la creation reussie.
  // Sans ce point de reprise, la preuve resterait indefiniment sans piece.
  async function deposer() {
    setDepot(true);
    try {
      await preuvesService.deposerFichier(doc.id, fichier);
      addToast({ type: 'success', message: 'Fichier depose.' });
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

  async function handleDelete() {
    try {
      if (estPreuve) await preuvesService.remove(doc.id);
      else await facturesService.remove(doc.id);
      addToast({ type: 'success', message: estPreuve ? 'Preuve supprimee.' : 'Facture supprimee.' });
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
          <ErrorState message={error} onRetry={load} />
        </div>
      </div>
    );
  }

  const fichierDepose = estPreuve && !!doc.hash_sha256;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[...FIL, { label: doc.label }]} />

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <DocumentIcon nomFichier={estPreuve ? (doc.nom_origine || doc.url_fichier) : doc.preuve_url_fichier} size={44} />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{doc.label}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {estPreuve ? `Preuve${doc.type_label ? ` - ${doc.type_label}` : ''}` : 'Facture'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {estPreuve && fichierDepose && (
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

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 grid grid-cols-2 md:grid-cols-3 gap-5">
        <Champ label="Libelle">{doc.label}</Champ>
        <Champ label="Depose le">{formatDate(doc.created_at)}</Champ>

        {estPreuve ? (
          <>
            <Champ label="Type de preuve">{doc.type_label}</Champ>
            <Champ label="Nom du fichier d'origine">{doc.nom_origine}</Champ>
            <Champ label="Contrat rattache">
              {doc.id_contrat
                ? <Link to={`/contrats/liste/${doc.id_contrat}`} className="text-blue-800 hover:underline">{doc.contrat_label}</Link>
                : null}
            </Champ>
            <Champ label="Commande rattachee">
              {doc.id_commande
                ? <Link to={`/contrats/commandes/${doc.id_commande}`} className="text-blue-800 hover:underline">{doc.commande_label}</Link>
                : null}
            </Champ>
            <Champ label="Factures liees">{doc.nb_factures > 0 ? `${doc.nb_factures} facture(s)` : 'Aucune'}</Champ>
          </>
        ) : (
          <>
            <Champ label="Commande">
              {doc.id_commande
                ? <Link to={`/contrats/commandes/${doc.id_commande}`} className="text-blue-800 hover:underline">{doc.commande_label}</Link>
                : null}
            </Champ>
            <Champ label="Contrat">
              {doc.id_contrat
                ? <Link to={`/contrats/liste/${doc.id_contrat}`} className="text-blue-800 hover:underline">{doc.contrat_label}</Link>
                : null}
            </Champ>
            <Champ label="Preuve liee">
              {doc.id_preuve
                ? <Link to={`/contrats/factures/${doc.id_preuve}?ressource=preuve`} className="text-blue-800 hover:underline">{doc.preuve_label}</Link>
                : <span className="text-gray-400">Aucune</span>}
            </Champ>
            <Champ label="Type de la preuve liee">{doc.preuve_type_label}</Champ>
          </>
        )}
      </div>

      {estPreuve && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Empreinte du fichier</h2>
          {fichierDepose ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs font-mono bg-gray-50 dark:bg-gray-900/60 text-gray-800 dark:text-gray-200 px-3 py-2 rounded-lg break-all">
                  {doc.hash_sha256}
                </code>
                <button onClick={copierHash} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-2" aria-label="Copier l'empreinte">
                  {copie ? <><Check size={14} className="text-green-600" /> Copie</> : <><Copy size={14} /> Copier</>}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Empreinte SHA-256 calculee au depot. Elle prouve en audit que le fichier servi est
                exactement celui qui a ete depose.
              </p>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <FileWarning size={15} className="text-amber-500" />
                Aucun fichier n&apos;a encore ete depose pour cette preuve.
              </p>
              {canWrite && (
                <>
                  <DocumentUploadField file={fichier} onChange={setFichier} disabled={depot} />
                  <div>
                    <Button variant="primary" onClick={deposer} isLoading={depot} disabled={!fichier}>
                      Deposer le fichier
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={estPreuve ? 'Supprimer cette preuve ?' : 'Supprimer cette facture ?'}
        message={estPreuve
          ? 'Le fichier associe sera egalement supprime. Une preuve rattachee a une facture ne peut pas etre supprimee.'
          : 'La preuve liee n\'est pas supprimee : elle reste disponible dans la liste des documents.'}
        confirmLabel="Supprimer"
        isDestructive
      />
    </div>
  );
}
