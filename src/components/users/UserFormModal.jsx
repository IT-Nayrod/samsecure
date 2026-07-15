// UserFormModal - Section 3.2 Specs UX v0.5
import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import ProfileBadge from './ProfileBadge';
import { validateEmail, validateRequired } from '../../utils/validation';
import { mockSocietes } from '../../data/mockReferentiels';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';

const PROFILS = [
  { value: 'manager_dsi', label: 'Manager DSI' },
  { value: 'financier', label: 'Financier' },
  { value: 'it_ops', label: 'IT Ops' },
];

const LANGUES = [{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }];

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = { prenom: '', nom: '', email: '', langue: 'fr', actif: true };

export default function UserFormModal({ isOpen, onClose, onSave, user }) {
  const isEdit = !!user;
  const draftKey = `user:${user?.id ?? 'new'}`;
  const [form, setForm] = useState(EMPTY_FORM);
  const [habilitations, setHabilitations] = useState([]);
  const [newHab, setNewHab] = useState({ profil: '', societe_id: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [draftRestaure, setDraftRestaure] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const draft = loadDraft(draftKey);
    if (draft) {
      setForm(draft.form);
      setHabilitations(draft.habilitations ?? []);
      setDraftRestaure(true);
      setErrors({});
      setNewHab({ profil: '', societe_id: '' });
      return;
    }
    if (user) {
      setForm({ prenom: user.prenom, nom: user.nom, email: user.email, langue: user.langue, actif: user.actif });
      setHabilitations(user.habilitations ?? []);
    } else {
      setForm(EMPTY_FORM);
      setHabilitations([]);
    }
    setDraftRestaure(false);
    setErrors({});
    setNewHab({ profil: '', societe_id: '' });
  }, [user, isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, { form, habilitations });
  }, [form, habilitations, isOpen, draftKey]);

  function validate() {
    const e = {};
    if (validateRequired(form.prenom, 'Le prénom')) e.prenom = validateRequired(form.prenom, 'Le prénom');
    if (validateRequired(form.nom, 'Le nom')) e.nom = validateRequired(form.nom, 'Le nom');
    const emailErr = validateEmail(form.email);
    if (emailErr) e.email = emailErr;
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setLoading(false);
    onSave({ ...form, habilitations });
    clearDraft(draftKey);
    onClose();
  }

  function addHab() {
    if (!newHab.profil || !newHab.societe_id) return;
    const soc = mockSocietes.find(s => s.id === newHab.societe_id);
    setHabilitations(prev => [...prev, {
      profil: newHab.profil,
      profilLabel: PROFILS.find(p => p.value === newHab.profil)?.label ?? newHab.profil,
      societe_id: newHab.societe_id,
      societe_label: soc?.raison_sociale ?? '',
    }]);
    setNewHab({ profil: '', societe_id: '' });
  }

  function removeHab(idx) {
    setHabilitations(prev => prev.filter((_, i) => i !== idx));
  }

  const isValid = !Object.values(validate()).some(Boolean);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier l\'utilisateur' : 'Ajouter un utilisateur'}
      size="md"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restaure depuis votre derniere saisie.
          <button onClick={() => { clearDraft(draftKey); setForm(user ? form : EMPTY_FORM); setDraftRestaure(false); }} className="underline hover:no-underline flex-shrink-0">Vider le brouillon</button>
        </p>
      )}
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
        {/* Informations */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
            Informations personnelles
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prénom" required error={errors.prenom}>
              <input className={INPUT_CLS} value={form.prenom} onChange={e => { setForm(v => ({ ...v, prenom: e.target.value })); setErrors(v => ({ ...v, prenom: null })); }} />
            </FormField>
            <FormField label="Nom" required error={errors.nom}>
              <input className={INPUT_CLS} value={form.nom} onChange={e => { setForm(v => ({ ...v, nom: e.target.value })); setErrors(v => ({ ...v, nom: null })); }} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <FormField label="Email" required error={errors.email} className="col-span-2">
              <input type="email" className={INPUT_CLS} value={form.email} onChange={e => { setForm(v => ({ ...v, email: e.target.value })); setErrors(v => ({ ...v, email: null })); }} />
            </FormField>
          </div>
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

        {/* Habilitations */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
            Habilitations
          </h3>
          <div className="flex flex-col gap-2 mb-3">
            {habilitations.map((hab, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <ProfileBadge profil={hab.profil} />
                  <span className="text-sm text-gray-600 dark:text-gray-300 truncate">sur {hab.societe_label}</span>
                </div>
                <button onClick={() => removeHab(i)} aria-label="Supprimer" className="text-gray-400 hover:text-red-500 flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 items-end">
            <FormField label="Profil" className="flex-1">
              <select className={INPUT_CLS} value={newHab.profil} onChange={e => setNewHab(v => ({ ...v, profil: e.target.value }))}>
                <option value="">Choisir…</option>
                {PROFILS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </FormField>
            <FormField label="Société" className="flex-1">
              <select className={INPUT_CLS} value={newHab.societe_id} onChange={e => setNewHab(v => ({ ...v, societe_id: e.target.value }))}>
                <option value="">Choisir…</option>
                {mockSocietes.filter(s => s.actif).map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
              </select>
            </FormField>
            <Button variant="secondary" size="sm" onClick={addHab} disabled={!newHab.profil || !newHab.societe_id} className="mb-0 flex-shrink-0">
              <Plus size={14} /> Ajouter
            </Button>
          </div>
        </section>
      </div>
    </SlideOver>
  );
}
