// ProfilsPage - onglet Profils de l'administration (#249, permission
// gerer_profils) : éditeur de la matrice PAR DÉFAUT du tenant pour chaque
// profil par défaut, liste des sociétés configurées (lien vers la fiche
// société) et paramétrage en masse (appliquer la matrice à plusieurs sociétés,
// chacune devenant configurée).
//
// L'enregistrement est un remplacement complet (Q2, PUT /profils/:id/matrice),
// plus une sauvegarde case par case : une évolution du défaut ne touche jamais
// une société configurée, le bouton Enregistrer rend ce moment explicite.
// Le profil système admin_sam reste consultable mais figé.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Building2 } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import SlideOver from '../ui/SlideOver';
import ConfirmModal from '../ui/ConfirmModal';
import ProfileBadge from '../users/ProfileBadge';
import SocieteSelector from '../ui/SocieteSelector';
import MatricePermissions from './MatricePermissions';
import { formatDate } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import { groupsService, permissionsService, societesService, profilsService } from '../../services/adminService';

export default function ProfilsPage() {
  const { addToast } = useToast();
  const [profils, setProfils] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [societes, setSocietes] = useState([]);
  const [configurees, setConfigurees] = useState({}); // { profilId: [{id_societe, raison_sociale, configure_le, configure_par_label}] }
  const [isLoading, setIsLoading] = useState(true);

  const [detail, setDetail] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [initialIds, setInitialIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [applySelection, setApplySelection] = useState([]);
  const [applying, setApplying] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async ({ silencieux = false } = {}) => {
    if (!silencieux) setIsLoading(true);
    try {
      const [g, c, s] = await Promise.all([
        groupsService.list(), permissionsService.list(), societesService.list(),
      ]);
      // L'écran ne montre que les profils de la plateforme : par défaut et
      // système (074). Les groupes ont leur onglet.
      const seuls = g.filter((p) => p.type !== 'groupe');
      setProfils(seuls);
      setCatalogue(c);
      setSocietes(s);
      const confs = await Promise.all(seuls.map((p) =>
        p.type === 'profil_defaut' ? profilsService.societesConfigurees(p.id) : Promise.resolve([])
      ));
      const map = {};
      seuls.forEach((p, i) => { map[p.id] = confs[i]; });
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
  const dirty = useMemo(() => {
    if (selectedIds.size !== initialIds.size) return true;
    for (const id of selectedIds) if (!initialIds.has(id)) return true;
    return false;
  }, [selectedIds, initialIds]);

  async function openDetail(profil) {
    setDetail(profil);
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

  const columns = [
    { key: 'label', label: 'Profil', sortable: true, render: r => <ProfileBadge profil={r.code} label={r.label} /> },
    { key: 'description', label: 'Description' },
    {
      key: 'type', label: 'Type', render: r => (
        <Badge variant={r.type === 'systeme' ? 'warning' : 'neutral'} label={r.type === 'systeme' ? 'Système' : 'Par défaut'} />
      ),
    },
    {
      key: 'configurees', label: 'Sociétés configurées', render: r => {
        const n = (configurees[r.id] || []).length;
        if (r.type !== 'profil_defaut') return <span className="text-xs text-gray-400">—</span>;
        return (
          <span className="text-xs text-gray-500">
            {n === 0 ? 'Aucune, toutes suivent le défaut' : `${n} société${n > 1 ? 's' : ''}`}
          </span>
        );
      },
    },
    {
      key: 'actions', label: 'Actions', render: r => (
        <button onClick={() => openDetail(r)} aria-label="Gérer" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
          <Pencil size={14} />
        </button>
      ),
    },
  ];

  const detailConfigurees = detail ? (configurees[detail.id] || []) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Profils</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Matrice par défaut du tenant pour chaque profil. Une société configurée depuis sa fiche fige sa propre matrice : les évolutions du défaut ne la touchent plus.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable columns={columns} data={profils} filename="profils" isLoading={isLoading} onRowClick={openDetail} emptyState={{ message: 'Aucun profil.' }} />
      </div>

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
            {lectureSeule ? (
              <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 rounded-lg px-3 py-2">
                Profil système : matrice complète en lecture seule, non configurable par société.
              </p>
            ) : (
              <p className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                Cette matrice est le défaut du tenant : elle s'applique à toute société non configurée. L'enregistrement la remplace intégralement et ne touche pas les sociétés configurées.
              </p>
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

            {detail.type === 'profil_defaut' && (
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
          </div>
        )}
      </SlideOver>

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => { confirm?.action(); setConfirm(null); }}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Appliquer"
      />
    </div>
  );
}
