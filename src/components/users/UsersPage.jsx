// UsersPage - administration des utilisateurs réels (données API, plus de mocks)
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, UserX, UserCheck, UserPlus, Eye, History } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import DesactivationModal from './DesactivationModal';
import HistoriqueModal from './HistoriqueModal';
import ProfileBadge from './ProfileBadge';
import DroitsViewer from '../admin/DroitsViewer';
import UserFormModal from './UserFormModal';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import useDebounce from '../../hooks/useDebounce';
import { usersService, societesService, groupsService, attributionsService } from '../../services/adminService';
import { attribuerGroupe } from '../../utils/attributionScope';

// Le statut Supprime n'existe plus : depuis la migration 022, le retrait d'un
// compte est une desactivation. Un utilisateur retire reste dans la liste,
// porte le statut Desactive et se reactive d'un clic.
function computeStatus(u) {
  const today = new Date().toISOString().slice(0, 10);
  if (!u.actif) return { label: 'Désactivé', variant: 'neutral' };
  // Une echeance depassee vaut desactivation : le login et le calcul des droits
  // la refusent deja, l'ecran doit dire la meme chose.
  if (u.date_finale && u.date_finale < today) return { label: 'Désactivé (échéance)', variant: 'neutral' };
  if (u.date_mise_en_fonction && u.date_mise_en_fonction > today) return { label: 'Mise en fonction à venir', variant: 'warning' };
  if (u.date_finale) return { label: 'Fin programmée', variant: 'warning' };
  return { label: 'Actif', variant: 'success' };
}

// Inactif au sens du serveur : le login et le calcul des droits refusent un
// compte a actif = false comme un compte dont l'echeance est depassee. L'ecran
// doit dire exactement la meme chose, sans quoi il montrerait comme actif un
// compte que l'API refuse.
function estInactif(u) {
  const today = new Date().toISOString().slice(0, 10);
  return !u.actif || (u.date_finale && u.date_finale < today);
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

  const [filterStatut, setFilterStatut] = useState('actifs');
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 300);
  const [formModal, setFormModal] = useState({ open: false, user: null });
  const [droitsModal, setDroitsModal] = useState(null);
  const [desactivation, setDesactivation] = useState(null);
  const [historique, setHistorique] = useState(null);

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
      if (filterStatut === 'actifs'   && estInactif(u)) return false;
      if (filterStatut === 'inactifs' && !estInactif(u)) return false;
      // Les autres valeurs restent un filtrage fin par libelle de statut.
      if (filterStatut && !['actifs', 'inactifs', 'tous'].includes(filterStatut) && status.label !== filterStatut) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (!`${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [users, filterStatut, debouncedSearch]);

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

  // Reactivation : actif = true ne suffit pas, une echeance depassee continuerait
  // de bloquer la connexion. Elle est effacee dans le meme geste.
  async function handleReactiver(u) {
    try {
      await usersService.update(u.id, { actif: true, date_finale: null });
      addToast({ type: 'success', message: 'Utilisateur réactivé.' });
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  async function handleDesactiver(payload) {
    try {
      await usersService.update(desactivation.id, payload);
      addToast({
        type: 'info',
        message: payload.actif === false
          ? 'Utilisateur désactivé.'
          : `Désactivation programmée au ${formatDate(payload.date_finale)}.`,
      });
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
      throw err;
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
    { key: 'date_mise_en_fonction', label: 'Mise en fonction', sortable: true,
      render: r => formatDate(r.date_mise_en_fonction) || '-',
      csvValue: r => formatDate(r.date_mise_en_fonction) },
    { key: 'date_finale', label: 'Date de désactivation', sortable: true,
      // Le tri porte sur la valeur brute, au format ISO : son ordre
      // lexicographique est deja chronologique. Trier sur le rendu JJ/MM/AAAA
      // classerait par jour du mois.
      render: r => formatDate(r.date_finale) || '-',
      csvValue: r => formatDate(r.date_finale) },
    {
      key: 'actions', label: 'Actions', render: r => (
        <div className="flex items-center gap-1">
          <button onClick={() => setDroitsModal(r)} aria-label="Voir les droits" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-700 transition-colors">
            <Eye size={14} />
          </button>
          <button onClick={() => setFormModal({ open: true, user: r })} aria-label="Modifier" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={() => setHistorique(r)} aria-label="Voir l'historique" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-700 transition-colors">
            <History size={14} />
          </button>
          {r.actif
            ? <button onClick={() => setDesactivation(r)} aria-label="Désactiver" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-orange-600 transition-colors">
                <UserX size={14} />
              </button>
            : <button onClick={() => handleReactiver(r)} aria-label="Réactiver" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-green-600 transition-colors">
                <UserCheck size={14} />
              </button>
          }
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
          <option value="actifs">Utilisateurs actifs</option>
          <option value="inactifs">Utilisateurs inactifs</option>
          <option value="tous">Tous les utilisateurs</option>
          <optgroup label="Par statut">
            <option value="Mise en fonction à venir">Mise en fonction à venir</option>
            <option value="Fin programmée">Fin programmée</option>
          </optgroup>
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
        <DataTable columns={columns} data={filtered} filename="utilisateurs" isLoading={isLoading} emptyState={{ message: 'Aucun utilisateur ne correspond aux filtres.' }} rowClassName={r => estInactif(r)
          // L'attenuation porte sur les cellules et non sur la ligne :
          // opacity sur le <tr> s'appliquerait aussi aux boutons d'action, et
          // aucun enfant ne peut la contrarier, la propriete creant un
          // contexte d'empilement. La derniere cellule, celle des actions, est
          // donc exclue pour que les trois boutons restent nets et se lisent
          // comme utilisables. Le fond colore reste porte par la ligne, il
          // n'est pas concerne par l'opacite des cellules.
          ? '[&>td:not(:last-child)]:opacity-60 bg-[rgb(255_0_0_/_10%)]'
          : ''} />
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

      <HistoriqueModal
        isOpen={!!historique}
        utilisateur={historique}
        onClose={() => setHistorique(null)}
      />

      <DesactivationModal
        isOpen={!!desactivation}
        utilisateur={desactivation}
        onClose={() => setDesactivation(null)}
        onConfirm={handleDesactiver}
      />

    </div>
  );
}
