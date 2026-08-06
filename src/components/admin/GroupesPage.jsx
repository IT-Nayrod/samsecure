// GroupesPage - CRUD des groupes (profils), diffusion tenant/sociétés,
// matrice de permissions par module avec sauvegarde immédiate.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Trash2, Plus } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import SlideOver from '../ui/SlideOver';
import ConfirmModal from '../ui/ConfirmModal';
import ProfileBadge from '../users/ProfileBadge';
import SocieteSelector from '../ui/SocieteSelector';
import GroupUsersSection from './GroupUsersSection';
import { useToast } from '../../hooks/useToast';
import { validateRequired } from '../../utils/validation';
import { groupsService, permissionsService, societesService, usersService, attributionsService } from '../../services/adminService';
import { MODULES } from '../../constants/permissions';
import { isGroupAssignable } from '../../utils/attributionScope';

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
  const [societes, setSocietes] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [diffusions, setDiffusions] = useState({}); // { groupId: [{id, id_societe, raison_sociale}] }
  const [users, setUsers] = useState([]);
  const [userSocietesMap, setUserSocietesMap] = useState({}); // { userId: [id_societe|null] }
  const [attributions, setAttributions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [createModal, setCreateModal] = useState(false);
  const [newGroup, setNewGroup] = useState({ label: '', description: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState(null); // groupe sélectionné
  const [detailPermissions, setDetailPermissions] = useState([]);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [g, s, c, u, a] = await Promise.all([
        groupsService.list(), societesService.list(), permissionsService.list(),
        usersService.list(), attributionsService.listAll(),
      ]);
      setGroups(g);
      setSocietes(s);
      setCatalogue(c);
      setUsers(u);
      setAttributions(a);
      const diffs = await Promise.all(g.map((grp) => groupsService.listSocietes(grp.id)));
      const map = {};
      g.forEach((grp, i) => { map[grp.id] = diffs[i]; });
      setDiffusions(map);
      const rattachements = await Promise.all(u.map((usr) => usersService.listSocietes(usr.id)));
      const uMap = {};
      u.forEach((usr, i) => { uMap[usr.id] = rattachements[i].map((r) => r.id_societe); });
      setUserSocietesMap(uMap);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // Parcours de réassignation (depuis la suppression d'une organisation avec
  // groupes orphelins) : ouvre directement la fiche du groupe ciblé.
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

  function diffusionLabel(groupId) {
    const rows = diffusions[groupId] || [];
    if (rows.some((r) => r.id_societe === null)) return 'Toutes organisations (tenant)';
    if (!rows.length) return 'Aucune diffusion';
    return rows.map((r) => r.raison_sociale).join(', ');
  }

  async function handleCreate() {
    const err = validateRequired(newGroup.label, 'Le libellé');
    if (err) { setErrors({ label: err }); return; }
    setSaving(true);
    try {
      const code = slugify(newGroup.label) || `groupe_${Date.now()}`;
      const created = await groupsService.create({ code, label: newGroup.label.trim(), description: newGroup.description.trim() || null });
      await groupsService.addSociete(created.id, null); // diffusion tenant par défaut
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
      const parts = [];
      if (impact.utilisateurs.length) parts.push(`${impact.utilisateurs.length} utilisateur(s) : ${impact.utilisateurs.map(u => `${u.prenom} ${u.nom}`).join(', ')}`);
      if (impact.societes.length) parts.push(`${impact.societes.length} organisation(s) en diffusion spécifique : ${impact.societes.map(s => s.raison_sociale).join(', ')}`);
      const message = parts.length
        ? `Ce groupe est encore utilisé. ${parts.join(' — ')}. Le supprimer retirera ces attributions. Continuer ?`
        : `Supprimer le groupe "${group.label}" ?`;
      setConfirm({
        title: 'Supprimer le groupe',
        message,
        destructive: true,
        action: async () => {
          await groupsService.remove(group.id);
          addToast({ type: 'success', message: 'Groupe supprimé.' });
          await load();
        },
      });
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  async function openDetail(group) {
    setDetail(group);
    try {
      const perms = await groupsService.listPermissions(group.id);
      setDetailPermissions(perms);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  async function togglePermission(permId, checked) {
    if (!detail) return;
    try {
      if (checked) {
        await groupsService.addPermission(detail.id, permId);
        setDetailPermissions((prev) => [...prev, catalogue.find((p) => p.id === permId)]);
      } else {
        await groupsService.removePermission(detail.id, permId);
        setDetailPermissions((prev) => prev.filter((p) => p.id !== permId));
      }
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  // Attributions de ce groupe qui deviendraient hors intersection si la
  // diffusion perdait la portée `societeId` (null = portée tenant). Réévalue
  // CHAQUE attribution du groupe via la même fonction centralisée que les
  // cases à cocher (isGroupAssignable), pas seulement celles dont la portée
  // correspond exactement à la société retirée — un retrait qui fait passer
  // la diffusion de tenant à spécifique peut aussi invalider des attributions
  // prises à l'échelle tenant. L'API d'Antonin ne cascade cette suppression
  // que côté rattachement utilisateur (DELETE /utilisateurs/:id/societes/:id) ;
  // côté diffusion de groupe, on reproduit le même effet nous-mêmes avec les
  // endpoints existants, sans ajouter de route.
  function attributionsImpacteesParDiffusion(societeId) {
    if (!detail) return [];
    const diffusionActuelle = (diffusions[detail.id] || []).map((r) => r.id_societe);
    const nouvelleDiffusion = diffusionActuelle.filter((id) => id !== societeId);
    return attributions
      .filter((a) => a.id_profil === detail.id)
      .filter((a) => !isGroupAssignable(userSocietesMap[a.id_utilisateur] || [], nouvelleDiffusion));
  }

  async function purgerAttributions(impactees) {
    for (const a of impactees) {
      await attributionsService.remove(a.id_utilisateur, a.id);
    }
  }

  function confirmerRetraitDiffusion(societeId, label, doRemove) {
    const impactees = attributionsImpacteesParDiffusion(societeId);
    if (!impactees.length) { doRemove([]); return; }
    const liste = impactees.map((a) => {
      const u = users.find((x) => x.id === a.id_utilisateur);
      return u ? `${u.prenom} ${u.nom}` : a.id_utilisateur;
    }).join(' • ');
    setConfirm({
      title: 'Attributions impactées',
      message: `Retirer la diffusion "${label}" supprimera l'attribution de ce groupe pour : ${liste}. Continuer ?`,
      destructive: true,
      action: () => doRemove(impactees),
    });
  }

  async function toggleDiffusionTenant(activate) {
    if (!detail) return;
    const doToggle = async (impactees = []) => {
      try {
        await purgerAttributions(impactees);
        if (activate) {
          await groupsService.addSociete(detail.id, null);
        } else {
          const tenantRow = (diffusions[detail.id] || []).find((r) => r.id_societe === null);
          if (tenantRow) await groupsService.removeSociete(detail.id, tenantRow.id);
        }
        const rows = await groupsService.listSocietes(detail.id);
        setDiffusions((prev) => ({ ...prev, [detail.id]: rows }));
        await load();
      } catch (err) {
        addToast({ type: 'error', message: err.message });
      }
    };
    if (activate) await doToggle();
    else confirmerRetraitDiffusion(null, 'Échelle tenant', doToggle);
  }

  async function toggleDiffusionSociete(societeId, checked) {
    if (!detail) return;
    const doToggle = async (impactees = []) => {
      try {
        await purgerAttributions(impactees);
        if (checked) {
          await groupsService.addSociete(detail.id, societeId);
        } else {
          const row = (diffusions[detail.id] || []).find((r) => r.id_societe === societeId);
          if (row) await groupsService.removeSociete(detail.id, row.id);
        }
        const rows = await groupsService.listSocietes(detail.id);
        setDiffusions((prev) => ({ ...prev, [detail.id]: rows }));
        await load();
      } catch (err) {
        addToast({ type: 'error', message: err.message });
      }
    };
    if (checked) await doToggle();
    else confirmerRetraitDiffusion(societeId, societes.find((s) => s.id === societeId)?.raison_sociale || societeId, doToggle);
  }

  // SocieteSelector expose la sélection complète à chaque changement ; un
  // clic ne modifie qu'un seul id à la fois, donc un seul des deux tableaux
  // (ajoutés/retirés) contient une entrée.
  function handleDiffusionChange(newIds) {
    const oldIds = detailDiffusion.filter((r) => r.id_societe !== null).map((r) => r.id_societe);
    newIds.filter((id) => !oldIds.includes(id)).forEach((id) => toggleDiffusionSociete(id, true));
    oldIds.filter((id) => !newIds.includes(id)).forEach((id) => toggleDiffusionSociete(id, false));
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

  const detailDiffusion = detail ? (diffusions[detail.id] || []) : [];
  const isTenantDiffusion = detailDiffusion.some((r) => r.id_societe === null);
  const detailPermIds = new Set(detailPermissions.map((p) => p.id));

  const columns = [
    { key: 'label', label: 'Groupe', sortable: true, render: r => <ProfileBadge profil={r.code} label={r.label} /> },
    { key: 'description', label: 'Description' },
    { key: 'diffusion', label: 'Diffusion', render: r => <span className="text-xs text-gray-500">{diffusionLabel(r.id)}</span> },
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
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Groupes et droits</h1>
          <p className="text-sm text-gray-500 mt-0.5">{groups.length} groupe{groups.length > 1 ? 's' : ''}</p>
        </div>
        <Button variant="primary" onClick={() => setCreateModal(true)}>
          <Plus size={15} /> Nouveau groupe
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable columns={columns} data={groups} filename="groupes" isLoading={isLoading} onRowClick={openDetail} emptyState={{ message: 'Aucun groupe.' }} />
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

      <SlideOver isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `Groupe "${detail.label}"` : ''} size="lg">
        {detail && (
          <div className="flex flex-col gap-6">
            <section>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">Diffusion</h3>
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => toggleDiffusionTenant(true)} className={`flex-1 px-3 py-2 rounded-lg text-sm border ${isTenantDiffusion ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}>
                  Échelle tenant
                </button>
                <button type="button" onClick={() => toggleDiffusionTenant(false)} className={`flex-1 px-3 py-2 rounded-lg text-sm border ${!isTenantDiffusion ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}>
                  Organisations spécifiques
                </button>
              </div>
              {!isTenantDiffusion && (
                <SocieteSelector
                  organisations={societes}
                  selectedIds={detailDiffusion.filter((r) => r.id_societe !== null).map((r) => r.id_societe)}
                  onChange={handleDiffusionChange}
                />
              )}
            </section>

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
              groupSocieteIds={detailDiffusion.map((r) => r.id_societe)}
              users={users}
              userSocietesMap={userSocietesMap}
              attributions={attributions}
              onChange={load}
            />
          </div>
        )}
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
