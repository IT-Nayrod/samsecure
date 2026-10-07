// ProfilsPage - onglet Profils de l'administration (#249, étendu « tout est
// profil » #276, permission gerer_profils). Un seul écran pour tout le cycle
// de vie :
//   - profils par défaut (IT Ops, Financier, Manager DSI, IT Data input) :
//     inaltérables (ni suppression ni renommage), matrice par défaut et
//     matrices par société configurables ;
//   - profil système admin_sam : consultable, entièrement figé ;
//   - profils ajoutés : création (avec dashboard de référence optionnel),
//     renommage, matrices comme un profil par défaut, suppression douce vers
//     la corbeille (#64) et restauration.
// L'enregistrement d'une matrice est un remplacement complet (Q2) ; une
// évolution du défaut ne touche jamais une société configurée. Les refus du
// serveur (profil verrouillé, délégation #278) sont affichés tels quels.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Building2, Plus, Archive, RotateCcw, Trash2, Lock } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import SlideOver from '../ui/SlideOver';
import ConfirmModal from '../ui/ConfirmModal';
import ProfileBadge from '../users/ProfileBadge';
import SocieteSelector from '../ui/SocieteSelector';
import MatricePermissions from './MatricePermissions';
import { formatDate } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import { validateRequired } from '../../utils/validation';
import { groupsService, permissionsService, societesService, profilsService } from '../../services/adminService';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

// Types traités comme « profil ajouté » : 'ajoute' (migration 097) et
// 'groupe' tant que la bascule n'est pas jouée partout (même règle que le
// serveur, droitsRegles.js).
const TYPES_AJOUTES = ['groupe', 'ajoute'];

// Dashboard de référence d'un profil ajouté (#276) : le choix pose la
// permission acceder_dashboard_* dans la matrice par défaut initiale.
const DASHBOARDS_REFERENCE = [
  { code: 'manager_dsi', label: 'Manager DSI' },
  { code: 'financier', label: 'Financier' },
  { code: 'it_ops', label: 'IT Ops' },
];

function slugify(label) {
  return label
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

function estAjoute(profil) {
  return TYPES_AJOUTES.includes(profil?.type);
}

function badgeType(type) {
  if (type === 'systeme') return <Badge variant="warning" label="Système" />;
  if (TYPES_AJOUTES.includes(type)) return <Badge variant="success" label="Ajouté" />;
  return <Badge variant="neutral" label="Par défaut" />;
}

export default function ProfilsPage() {
  const { addToast } = useToast();
  const [profils, setProfils] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [societes, setSocietes] = useState([]);
  const [configurees, setConfigurees] = useState({}); // { profilId: [{id_societe, raison_sociale, configure_le, configure_par_label}] }
  const [corbeille, setCorbeille] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [corbeilleOpen, setCorbeilleOpen] = useState(false);
  const [restauration, setRestauration] = useState(null); // id en cours

  const [createModal, setCreateModal] = useState(false);
  const [nouveau, setNouveau] = useState({ label: '', description: '', dashboard_reference: '' });
  const [errors, setErrors] = useState({});
  const [creating, setCreating] = useState(false);

  const [detail, setDetail] = useState(null);
  const [identite, setIdentite] = useState({ label: '', description: '' });
  const [savingIdentite, setSavingIdentite] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [initialIds, setInitialIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [applySelection, setApplySelection] = useState([]);
  const [applying, setApplying] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async ({ silencieux = false } = {}) => {
    if (!silencieux) setIsLoading(true);
    try {
      const [g, c, s, cb] = await Promise.all([
        groupsService.list(), permissionsService.list(), societesService.list(),
        // La lecture de la corbeille déclenche la purge des 90 jours côté API.
        groupsService.listCorbeille(),
      ]);
      setProfils(g);
      setCatalogue(c);
      setSocietes(s);
      setCorbeille(cb);
      // Sociétés configurées : pour tout profil configurable par société
      // (par défaut et ajoutés), jamais pour le profil système.
      const configurables = g.filter((p) => p.type !== 'systeme');
      const confs = await Promise.all(configurables.map((p) => profilsService.societesConfigurees(p.id)));
      const map = {};
      configurables.forEach((p, i) => { map[p.id] = confs[i]; });
      setConfigurees(map);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const lectureSeule = detail?.type === 'systeme';
  const detailAjoute = estAjoute(detail);

  const dirty = useMemo(() => {
    if (selectedIds.size !== initialIds.size) return true;
    for (const id of selectedIds) if (!initialIds.has(id)) return true;
    return false;
  }, [selectedIds, initialIds]);

  const identiteDirty = detail && (identite.label !== (detail.label || '') || identite.description !== (detail.description || ''));

  async function openDetail(profil) {
    setDetail(profil);
    setIdentite({ label: profil.label || '', description: profil.description || '' });
    setSelectedIds(new Set());
    setInitialIds(new Set());
    setApplySelection([]);
    try {
      const perms = await groupsService.listPermissions(profil.id);
      const ids = new Set(perms.map((p) => p.id));
      setSelectedIds(ids);
      setInitialIds(new Set(ids));
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  function togglePermission(permId, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(permId); else next.delete(permId);
      return next;
    });
  }

  async function creerProfil() {
    const err = validateRequired(nouveau.label, 'Le libellé');
    if (err) { setErrors({ label: err }); return; }
    setCreating(true);
    try {
      const code = slugify(nouveau.label) || `profil_${Date.now()}`;
      await groupsService.create({
        code,
        label: nouveau.label.trim(),
        description: nouveau.description.trim() || null,
        dashboard_reference: nouveau.dashboard_reference || null,
      });
      addToast({ type: 'success', message: 'Profil créé.' });
      setCreateModal(false);
      setNouveau({ label: '', description: '', dashboard_reference: '' });
      setErrors({});
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setCreating(false);
    }
  }

  async function enregistrerIdentite() {
    if (!detail) return;
    const err = validateRequired(identite.label, 'Le libellé');
    if (err) { addToast({ type: 'error', message: err }); return; }
    setSavingIdentite(true);
    try {
      const maj = await groupsService.update(detail.id, {
        label: identite.label.trim(),
        description: identite.description.trim() || null,
      });
      setDetail(maj);
      addToast({ type: 'success', message: 'Profil mis à jour.' });
      await load({ silencieux: true });
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setSavingIdentite(false);
    }
  }

  async function enregistrerMatrice() {
    if (!detail) return;
    setSaving(true);
    try {
      await profilsService.remplacerMatrice(detail.id, Array.from(selectedIds));
      setInitialIds(new Set(selectedIds));
      addToast({ type: 'success', message: `Matrice par défaut du profil "${detail.label}" enregistrée.` });
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  }

  function demanderApplication() {
    if (!detail || !applySelection.length) return;
    const noms = applySelection
      .map((id) => societes.find((s) => s.id === id)?.raison_sociale || id)
      .join(', ');
    setConfirm({
      title: 'Appliquer la matrice',
      confirmLabel: 'Appliquer',
      message: `Appliquer la matrice par défaut du profil "${detail.label}" à : ${noms} ? Chaque société devient configurée : elle fige cette matrice et ne suivra plus les évolutions du défaut. Une société déjà configurée est remplacée.`,
      action: appliquerMatrice,
    });
  }

  async function appliquerMatrice() {
    if (!detail) return;
    setApplying(true);
    try {
      if (dirty) {
        // La matrice affichée n'est pas enregistrée : l'appliquer en masse
        // enverrait l'ancienne version. On enregistre d'abord.
        await profilsService.remplacerMatrice(detail.id, Array.from(selectedIds));
        setInitialIds(new Set(selectedIds));
      }
      const resultat = await profilsService.appliquerMatrice(detail.id, applySelection);
      addToast({ type: 'success', message: `Matrice appliquée : ${resultat.societes_configurees} société(s) configurée(s).` });
      setApplySelection([]);
      await load({ silencieux: true });
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setApplying(false);
    }
  }

  async function demanderSuppression(profil) {
    try {
      const impact = await groupsService.impact(profil.id);
      const message = impact.utilisateurs.length
        ? `Ce profil est encore attribué à ${impact.utilisateurs.length} utilisateur(s) : ${impact.utilisateurs.map((u) => `${u.prenom} ${u.nom}`).join(', ')}. Le supprimer retirera ces attributions, restaurables depuis la corbeille pendant 90 jours. Continuer ?`
        : `Placer le profil "${profil.label}" dans la corbeille ? Il restera restaurable pendant 90 jours.`;
      setConfirm({
        title: 'Supprimer le profil',
        confirmLabel: 'Supprimer',
        destructive: true,
        message,
        action: async () => {
          try {
            await groupsService.remove(profil.id);
            addToast({ type: 'success', message: 'Profil placé dans la corbeille.' });
            if (detail?.id === profil.id) setDetail(null);
            await load();
          } catch (err) {
            // Message de l'API tel quel, jamais reconstruit.
            addToast({ type: 'error', message: err.message });
          }
        },
      });
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  async function restaurer(profil) {
    setRestauration(profil.id);
    try {
      await groupsService.restore(profil.id);
      addToast({ type: 'success', message: `Profil "${profil.label}" restauré.` });
      await load({ silencieux: true });
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setRestauration(null);
    }
  }

  const columns = [
    { key: 'label', label: 'Profil', sortable: true, render: r => <ProfileBadge profil={r.code} label={r.label} /> },
    { key: 'description', label: 'Description' },
    {
      key: 'type', label: 'Type', render: r => (
        <span className="inline-flex items-center gap-1.5">
          {badgeType(r.type)}
          {!estAjoute(r) && <Lock size={12} className="text-gray-400" aria-label="Ni suppression ni renommage" />}
        </span>
      ),
    },
    {
      key: 'configurees', label: 'Sociétés configurées', render: r => {
        if (r.type === 'systeme') return <span className="text-xs text-gray-400">—</span>;
        const n = (configurees[r.id] || []).length;
        return (
          <span className="text-xs text-gray-500">
            {n === 0 ? 'Aucune, toutes suivent le défaut' : `${n} société${n > 1 ? 's' : ''}`}
          </span>
        );
      },
    },
    {
      key: 'actions', label: 'Actions', render: r => (
        <div className="flex items-center gap-1">
          <button onClick={() => openDetail(r)} aria-label="Gérer" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <Pencil size={14} />
          </button>
          {estAjoute(r) && (
            <button onClick={(e) => { e.stopPropagation(); demanderSuppression(r); }} aria-label="Supprimer" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const detailConfigurees = detail ? (configurees[detail.id] || []) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Profils</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Profils par défaut verrouillés et profils ajoutés. La matrice par défaut vaut pour toute société non configurée ; une société configurée depuis sa fiche fige la sienne.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setCorbeilleOpen(true)}>
            <Archive size={15} /> Corbeille ({corbeille.length})
          </Button>
          <Button variant="primary" onClick={() => setCreateModal(true)}>
            <Plus size={15} /> Nouveau profil
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable columns={columns} data={profils} filename="profils" isLoading={isLoading} onRowClick={openDetail} emptyState={{ message: 'Aucun profil.' }} />
      </div>

      <SlideOver isOpen={createModal} onClose={() => setCreateModal(false)} title="Nouveau profil" size="sm"
        footer={<><Button variant="secondary" onClick={() => setCreateModal(false)}>Annuler</Button><Button variant="primary" onClick={creerProfil} isLoading={creating}>Créer</Button></>}
      >
        <div className="flex flex-col gap-4">
          <FormField label="Libellé" required error={errors.label}>
            <input className={INPUT_CLS} value={nouveau.label} onChange={e => setNouveau(v => ({ ...v, label: e.target.value }))} />
          </FormField>
          <FormField label="Description">
            <textarea className={INPUT_CLS} rows={3} value={nouveau.description} onChange={e => setNouveau(v => ({ ...v, description: e.target.value }))} />
          </FormField>
          <FormField label="Dashboard de référence" hint="Optionnel : le profil reçoit la permission du tableau de bord choisi dans sa matrice par défaut, modifiable ensuite comme les autres permissions.">
            <select className={INPUT_CLS} value={nouveau.dashboard_reference} onChange={e => setNouveau(v => ({ ...v, dashboard_reference: e.target.value }))}>
              <option value="">Aucun</option>
              {DASHBOARDS_REFERENCE.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
            </select>
          </FormField>
          {nouveau.label && <p className="text-xs text-gray-400">Code généré : {slugify(nouveau.label)}</p>}
        </div>
      </SlideOver>

      <SlideOver
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Profil "${detail.label}"` : ''}
        size="lg"
        footer={!lectureSeule && (
          <>
            <Button variant="secondary" onClick={() => setDetail(null)}>Fermer</Button>
            <Button variant="primary" onClick={enregistrerMatrice} isLoading={saving} disabled={!dirty}>
              Enregistrer la matrice par défaut
            </Button>
          </>
        )}
      >
        {detail && (
          <div className="flex flex-col gap-6">
            {lectureSeule && (
              <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 rounded-lg px-3 py-2">
                Profil système : matrice complète en lecture seule, non configurable par société.
              </p>
            )}
            {!lectureSeule && !detailAjoute && (
              <p className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                Profil par défaut de la plateforme : ni suppression ni renommage. Sa matrice par défaut est celle du tenant ; l'enregistrement la remplace intégralement et ne touche pas les sociétés configurées.
              </p>
            )}
            {detailAjoute && (
              <section>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                  Identité
                </h3>
                <div className="flex flex-col gap-3">
                  <FormField label="Libellé" required>
                    <input className={INPUT_CLS} value={identite.label} onChange={e => setIdentite(v => ({ ...v, label: e.target.value }))} />
                  </FormField>
                  <FormField label="Description">
                    <textarea className={INPUT_CLS} rows={2} value={identite.description} onChange={e => setIdentite(v => ({ ...v, description: e.target.value }))} />
                  </FormField>
                  <div className="flex justify-end">
                    <Button variant="secondary" size="sm" onClick={enregistrerIdentite} isLoading={savingIdentite} disabled={!identiteDirty}>
                      Enregistrer l'identité
                    </Button>
                  </div>
                </div>
              </section>
            )}

            <section>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                Matrice par défaut
              </h3>
              <MatricePermissions
                catalogue={catalogue}
                selectedIds={selectedIds}
                onToggle={togglePermission}
                disabled={lectureSeule}
              />
            </section>

            {!lectureSeule && (
              <>
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                    Sociétés configurées ({detailConfigurees.length})
                  </h3>
                  {detailConfigurees.length === 0 ? (
                    <p className="text-sm text-gray-400">Aucune société configurée : toutes suivent le défaut.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {detailConfigurees.map((c) => (
                        <div key={c.id_societe} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                          <Link
                            to={`/referentiels/organisation/${c.id_societe}?tab=profils`}
                            className="flex items-center gap-2 text-blue-800 dark:text-blue-400 hover:underline"
                          >
                            <Building2 size={14} /> {c.raison_sociale}
                          </Link>
                          <span className="text-xs text-gray-400">
                            Configuré le {formatDate(c.configure_le)}{c.configure_par_label ? ` par ${c.configure_par_label}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                    Appliquer la matrice à des sociétés
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Paramétrage en masse : chaque société sélectionnée reçoit la matrice par défaut ci-dessus et devient configurée.
                  </p>
                  <SocieteSelector
                    organisations={societes}
                    selectedIds={applySelection}
                    onChange={setApplySelection}
                  />
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="secondary"
                      onClick={demanderApplication}
                      isLoading={applying}
                      disabled={!applySelection.length}
                    >
                      Appliquer à {applySelection.length || 'ces'} société{applySelection.length > 1 ? 's' : ''}
                    </Button>
                  </div>
                </section>
              </>
            )}

            {detailAjoute && (
              <section>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                  Suppression
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  La suppression est douce : le profil part en corbeille avec ses droits et ses attributions, restaurable pendant 90 jours.
                </p>
                <Button variant="secondary" onClick={() => demanderSuppression(detail)}>
                  <Trash2 size={14} /> Placer dans la corbeille
                </Button>
              </section>
            )}
          </div>
        )}
      </SlideOver>

      <SlideOver isOpen={corbeilleOpen} onClose={() => setCorbeilleOpen(false)} title="Corbeille des profils" size="sm">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            Un profil supprimé reste restaurable pendant 90 jours, avec ses droits et ses attributions. Au-delà, il est purgé définitivement.
          </p>
          {corbeille.length === 0 && (
            <p className="text-sm text-gray-500 py-6 text-center">La corbeille est vide.</p>
          )}
          {corbeille.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.label}</p>
                <p className="text-xs text-gray-500">
                  Supprimé le {formatDate(p.date_suppression)} — {p.jours_restants} jour{p.jours_restants > 1 ? 's' : ''} restant{p.jours_restants > 1 ? 's' : ''}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => restaurer(p)} isLoading={restauration === p.id}>
                <RotateCcw size={14} /> Restaurer
              </Button>
            </div>
          ))}
        </div>
      </SlideOver>

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => { confirm?.action(); setConfirm(null); }}
        title={confirm?.title}
        message={confirm?.message}
        isDestructive={confirm?.destructive}
        confirmLabel={confirm?.confirmLabel}
      />
    </div>
  );
}
