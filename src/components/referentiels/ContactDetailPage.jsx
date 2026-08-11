// ContactDetailPage - fiche detail d'un contact
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { mockContacts, mockFonctions, isContactActif, getRattachementInfo } from '../../data/mockReferentiels';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import StatutValidationBadge from './StatutValidationBadge';
import ValidationActions from './ValidationActions';
import ContactFormModal from './ContactFormModal';
import AvatarContact from './AvatarContact';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';
import { formatDate } from '../../utils/dateUtils';
import { setContactPhoto, removeContactPhoto } from '../../utils/contactPhotos';

const TYPE_LABELS = { client: 'Client', editeur: 'Editeur', revendeur: 'Revendeur' };

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canValidate, canDelete, submitsForValidation } = useRbac();
  const { user } = useAuth();
  const [contacts, setContacts] = useState(mockContacts);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const contact = contacts.find(c => c.id === id);

  if (!contact) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Referentiels', to: '/referentiels/contacts' }, { label: 'Contacts', to: '/referentiels/contacts' }, { label: 'Introuvable' }]} />
        <EmptyState title="Contact introuvable" description="Ce contact n'existe pas ou a ete supprime." ctaLabel="Retour a la liste" onCta={() => navigate('/referentiels/contacts')} />
      </div>
    );
  }

  const fonction = mockFonctions.find(f => f.id === contact.id_fonction);
  const rattachement = getRattachementInfo(contact.type_rattachement, contact.id_rattachement);
  const actif = isContactActif(contact);

  function handleValidate() {
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, statut_validation: 'valide', motif_refus: undefined } : c));
    addToast({ type: 'success', message: 'Contact valide.' });
  }

  function handleRefuse(motif) {
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, statut_validation: 'refuse', motif_refus: motif } : c));
    addToast({ type: 'info', message: 'Contact refuse.' });
  }

  function handleSave(data, existing, photo) {
    if (photo) setContactPhoto(existing.id, photo);
    else removeContactPhoto(existing.id);
    const resoumis = submitsForValidation;
    setContacts(prev => prev.map(c => c.id === existing.id ? {
      ...c, ...data,
      statut_validation: resoumis ? 'en_attente' : 'valide',
      soumis_par: `${user.prenom} ${user.nom}`,
    } : c));
    addToast({ type: 'success', message: resoumis ? 'Modification soumise a validation.' : 'Contact mis a jour.' });
  }

  function handleDelete() {
    setContacts(prev => prev.filter(c => c.id !== contact.id));
    addToast({ type: 'success', message: 'Contact supprime.' });
    navigate('/referentiels/contacts');
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[
        { label: 'Referentiels', to: '/referentiels/contacts' },
        { label: 'Contacts', to: '/referentiels/contacts' },
        { label: `${contact.prenom} ${contact.nom}` },
      ]} />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <AvatarContact contact={contact} size={48} />
          <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{contact.prenom} {contact.nom}</h1>
            <Badge variant={actif ? 'success' : 'neutral'} label={actif ? 'Actif' : 'Inactif'} />
            <StatutValidationBadge statut={contact.statut_validation} />
          </div>
          {fonction && <p className="text-sm text-gray-500 mt-1">{fonction.label}</p>}
          {contact.statut_validation === 'refuse' && contact.motif_refus && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">Motif du refus : {contact.motif_refus}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">Soumis par {contact.soumis_par}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canValidate && <ValidationActions statut={contact.statut_validation} onValidate={handleValidate} onRefuse={handleRefuse} />}
          {canWrite && (
            <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}>
              <Pencil size={14} /> Editer
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
          <p className="text-xs text-gray-500 mb-1">Telephone</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">{contact.telephone || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Rattachement</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">
            {TYPE_LABELS[contact.type_rattachement]}
            {rattachement.detailPath
              ? <> - <Link to={rattachement.detailPath} className="text-blue-800 hover:underline">{rattachement.label}</Link></>
              : <> - {rattachement.label}</>
            }
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Periode</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">
            Du {formatDate(contact.date_debut)} {contact.date_fin ? `au ${formatDate(contact.date_fin)}` : '(en cours)'}
          </p>
        </div>
      </div>

      <ContactFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} contact={contact} />

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer le contact"
        isDestructive
        confirmLabel="Supprimer"
        message={`Supprimer definitivement ${contact.prenom} ${contact.nom} ? Cette action est irreversible.`}
      />
    </div>
  );
}
