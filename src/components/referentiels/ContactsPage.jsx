// ContactsPage - liste des contacts (Referentiels)
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, LayoutGrid, List, Mail, Phone } from 'lucide-react';
import { mockContacts as initialContacts, mockFonctions, isContactActif, getRattachementInfo } from '../../data/mockReferentiels';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Breadcrumb from '../ui/Breadcrumb';
import StatutValidationBadge from './StatutValidationBadge';
import ContactFormModal from './ContactFormModal';
import AvatarContact from './AvatarContact';
import useRbac from '../../hooks/useRbac';
import useDebounce from '../../hooks/useDebounce';
import useLocalStorage from '../../hooks/useLocalStorage';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';
import { setContactPhoto, removeContactPhoto } from '../../utils/contactPhotos';

const TYPE_LABELS = { client: 'Client', editeur: 'Editeur', revendeur: 'Revendeur' };

function ContactCard({ contact, navigate }) {
  const fonction = mockFonctions.find(f => f.id === contact.id_fonction)?.label;
  const rattachement = getRattachementInfo(contact.type_rattachement, contact.id_rattachement);
  const actif = isContactActif(contact);

  return (
    <button
      onClick={() => navigate(`/referentiels/contacts/${contact.id}`)}
      className="flex flex-col items-center text-center gap-2 w-full h-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
    >
      <AvatarContact contact={contact} size={56} />
      <div className="min-w-0 w-full">
        <p className="font-semibold text-gray-900 dark:text-white truncate">{contact.prenom} {contact.nom}</p>
        {fonction && <p className="text-xs text-gray-500 mt-0.5 truncate">{fonction}</p>}
        <p className="text-xs text-gray-400 mt-0.5 truncate">{TYPE_LABELS[contact.type_rattachement]} - {rattachement.label}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <Badge variant={actif ? 'success' : 'neutral'} label={actif ? 'Actif' : 'Inactif'} />
        <StatutValidationBadge statut={contact.statut_validation} />
      </div>
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
  const { canWrite, submitsForValidation } = useRbac();
  const { user } = useAuth();
  const [contacts, setContacts] = useState(initialContacts);
  const [filterType, setFilterType] = useState('');
  const [filterFonction, setFilterFonction] = useState('');
  const [filterActif, setFilterActif] = useState('');
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 300);
  const [formModal, setFormModal] = useState({ open: false, contact: null });
  const [viewMode, setViewMode] = useLocalStorage('samsecure_contacts_vue', 'cards');

  const filtered = useMemo(() => {
    return contacts.filter(c => {
      if (filterType && c.type_rattachement !== filterType) return false;
      if (filterFonction && c.id_fonction !== filterFonction) return false;
      if (filterActif === 'actif' && !isContactActif(c)) return false;
      if (filterActif === 'inactif' && isContactActif(c)) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (!`${c.prenom} ${c.nom} ${c.email}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [contacts, filterType, filterFonction, filterActif, debouncedSearch]);

  function handleSave(data, existing, photo) {
    const id = existing?.id ?? `ct-${Date.now()}`;
    if (photo) setContactPhoto(id, photo);
    else removeContactPhoto(id);

    if (existing) {
      const resoumis = submitsForValidation;
      setContacts(prev => prev.map(c => c.id === existing.id ? {
        ...c, ...data,
        statut_validation: resoumis ? 'en_attente' : 'valide',
        soumis_par: `${user.prenom} ${user.nom}`,
      } : c));
      addToast({ type: 'success', message: resoumis ? 'Modification soumise a validation.' : 'Contact mis a jour.' });
    } else {
      const newContact = {
        id, ...data,
        statut_validation: submitsForValidation ? 'en_attente' : 'valide',
        soumis_par: `${user.prenom} ${user.nom}`,
      };
      setContacts(prev => [...prev, newContact]);
      addToast({ type: 'success', message: submitsForValidation ? 'Contact soumis a validation.' : 'Contact cree.' });
    }
  }

  const columns = [
    { key: 'nom', label: 'Nom Prenom', sortable: true, render: r => (
      <button onClick={() => navigate(`/referentiels/contacts/${r.id}`)} className="flex items-center gap-2.5 font-medium text-blue-800 hover:underline text-left">
        <AvatarContact contact={r} size={28} />
        {r.nom} {r.prenom}
      </button>
    ), csvValue: r => `${r.nom} ${r.prenom}` },
    { key: 'fonction', label: 'Fonction', getValue: r => mockFonctions.find(f => f.id === r.id_fonction)?.label ?? '-', render: r => mockFonctions.find(f => f.id === r.id_fonction)?.label ?? '-' },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'telephone', label: 'Telephone' },
    { key: 'rattachement', label: 'Rattachement', render: r => {
      const info = getRattachementInfo(r.type_rattachement, r.id_rattachement);
      return <span>{TYPE_LABELS[r.type_rattachement]} - {info.label}</span>;
    } },
    { key: 'actif', label: 'Statut', sortable: true, getValue: r => isContactActif(r) ? 1 : 0, render: r => <Badge variant={isContactActif(r) ? 'success' : 'neutral'} label={isContactActif(r) ? 'Actif' : 'Inactif'} /> },
    { key: 'statut_validation', label: 'Validation', sortable: true, render: r => <StatutValidationBadge statut={r.statut_validation} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Referentiels' }, { label: 'Contacts' }]} />
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
            <Button variant="primary" onClick={() => setFormModal({ open: true, contact: null })}>
              <Plus size={15} /> Nouveau contact
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les rattachements</option>
          <option value="client">Client</option>
          <option value="editeur">Editeur</option>
          <option value="revendeur">Revendeur</option>
        </select>
        <select value={filterFonction} onChange={e => setFilterFonction(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les fonctions</option>
          {mockFonctions.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <select value={filterActif} onChange={e => setFilterActif(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
        </select>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, prenom ou email..."
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
            message: 'Aucun contact ne correspond aux filtres.',
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
      />
    </div>
  );
}
