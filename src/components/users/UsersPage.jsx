// UsersPage - administration des utilisateurs réels (données API, plus de mocks)
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, UserX, UserCheck, Trash2, UserPlus, Eye } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import ProfileBadge from './ProfileBadge';
import DroitsViewer from '../admin/DroitsViewer';
import UserFormModal from './UserFormModal';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import useDebounce from '../../hooks/useDebounce';
import { usersService, societesService, groupsService, attributionsService } from '../../services/adminService';
import { attribuerGroupe } from '../../utils/attributionScope';

function computeStatus(u) {
  const today = new Date().toISOString().slice(0, 10);
  if (u.date_suppression) return { label: 'Supprimé', variant: 'error' };
  if (!u.actif) return { label: 'Désactivé', variant: 'neutral' };
  if (u.date_mise_en_fonction && u.date_mise_en_fonction > today) return { label: 'Mise en fonction à venir', variant: 'warning' };
  if (u.date_finale) return { label: 'Fin programmée', variant: 'warning' };
  return { label: 'Actif', variant: 'success' };
}

export default function UsersPage() {
  const { addToast } = useToast();
  const [users, setUsers] = useState([]);
  const [societes, setSocietes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [attributions, setAttributions] = useState([]);
  const [userSocietes, setUserSocietes] = useState({}); // { userId: [id_societe|null] }
  const [groupDiffusions, setGroupDiffusions] = useState({}); // { groupId: [id_societe|null] }
  const [isLoading, setIsLoading] = useState(true);

  const [filterStatut, setFilterStatut] = useState('');
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 300);
  const [formModal, setFormModal] = useState({ open: false, user: null });
  const [droitsModal, setDroitsModal] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null, destructive: false });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [u, s, g, a] = await Promise.all([
        usersService.list(),
        societesService.list(),
        groupsService.list(),
        attributionsService.listAll(),
      ]);
      setUsers(u);
      setSocietes(s);
      setGroups(g);
      setAttributions(a);
      const rattachements = await Promise.all(u.map((usr) => usersService.listSocietes(usr.id)));
      const map = {};
      u.forEach((usr, i) => { map[usr.id] = rattachements[i].map((r) => r.id_societe); });
      setUserSocietes(map);
      const diffusions = await Promise.all(g.map((grp) => groupsService.listSocietes(grp.id)));
      const gMap = {};
      g.forEach((grp, i) => { gMap[grp.id] = diffusions[i].map((r) => r.id_societe); });
      setGroupDiffusions(gMap);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  function groupsOf(userId) {
    return attributions
      .filter((a) => a.id_utilisateur === userId)
      .map((a) => groups.find((g) => g.id === a.id_profil))
      .filter(Boolean)
      .filter((g, i, arr) => arr.findIndex((x) => x.id === g.id) === i);
  }

  function societesLabel(userId) {
    const ids = userSocietes[userId] || [];
    if (ids.includes(null) || ids.length === 0) return 'Toutes organisations (tenant)';
    return ids.map((id) => societes.find((s) => s.id === id)?.raison_sociale || id).join(', ');
  }

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const status = computeStatus(u);
      if (filterStatut && status.label !== filterStatut) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (!`${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [users, filterStatut, debouncedSearch]);

  function openConfirm(title, message, action, destructive = false) {
    setConfirm({ open: true, title, message, action, destructive });
  }

  async function handleSubmit(payload, nouvellesSocietes, impactees = [], additions = []) {
    let userId = formModal.user?.id;
    if (formModal.user) {
      await usersService.update(userId, payload);
    } else {
      const created = await usersService.create(payload);
      userId = created.id;
    }

    const anciennes = formModal.user ? (userSocietes[userId] || []) : [];
    const ancienneCle = (id) => (id === null ? 'TENANT' : id);
    const ancienSet = new Set(anciennes.map(ancienneCle));
    const nouveauSet = new Set(nouvellesSocietes.map(ancienneCle));

    for (const cle of ancienSet) {
      if (nouveauSet.has(cle)) continue;
      if (cle === 'TENANT') await usersService.removeTenantRattachement(userId);
      else await usersService.removeSociete(userId, cle);
    }
    for (const cle of nouveauSet) {
      if (ancienSet.has(cle)) continue;
      await usersService.addSociete(userId, cle === 'TENANT' ? null : cle);
    }

    // Purge des attributions devenues sans intersection. Le retrait d'une
    // société précise du rattachement les cascade déjà côté serveur ; on
    // couvre ici en plus le passage tenant -> spécifique, que l'API ne
    // cascade pas (aucune route dédiée pour cibler la ligne id_societe NULL
    // d'une attribution). Les 404 (déjà retirée par la cascade serveur) sont
    // ignorées.
    for (const a of impactees) {
      try {
        await attributionsService.remove(userId, a.id);
      } catch {
        // déjà supprimée par la cascade serveur
      }
    }

    // Groupes cochés dans l'aperçu temps réel alors qu'ils n'étaient
    // assignables qu'avec CE nouveau rattachement (pas encore enregistré au
    // moment de la coche) : le rattachement vient d'être appliqué ci-dessus,
    // on peut désormais calculer la bonne portée et créer l'attribution.
    for (const groupId of additions) {
      try {
        await attribuerGroupe(userId, groupId, nouvellesSocietes, groupDiffusions[groupId] || []);
      } catch (err) {
        addToast({ type: 'error', message: err.message });
      }
    }

    addToast({ type: 'success', message: formModal.user ? 'Utilisateur mis à jour.' : 'Utilisateur créé.' });
    await load();
  }

  async function handleToggleActif(u) {
    try {
      await usersService.update(u.id, { actif: !u.actif });
      addToast({ type: u.actif ? 'info' : 'success', message: u.actif ? 'Utilisateur désactivé.' : 'Utilisateur réactivé.' });
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  async function handleDelete(u) {
    try {
      await usersService.remove(u.id);
      addToast({ type: 'success', message: 'Utilisateur supprimé.' });
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  const columns = [
    { key: 'nom', label: 'Prénom Nom', sortable: true, render: r => <span className="font-medium text-gray-900 dark:text-white">{r.prenom} {r.nom}</span>, csvValue: r => `${r.prenom} ${r.nom}` },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'groupes', label: 'Groupe(s)', render: r => (
      <div className="flex flex-wrap gap-1">{groupsOf(r.id).map((g) => <ProfileBadge key={g.id} profil={g.code} label={g.label} />)}</div>
    ) },
    { key: 'rattachement', label: 'Rattachement', render: r => <span className="text-xs text-gray-500">{societesLabel(r.id)}</span> },
    { key: 'statut', label: 'Statut', sortable: true, render: r => { const s = computeStatus(r); return <Badge variant={s.variant} label={s.label} />; } },
    { key: 'date_mise_en_fonction', label: 'Mise en fonction', render: r => formatDate(r.date_mise_en_fonction), csvValue: r => formatDate(r.date_mise_en_fonction) },
    {
      key: 'actions', label: 'Actions', render: r => (
        <div className="flex items-center gap-1">
          <button onClick={() => setDroitsModal(r)} aria-label="Voir les droits" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-700 transition-colors">
            <Eye size={14} />
          </button>
          {!r.date_suppression && (
            <button onClick={() => setFormModal({ open: true, user: r })} aria-label="Modifier" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
              <Pencil size={14} />
            </button>
          )}
          {!r.date_suppression && (r.actif
            ? <button onClick={() => openConfirm('Désactiver l\'utilisateur', `Désactiver ${r.prenom} ${r.nom} ?`, () => handleToggleActif(r))} aria-label="Désactiver" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-orange-600 transition-colors">
                <UserX size={14} />
              </button>
            : <button onClick={() => handleToggleActif(r)} aria-label="Réactiver" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-green-600 transition-colors">
                <UserCheck size={14} />
              </button>
          )}
          {!r.date_suppression && (
            <button onClick={() => openConfirm('Supprimer l\'utilisateur', `Supprimer ${r.prenom} ${r.nom} ? Cette action est réversible en base (soft delete) mais l'utilisateur ne pourra plus se connecter.`, () => handleDelete(r), true)} aria-label="Supprimer" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors">
              <Trash2 size={14} />
            </button>
          )}
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

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les statuts</option>
          <option value="Actif">Actif</option>
          <option value="Désactivé">Désactivé</option>
          <option value="Mise en fonction à venir">Mise en fonction à venir</option>
          <option value="Fin programmée">Fin programmée</option>
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
        <DataTable columns={columns} data={filtered} filename="utilisateurs" isLoading={isLoading} emptyState={{ message: 'Aucun utilisateur ne correspond aux filtres.' }} />
      </div>

      <UserFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, user: null })}
        onSubmit={handleSubmit}
        user={formModal.user}
        initialSocieteIds={formModal.user ? userSocietes[formModal.user.id] : []}
        societes={societes}
        userAttributions={formModal.user ? attributions.filter((a) => a.id_utilisateur === formModal.user.id) : []}
        groups={groups}
        groupDiffusions={groupDiffusions}
        onGroupsChanged={() => load()}
      />

      {droitsModal && (
        <DroitsViewer
          isOpen={!!droitsModal}
          onClose={() => setDroitsModal(null)}
          user={droitsModal}
          societes={societes}
          userSocieteIds={userSocietes[droitsModal.id] || []}
        />
      )}

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
