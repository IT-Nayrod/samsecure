// UserFormModal - création / édition d'un utilisateur réel : identité,
// fenêtre d'activité, profil par défaut (#249), rattachement, groupes.
//
// Section Profil distincte de la section Groupes (refonte #249) : un seul
// profil par défaut, appliqué à toutes les sociétés de rattachement (chaque
// société configurée applique sa matrice, les autres suivent le défaut du
// tenant). Les groupes s'ajoutent au profil, sans notion de société (#57).
// Plus aucune purge ni intersection d'attributions à gérer : le rattachement
// se modifie librement, le périmètre effectif suit.
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import SocieteSelector from '../ui/SocieteSelector';
import UserGroupsSection from './UserGroupsSection';
import { validateEmail, validateRequired } from '../../utils/validation';

const LANGUES = [{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }];

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = {
  prenom: '', nom: '', email: '', password: '', langue: 'fr', actif: true,
  temporaire: false, date_finale: '', date_mise_en_fonction: '',
};


export default function UserFormModal({ isOpen, onClose, onSubmit, user, initialSocieteIds, societes, profils, userAttributions, groups, onGroupsChanged }) {
  const isEdit = !!user;
  const [form, setForm] = useState(EMPTY_FORM);
  const [idProfil, setIdProfil] = useState('');
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

  useEffect(() => {
    if (!isOpen) return;
    if (user) {
      setForm({
        prenom: user.prenom, nom: user.nom, email: user.email, password: '',
        langue: user.langue || 'fr', actif: user.actif,
        temporaire: !!user.date_finale, date_finale: user.date_finale || '',
        date_mise_en_fonction: user.date_mise_en_fonction || '',
      });
      setIdProfil(user.id_profil || '');
      const ids = initialSocieteIds || [];
      const isTenant = ids.includes(null) || ids.length === 0;
      setScope(isTenant ? 'tenant' : 'specifique');
      setSelectedSocietes(ids.filter(Boolean));
    } else {
      setForm(EMPTY_FORM);
      setIdProfil('');
      setScope('tenant');
      setSelectedSocietes([]);
    }
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOpen, cleRattachement]);

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
      await onSubmit(payload, nouvellesSocietes, idProfil || null);
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
            Profil
          </h3>
          <FormField label="Profil par défaut">
            <select className={INPUT_CLS} value={idProfil} onChange={e => setIdProfil(e.target.value)}>
              <option value="">Aucun profil</option>
              {(profils || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}{p.type === 'systeme' ? ' (système)' : ''}
                </option>
              ))}
            </select>
          </FormField>
          <p className="text-xs text-gray-500 mt-2">
            Le profil s'applique à toutes les sociétés de rattachement de l'utilisateur : chaque société configurée applique sa propre matrice, les autres suivent la matrice par défaut du tenant.
          </p>
        </section>

        {isEdit && (
          <UserGroupsSection
            userId={user.id}
            groups={groups || []}
            attributions={userAttributions || []}
            onChange={onGroupsChanged}
          />
        )}
      </div>
    </SlideOver>
  );
}
