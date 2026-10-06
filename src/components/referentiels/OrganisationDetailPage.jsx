// OrganisationDetailPage - fiche détail d'une société (données réelles), en
// deux onglets : Informations (identité, paramètres financiers, utilisateurs
// rattachés) et Profils (#249, configuration des matrices des profils par
// défaut pour cette société, visible avec gerer_profils).
//
// Refonte #249 : plus de détection de « groupes orphelins » à la suppression
// ni de purge d'attributions au retrait d'un rattachement (#57) : un groupe ne
// porte plus de diffusion, le périmètre effectif suit le rattachement restant.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Pencil, Trash2, UserX, Building2, Shield } from 'lucide-react';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import OrganisationFormModal from './OrganisationFormModal';
import SocieteProfilsTab from '../societes/SocieteProfilsTab';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';
import { ADMIN_PERMISSIONS } from '../../constants/permissions';
import { societesService, usersService } from '../../services/adminService';

export default function OrganisationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();
  const { hasPermission } = useAuth();
  const [organisations, setOrganisations] = useState([]);
  const [users, setUsers] = useState([]);
  const [userSocietesMap, setUserSocietesMap] = useState({}); // { userId: [id_societe|null] }
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState(null);
  const [retraitInfo, setRetraitInfo] = useState(null);

  // Onglets : Profils n'existe qu'avec la permission dédiée (Q5). L'onglet
  // actif vit dans l'URL (?tab=profils), ce qui permet le lien direct depuis
  // l'onglet Profils de l'administration.
  const peutGererProfils = hasPermission(ADMIN_PERMISSIONS.PROFILS);
  const tabUrl = searchParams.get('tab');
  const tab = tabUrl === 'profils' && peutGererProfils ? 'profils' : 'infos';

  function changerOnglet(suivant) {
    const next = new URLSearchParams(searchParams);
    if (suivant === 'profils') next.set('tab', 'profils');
    else next.delete('tab');
    setSearchParams(next, { replace: true });
  }

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rows, u] = await Promise.all([societesService.list(), usersService.list()]);
      setOrganisations(rows);
      setUsers(u);
      const rattachements = await Promise.all(u.map((usr) => usersService.listSocietes(usr.id)));
      const map = {};
      u.forEach((usr, i) => { map[usr.id] = rattachements[i].map((r) => r.id_societe); });
      setUserSocietesMap(map);
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
        <EmptyState title="Société introuvable" description="Cette société n'existe pas ou a été supprimée." ctaLabel="Retour à la liste" onCta={() => navigate('/referentiels/organisation')} />
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
    addToast({ type: 'success', message: 'Société mise à jour.' });
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

  function askDelete() {
    const descendants = collectDescendants(organisation.id);
    setDeleteInfo({
      message: descendants.length
        ? `Supprimer "${organisation.raison_sociale}" et ses ${descendants.length} filiale(s) ?`
        : `Supprimer définitivement "${organisation.raison_sociale}" ?`,
    });
  }

  // Retrait d'un utilisateur de cette société : le rattachement seul est
  // retiré. Le profil et les groupes du compte ne sont plus purgés (#249) :
  // leur périmètre effectif suit le rattachement restant.
  function askRetirerRattachement(user) {
    setRetraitInfo({
      user,
      message: `Retirer ${user.prenom} ${user.nom} de "${organisation.raison_sociale}" ? Ses droits ne s'appliqueront plus à cette société.`,
    });
  }

  async function handleRetirerRattachement() {
    if (!retraitInfo) return;
    try {
      await usersService.removeSociete(retraitInfo.user.id, organisation.id);
      addToast({ type: 'success', message: `${retraitInfo.user.prenom} ${retraitInfo.user.nom} retiré(e) de la société.` });
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  async function handleDelete() {
    try {
      await societesService.remove(organisation.id);
      addToast({ type: 'success', message: 'Société supprimée.' });
      navigate('/referentiels/organisation');
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  const ONGLETS = [
    { key: 'infos', label: 'Informations', icon: Building2 },
    ...(peutGererProfils ? [{ key: 'profils', label: 'Profils', icon: Shield }] : []),
  ];

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

      {ONGLETS.length > 1 && (
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {ONGLETS.map((t) => (
            <button
              key={t.key}
              onClick={() => changerOnglet(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'border-blue-700 text-blue-700 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'profils' ? (
        <SocieteProfilsTab societe={organisation} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Identité</h2>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">SIRET</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{organisation.siret ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Société parente</p>
                  {parent
                    ? <Link to={`/referentiels/organisation/${parent.id}`} className="text-sm text-blue-800 hover:underline">{parent.raison_sociale}</Link>
                    : <p className="text-sm text-gray-500">Aucune (société mère)</p>
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
              <p className="text-sm text-gray-500">Aucun utilisateur rattaché explicitement à cette société.</p>
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
        </>
      )}

      <OrganisationFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} organisation={organisation} existingOrganisations={organisations} />

      <ConfirmModal
        isOpen={!!deleteInfo}
        onClose={() => setDeleteInfo(null)}
        onConfirm={handleDelete}
        title="Supprimer la société"
        isDestructive
        confirmLabel="Supprimer"
        message={deleteInfo?.message}
      />

      <ConfirmModal
        isOpen={!!retraitInfo}
        onClose={() => setRetraitInfo(null)}
        onConfirm={handleRetirerRattachement}
        title="Retirer l'utilisateur de la société"
        isDestructive
        confirmLabel="Retirer"
        message={retraitInfo?.message}
      />
    </div>
  );
}
