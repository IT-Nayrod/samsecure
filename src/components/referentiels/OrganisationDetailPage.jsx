// OrganisationDetailPage - fiche detail d'une organisation (donnees reelles)
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2, UserX } from 'lucide-react';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ConfirmModal from '../ui/ConfirmModal';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import OrganisationFormModal from './OrganisationFormModal';
import { useToast } from '../../hooks/useToast';
import { societesService, usersService, groupsService, attributionsService } from '../../services/adminService';
import { isGroupAssignable } from '../../utils/attributionScope';

export default function OrganisationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [organisations, setOrganisations] = useState([]);
  const [users, setUsers] = useState([]);
  const [userSocietesMap, setUserSocietesMap] = useState({}); // { userId: [id_societe|null] }
  const [groups, setGroups] = useState([]);
  const [groupDiffusions, setGroupDiffusions] = useState({}); // { groupId: [id_societe|null] }
  const [attributions, setAttributions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState(null);
  const [retraitInfo, setRetraitInfo] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rows, u, g, a] = await Promise.all([
        societesService.list(), usersService.list(), groupsService.list(), attributionsService.listAll(),
      ]);
      setOrganisations(rows);
      setUsers(u);
      setGroups(g);
      setAttributions(a);
      const rattachements = await Promise.all(u.map((usr) => usersService.listSocietes(usr.id)));
      const map = {};
      u.forEach((usr, i) => { map[usr.id] = rattachements[i].map((r) => r.id_societe); });
      setUserSocietesMap(map);
      const diffs = await Promise.all(g.map((grp) => groupsService.listSocietes(grp.id)));
      const gMap = {};
      g.forEach((grp, i) => { gMap[grp.id] = diffs[i].map((r) => r.id_societe); });
      setGroupDiffusions(gMap);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const organisation = organisations.find(o => o.id === id);

  if (isLoading) {
    return <p className="text-sm text-gray-400">Chargement…</p>;
  }

  if (!organisation) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Administration', to: '/referentiels/organisation' }, { label: 'Organisation', to: '/referentiels/organisation' }, { label: 'Introuvable' }]} />
        <EmptyState title="Organisation introuvable" description="Cette organisation n'existe pas ou a été supprimée." ctaLabel="Retour à la liste" onCta={() => navigate('/referentiels/organisation')} />
      </div>
    );
  }

  const parent = organisation.id_societe_parent ? organisations.find(o => o.id === organisation.id_societe_parent) : null;
  const filiales = organisations.filter(o => o.id_societe_parent === organisation.id);

  // Utilisateurs ayant un rattachement explicite à cette organisation (pas les
  // rattachements à l'échelle tenant, qui n'ont pas de ligne société précise
  // à retirer via DELETE /utilisateurs/{id}/societes/{societeId}).
  const rattaches = users.filter((u) => u.actif && (userSocietesMap[u.id] || []).includes(organisation.id));

  async function handleSubmit(data, existing) {
    await societesService.update(existing.id, data);
    addToast({ type: 'success', message: 'Organisation mise à jour.' });
    await load();
  }

  function collectDescendants(rootId) {
    const ids = [];
    let frontier = [rootId];
    while (frontier.length) {
      const next = organisations.filter(o => frontier.includes(o.id_societe_parent)).map(o => o.id);
      ids.push(...next);
      frontier = next;
    }
    return ids;
  }

  async function askDelete() {
    try {
      const descendants = collectDescendants(organisation.id);
      const orphanLists = await Promise.all([organisation.id, ...descendants].map((sid) => societesService.orphanGroups(sid)));
      // Dédoublonnage par id de groupe (un même groupe peut ressortir pour
      // plusieurs sociétés de la descendance), fidèle à supprimerSociete (sandbox).
      const seen = new Set();
      const orphanGroups = orphanLists.flat().filter((g) => {
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      });
      if (orphanGroups.length) {
        setDeleteInfo({ mode: 'orphans', descendants, orphanGroups });
      } else if (descendants.length) {
        setDeleteInfo({ mode: 'simple', message: `Supprimer "${organisation.raison_sociale}" et ses ${descendants.length} filiale(s) ?` });
      } else {
        setDeleteInfo({ mode: 'simple', message: `Supprimer définitivement "${organisation.raison_sociale}" ?` });
      }
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  function goReassign(groupId) {
    setDeleteInfo(null);
    navigate(`/admin/utilisateurs?tab=groupes&groupId=${groupId}`);
  }

  // Retrait d'un utilisateur de cette organisation : le retrait d'une société
  // du rattachement fait tomber les attributions qui n'ont plus d'intersection
  // avec la diffusion de leur groupe (même fonction centralisée que les deux
  // autres points d'entrée) — le serveur cascade déjà ce retrait précis
  // (DELETE /utilisateurs/{id}/societes/{id}), on prévient avant.
  function askRetirerRattachement(user) {
    const rattachementActuel = userSocietesMap[user.id] || [];
    const nouveauRattachement = rattachementActuel.filter((sid) => sid !== organisation.id);
    const impactees = attributions
      .filter((a) => a.id_utilisateur === user.id)
      .filter((a) => !isGroupAssignable(nouveauRattachement, groupDiffusions[a.id_profil] || []));
    const liste = impactees.map((a) => groups.find((g) => g.id === a.id_profil)?.label || a.id_profil).join(' • ');
    setRetraitInfo({
      user,
      impactees,
      message: impactees.length
        ? `Retirer ${user.prenom} ${user.nom} de "${organisation.raison_sociale}" supprimera son attribution aux groupes : ${liste}. Continuer ?`
        : `Retirer ${user.prenom} ${user.nom} de "${organisation.raison_sociale}" ?`,
    });
  }

  async function handleRetirerRattachement() {
    if (!retraitInfo) return;
    try {
      await usersService.removeSociete(retraitInfo.user.id, organisation.id);
      // Le serveur cascade déjà les attributions scopées exactement sur cette
      // société ; on couvre en plus celles restées à une autre portée (ex.
      // tenant) mais devenues sans intersection avec le nouveau rattachement.
      for (const a of retraitInfo.impactees || []) {
        try {
          await attributionsService.remove(retraitInfo.user.id, a.id);
        } catch {
          // déjà supprimée par la cascade serveur
        }
      }
      addToast({ type: 'success', message: `${retraitInfo.user.prenom} ${retraitInfo.user.nom} retiré(e) de l'organisation.` });
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  async function handleDelete() {
    try {
      await societesService.remove(organisation.id);
      addToast({ type: 'success', message: 'Organisation supprimée.' });
      navigate('/referentiels/organisation');
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[
        { label: 'Administration', to: '/referentiels/organisation' },
        { label: 'Organisation', to: '/referentiels/organisation' },
        { label: organisation.raison_sociale },
      ]} />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{organisation.raison_sociale}</h1>
            <Badge variant={organisation.actif ? 'success' : 'neutral'} label={organisation.actif ? 'Active' : 'Inactive'} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}>
            <Pencil size={14} /> Éditer
          </Button>
          <Button variant="destructive" size="sm" onClick={askDelete}>
            <Trash2 size={14} /> Supprimer
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Identité</h2>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">SIRET</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{organisation.siret ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Organisation parente</p>
              {parent
                ? <Link to={`/referentiels/organisation/${parent.id}`} className="text-sm text-blue-800 hover:underline">{parent.raison_sociale}</Link>
                : <p className="text-sm text-gray-500">Aucune (organisation mère)</p>
              }
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Filiales ({filiales.length})</p>
              {filiales.length === 0
                ? <p className="text-sm text-gray-500">Aucune filiale.</p>
                : (
                  <ul className="flex flex-col gap-1">
                    {filiales.map(f => (
                      <li key={f.id}><Link to={`/referentiels/organisation/${f.id}`} className="text-sm text-blue-800 hover:underline">{f.raison_sociale}</Link></li>
                    ))}
                  </ul>
                )}
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Paramètres financiers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Durée amortissement</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{organisation.duree_amortissement ? `${organisation.duree_amortissement} mois` : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Revalorisation annuelle</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{organisation.revalorisation_annuelle != null ? `${organisation.revalorisation_annuelle} %` : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Délai de revalidation</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{organisation.delai_revalidation ? `${organisation.delai_revalidation} jours` : '-'}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Utilisateurs rattachés ({rattaches.length})</h2>
        {rattaches.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun utilisateur rattaché explicitement à cette organisation.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
            {rattaches.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{u.prenom} {u.nom}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <button
                  onClick={() => askRetirerRattachement(u)}
                  aria-label={`Retirer ${u.prenom} ${u.nom}`}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600"
                >
                  <UserX size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <OrganisationFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} organisation={organisation} existingOrganisations={organisations} />

      <ConfirmModal
        isOpen={deleteInfo?.mode === 'simple'}
        onClose={() => setDeleteInfo(null)}
        onConfirm={handleDelete}
        title="Supprimer l'organisation"
        isDestructive
        confirmLabel="Supprimer"
        message={deleteInfo?.message}
      />

      {/* Cas avec groupes orphelins : parcours de réassignation avant suppression,
          fidèle à supprimerSociete (sandbox) — réassigner d'abord ou supprimer quand même. */}
      <Modal
        isOpen={deleteInfo?.mode === 'orphans'}
        onClose={() => setDeleteInfo(null)}
        title="Groupes orphelins détectés"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteInfo(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete}>Supprimer quand même</Button>
            <Button variant="primary" onClick={() => goReassign(deleteInfo.orphanGroups[0].id)}>Réassigner d'abord</Button>
          </>
        }
      >
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          {deleteInfo?.descendants?.length > 0 && `Supprimer "${organisation.raison_sociale}" et ses ${deleteInfo.descendants.length} filiale(s) `}
          {!(deleteInfo?.descendants?.length > 0) && `Supprimer "${organisation.raison_sociale}" `}
          entraînera la suppression des groupes suivants, diffusés uniquement ici :
        </p>
        <ul className="flex flex-col gap-1 mb-3">
          {deleteInfo?.orphanGroups?.map((g) => (
            <li key={g.id} className="text-sm text-gray-600 dark:text-gray-300">• {g.label || g.code}</li>
          ))}
        </ul>
        <p className="text-sm text-gray-500">
          Vous pouvez d'abord réassigner la diffusion de ces groupes sur une autre organisation, ou supprimer quand même.
        </p>
      </Modal>

      <ConfirmModal
        isOpen={!!retraitInfo}
        onClose={() => setRetraitInfo(null)}
        onConfirm={handleRetirerRattachement}
        title="Retirer l'utilisateur de l'organisation"
        isDestructive
        confirmLabel="Retirer"
        message={retraitInfo?.message}
      />
    </div>
  );
}
