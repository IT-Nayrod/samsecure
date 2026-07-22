// RevendeurFormModal - creation / edition d'un revendeur
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { validateRequired, validateSiret, validateIban, validateEmail } from '../../utils/validation';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = { raison_sociale: '', siret: '', iban: '', email: '' };

export default function RevendeurFormModal({ isOpen, onClose, onSave, revendeur, existingRevendeurs }) {
  const isEdit = !!revendeur;
  const draftKey = `revendeur:${revendeur?.id ?? 'new'}`;
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [draftRestaure, setDraftRestaure] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const draft = loadDraft(draftKey);
    if (draft) {
      setForm(draft);
      setDraftRestaure(true);
      setErrors({});
      return;
    }
    if (revendeur) setForm({ raison_sociale: revendeur.raison_sociale, siret: revendeur.siret ?? '', iban: revendeur.iban ?? '', email: revendeur.email ?? '' });
    else setForm(EMPTY_FORM);
    setDraftRestaure(false);
    setErrors({});
  }, [revendeur, isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  function validate() {
    const e = {};
    const reqErr = validateRequired(form.raison_sociale, 'La raison sociale');
    if (reqErr) e.raison_sociale = reqErr;
    else {
      const dup = existingRevendeurs.some(r => r.id !== revendeur?.id && r.raison_sociale.trim().toLowerCase() === form.raison_sociale.trim().toLowerCase());
      if (dup) e.raison_sociale = 'Un revendeur avec cette raison sociale existe deja';
    }
    if (form.siret) { const s = validateSiret(form.siret); if (s) e.siret = s; }
    if (form.iban) { const i = validateIban(form.iban); if (i) e.iban = i; }
    if (form.email) { const m = validateEmail(form.email); if (m) e.email = m; }
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    setLoading(false);
    onSave(form, revendeur);
    clearDraft(draftKey);
    onClose();
  }

  const isValid = !Object.values(validate()).some(Boolean);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier le revendeur' : 'Nouveau revendeur'}
      size="sm"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restaure depuis votre derniere saisie.
          <button onClick={() => { clearDraft(draftKey); setForm(revendeur ? form : EMPTY_FORM); setDraftRestaure(false); }} className="underline hover:no-underline flex-shrink-0">Vider le brouillon</button>
        </p>
      )}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} isLoading={loading} disabled={!isValid}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Raison sociale" required error={errors.raison_sociale}>
          <input className={INPUT_CLS} value={form.raison_sociale} onChange={e => { setForm(v => ({ ...v, raison_sociale: e.target.value })); setErrors(v => ({ ...v, raison_sociale: null })); }} />
        </FormField>
        <FormField label="SIRET" error={errors.siret} hint="14 chiffres">
          <input className={INPUT_CLS} value={form.siret} onChange={e => { setForm(v => ({ ...v, siret: e.target.value })); setErrors(v => ({ ...v, siret: null })); }} />
        </FormField>
        <FormField label="IBAN" error={errors.iban}>
          <input className={INPUT_CLS} value={form.iban} onChange={e => { setForm(v => ({ ...v, iban: e.target.value })); setErrors(v => ({ ...v, iban: null })); }} />
        </FormField>
        <FormField label="Email" error={errors.email}>
          <input type="email" className={INPUT_CLS} value={form.email} onChange={e => { setForm(v => ({ ...v, email: e.target.value })); setErrors(v => ({ ...v, email: null })); }} />
        </FormField>
      </div>
    </SlideOver>
  );
}
