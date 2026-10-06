// GroupesPage - groupes de droits personnalisés : CRUD, matrice de permissions
// par module avec sauvegarde immédiate, corbeille #64 (90 jours avant purge,
// restauration).
//
// Refonte #249 : l'écran ne sert plus que les groupes (type 'groupe', 074).
// Les profils par défaut ont leur propre onglet (ProfilsPage, matrice par
// défaut et configuration par société). Un groupe ne porte plus de sociétés de
// diffusion (#57) : sa portée suit le rattachement des utilisateurs, la
// section Diffusion et les règles d'intersection ont disparu.
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Trash2, Plus, Archive, RotateCcw } from 'lucide-react';
import DataTable from '../ui/DataTable';
import { formatDate } from '../../utils/dateUtils';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import SlideOver from '../ui/SlideOver';
import ConfirmModal from '../ui/ConfirmModal';
import ProfileBadge from '../users/ProfileBadge';
import GroupUsersSection from './GroupUsersSection';
import { useToast } from '../../hooks/useToast';
import { validateRequired } from '../../utils/validation';
import { groupsService, permissionsService, usersService, attributionsService } from '../../services/adminService';
import { MODULES } from '../../constants/permissions';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

function slugify(label) {
  return label
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

export default function GroupesPage() {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [users, setUsers] = useState([]);
  const [attributions, setAttributions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [corbeille, setCorbeille] = useState([]);
  const [corbeilleOpen, setCorbeilleOpen] = useState(false);
  const [restauration, setRestauration] = useState(null); // id en cours

  const [createModal, setCreateModal] = useState(false);
  const [newGroup, setNewGroup] = useState({ label: '', description: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState(null); // groupe sélectionné
  const [detailPermissions, setDetailPermissions] = useState([]);
  const [confirm, setConfirm] = useState(null);
  // Fiche réellement ouverte et cases dont l'écriture est en vol : des refs,
  // pour que les réponses asynchrones lisent l'état courant et non celui du
  // rendu qui a lancé l'appel.
  const detailIdRef = useRef(null);
  const togglesEnCours = useRef(new Set());
  const relectureRequise = useRef(false);

  // silencieux (#169) : rechargement demandé depuis la fiche ouverte (coche
  // d'un utilisateur). Sans lui, chaque coche basculait la liste d'arrière-plan
  // en squelette : la page raccourcissait, son défilement retombait en haut et
  // la liste clignotait derrière le panneau. Les données sont remplacées sur
  // place, le squelette reste réservé au premier chargement et aux créations
  // et suppressions de groupe.
  const load = useCallback(async ({ silencieux = false } = {}) => {
    if (!silencieux) setIsLoading(true);
    try {
      const [g, c, u, a, cb] = await Promise.all([
        groupsService.list(), permissionsService.list(),
        usersService.list(), attributionsService.listAll(),
        // La lecture de la corbeille déclenche la purge des 90 jours côté API.
        groupsService.listCorbeille(),
      ]);
      setGroups(g);
      setCorbeille(cb);
      setCatalogue(c);
      setUsers(u);
      setAttributions(a);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // Ouverture directe de la fiche d'un groupe ciblé par l'URL (?groupId=).
  useEffect(() => {
    const groupId = searchParams.get('groupId');
    if (!groupId || !groups.length) return;
    const target = groups.find((g) => g.id === groupId);
    if (target) openDetail(target);
    const next = new URLSearchParams(searchParams);
    next.delete('groupId');
    next.delete('tab');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  // L'écran ne montre que les groupes personnalisés : les profils par défaut
  // et système vivent dans l'onglet Profils (074, #249).
  const visibles = useMemo(() => groups.filter((g) => g.type === 'groupe'), [groups]);

  async function handleCreate() {
    const err = validateRequired(newGroup.label, 'Le libellé');
    if (err) { setErrors({ label: err }); return; }
    setSaving(true);
    try {
      const code = slugify(newGroup.label) || `groupe_${Date.now()}`;
      // #57 : plus de diffusion à poser, le groupe vaut pour le rattachement
      // de chacun de ses porteurs.
      await groupsService.create({ code, label: newGroup.label.trim(), description: newGroup.description.trim() || null });
      addToast({ type: 'success', message: 'Groupe créé.' });
      setCreateModal(false);
      setNewGroup({ label: '', description: '' });
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function askDelete(group) {
    try {
      const impact = await groupsService.impact(group.id);
      const message = impact.utilisateurs.length
        ? `Ce groupe est encore attribué à ${impact.utilisateurs.length} utilisateur(s) : ${impact.utilisateurs.map(u => `${u.prenom} ${u.nom}`).join(', ')}. Le supprimer retirera ces attributions, restaurables depuis la corbeille pendant 90 jours. Continuer ?`
        : `Placer le groupe "${group.label}" dans la corbeille ? Il restera restaurable pendant 90 jours.`;
      setConfirm({
        title: 'Supprimer le groupe',
        message,
        destructive: true,
        action: async () => {
          await groupsService.remove(group.id);
          addToast({ type: 'success', message: 'Groupe placé dans la corbeille.' });
          await load();
        },
      });
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  async function restaurer(groupe) {
    setRestauration(groupe.id);
    try {
      await groupsService.restore(groupe.id);
      addToast({ type: 'success', message: `Groupe "${groupe.label}" restauré.` });
      await load({ silencieux: true });
    } catch (err) {
      // Message de l'API tel quel, jamais reconstruit.
      addToast({ type: 'error', message: err.message });
    } finally {
      setRestauration(null);
    }
  }

  async function openDetail(group) {
    setDetail(group);
    detailIdRef.current = group.id;
    // La matrice du groupe précédent ne doit pas rester affichée sous le titre
    // du nouveau : une coche porterait sur un état qui n'est pas le sien.
    setDetailPermissions([]);
    try {
      const perms = await groupsService.listPermissions(group.id);
      // Réponse tardive d'une fiche refermée ou remplacée : ignorée.
      if (detailIdRef.current === group.id) setDetailPermissions(perms);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  function closeDetail() {
    detailIdRef.current = null;
    relectureRequise.current = false;
    setDetail(null);
  }

  // Sauvegarde immédiate d'une case. La coche est appliquée tout de suite à
  // l'écran puis confirmée par l'API : en enchaînant plusieurs droits, chaque
  // case répond au clic sans attendre la précédente. En cas de refus (#170),
  // le message du serveur est affiché tel quel et la matrice est relue, pour
  // que l'écran montre l'état réel du groupe et non une supposition.
  async function togglePermission(permId, checked) {
    if (!detail) return;
    const groupId = detail.id;
    const cle = `${groupId}:${permId}`;
    // Une case dont l'écriture est encore en vol ignore le clic suivant : deux
    // appels contraires sur le même droit arriveraient dans un ordre non garanti.
    if (togglesEnCours.current.has(cle)) return;
    togglesEnCours.current.add(cle);
    setDetailPermissions((prev) => {
      const sans = prev.filter((p) => p.id !== permId);
      const perm = catalogue.find((p) => p.id === permId);
      return checked && perm ? [...sans, perm] : sans;
    });
    try {
      if (checked) await groupsService.addPermission(groupId, permId);
      else await groupsService.removePermission(groupId, permId);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
      relectureRequise.current = true;
    } finally {
      togglesEnCours.current.delete(cle);
      await relireApresRefus(groupId);
    }
  }

  // Relecture de la matrice après un refus, une fois toutes les écritures en
  // vol retombées : relire plus tôt montrerait comme décochée une case dont
  // l'ajout n'est pas encore validé en base. Si une nouvelle coche part pendant
  // la relecture, son résultat est écarté et la relecture est reportée à la fin
  // de cette coche.
  async function relireApresRefus(groupId) {
    if (!relectureRequise.current || togglesEnCours.current.size > 0) return;
    relectureRequise.current = false;
    try {
      const perms = await groupsService.listPermissions(groupId);
      if (detailIdRef.current !== groupId) return;
      if (togglesEnCours.current.size > 0) { relectureRequise.current = true; return; }
      setDetailPermissions(perms);
    } catch {
      // La relecture a échoué elle aussi : le message du refus suffit.
    }
  }

  // Regroupement par module dans l'ordre et avec les libellés de la sandbox
  // (const MODULES, index.html), reste du catalogue sous "Autre".
  const modules = useMemo(() => {
    const groups = MODULES.map((m) => [m.label, catalogue.filter((p) => p.module === m.code)])
      .filter(([, perms]) => perms.length > 0);
    const connus = new Set(MODULES.map((m) => m.code));
    const autres = catalogue.filter((p) => !connus.has(p.module));
    if (autres.length) groups.push(['Autre', autres]);
    return groups;
  }, [catalogue]);

  const detailPermIds = new Set(detailPermissions.map((p) => p.id));

  const columns = [
    { key: 'label', label: 'Groupe', sortable: true, render: r => <ProfileBadge profil={r.code} label={r.label} /> },
    { key: 'description', label: 'Description' },
    {
      key: 'actions', label: 'Actions', render: r => (
        <div className="flex items-center gap-1">
          <button onClick={() => openDetail(r)} aria-label="Gérer" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <Pencil size={14} />
          </button>
          <button onClick={() => askDelete(r)} aria-label="Supprimer" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600">
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
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Groupes personnalisés</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {visibles.length} groupe{visibles.length > 1 ? 's' : ''} — un groupe s'ajoute au profil de l'utilisateur, sur son rattachement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setCorbeilleOpen(true)}>
            <Archive size={15} /> Corbeille ({corbeille.length})
          </Button>
          <Button variant="primary" onClick={() => setCreateModal(true)}>
            <Plus size={15} /> Nouveau groupe
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable columns={columns} data={visibles} filename="groupes" isLoading={isLoading} onRowClick={openDetail} emptyState={{ message: 'Aucun groupe.' }} />
      </div>

      <SlideOver isOpen={createModal} onClose={() => setCreateModal(false)} title="Nouveau groupe" size="sm"
        footer={<><Button variant="secondary" onClick={() => setCreateModal(false)}>Annuler</Button><Button variant="primary" onClick={handleCreate} isLoading={saving}>Créer</Button></>}
      >
        <div className="flex flex-col gap-4">
          <FormField label="Libellé" required error={errors.label}>
            <input className={INPUT_CLS} value={newGroup.label} onChange={e => setNewGroup(v => ({ ...v, label: e.target.value }))} />
          </FormField>
          <FormField label="Description">
            <textarea className={INPUT_CLS} rows={3} value={newGroup.description} onChange={e => setNewGroup(v => ({ ...v, description: e.target.value }))} />
          </FormField>
          {newGroup.label && <p className="text-xs text-gray-400">Code généré : {slugify(newGroup.label)}</p>}
        </div>
      </SlideOver>

      <SlideOver isOpen={!!detail} onClose={closeDetail} title={detail ? `Groupe "${detail.label}"` : ''} size="lg">
        {detail && (
          <div className="flex flex-col gap-6">
            <section>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">Permissions</h3>
              <div className="flex flex-col gap-4">
                {modules.map(([moduleName, perms]) => (
                  <div key={moduleName}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{moduleName}</p>
                    <div className="flex flex-col gap-1">
                      {perms.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                          <input type="checkbox" checked={detailPermIds.has(p.id)} onChange={(e) => togglePermission(p.id, e.target.checked)} className="rounded border-gray-300" />
                          <span className="text-gray-700 dark:text-gray-200">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <GroupUsersSection
              groupId={detail.id}
              users={users}
              attributions={attributions}
              onChange={() => load({ silencieux: true })}
            />
          </div>
        )}
      </SlideOver>

      <SlideOver isOpen={corbeilleOpen} onClose={() => setCorbeilleOpen(false)} title="Corbeille des groupes" size="sm">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            Un groupe supprimé reste restaurable pendant 90 jours, avec ses droits et ses attributions. Au-delà, il est purgé définitivement.
          </p>
          {corbeille.length === 0 && (
            <p className="text-sm text-gray-500 py-6 text-center">La corbeille est vide.</p>
          )}
          {corbeille.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-3 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{g.label}</p>
                <p className="text-xs text-gray-500">
                  Supprimé le {formatDate(g.date_suppression)} — {g.jours_restants} jour{g.jours_restants > 1 ? 's' : ''} restant{g.jours_restants > 1 ? 's' : ''}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => restaurer(g)} isLoading={restauration === g.id}>
                <RotateCcw size={14} /> Restaurer
              </Button>
            </div>
          ))}
        </div>
      </SlideOver>

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.action ?? (() => {})}
        title={confirm?.title}
        message={confirm?.message}
        isDestructive={confirm?.destructive}
        confirmLabel="Supprimer"
      />
    </div>
  );
}
