// OrganisationFormModal - creation / edition d'une societe de l'organisation
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { validateRequired, validateSiret } from '../../utils/validation';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

// Une societe ne peut pas etre sa propre ascendante : on retire la societe editee et toutes ses descendantes des options de parente
function getDescendantIds(societes, rootId) {
  const ids = new Set();
  let frontier = [rootId];
  while (frontier.length) {
    const next = societes.filter(s => frontier.includes(s.societe_parent_id)).map(s => s.id);
    next.forEach(id => ids.add(id));
    frontier = next;
  }
  return ids;
}

const EMPTY_FORM = { raison_sociale: '', siret: '', societe_parent_id: '', duree_amortissement: 36, revalorisation: 3.5, delai_revalidation: 30 };

export default function OrganisationFormModal({ isOpen, onClose, onSave, societe, existingSocietes }) {
  const isEdit = !!societe;
  const draftKey = `organisation:${societe?.id ?? 'new'}`;
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
    if (societe) {
      setForm({
        raison_sociale: societe.raison_sociale, siret: societe.siret ?? '',
        societe_parent_id: societe.societe_parent_id ?? '',
        duree_amortissement: societe.duree_amortissement, revalorisation: societe.revalorisation, delai_revalidation: societe.delai_revalidation,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setDraftRestaure(false);
    setErrors({});
  }, [societe, isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  function validate() {
    const e = {};
    const reqErr = validateRequired(form.raison_sociale, 'La raison sociale');
    if (reqErr) e.raison_sociale = reqErr;
    else {
      const dup = existingSocietes.some(s => s.id !== societe?.id && s.raison_sociale.trim().toLowerCase() === form.raison_sociale.trim().toLowerCase());
      if (dup) e.raison_sociale = 'Une societe avec cette raison sociale existe deja';
    }
    const siretErr = validateSiret(form.siret);
    if (siretErr) e.siret = siretErr;
    const amort = Number(form.duree_amortissement);
    if (!amort || amort < 1 || amort > 48) e.duree_amortissement = 'La duree d\'amortissement doit etre comprise entre 1 et 48 mois';
    const revalid = Number(form.delai_revalidation);
    if (!revalid || revalid < 1 || revalid > 366) e.delai_revalidation = 'Le delai de revalidation doit etre compris entre 1 et 366 jours';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    setLoading(false);
    onSave({
      raison_sociale: form.raison_sociale,
      siret: form.siret,
      societe_parent_id: form.societe_parent_id || null,
      duree_amortissement: Number(form.duree_amortissement),
      revalorisation: parseFloat(form.revalorisation),
      delai_revalidation: Number(form.delai_revalidation),
    }, societe);
    clearDraft(draftKey);
    onClose();
  }

  const isValid = !Object.values(validate()).some(Boolean);
  const excludedIds = societe ? getDescendantIds(existingSocietes, societe.id) : new Set();
  const parentOptions = existingSocietes.filter(s => s.id !== societe?.id && !excludedIds.has(s.id));

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier la societe' : 'Nouvelle societe'}
      size="sm"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restaure depuis votre derniere saisie.
          <button onClick={() => { clearDraft(draftKey); setForm(societe ? form : EMPTY_FORM); setDraftRestaure(false); }} className="underline hover:no-underline flex-shrink-0">Vider le brouillon</button>
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
        <FormField label="SIRET" required error={errors.siret} hint="14 chiffres">
          <input className={INPUT_CLS} value={form.siret} onChange={e => { setForm(v => ({ ...v, siret: e.target.value })); setErrors(v => ({ ...v, siret: null })); }} maxLength={14} />
        </FormField>
        <FormField label="Societe parente" hint="Optionnel">
          <select className={INPUT_CLS} value={form.societe_parent_id} onChange={e => setForm(v => ({ ...v, societe_parent_id: e.target.value }))}>
            <option value="">Aucune (societe mere)</option>
            {parentOptions.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Duree amort. (mois)" error={errors.duree_amortissement}>
            <input type="number" className={INPUT_CLS} value={form.duree_amortissement} onChange={e => { setForm(v => ({ ...v, duree_amortissement: e.target.value })); setErrors(v => ({ ...v, duree_amortissement: null })); }} min={1} max={48} />
          </FormField>
          <FormField label="Revalorisation (%)">
            <input type="number" className={INPUT_CLS} value={form.revalorisation} onChange={e => setForm(v => ({ ...v, revalorisation: e.target.value }))} step={0.1} min={0} />
          </FormField>
          <FormField label="Delai revalid. (j)" error={errors.delai_revalidation}>
            <input type="number" className={INPUT_CLS} value={form.delai_revalidation} onChange={e => { setForm(v => ({ ...v, delai_revalidation: e.target.value })); setErrors(v => ({ ...v, delai_revalidation: null })); }} min={1} max={366} />
          </FormField>
        </div>
      </div>
    </SlideOver>
  );
}
