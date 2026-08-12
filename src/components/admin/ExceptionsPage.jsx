// ExceptionsPage - exceptions de droits par utilisateur (accorder/retirer).
// Le retrait est prioritaire sur l'ajout, rappelé dans l'interface. Le motif
// est réellement obligatoire (front + serveur).
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trash2, Plus, Pencil, AlertTriangle } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import SlideOver from '../ui/SlideOver';
import ConfirmModal from '../ui/ConfirmModal';
import SocieteSelector from '../ui/SocieteSelector';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import { validateRequired } from '../../utils/validation';
import { exceptionsService, usersService, permissionsService, societesService } from '../../services/adminService';
import { MODULES } from '../../constants/permissions';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

const EMPTY = { userId: '', permissionId: '', portee: 'TOUT', type: 'accorde', motif: '', date_debut: '', date_fin: '' };

function isExpired(exc) {
  if (!exc.date_fin) return false;
  return exc.date_fin < new Date().toISOString().slice(0, 10);
}

export default function ExceptionsPage() {
  const { addToast } = useToast();
  const [exceptions, setExceptions] = useState([]);
  const [users, setUsers] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [societes, setSocietes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showExpired, setShowExpired] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ date_debut: '', date_fin: '', motif_modification: '' });

  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [e, u, c, s] = await Promise.all([
        exceptionsService.listAll(), usersService.list(), permissionsService.list(), societesService.list(),
      ]);
      setExceptions(e); setUsers(u); setCatalogue(c); setSocietes(s);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => exceptions.filter((e) => showExpired || !isExpired(e)),
    [exceptions, showExpired]
  );

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

  function validateForm() {
    const e = {};
    if (!form.userId) e.userId = 'Utilisateur requis';
    if (!form.permissionId) e.permissionId = 'Permission requise';
    if (form.portee !== 'TOUT' && !form.portee) e.portee = 'Sélectionnez une organisation ou "Tout le rattachement"';
    const motifErr = validateRequired(form.motif, 'Le motif');
    if (motifErr) e.motif = motifErr;
    return e;
  }

  async function handleCreate() {
    const e = validateForm();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await exceptionsService.create(form.userId, {
        id_permission: form.permissionId,
        id_societe: form.portee === 'TOUT' ? null : form.portee,
        type: form.type,
        motif: form.motif.trim(),
        date_debut: form.date_debut || null,
        date_fin: form.date_fin || null,
      });
      addToast({ type: 'success', message: 'Exception créée.' });
      setFormOpen(false);
      setForm(EMPTY);
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  }

  function openEdit(exc) {
    setEditing(exc);
    setEditForm({ date_debut: exc.date_debut || '', date_fin: exc.date_fin || '', motif_modification: '' });
  }

  async function handleEditSave() {
    if (!editing) return;
    const motifErr = validateRequired(editForm.motif_modification, 'Le motif de modification');
    if (motifErr) { addToast({ type: 'error', message: motifErr }); return; }
    try {
      await exceptionsService.update(editing.id_utilisateur, editing.id, {
        date_debut: editForm.date_debut || null,
        date_fin: editForm.date_fin || null,
        motif_modification: editForm.motif_modification.trim(),
      });
      addToast({ type: 'success', message: 'Exception modifiée.' });
      setEditing(null);
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  function askDelete(exc) {
    const user = users.find((u) => u.id === exc.id_utilisateur);
    const perm = catalogue.find((p) => p.id === exc.id_permission);
    setConfirm({
      title: 'Supprimer l\'exception',
      message: `Supprimer l'exception "${perm?.label}" (${exc.type}) pour ${user?.prenom} ${user?.nom} ?`,
      action: async () => {
        await exceptionsService.remove(exc.id_utilisateur, exc.id);
        addToast({ type: 'success', message: 'Exception supprimée.' });
        await load();
      },
    });
  }

  const columns = [
    { key: 'utilisateur', label: 'Utilisateur', render: r => { const u = users.find((x) => x.id === r.id_utilisateur); return u ? `${u.prenom} ${u.nom}` : r.id_utilisateur; } },
    { key: 'permission', label: 'Permission', render: r => catalogue.find((p) => p.id === r.id_permission)?.label || r.id_permission },
    { key: 'portee', label: 'Portée', render: r => r.id_societe ? (societes.find((s) => s.id === r.id_societe)?.raison_sociale || r.id_societe) : 'Tout le rattachement' },
    { key: 'type', label: 'Type', render: r => <Badge variant={r.type === 'retire' ? 'error' : 'success'} label={r.type === 'retire' ? 'Retrait' : 'Attribution'} /> },
    { key: 'motif', label: 'Motif' },
    { key: 'periode', label: 'Période', render: r => `${r.date_debut ? formatDate(r.date_debut) : '—'} → ${r.date_fin ? formatDate(r.date_fin) : 'sans fin'}` },
    { key: 'actions', label: 'Actions', render: r => (
      <div className="flex items-center gap-1">
        <button onClick={() => openEdit(r)} aria-label="Modifier" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil size={14} /></button>
        <button onClick={() => askDelete(r)} aria-label="Supprimer" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
      </div>
    ) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Exceptions</h1>
          <p className="text-sm text-gray-500 mt-0.5">{visible.length} exception{visible.length > 1 ? 's' : ''} affichée{visible.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={showExpired} onChange={e => setShowExpired(e.target.checked)} className="rounded border-gray-300" />
            Afficher les exceptions expirées
          </label>
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus size={15} /> Nouvelle exception
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable columns={columns} data={visible} filename="exceptions" isLoading={isLoading} emptyState={{ message: 'Aucune exception.' }} />
      </div>

      <SlideOver isOpen={formOpen} onClose={() => setFormOpen(false)} title="Nouvelle exception" size="md"
        footer={<><Button variant="secondary" onClick={() => setFormOpen(false)}>Annuler</Button><Button variant="primary" onClick={handleCreate} isLoading={saving}>Créer</Button></>}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">En cas de conflit, un retrait est toujours prioritaire sur une attribution pour la même permission et la même portée.</p>
          </div>

          <FormField label="Utilisateur" required error={errors.userId}>
            <select className={INPUT_CLS} value={form.userId} onChange={e => setForm(v => ({ ...v, userId: e.target.value }))}>
              <option value="">Choisir…</option>
              {users.filter((u) => u.actif).map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
            </select>
          </FormField>

          <FormField label="Permission" required error={errors.permissionId}>
            <select className={INPUT_CLS} value={form.permissionId} onChange={e => setForm(v => ({ ...v, permissionId: e.target.value }))}>
              <option value="">Choisir…</option>
              {modules.map(([moduleName, perms]) => (
                <optgroup key={moduleName} label={moduleName}>
                  {perms.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </optgroup>
              ))}
            </select>
          </FormField>

          <FormField label="Type">
            <select className={INPUT_CLS} value={form.type} onChange={e => setForm(v => ({ ...v, type: e.target.value }))}>
              <option value="accorde">Accorder</option>
              <option value="retire">Retirer</option>
            </select>
          </FormField>

          <FormField label="Portée" error={errors.portee}>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setForm(v => ({ ...v, portee: 'TOUT' }))}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border ${form.portee === 'TOUT' ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}
              >
                Tout le rattachement
              </button>
              <button
                type="button"
                onClick={() => setForm(v => ({ ...v, portee: v.portee === 'TOUT' ? '' : v.portee }))}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border ${form.portee !== 'TOUT' ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}
              >
                Organisation spécifique
              </button>
            </div>
            {form.portee !== 'TOUT' && (
              <SocieteSelector
                organisations={societes}
                multiple={false}
                selectedIds={form.portee ? [form.portee] : []}
                onChange={(ids) => setForm(v => ({ ...v, portee: ids[0] || '' }))}
              />
            )}
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date de début">
              <input type="date" className={INPUT_CLS} value={form.date_debut} onChange={e => setForm(v => ({ ...v, date_debut: e.target.value }))} />
            </FormField>
            <FormField label="Date de fin">
              <input type="date" className={INPUT_CLS} value={form.date_fin} onChange={e => setForm(v => ({ ...v, date_fin: e.target.value }))} />
            </FormField>
          </div>

          <FormField label="Motif" required error={errors.motif}>
            <textarea className={INPUT_CLS} rows={3} value={form.motif} onChange={e => setForm(v => ({ ...v, motif: e.target.value }))} placeholder="Justification de l'exception" />
          </FormField>
        </div>
      </SlideOver>

      <SlideOver isOpen={!!editing} onClose={() => setEditing(null)} title="Modifier l'exception" size="sm"
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Annuler</Button><Button variant="primary" onClick={handleEditSave}>Enregistrer</Button></>}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date de début">
              <input type="date" className={INPUT_CLS} value={editForm.date_debut} onChange={e => setEditForm(v => ({ ...v, date_debut: e.target.value }))} />
            </FormField>
            <FormField label="Date de fin">
              <input type="date" className={INPUT_CLS} value={editForm.date_fin} onChange={e => setEditForm(v => ({ ...v, date_fin: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Motif de la modification" required>
            <textarea className={INPUT_CLS} rows={3} value={editForm.motif_modification} onChange={e => setEditForm(v => ({ ...v, motif_modification: e.target.value }))} />
          </FormField>
        </div>
      </SlideOver>

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.action ?? (() => {})}
        title={confirm?.title}
        message={confirm?.message}
        isDestructive
        confirmLabel="Supprimer"
      />
    </div>
  );
}
