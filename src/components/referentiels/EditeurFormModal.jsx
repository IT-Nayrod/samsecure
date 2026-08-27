// EditeurFormModal - creation et edition d'un editeur.
//
// L'unicite de la raison sociale n'est plus verifiee ici : elle est portee par
// la base (uq_editeur_raison_sociale) et rendue en 409 par l'API. Un controle
// local aurait ete contournable par appel direct, et faux des qu'un autre
// onglet cree le meme editeur. Le message du serveur est affiche tel quel sur
// le champ, et la modale reste ouverte pour que la saisie soit corrigee sur
// place.
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { validateRequired } from '../../utils/validation';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = { raison_sociale: '', pays: '' };

function formDepuis(editeur) {
  return editeur
    ? { raison_sociale: editeur.raison_sociale, pays: editeur.pays ?? '' }
    : EMPTY_FORM;
}

export default function EditeurFormModal({ isOpen, onClose, onSave, editeur }) {
  const isEdit = !!editeur;
  const draftKey = `editeur:${editeur?.id ?? 'new'}`;
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
    setForm(formDepuis(editeur));
    setDraftRestaure(false);
    setErrors({});
  }, [editeur, isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  function validate() {
    const e = {};
    const reqErr = validateRequired(form.raison_sociale, 'La raison sociale');
    if (reqErr) e.raison_sociale = reqErr;
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      await onSave({ raison_sociale: form.raison_sociale.trim(), pays: form.pays.trim() }, editeur);
      clearDraft(draftKey);
      onClose();
    } catch (err) {
      // 409 : raison sociale deja prise. Les autres erreurs partent deja en
      // toast cote appelant, les porter aussi sur le champ serait redondant.
      if (err?.status === 409) setErrors({ raison_sociale: err.message });
    } finally {
      setLoading(false);
    }
  }

  // Vider le brouillon revient aux valeurs d'origine : celles de l'editeur en
  // edition, un formulaire vide en creation.
  function viderBrouillon() {
    clearDraft(draftKey);
    setForm(formDepuis(editeur));
    setErrors({});
    setDraftRestaure(false);
  }

  const isValid = !Object.values(validate()).some(Boolean);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier l\'éditeur' : 'Nouvel éditeur'}
      size="sm"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restauré depuis votre dernière saisie.
          <button onClick={viderBrouillon} className="underline hover:no-underline flex-shrink-0">Vider le brouillon</button>
        </p>
      )}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} isLoading={loading} disabled={!isValid}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Raison sociale" required error={errors.raison_sociale}>
          <input
            className={INPUT_CLS}
            value={form.raison_sociale}
            onChange={e => { setForm(v => ({ ...v, raison_sociale: e.target.value })); setErrors(v => ({ ...v, raison_sociale: null })); }}
          />
        </FormField>
        <FormField label="Pays" hint="Optionnel">
          <input className={INPUT_CLS} value={form.pays} onChange={e => setForm(v => ({ ...v, pays: e.target.value }))} />
        </FormField>
      </div>
    </SlideOver>
  );
}
