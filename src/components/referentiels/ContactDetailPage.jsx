// ContactDetailPage - fiche detail d'un contact.
// Donnees API : /contacts/:id. La fonction, le rattachement resolu et l'etat
// actif (derive de la date de fin) sont servis par l'API, jamais recalcules
// ici.
//
// La suppression est reelle : aucune table ne reference le contact, elle sert
// la fiche creee par erreur. Un contact parti se retire en posant sa date de
// fin, depuis le formulaire d'edition ; la modale de suppression le rappelle.
// Un 409 de doublon sur l'edition ouvre ModalDoublonContact, comme sur la
// liste.
import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { contactsService } from '../../services/contactsService';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import ContactFormModal from './ContactFormModal';
import ModalDoublonContact from './ModalDoublonContact';
import AvatarContact from './AvatarContact';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import { setContactPhoto, removeContactPhoto } from '../../utils/contactPhotos';

const TYPE_LABELS = { client: 'Client', editeur: 'Éditeur', revendeur: 'Revendeur' };

// Fiche de l'entite de rattachement : la cible depend du type servi par l'API.
function cheminRattachement(contact) {
  if (contact.id_societe) return `/referentiels/organisation/${contact.id_societe}`;
  if (contact.id_editeur) return `/referentiels/editeurs/${contact.id_editeur}`;
  if (contact.id_revendeur) return `/referentiels/revendeurs/${contact.id_revendeur}`;
  return null;
}

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canDelete } = useRbac({ write: 'gerer_contacts' });
  const [contact, setContact] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [doublon, setDoublon] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      setContact(await contactsService.get(id));
    } catch (err) {
      setError(err.message);
      setErrorStatus(err.status);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data, existing, photo) {
    try {
      await contactsService.update(existing.id, data);
      if (photo) setContactPhoto(existing.id, photo);
      else removeContactPhoto(existing.id);
      addToast({ type: 'success', message: 'Contact mis à jour.' });
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

  async function handleDelete() {
    try {
      await contactsService.remove(id);
      removeContactPhoto(id);
      addToast({ type: 'success', message: 'Contact supprimé.' });
      navigate('/referentiels/contacts');
    } catch (err) {
      setDeleteOpen(false);
      addToast({ type: 'error', message: err.message });
    }
  }

  function ouvrirExistant(existant) {
    setDoublon(null);
    setFormOpen(false);
    navigate(`/referentiels/contacts/${existant.id}`);
  }

  const fil = (
    <Breadcrumb items={[
      { label: 'Référentiels', to: '/referentiels/contacts' },
      { label: 'Contacts', to: '/referentiels/contacts' },
      { label: contact ? `${contact.prenom ?? ''} ${contact.nom}`.trim() : '...' },
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
    // 404 : le contact n'existe pas ou a ete supprime depuis un autre onglet.
    if (errorStatus === 404) {
      return (
        <div className="flex flex-col gap-6">
          {fil}
          <EmptyState title="Contact introuvable" description="Ce contact n'existe pas ou a été supprimé." ctaLabel="Retour à la liste" onCta={() => navigate('/referentiels/contacts')} />
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

  const chemin = cheminRattachement(contact);

  return (
    <div className="flex flex-col gap-6">
      {fil}

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <AvatarContact contact={contact} size={48} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{contact.prenom} {contact.nom}</h1>
              <Badge variant={contact.actif ? 'success' : 'neutral'} label={contact.actif ? 'Actif' : 'Inactif'} />
            </div>
            {contact.fonction_label && <p className="text-sm text-gray-500 mt-1">{contact.fonction_label}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Email</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">{contact.email || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Téléphone</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">{contact.telephone || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Rattachement</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">
            {contact.type_rattachement
              ? (
                <>
                  {TYPE_LABELS[contact.type_rattachement]}
                  {chemin
                    ? <> - <Link to={chemin} className="text-blue-800 hover:underline">{contact.rattachement_label}</Link></>
                    : <> - {contact.rattachement_label}</>}
                </>
              )
              : 'Aucun'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Période</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">
            {contact.date_debut ? `Du ${formatDate(contact.date_debut)} ` : ''}
            {contact.date_fin ? `au ${formatDate(contact.date_fin)}` : '(en cours)'}
          </p>
        </div>
      </div>

      <ContactFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        contact={contact}
        onOuvrirExistant={ouvrirExistant}
      />

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer le contact"
        isDestructive
        confirmLabel="Supprimer"
        message={`Supprimer définitivement ${contact.prenom ?? ''} ${contact.nom} ? Cette action est irréversible. Pour un contact qui a quitté ses fonctions, posez plutôt une date de fin depuis l'édition.`}
      />

      {doublon && (
        <ModalDoublonContact
          doublon={doublon}
          onClose={() => setDoublon(null)}
          onOuvrirFiche={ouvrirExistant}
        />
      )}
    </div>
  );
}
