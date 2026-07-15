// UsersPage - Section 3 Specs UX v0.5
import { useState, useMemo } from 'react';
import { Pencil, UserX, UserCheck, KeyRound, Trash2, UserPlus } from 'lucide-react';
import { mockUsers as initialUsers } from '../../data/mockUsers';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import ProfileBadge from './ProfileBadge';
import UserFormModal from './UserFormModal';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import useDebounce from '../../hooks/useDebounce';

export default function UsersPage() {
  const { addToast } = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [filterStatut, setFilterStatut] = useState('');
  const [filterProfil, setFilterProfil] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [formModal, setFormModal] = useState({ open: false, user: null });
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null, destructive: false });

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (filterStatut === 'actif' && !u.actif) return false;
      if (filterStatut === 'inactif' && u.actif) return false;
      if (filterProfil && !u.habilitations.some(h => h.profil === filterProfil)) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (!`${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [users, filterStatut, filterProfil, debouncedSearch]);

  function openConfirm(title, message, action, destructive = false) {
    setConfirm({ open: true, title, message, action, destructive });
  }

  function handleSave(data) {
    if (formModal.user) {
      setUsers(prev => prev.map(u => u.id === formModal.user.id ? { ...u, ...data } : u));
      addToast({ type: 'success', message: 'Utilisateur mis à jour.' });
    } else {
      const newUser = { id: String(Date.now()), ...data, derniere_connexion: null, twoFactor: false };
      setUsers(prev => [...prev, newUser]);
      addToast({ type: 'success', message: 'Utilisateur créé. Email d\'invitation envoyé.' });
    }
  }

  const columns = [
    { key: 'nom', label: 'Prénom Nom', sortable: true, render: r => <span className="font-medium text-gray-900 dark:text-white">{r.prenom} {r.nom}</span>, csvValue: r => `${r.prenom} ${r.nom}` },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'habilitations', label: 'Profil(s)', render: r => (
      <div className="flex flex-wrap gap-1">{r.habilitations.map((h, i) => <ProfileBadge key={i} profil={h.profil} />)}</div>
    ), csvValue: r => r.habilitations.map(h => h.profilLabel).join(', ') },
    { key: 'actif', label: 'Statut', sortable: true, render: r => <Badge variant={r.actif ? 'success' : 'neutral'} label={r.actif ? 'Actif' : 'Inactif'} /> },
    { key: 'derniere_connexion', label: 'Dernière connexion', sortable: true, render: r => formatDate(r.derniere_connexion), csvValue: r => formatDate(r.derniere_connexion) },
    {
      key: 'actions', label: 'Actions', render: r => (
        <div className="flex items-center gap-1">
          <button onClick={() => setFormModal({ open: true, user: r })} aria-label="Modifier" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <Pencil size={14} />
          </button>
          {r.actif
            ? <button onClick={() => openConfirm('Désactiver l\'utilisateur', `Désactiver ${r.prenom} ${r.nom} ?`, () => { setUsers(p => p.map(u => u.id === r.id ? { ...u, actif: false } : u)); addToast({ type: 'info', message: 'Utilisateur désactivé.' }); })} aria-label="Désactiver" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-orange-600 transition-colors">
                <UserX size={14} />
              </button>
            : <button onClick={() => { setUsers(p => p.map(u => u.id === r.id ? { ...u, actif: true } : u)); addToast({ type: 'success', message: 'Utilisateur réactivé.' }); }} aria-label="Réactiver" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-green-600 transition-colors">
                <UserCheck size={14} />
              </button>
          }
          <button onClick={() => openConfirm('Réinitialiser le mot de passe', `Envoyer un email de réinitialisation à ${r.email} ?`, () => addToast({ type: 'info', message: 'Email de réinitialisation envoyé.' }))} aria-label="Réinitialiser MDP" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors">
            <KeyRound size={14} />
          </button>
          <button onClick={() => openConfirm('Supprimer l\'utilisateur', `Supprimer définitivement ${r.prenom} ${r.nom} ?`, () => { setUsers(p => p.filter(u => u.id !== r.id)); addToast({ type: 'success', message: 'Utilisateur supprimé.' }); }, true)} aria-label="Supprimer" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} utilisateur{users.length > 1 ? 's' : ''} au total</p>
        </div>
        <Button variant="primary" onClick={() => setFormModal({ open: true, user: null })}>
          <UserPlus size={15} /> Ajouter un utilisateur
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
        </select>
        <select value={filterProfil} onChange={e => setFilterProfil(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les profils</option>
          <option value="manager_dsi">Manager DSI</option>
          <option value="financier">Financier</option>
          <option value="it_ops">IT Ops</option>
        </select>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou email…"
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable columns={columns} data={filtered} filename="utilisateurs" emptyState={{ message: 'Aucun utilisateur ne correspond aux filtres.' }} />
      </div>

      <UserFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, user: null })}
        onSave={handleSave}
        user={formModal.user}
      />

      <ConfirmModal
        isOpen={confirm.open}
        onClose={() => setConfirm(v => ({ ...v, open: false }))}
        onConfirm={confirm.action ?? (() => {})}
        title={confirm.title}
        message={confirm.message}
        isDestructive={confirm.destructive}
        confirmLabel={confirm.destructive ? 'Supprimer' : 'Confirmer'}
      />
    </div>
  );
}
