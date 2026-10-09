// UserFormModal - création / édition d'un utilisateur réel : identité,
// fenêtre d'activité, rattachement, profils.
//
// Une seule section Profils (#249 corrigé multi-profils, étendu « tout est
// profil » #276) : un compte porte PLUSIEURS profils, par défaut comme
// ajoutés, cochés dans la même liste ; chacun s'applique à toutes les
// sociétés de rattachement (chaque société configurée applique sa matrice,
// les autres suivent le défaut du tenant) et donne accès à son tableau de
// bord le cas échéant. L'enregistrement remplace l'ensemble d'un appel
// (PUT /utilisateurs/:id/profils) ; les verrous admin_sam et le garde-fou de
// délégation (#278) sont portés par le serveur, leurs refus affichés tels
// quels. Plus aucune purge ni intersection d'attributions à gérer : le
// rattachement se modifie librement, le périmètre effectif suit.
import { useState, useEffect, useCallback } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import SocieteSelector from '../ui/SocieteSelector';
import ProfileBadge from './ProfileBadge';
import { validateEmail, validateRequired } from '../../utils/validation';
import { useToast } from '../../hooks/useToast';
import { optionnel } from '../../services/http';
import { groupesUtilisateursService } from '../../services/adminService';

const LANGUES = [{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }];

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = {
  prenom: '', nom: '', email: '', password: '', langue: 'fr', actif: true,
  temporaire: false, date_finale: '', date_mise_en_fonction: '',
};


export default function UserFormModal({ isOpen, onClose, onSubmit, user, initialSocieteIds, societes, profils }) {
  const isEdit = !!user;
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [idsProfils, setIdsProfils] = useState([]);
  // Groupes d'utilisateurs (US #330) : appartenances du compte et catalogue
  // des groupes. Contrairement au reste de la fiche (enregistrée d'un bloc),
  // l'ajout et le retrait sont des écritures immédiates de l'API, comme sur
  // la fiche du groupe : chaque action laisse sa trace probante propre.
  const [appartenances, setAppartenances] = useState([]);
  const [groupesDisponibles, setGroupesDisponibles] = useState([]);
  const [groupeAAjouter, setGroupeAAjouter] = useState('');
  const [groupeEnCours, setGroupeEnCours] = useState(false);
  const [scope, setScope] = useState('tenant'); // 'tenant' | 'specifique'
  const [selectedSocietes, setSelectedSocietes] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // #169 : la fiche ne se réinitialise que si le rattachement enregistré
  // change réellement. La dépendance portait sur l'identité du tableau : chaque
  // coche de groupe recharge la page, qui sert un nouveau tableau de même
  // contenu, et la fiche repartait de l'état enregistré (saisies en cours
  // perdues, sélecteur de sociétés replié, d'où un saut du panneau sous le
  // curseur).
  const cleRattachement = (initialSocieteIds || []).map((id) => id ?? 'tenant').join(',');

  const chargerGroupes = useCallback(async () => {
    if (!user?.id) { setAppartenances([]); setGroupesDisponibles([]); return; }
    // Accessoire : un échec (403 ou tables des groupes non migrées, 500)
    // laisse la section vide sans bloquer la fiche ; optionnel ne couvre que
    // le 403, le catch couvre le reste.
    try {
      const [app, dispo] = await Promise.all([
        optionnel(groupesUtilisateursService.appartenances(user.id)),
        optionnel(groupesUtilisateursService.list()),
      ]);
      setAppartenances(app);
      setGroupesDisponibles(dispo);
    } catch {
      setAppartenances([]);
      setGroupesDisponibles([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isOpen) return;
    if (user) {
      setForm({
        prenom: user.prenom, nom: user.nom, email: user.email, password: '',
        langue: user.langue || 'fr', actif: user.actif,
        temporaire: !!user.date_finale, date_finale: user.date_finale || '',
        date_mise_en_fonction: user.date_mise_en_fonction || '',
      });
      setIdsProfils((user.profils || []).map((p) => p.id));
      const ids = initialSocieteIds || [];
      const isTenant = ids.includes(null) || ids.length === 0;
      setScope(isTenant ? 'tenant' : 'specifique');
      setSelectedSocietes(ids.filter(Boolean));
    } else {
      setForm(EMPTY_FORM);
      setIdsProfils([]);
      setScope('tenant');
      setSelectedSocietes([]);
    }
    setErrors({});
    setGroupeAAjouter('');
    if (isOpen) chargerGroupes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOpen, cleRattachement]);

  async function ajouterAuGroupe() {
    if (!groupeAAjouter || !user?.id) return;
    setGroupeEnCours(true);
    try {
      await groupesUtilisateursService.addMembre(groupeAAjouter, user.id);
      addToast({ type: 'success', message: 'Compte ajouté au groupe : il porte désormais ses accès.' });
      setGroupeAAjouter('');
      await chargerGroupes();
    } catch (err) {
      // Message de l'API tel quel (périmètre, délégation, verrou admin_sam).
      addToast({ type: 'error', message: err.message });
    } finally {
      setGroupeEnCours(false);
    }
  }

  async function retirerDuGroupe(appartenance) {
    setGroupeEnCours(true);
    try {
      await groupesUtilisateursService.removeMembre(appartenance.id, appartenance.id_appartenance);
      addToast({ type: 'success', message: `Compte retiré du groupe "${appartenance.nom}".` });
      await chargerGroupes();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setGroupeEnCours(false);
    }
  }

  function validate() {
    const e = {};
    const nomErr = validateRequired(form.prenom, 'Le prénom'); if (nomErr) e.prenom = nomErr;
    const nomErr2 = validateRequired(form.nom, 'Le nom'); if (nomErr2) e.nom = nomErr2;
    const emailErr = validateEmail(form.email); if (emailErr) e.email = emailErr;
    if (!isEdit && (!form.password || form.password.length < 4)) {
      e.password = 'Mot de passe initial requis (4 caractères minimum)';
    }
    if (form.temporaire && !form.date_finale) e.date_finale = 'Date finale requise pour un compte temporaire';
    if (scope === 'specifique' && selectedSocietes.length === 0) {
      e.societes = 'Sélectionnez au moins une société, ou choisissez le rattachement tenant';
    }
    return e;
  }

  const isValid = Object.keys(validate()).length === 0;

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const payload = {
      nom: form.nom.trim(), prenom: form.prenom.trim(), email: form.email.trim().toLowerCase(),
      actif: form.actif, langue: form.langue,
      date_finale: form.temporaire ? form.date_finale : null,
      date_mise_en_fonction: form.date_mise_en_fonction || null,
    };
    // Contrat d'Antonin : le champ s'appelle mot_de_passe_hash (cf. sandbox
    // handleCreateUser), pas password. La valeur saisie ici transite telle
    // quelle, fidèle au comportement de référence de la sandbox.
    if (!isEdit) payload.mot_de_passe_hash = form.password;
    const nouvellesSocietes = scope === 'tenant' ? [null] : selectedSocietes;

    setLoading(true);
    try {
      await onSubmit(payload, nouvellesSocietes, idsProfils);
      onClose();
    } catch (err) {
      setErrors((v) => ({ ...v, global: err.message }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Modifier l'utilisateur" : 'Ajouter un utilisateur'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} isLoading={loading} disabled={!isValid}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {errors.global && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm text-red-700">{errors.global}</p>
          </div>
        )}

        <section>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
            Informations personnelles
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prénom" required error={errors.prenom}>
              <input className={INPUT_CLS} value={form.prenom} onChange={e => setForm(v => ({ ...v, prenom: e.target.value }))} />
            </FormField>
            <FormField label="Nom" required error={errors.nom}>
              <input className={INPUT_CLS} value={form.nom} onChange={e => setForm(v => ({ ...v, nom: e.target.value }))} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <FormField label="Email" required error={errors.email} className="col-span-2">
              <input type="email" className={INPUT_CLS} value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))} />
            </FormField>
          </div>
          {!isEdit && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <FormField label="Mot de passe initial" required error={errors.password} hint="Communiqué à l'utilisateur en dehors de l'application." className="col-span-2">
                <input type="text" className={INPUT_CLS} value={form.password} onChange={e => setForm(v => ({ ...v, password: e.target.value }))} />
              </FormField>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <FormField label="Langue">
              <select className={INPUT_CLS} value={form.langue} onChange={e => setForm(v => ({ ...v, langue: e.target.value }))}>
                {LANGUES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </FormField>
            <FormField label="Statut">
              <label className="flex items-center gap-3 pt-2 cursor-pointer">
                <div
                  onClick={() => setForm(v => ({ ...v, actif: !v.actif }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.actif ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.actif ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">{form.actif ? 'Actif' : 'Inactif'}</span>
              </label>
            </FormField>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
            Fenêtre d'activité
          </h3>
          <FormField label="Date de mise en fonction" hint="Permet de créer le compte en avance pour l'onboarding.">
            <input type="date" className={INPUT_CLS} value={form.date_mise_en_fonction} onChange={e => setForm(v => ({ ...v, date_mise_en_fonction: e.target.value }))} />
          </FormField>
          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input type="checkbox" checked={form.temporaire} onChange={e => setForm(v => ({ ...v, temporaire: e.target.checked }))} className="rounded border-gray-300" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Utilisateur temporaire</span>
          </label>
          {form.temporaire && (
            <FormField label="Date finale" required error={errors.date_finale} className="mt-3">
              <input type="date" className={INPUT_CLS} value={form.date_finale} onChange={e => setForm(v => ({ ...v, date_finale: e.target.value }))} />
            </FormField>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
            Rattachement
          </h3>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setScope('tenant')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm border ${scope === 'tenant' ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}
            >
              Échelle tenant (toutes sociétés)
            </button>
            <button
              type="button"
              onClick={() => setScope('specifique')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm border ${scope === 'specifique' ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}
            >
              Sociétés spécifiques
            </button>
          </div>
          {scope === 'specifique' && (
            <FormField error={errors.societes}>
              {(societes || []).length === 0 ? (
                <p className="px-3 py-3 text-sm text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg">
                  Aucune société. Créez-en une depuis Administration &gt; Organisation.
                </p>
              ) : (
                <SocieteSelector organisations={societes} selectedIds={selectedSocietes} onChange={setSelectedSocietes} />
              )}
            </FormField>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
            Profils
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Un compte peut porter plusieurs profils, par défaut comme ajoutés : chacun s'applique à toutes les sociétés de rattachement (chaque société configurée applique sa propre matrice, les autres suivent la matrice par défaut du tenant) et donne accès à son tableau de bord le cas échéant. Les droits se cumulent par union.
          </p>
          <div className="flex flex-col gap-1">
            {(profils || []).map((p) => {
              const checked = idsProfils.includes(p.id);
              return (
                <label
                  key={p.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setIdsProfils((ids) =>
                      e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id))}
                    className="rounded border-gray-300"
                  />
                  <ProfileBadge profil={p.code} label={`${p.label}${p.type === 'systeme' ? ' (système)' : ''}`} />
                </label>
              );
            })}
            {(profils || []).length === 0 && <p className="text-sm text-gray-400">Aucun profil.</p>}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
            Groupes d'utilisateurs
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Chaque groupe apporte ses accès profil × groupe d'organisations, en plus des profils ci-dessus (« et/ou », union des droits). L'ajout et le retrait sont immédiats.
          </p>
          {!isEdit ? (
            <p className="text-sm text-gray-400">Enregistrez d'abord l'utilisateur, puis rouvrez sa fiche pour l'ajouter à des groupes.</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                {appartenances.map((a) => (
                  <div key={a.id_appartenance} className="border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.nom}</p>
                      <button
                        type="button"
                        onClick={() => retirerDuGroupe(a)}
                        disabled={groupeEnCours}
                        className="text-xs text-gray-400 hover:text-red-600 flex-shrink-0"
                      >
                        Retirer
                      </button>
                    </div>
                    {(a.acces || []).length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {a.acces.map((ac) => `${ac.profil_label} × ${ac.groupe_organisation_nom} (${(ac.societes || []).length} société${(ac.societes || []).length > 1 ? 's' : ''})`).join(' ; ')}
                      </p>
                    )}
                    {(a.acces || []).length === 0 && (
                      <p className="text-xs text-gray-400 mt-1">Aucune ligne d'accès : ce groupe ne confère encore aucun droit.</p>
                    )}
                  </div>
                ))}
                {appartenances.length === 0 && <p className="text-sm text-gray-400">Aucune appartenance.</p>}
              </div>
              {(() => {
                const dejaMembre = new Set(appartenances.map((a) => a.id));
                const candidats = groupesDisponibles.filter((g) => !dejaMembre.has(g.id));
                if (!candidats.length) return null;
                return (
                  <div className="mt-3 flex items-end gap-2">
                    <div className="flex-1">
                      <select
                        className={INPUT_CLS}
                        value={groupeAAjouter}
                        onChange={(e) => setGroupeAAjouter(e.target.value)}
                        aria-label="Ajouter à un groupe d'utilisateurs"
                      >
                        <option value="">Ajouter à un groupe…</option>
                        {candidats.map((g) => <option key={g.id} value={g.id}>{g.nom} ({g.nb_acces} accès)</option>)}
                      </select>
                    </div>
                    <Button variant="secondary" size="sm" onClick={ajouterAuGroupe} isLoading={groupeEnCours} disabled={!groupeAAjouter}>
                      Ajouter
                    </Button>
                  </div>
                );
              })()}
            </>
          )}
        </section>

      </div>
    </SlideOver>
  );
}
