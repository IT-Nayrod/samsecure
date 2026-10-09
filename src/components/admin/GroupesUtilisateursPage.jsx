// GroupesUtilisateursPage - onglet Groupes d'utilisateurs de l'administration
// (US #330, décisions client du 08/10/2026). Un groupe d'utilisateurs est une
// somme de comptes dont les accès sont une somme de lignes profil × groupe
// d'organisations (ex. IT Ops sur le groupe A-B-C et Manager DSI sur le
// groupe E-F) : ajouter un compte au groupe lui donne tous ces accès, en plus
// de ses attributions directes (« et/ou », union des droits).
// Droits à l'écran : la liste et la fiche se lisent avec gerer_utilisateurs ;
// créer, renommer, supprimer le groupe et composer ses lignes d'accès exigent
// gerer_profils ; ajouter et retirer des membres, gerer_utilisateurs. Les
// garde-fous fins (périmètre, délégation #278, verrou admin_sam, refus
// d'admin_sam dans une ligne) sont portés par le serveur : ses refus sont
// affichés tels quels.
import { useState, useEffect, useCallback } from 'react';
import { Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import SlideOver from '../ui/SlideOver';
import ConfirmModal from '../ui/ConfirmModal';
import ProfileBadge from '../users/ProfileBadge';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';
import { validateRequired } from '../../utils/validation';
import { optionnel } from '../../services/http';
import {
  groupesUtilisateursService, groupesOrganisationsService, groupsService, usersService,
} from '../../services/adminService';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';
const SELECT_CLS = 'text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

function libelleSocietes(acces) {
  const liste = acces.societes_labels || [];
  if (!liste.length) return 'aucune société active';
  return liste.join(', ');
}

export default function GroupesUtilisateursPage() {
  const { addToast } = useToast();
  const { hasPermission } = useAuth();
  // La composition (groupe, lignes d'accès) suit gerer_profils ; les membres
  // suivent gerer_utilisateurs, permission d'accès de l'onglet.
  const peutComposer = hasPermission('gerer_profils');

  const [groupes, setGroupes] = useState([]);
  const [groupesOrganisations, setGroupesOrganisations] = useState([]);
  const [profils, setProfils] = useState([]);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [createModal, setCreateModal] = useState(false);
  const [nouveau, setNouveau] = useState({ nom: '', description: '' });
  const [errors, setErrors] = useState({});
  const [creating, setCreating] = useState(false);

  const [detail, setDetail] = useState(null); // fiche chargée (GET :id)
  const [identite, setIdentite] = useState({ nom: '', description: '' });
  const [savingIdentite, setSavingIdentite] = useState(false);
  const [nouvelAcces, setNouvelAcces] = useState({ id_profil: '', id_groupe_organisation: '' });
  const [ajoutAcces, setAjoutAcces] = useState(false);
  const [nouveauMembre, setNouveauMembre] = useState('');
  const [ajoutMembre, setAjoutMembre] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async ({ silencieux = false } = {}) => {
    if (!silencieux) setIsLoading(true);
    try {
      // Les catalogues de composition (groupes d'organisations : gerer_profils)
      // sont accessoires pour un lecteur gerer_utilisateurs seul : un 403 les
      // laisse vides, l'écran reste servi (optionnel).
      const [g, go, p, u] = await Promise.all([
        groupesUtilisateursService.list(),
        optionnel(groupesOrganisationsService.list()),
        groupsService.list(),
        usersService.list(),
      ]);
      setGroupes(g);
      setGroupesOrganisations(go);
      setProfils(p);
      setUtilisateurs(u);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function ouvrirFiche(groupe) {
    try {
      const fiche = await groupesUtilisateursService.get(groupe.id);
      setDetail(fiche);
      setIdentite({ nom: fiche.nom || '', description: fiche.description || '' });
      setNouvelAcces({ id_profil: '', id_groupe_organisation: '' });
      setNouveauMembre('');
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  async function rechargerFiche() {
    if (!detail) return;
    try {
      setDetail(await groupesUtilisateursService.get(detail.id));
      await load({ silencieux: true });
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  async function creerGroupe() {
    const err = validateRequired(nouveau.nom, 'Le nom');
    if (err) { setErrors({ nom: err }); return; }
    setCreating(true);
    try {
      const cree = await groupesUtilisateursService.create({
        nom: nouveau.nom.trim(),
        description: nouveau.description.trim() || null,
      });
      addToast({ type: 'success', message: 'Groupe d\'utilisateurs créé.' });
      setCreateModal(false);
      setNouveau({ nom: '', description: '' });
      setErrors({});
      await load({ silencieux: true });
      await ouvrirFiche(cree);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setCreating(false);
    }
  }

  const identiteDirty = detail && (identite.nom !== (detail.nom || '') || identite.description !== (detail.description || ''));

  async function enregistrerIdentite() {
    if (!detail) return;
    const err = validateRequired(identite.nom, 'Le nom');
    if (err) { addToast({ type: 'error', message: err }); return; }
    setSavingIdentite(true);
    try {
      await groupesUtilisateursService.update(detail.id, {
        nom: identite.nom.trim(),
        description: identite.description.trim() || null,
      });
      addToast({ type: 'success', message: 'Groupe d\'utilisateurs mis à jour.' });
      await rechargerFiche();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setSavingIdentite(false);
    }
  }

  async function ajouterAcces() {
    if (!detail || !nouvelAcces.id_profil || !nouvelAcces.id_groupe_organisation) return;
    setAjoutAcces(true);
    try {
      await groupesUtilisateursService.addAcces(detail.id, nouvelAcces);
      addToast({ type: 'success', message: 'Ligne d\'accès ajoutée.' });
      setNouvelAcces({ id_profil: '', id_groupe_organisation: '' });
      await rechargerFiche();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setAjoutAcces(false);
    }
  }

  function retirerAcces(acces) {
    setConfirm({
      title: 'Retirer la ligne d\'accès',
      confirmLabel: 'Retirer',
      message: `Retirer l'accès "${acces.profil_label}" × "${acces.groupe_organisation_nom}" du groupe "${detail.nom}" ? Les membres perdent cet accès (leurs attributions directes ne sont pas touchées).`,
      action: async () => {
        try {
          await groupesUtilisateursService.removeAcces(detail.id, acces.id);
          addToast({ type: 'success', message: 'Ligne d\'accès retirée.' });
          await rechargerFiche();
        } catch (err) {
          addToast({ type: 'error', message: err.message });
        }
      },
    });
  }

  async function ajouterMembre() {
    if (!detail || !nouveauMembre) return;
    setAjoutMembre(true);
    try {
      await groupesUtilisateursService.addMembre(detail.id, nouveauMembre);
      addToast({ type: 'success', message: 'Membre ajouté : il porte désormais les accès du groupe.' });
      setNouveauMembre('');
      await rechargerFiche();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setAjoutMembre(false);
    }
  }

  function retirerMembre(membre) {
    setConfirm({
      title: 'Retirer le membre',
      confirmLabel: 'Retirer',
      message: `Retirer ${membre.prenom} ${membre.nom} du groupe "${detail.nom}" ? Il perd les accès du groupe (ses attributions directes ne sont pas touchées).`,
      action: async () => {
        try {
          await groupesUtilisateursService.removeMembre(detail.id, membre.id);
          addToast({ type: 'success', message: 'Membre retiré.' });
          await rechargerFiche();
        } catch (err) {
          addToast({ type: 'error', message: err.message });
        }
      },
    });
  }

  function demanderSuppression(groupe) {
    const nbMembres = groupe.nb_membres ?? (groupe.membres || []).length;
    const nbAcces = groupe.nb_acces ?? (groupe.acces || []).length;
    setConfirm({
      title: 'Supprimer le groupe d\'utilisateurs',
      confirmLabel: 'Supprimer',
      message: `Supprimer le groupe "${groupe.nom}" (${nbMembres} membre${nbMembres > 1 ? 's' : ''}, ${nbAcces} ligne${nbAcces > 1 ? 's' : ''} d'accès) ? Ses membres perdent immédiatement les accès du groupe ; leurs attributions directes ne sont pas touchées.`,
      action: async () => {
        try {
          await groupesUtilisateursService.remove(groupe.id);
          addToast({ type: 'success', message: 'Groupe d\'utilisateurs supprimé.' });
          if (detail?.id === groupe.id) setDetail(null);
          await load({ silencieux: true });
        } catch (err) {
          addToast({ type: 'error', message: err.message });
        }
      },
    });
  }

  const membresIds = new Set((detail?.membres || []).map((m) => m.id_utilisateur));
  const candidats = utilisateurs.filter((u) => !membresIds.has(u.id));
  // admin_sam ne se donne pas par un groupe (décision du 08/10, refus serveur
  // 2113) : le sélecteur ne le propose pas, pour ne pas mener à un refus.
  const profilsProposables = profils.filter((p) => p.code !== 'admin_sam');

  const columns = [
    { key: 'nom', label: 'Nom', sortable: true, render: r => <span className="font-medium text-gray-900 dark:text-white">{r.nom}</span> },
    { key: 'description', label: 'Description', render: r => <span className="text-gray-500">{r.description || '—'}</span> },
    { key: 'nb_membres', label: 'Membres', sortable: true, render: r => <Badge variant="neutral" label={`${r.nb_membres} membre${r.nb_membres > 1 ? 's' : ''}`} /> },
    { key: 'nb_acces', label: 'Lignes d\'accès', sortable: true, render: r => <Badge variant={r.nb_acces ? 'success' : 'neutral'} label={`${r.nb_acces} accès`} /> },
    {
      key: 'actions', label: 'Actions', render: r => (
        <div className="flex items-center gap-1">
          <button onClick={() => ouvrirFiche(r)} aria-label="Gérer" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <Pencil size={14} />
          </button>
          {peutComposer && (
            <button onClick={(e) => { e.stopPropagation(); demanderSuppression(r); }} aria-label="Supprimer" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600">
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
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Groupes d'utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Un groupe d'utilisateurs donne à ses membres une somme d'accès profil × groupe d'organisations, en plus de leurs attributions directes. Les droits se cumulent par union.
          </p>
        </div>
        {peutComposer && (
          <Button variant="primary" onClick={() => setCreateModal(true)}>
            <Plus size={15} /> Nouveau groupe
          </Button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable columns={columns} data={groupes} filename="groupes-utilisateurs" isLoading={isLoading} onRowClick={ouvrirFiche} emptyState={{ message: 'Aucun groupe d\'utilisateurs.' }} />
      </div>

      <SlideOver isOpen={createModal} onClose={() => setCreateModal(false)} title="Nouveau groupe d'utilisateurs" size="sm"
        footer={<><Button variant="secondary" onClick={() => setCreateModal(false)}>Annuler</Button><Button variant="primary" onClick={creerGroupe} isLoading={creating}>Créer</Button></>}
      >
        <div className="flex flex-col gap-4">
          <FormField label="Nom" required error={errors.nom}>
            <input className={INPUT_CLS} value={nouveau.nom} onChange={e => setNouveau(v => ({ ...v, nom: e.target.value }))} />
          </FormField>
          <FormField label="Description">
            <textarea className={INPUT_CLS} rows={3} value={nouveau.description} onChange={e => setNouveau(v => ({ ...v, description: e.target.value }))} />
          </FormField>
          <p className="text-xs text-gray-400">Les lignes d'accès et les membres s'ajoutent depuis la fiche, juste après la création.</p>
        </div>
      </SlideOver>

      <SlideOver
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Groupe "${detail.nom}"` : ''}
        size="lg"
      >
        {detail && (
          <div className="flex flex-col gap-6">
            <section>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                Identité
              </h3>
              <div className="flex flex-col gap-3">
                <FormField label="Nom" required>
                  <input className={INPUT_CLS} value={identite.nom} disabled={!peutComposer} onChange={e => setIdentite(v => ({ ...v, nom: e.target.value }))} />
                </FormField>
                <FormField label="Description">
                  <textarea className={INPUT_CLS} rows={2} value={identite.description} disabled={!peutComposer} onChange={e => setIdentite(v => ({ ...v, description: e.target.value }))} />
                </FormField>
                {peutComposer && (
                  <div className="flex justify-end">
                    <Button variant="secondary" size="sm" onClick={enregistrerIdentite} isLoading={savingIdentite} disabled={!identiteDirty}>
                      Enregistrer l'identité
                    </Button>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                Lignes d'accès ({(detail.acces || []).length})
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Chaque ligne applique un profil aux sociétés d'un groupe d'organisations. Chaque membre du groupe porte l'union de ces lignes.
              </p>
              <div className="flex flex-col gap-1.5">
                {(detail.acces || []).map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2">
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      <ProfileBadge profil={a.profil_code} label={a.profil_label} />
                      <span className="text-gray-400 text-sm">×</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{a.groupe_organisation_nom}</span>
                      <span className="text-xs text-gray-400 truncate" title={libelleSocietes(a)}>({libelleSocietes(a)})</span>
                    </div>
                    {peutComposer && (
                      <button onClick={() => retirerAcces(a)} aria-label="Retirer la ligne" className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600 flex-shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {(detail.acces || []).length === 0 && <p className="text-sm text-gray-400">Aucune ligne d'accès : le groupe ne confère encore aucun droit.</p>}
              </div>
              {peutComposer && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Profil</label>
                    <select className={SELECT_CLS} value={nouvelAcces.id_profil} onChange={e => setNouvelAcces(v => ({ ...v, id_profil: e.target.value }))}>
                      <option value="">Choisir…</option>
                      {profilsProposables.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Groupe d'organisations</label>
                    <select className={SELECT_CLS} value={nouvelAcces.id_groupe_organisation} onChange={e => setNouvelAcces(v => ({ ...v, id_groupe_organisation: e.target.value }))}>
                      <option value="">Choisir…</option>
                      {groupesOrganisations.map((g) => <option key={g.id} value={g.id}>{g.nom} ({(g.societes || []).length} société{(g.societes || []).length > 1 ? 's' : ''})</option>)}
                    </select>
                  </div>
                  <Button variant="secondary" size="sm" onClick={ajouterAcces} isLoading={ajoutAcces} disabled={!nouvelAcces.id_profil || !nouvelAcces.id_groupe_organisation}>
                    <Plus size={14} /> Ajouter la ligne
                  </Button>
                </div>
              )}
              {peutComposer && groupesOrganisations.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">Aucun groupe d'organisations : créez-en un depuis l'onglet Groupes d'organisations.</p>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                Membres ({(detail.membres || []).length})
              </h3>
              <div className="flex flex-col gap-1.5">
                {(detail.membres || []).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {m.prenom} {m.nom}
                        {!m.actif && <span className="ml-2 text-xs text-gray-400">(compte désactivé)</span>}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{m.email}</p>
                    </div>
                    <button onClick={() => retirerMembre(m)} aria-label="Retirer le membre" className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600 flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {(detail.membres || []).length === 0 && <p className="text-sm text-gray-400">Aucun membre.</p>}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
                  <label className="text-xs font-medium text-gray-500">Ajouter un membre</label>
                  <select className={`${SELECT_CLS} w-full`} value={nouveauMembre} onChange={e => setNouveauMembre(e.target.value)}>
                    <option value="">Choisir un utilisateur…</option>
                    {candidats.map((u) => <option key={u.id} value={u.id}>{u.prenom} {u.nom} — {u.email}</option>)}
                  </select>
                </div>
                <Button variant="secondary" size="sm" onClick={ajouterMembre} isLoading={ajoutMembre} disabled={!nouveauMembre}>
                  <UserPlus size={14} /> Ajouter
                </Button>
              </div>
            </section>

            {peutComposer && (
              <section>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                  Suppression
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  La suppression est douce : le groupe cesse de conférer ses accès, les attributions directes des membres ne sont pas touchées.
                </p>
                <Button variant="secondary" onClick={() => demanderSuppression(detail)}>
                  <Trash2 size={14} /> Supprimer le groupe
                </Button>
              </section>
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
        confirmLabel={confirm?.confirmLabel}
        isDestructive
      />
    </div>
  );
}
