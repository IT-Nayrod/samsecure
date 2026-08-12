// UserFormModal - création / édition d'un utilisateur réel (identité,
// rattachement, groupes). L'attribution de groupes se pilote directement ici
// (section Groupes) et en miroir depuis la fiche du groupe.
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import ConfirmModal from '../ui/ConfirmModal';
import SocieteSelector from '../ui/SocieteSelector';
import UserGroupsSection from './UserGroupsSection';
import { validateEmail, validateRequired } from '../../utils/validation';
import { isGroupAssignable } from '../../utils/attributionScope';

const LANGUES = [{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }];

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = {
  prenom: '', nom: '', email: '', password: '', langue: 'fr', actif: true,
  temporaire: false, date_finale: '', date_mise_en_fonction: '',
};


export default function UserFormModal({ isOpen, onClose, onSubmit, user, initialSocieteIds, societes, userAttributions, groups, groupDiffusions, onGroupsChanged }) {
  const isEdit = !!user;
  const [form, setForm] = useState(EMPTY_FORM);
  const [scope, setScope] = useState('tenant'); // 'tenant' | 'specifique'
  const [selectedSocietes, setSelectedSocietes] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [impactModal, setImpactModal] = useState(null);
  // Groupes cochés alors qu'ils ne sont assignables qu'avec le rattachement
  // en cours d'édition (pas encore enregistré) : mis en attente ici, créés
  // réellement à l'enregistrement une fois le nouveau rattachement effectif.
  const [pendingGroupAdditions, setPendingGroupAdditions] = useState(new Set());

  useEffect(() => {
    if (!isOpen) return;
    if (user) {
      setForm({
        prenom: user.prenom, nom: user.nom, email: user.email, password: '',
        langue: user.langue || 'fr', actif: user.actif,
        temporaire: !!user.date_finale, date_finale: user.date_finale || '',
        date_mise_en_fonction: user.date_mise_en_fonction || '',
      });
      const ids = initialSocieteIds || [];
      const isTenant = ids.includes(null) || ids.length === 0;
      setScope(isTenant ? 'tenant' : 'specifique');
      setSelectedSocietes(ids.filter(Boolean));
    } else {
      setForm(EMPTY_FORM);
      setScope('tenant');
      setSelectedSocietes([]);
    }
    setErrors({});
    setPendingGroupAdditions(new Set());
  }, [user, isOpen, initialSocieteIds]);

  // Rattachement en cours d'édition (non enregistré), pour la prévisualisation
  // temps réel de la section Groupes.
  const nouvellesSocietesLive = scope === 'tenant' ? [null] : selectedSocietes;

  function togglePendingAddition(groupId, checked) {
    setPendingGroupAdditions((prev) => {
      const next = new Set(prev);
      if (checked) next.add(groupId); else next.delete(groupId);
      return next;
    });
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
      e.societes = 'Sélectionnez au moins une organisation, ou choisissez le rattachement tenant';
    }
    return e;
  }

  const isValid = Object.keys(validate()).length === 0;

  async function doSave(payload, nouvellesSocietes, impactees, additions) {
    setLoading(true);
    try {
      await onSubmit(payload, nouvellesSocietes, impactees || [], additions || []);
      onClose();
    } catch (err) {
      setErrors((v) => ({ ...v, global: err.message }));
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
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

    // Réévalue CHAQUE attribution actuelle contre le nouveau rattachement, via
    // la même fonction que les cases à cocher (isGroupAssignable). Ne pas se
    // contenter de comparer les sociétés retirées : un passage tenant →
    // spécifique retire une portée implicite (NULL) qu'un simple diff de
    // tableaux ne détecte pas, alors qu'il invalide potentiellement les
    // attributions prises à l'échelle tenant.
    const impactees = (userAttributions || []).filter((a) => {
      const groupSocieteIds = (groupDiffusions?.[a.id_profil] || []);
      return !isGroupAssignable(nouvellesSocietes, groupSocieteIds);
    });

    const additions = Array.from(pendingGroupAdditions);

    if (impactees.length) {
      const liste = impactees.map((a) => {
        const g = (groups || []).find((g) => g.id === a.id_profil);
        return g?.label || 'groupe inconnu';
      }).join(' • ');
      setImpactModal({
        message: `Ce rattachement supprimera les attributions suivantes, devenues sans société commune : ${liste}. Continuer ?`,
        onConfirm: () => doSave(payload, nouvellesSocietes, impactees, additions),
      });
      return;
    }

    doSave(payload, nouvellesSocietes, [], additions);
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
              Échelle tenant (toutes organisations)
            </button>
            <button
              type="button"
              onClick={() => setScope('specifique')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm border ${scope === 'specifique' ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}
            >
              Organisations spécifiques
            </button>
          </div>
          {scope === 'specifique' && (
            <FormField error={errors.societes}>
              {(societes || []).length === 0 ? (
                <p className="px-3 py-3 text-sm text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg">
                  Aucune organisation. Créez-en une depuis Administration &gt; Organisation.
                </p>
              ) : (
                <SocieteSelector organisations={societes} selectedIds={selectedSocietes} onChange={setSelectedSocietes} />
              )}
            </FormField>
          )}
        </section>

        {isEdit && (
          <UserGroupsSection
            userId={user.id}
            userSocieteIds={initialSocieteIds || []}
            pendingSocieteIds={nouvellesSocietesLive}
            pendingAdditions={pendingGroupAdditions}
            onTogglePendingAddition={togglePendingAddition}
            groups={groups || []}
            groupDiffusions={groupDiffusions || {}}
            societes={societes || []}
            attributions={userAttributions || []}
            onChange={onGroupsChanged}
          />
        )}
      </div>

      <ConfirmModal
        isOpen={!!impactModal}
        onClose={() => setImpactModal(null)}
        onConfirm={() => impactModal?.onConfirm()}
        title="Attributions impactées"
        message={impactModal?.message}
        isDestructive
        confirmLabel="Confirmer le retrait"
      />
    </SlideOver>
  );
}
