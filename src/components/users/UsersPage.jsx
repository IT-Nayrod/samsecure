// UsersPage - administration des utilisateurs réels (données API, plus de mocks)
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, UserX, UserCheck, UserPlus, Eye, History, KeyRound } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import StatutCompteModal from './StatutCompteModal';
import HistoriqueModal from './HistoriqueModal';
import MotDePasseModal from './MotDePasseModal';
import ProfileBadge from './ProfileBadge';
import DroitsViewer from '../admin/DroitsViewer';
import UserFormModal from './UserFormModal';
import SelectionActionsBar from './SelectionActionsBar';
import ConfirmModal from '../ui/ConfirmModal';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';
import { formatDate } from '../../utils/dateUtils';
import useDebounce from '../../hooks/useDebounce';
import { exportToCsv } from '../../utils/exportCsv';
import { usersService, societesService, groupsService, attributionsService } from '../../services/adminService';
import { attribuerGroupe } from '../../utils/attributionScope';
import { estInactif, estEnAttenteDeMiseEnFonction, dateIso, FILTRES_STATUT, FILTRES_DATES, filtrerParStatut } from './statutCompte';

// Le statut Supprime n'existe plus : depuis la migration 022, le retrait d'un
// compte est une désactivation. Un utilisateur retiré reste dans la liste,
// porte le statut Désactivé et se réactive d'un clic.
// Les règles de dates vivent dans statutCompte.js (#211), partagées avec les
// filtres et testées ; seul le libellé du badge reste ici.
function computeStatus(u) {
  if (!u.actif) return { label: 'Désactivé', variant: 'neutral' };
  // Une échéance dépassée vaut désactivation : le login et le calcul des droits
  // la refusent déjà, l'écran doit dire la même chose.
  if (estInactif(u)) return { label: 'Désactivé (échéance)', variant: 'neutral' };
  if (estEnAttenteDeMiseEnFonction(u)) return { label: 'Mise en fonction à venir', variant: 'warning' };
  if (dateIso(u.date_finale)) return { label: 'Fin programmée', variant: 'warning' };
  return { label: 'Actif', variant: 'success' };
}

// Message de résultat de la désactivation groupée : les comptes déjà inactifs
// sont ignorés par le serveur et comptés ici.
function messageResultatDesactivation({ desactives = 0, ignores = 0 }) {
  const parts = [`${desactives} compte${desactives > 1 ? 's' : ''} désactivé${desactives > 1 ? 's' : ''}`];
  if (ignores) parts.push(`${ignores} déjà inactif${ignores > 1 ? 's' : ''} ignoré${ignores > 1 ? 's' : ''}`);
  return `${parts.join(', ')}.`;
}

export default function UsersPage() {
  const { addToast } = useToast();
  const { user: utilisateurConnecte } = useAuth();
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
  const [statutModal, setStatutModal] = useState(null); // { user, sens }
  const [historique, setHistorique] = useState(null);
  const [motDePasse, setMotDePasse] = useState(null);
  // Sélection des lignes (#212), portée ici et non par le tableau : les
  // actions groupées en ont besoin, et elle doit se vider après traitement.
  const [selection, setSelection] = useState(new Set());
  const [confirmDesactivation, setConfirmDesactivation] = useState(false);
  const [desactivationEnCours, setDesactivationEnCours] = useState(false);

  // silencieux (#169) : rechargement demandé par une coche de groupe dans la
  // fiche ouverte. La liste d'arrière-plan ne repasse pas en squelette (page
  // raccourcie, défilement ramené en haut, clignotement derrière le panneau) :
  // les données sont remplacées sur place.
  const load = useCallback(async ({ silencieux = false } = {}) => {
    if (!silencieux) setIsLoading(true);
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
    if (ids.includes(null) || ids.length === 0) return 'Toutes sociétés (tenant)';
    return ids.map((id) => societes.find((s) => s.id === id)?.raison_sociale || id).join(', ');
  }

  // Filtrage côté front, comme l'existant : GET /utilisateurs n'expose aucun
  // paramètre de filtre. Le statut est calculé depuis les dates du compte
  // (statutCompte.js), puis la recherche s'applique.
  const filtered = useMemo(() => {
    const parStatut = filtrerParStatut(users, filterStatut);
    if (!debouncedSearch) return parStatut;
    const q = debouncedSearch.toLowerCase();
    return parStatut.filter((u) => `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(q));
  }, [users, filterStatut, debouncedSearch]);

  // Une ligne qui sort de la liste (filtre, recherche, rechargement) sort de la
  // sélection : les actions ne portent que sur des comptes visibles, jamais
  // sur une coche oubliée derrière un filtre.
  useEffect(() => {
    setSelection((prev) => {
      if (prev.size === 0) return prev;
      const visibles = new Set(filtered.map((u) => u.id));
      const suivant = new Set([...prev].filter((id) => visibles.has(id)));
      return suivant.size === prev.size ? prev : suivant;
    });
  }, [filtered]);

  const selectionnes = useMemo(() => filtered.filter((u) => selection.has(u.id)), [filtered, selection]);

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

  // Les quatre cas passent par le même appel : la modale a déjà construit le
  // payload, ne reste que le message à choisir.
  function messageStatut(payload) {
    if (payload.actif === false) return { type: 'info', message: 'Utilisateur désactivé.' };
    if (payload.date_finale) return { type: 'info', message: `Désactivation programmée au ${formatDate(payload.date_finale)}.` };
    if (payload.date_mise_en_fonction) return { type: 'success', message: `Activation programmée au ${formatDate(payload.date_mise_en_fonction)}.` };
    return { type: 'success', message: 'Utilisateur réactivé.' };
  }

  async function handleStatut(payload) {
    try {
      await usersService.update(statutModal.user.id, payload);
      addToast(messageStatut(payload));
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
      // Relance : la modale garde alors sa saisie au lieu de se fermer sur un échec.
      throw err;
    }
  }

  // Le refus du compte connecté est aussi porté par le serveur (409) : le
  // contrôle ici évite seulement d'ouvrir une confirmation vouée à l'échec.
  function demanderDesactivation() {
    if (utilisateurConnecte && selection.has(utilisateurConnecte.id)) {
      addToast({ type: 'error', message: 'La sélection contient votre propre compte : retirez-le avant de désactiver.' });
      return;
    }
    if (selectionnes.every((u) => !u.actif)) {
      addToast({ type: 'info', message: 'Tous les comptes sélectionnés sont déjà inactifs.' });
      return;
    }
    setConfirmDesactivation(true);
  }

  async function desactiverSelection() {
    setDesactivationEnCours(true);
    try {
      const resultat = await usersService.desactiverSelection(selectionnes.map((u) => u.id));
      addToast({ type: 'info', message: messageResultatDesactivation(resultat) });
      setSelection(new Set());
      await load();
    } catch (err) {
      // Refus du serveur (compte connecté, périmètre, introuvable) : rien n'a
      // été écrit, la sélection reste pour corriger et relancer.
      addToast({ type: 'error', message: err.message });
    } finally {
      setDesactivationEnCours(false);
    }
  }

  const dejaInactifs = selectionnes.filter((u) => !u.actif).length;
  const aDesactiver = selectionnes.length - dejaInactifs;
  const messageConfirmation = [
    `${selectionnes.length} compte${selectionnes.length > 1 ? 's' : ''} sélectionné${selectionnes.length > 1 ? 's' : ''}`
      + (dejaInactifs ? `, dont ${dejaInactifs} déjà inactif${dejaInactifs > 1 ? 's' : ''} qui ${dejaInactifs > 1 ? 'seront ignorés' : 'sera ignoré'}` : '')
      + '.',
    `${aDesactiver} compte${aDesactiver > 1 ? 's' : ''} ${aDesactiver > 1 ? 'seront désactivés' : 'sera désactivé'} immédiatement : la connexion est refusée dès la validation.`,
    'Les comptes désactivés restent visibles dans la liste et peuvent être réactivés à tout moment.',
  ].join(' ');

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
      // lexicographique est déjà chronologique. Trier sur le rendu JJ/MM/AAAA
      // classerait par jour du mois.
      render: r => formatDate(r.date_finale) || '-',
      csvValue: r => formatDate(r.date_finale) },
    {
      key: 'actions', label: 'Actions', render: r => (
        <div className="flex items-center gap-1">
          <button onClick={() => setDroitsModal(r)} aria-label="Voir les droits" title="Consulter les droits effectifs" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-700 transition-colors">
            <Eye size={14} />
          </button>
          <button onClick={() => setFormModal({ open: true, user: r })} aria-label="Modifier" title="Modifier l'identité, les groupes et les rattachements" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={() => setHistorique(r)} aria-label="Voir l'historique" title="Consulter l'historique des actions sur ce compte" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-700 transition-colors">
            <History size={14} />
          </button>
          <button onClick={() => setMotDePasse(r)} aria-label="Gérer le mot de passe" title="Définir, générer ou réinitialiser le mot de passe" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-600 transition-colors">
            <KeyRound size={14} />
          </button>
          {r.actif
            ? <button onClick={() => setStatutModal({ user: r, sens: 'desactivation' })} aria-label="Désactiver" title="Désactiver le compte, immédiatement ou à une date" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-orange-600 transition-colors">
                <UserX size={14} />
              </button>
            : <button onClick={() => setStatutModal({ user: r, sens: 'activation' })} aria-label="Réactiver" title="Réactiver le compte, immédiatement ou à une date" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-green-600 transition-colors">
                <UserCheck size={14} />
              </button>
          }
        </div>
      ),
    },
  ];

  // Export de la sélection : mêmes colonnes et même format que l'export CSV
  // du tableau, restreint aux lignes cochées.
  function exporterSelection() {
    exportToCsv('utilisateurs-selection', columns.filter((c) => c.key && c.label && c.label !== 'Actions'), selectionnes);
  }

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
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} aria-label="Filtrer par statut" className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {FILTRES_STATUT.map((f) => <option key={f.valeur} value={f.valeur}>{f.libelle}</option>)}
          <optgroup label="Par dates du compte">
            {FILTRES_DATES.map((f) => <option key={f.valeur} value={f.valeur}>{f.libelle}</option>)}
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

      <SelectionActionsBar
        nombre={selectionnes.length}
        onExporter={exporterSelection}
        onDesactiver={demanderDesactivation}
        onEffacer={() => setSelection(new Set())}
        enCours={desactivationEnCours}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable columns={columns} data={filtered} filename="utilisateurs" isLoading={isLoading} emptyState={{ message: 'Aucun utilisateur ne correspond aux filtres.' }} selectedIds={selection} onSelectionChange={setSelection} rowClassName={r => estInactif(r)
          // L'atténuation porte sur les cellules et non sur la ligne :
          // opacity sur le <tr> s'appliquerait aussi aux boutons d'action, et
          // aucun enfant ne peut la contrarier, la propriété créant un
          // contexte d'empilement. La dernière cellule, celle des actions, est
          // donc exclue pour que les trois boutons restent nets et se lisent
          // comme utilisables. Le fond coloré reste porté par la ligne, il
          // n'est pas concerné par l'opacité des cellules.
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
        onGroupsChanged={() => load({ silencieux: true })}
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

      <MotDePasseModal
        isOpen={!!motDePasse}
        utilisateur={motDePasse}
        onClose={() => setMotDePasse(null)}
      />

      <HistoriqueModal
        isOpen={!!historique}
        utilisateur={historique}
        onClose={() => setHistorique(null)}
      />

      <StatutCompteModal
        isOpen={!!statutModal}
        utilisateur={statutModal?.user}
        sens={statutModal?.sens}
        onClose={() => setStatutModal(null)}
        onConfirm={handleStatut}
      />

      <ConfirmModal
        isOpen={confirmDesactivation}
        onClose={() => setConfirmDesactivation(false)}
        onConfirm={desactiverSelection}
        title="Désactiver la sélection"
        message={messageConfirmation}
        confirmLabel={`Désactiver ${aDesactiver} compte${aDesactiver > 1 ? 's' : ''}`}
        isDestructive
      />

    </div>
  );
}
