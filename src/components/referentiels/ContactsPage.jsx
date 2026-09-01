// ContactsPage - liste des contacts (Referentiels).
// Donnees API : /contacts et /fonctions. La fonction, le rattachement resolu
// (type_rattachement, rattachement_label) et l'etat actif (derive de la date
// de fin) sont servis par l'API, jamais recalcules ici.
//
// Le 409 de doublon n'est pas une erreur a jeter en toast : il porte
// l'existant, et c'est lui qui interesse l'utilisateur. La page ouvre alors
// ModalDoublonContact, comme RevendeursPage avec la sienne.
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, LayoutGrid, List, Mail, Phone } from 'lucide-react';
import { contactsService } from '../../services/contactsService';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Breadcrumb from '../ui/Breadcrumb';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import ContactFormModal from './ContactFormModal';
import ModalDoublonContact from './ModalDoublonContact';
import AvatarContact from './AvatarContact';
import useRbac from '../../hooks/useRbac';
import useDebounce from '../../hooks/useDebounce';
import useLocalStorage from '../../hooks/useLocalStorage';
import { useToast } from '../../hooks/useToast';
import { setContactPhoto, removeContactPhoto } from '../../utils/contactPhotos';

const TYPE_LABELS = { client: 'Client', editeur: 'Éditeur', revendeur: 'Revendeur' };

function ContactCard({ contact, navigate }) {
  return (
    <button
      onClick={() => navigate(`/referentiels/contacts/${contact.id}`)}
      className="flex flex-col items-center text-center gap-2 w-full h-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
    >
      <AvatarContact contact={contact} size={56} />
      <div className="min-w-0 w-full">
        <p className="font-semibold text-gray-900 dark:text-white truncate">{contact.prenom} {contact.nom}</p>
        {contact.fonction_label && <p className="text-xs text-gray-500 mt-0.5 truncate">{contact.fonction_label}</p>}
        {contact.type_rattachement && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{TYPE_LABELS[contact.type_rattachement]} - {contact.rattachement_label}</p>
        )}
      </div>
      <Badge variant={contact.actif ? 'success' : 'neutral'} label={contact.actif ? 'Actif' : 'Inactif'} />
      {(contact.email || contact.telephone) && (
        <div className="flex flex-col gap-1 w-full min-w-0 pt-3 mt-auto border-t border-gray-100 dark:border-gray-700">
          {contact.email && (
            <span className="flex items-center justify-center gap-1.5 text-xs text-gray-500 min-w-0">
              <Mail size={11} className="flex-shrink-0" /> <span className="truncate">{contact.email}</span>
            </span>
          )}
          {contact.telephone && (
            <span className="flex items-center justify-center gap-1.5 text-xs text-gray-500 min-w-0">
              <Phone size={11} className="flex-shrink-0" /> <span className="truncate">{contact.telephone}</span>
            </span>
          )}
        </div>
      )}
    </button>
  );
}

export default function ContactsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite } = useRbac({ write: 'gerer_contacts' });
  const [contacts, setContacts] = useState([]);
  const [fonctions, setFonctions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterFonction, setFilterFonction] = useState('');
  const [filterActif, setFilterActif] = useState('');
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 300);
  const [formModal, setFormModal] = useState({ open: false, contact: null });
  const [doublon, setDoublon] = useState(null);
  const [viewMode, setViewMode] = useLocalStorage('samsecure_contacts_vue', 'cards');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      // Les fonctions ne servent qu'au filtre : leur echec ne prive pas de la
      // liste, il vide simplement le selecteur.
      const [listeContacts, listeFonctions] = await Promise.all([
        contactsService.list(),
        contactsService.fonctions().catch(() => []),
      ]);
      setContacts(listeContacts);
      setFonctions(listeFonctions);
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
    return contacts.filter(c => {
      if (filterType && c.type_rattachement !== filterType) return false;
      if (filterFonction && c.id_fonction !== filterFonction) return false;
      if (filterActif === 'actif' && !c.actif) return false;
      if (filterActif === 'inactif' && c.actif) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (!`${c.prenom ?? ''} ${c.nom} ${c.email ?? ''}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [contacts, filterType, filterFonction, filterActif, debouncedSearch]);

  // La photo reste un stockage navigateur (samsecure_photos_contacts), le
  // schema ne portant pas de depot de fichier pour les contacts.
  async function handleSave(data, existing, photo) {
    try {
      if (existing) {
        await contactsService.update(existing.id, data);
        if (photo) setContactPhoto(existing.id, photo);
        else removeContactPhoto(existing.id);
        addToast({ type: 'success', message: 'Contact mis à jour.' });
      } else {
        const cree = await contactsService.create(data);
        if (photo) setContactPhoto(cree.id, photo);
        addToast({ type: 'success', message: 'Contact créé.' });
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
    setFormModal({ open: false, contact: null });
    navigate(`/referentiels/contacts/${existant.id}`);
  }

  const columns = [
    { key: 'nom', label: 'Nom Prénom', sortable: true, render: r => (
      <button onClick={() => navigate(`/referentiels/contacts/${r.id}`)} className="flex items-center gap-2.5 font-medium text-blue-800 hover:underline text-left">
        <AvatarContact contact={r} size={28} />
        {r.nom} {r.prenom}
      </button>
    ), csvValue: r => `${r.nom} ${r.prenom ?? ''}`.trim() },
    { key: 'fonction', label: 'Fonction', getValue: r => r.fonction_label ?? '-', render: r => r.fonction_label ?? '-' },
    { key: 'email', label: 'Email', sortable: true, render: r => r.email ?? '-' },
    { key: 'telephone', label: 'Téléphone', render: r => r.telephone ?? '-' },
    { key: 'rattachement', label: 'Rattachement', render: r => (
      r.type_rattachement
        ? <span>{TYPE_LABELS[r.type_rattachement]} - {r.rattachement_label}</span>
        : <span className="text-gray-400">-</span>
    ) },
    { key: 'actif', label: 'Statut', sortable: true, getValue: r => r.actif ? 1 : 0, render: r => <Badge variant={r.actif ? 'success' : 'neutral'} label={r.actif ? 'Actif' : 'Inactif'} /> },
  ];

  const entete = (
    <>
      <Breadcrumb items={[{ label: 'Référentiels' }, { label: 'Contacts' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contacts.length} contact{contacts.length > 1 ? 's' : ''} au total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button onClick={() => setViewMode('cards')} aria-label="Vue cartes" className={`p-1.5 rounded ${viewMode === 'cards' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-800' : 'text-gray-500'}`}>
              <LayoutGrid size={15} />
            </button>
            <button onClick={() => setViewMode('table')} aria-label="Vue liste" className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-800' : 'text-gray-500'}`}>
              <List size={15} />
            </button>
          </div>
          {canWrite && (
            <Button variant="primary" onClick={() => setFormModal({ open: true, contact: null })} disabled={isLoading || !!error}>
              <Plus size={15} /> Nouveau contact
            </Button>
          )}
        </div>
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
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les rattachements</option>
          <option value="client">Client</option>
          <option value="editeur">Éditeur</option>
          <option value="revendeur">Revendeur</option>
        </select>
        <select value={filterFonction} onChange={e => setFilterFonction(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les fonctions</option>
          {fonctions.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <select value={filterActif} onChange={e => setFilterActif(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les états</option>
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
        </select>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, prénom ou email..."
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable
          columns={columns}
          data={filtered}
          filename="contacts"
          viewMode={viewMode}
          renderCard={contact => <ContactCard contact={contact} navigate={navigate} />}
          cardsClassName="grid items-stretch gap-4 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]"
          emptyState={{
            message: contacts.length
              ? 'Aucun contact ne correspond aux filtres.'
              : 'Aucun contact enregistré.',
            ctaLabel: canWrite ? 'Nouveau contact' : undefined,
            onCta: canWrite ? () => setFormModal({ open: true, contact: null }) : undefined,
          }}
        />
      </div>

      <ContactFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, contact: null })}
        onSave={handleSave}
        contact={formModal.contact}
        onOuvrirExistant={ouvrirExistant}
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
