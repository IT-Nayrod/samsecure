// ProduitFormModal - creation / edition d'un produit client (le catalogue commun n'est pas creable depuis le tenant)
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { validateRequired } from '../../utils/validation';
import { mockEditeurs } from '../../data/mockReferentiels';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

// Un produit ne peut pas etre son propre ancetre : on retire le produit edite et tous ses descendants des options de parent
function getDescendantIds(produits, rootId) {
  const ids = new Set();
  let frontier = [rootId];
  while (frontier.length) {
    const next = produits.filter(p => frontier.includes(p.id_produit_parent)).map(p => p.id);
    next.forEach(id => ids.add(id));
    frontier = next;
  }
  return ids;
}

const EMPTY_FORM = { label: '', id_editeur: '', id_produit_parent: '', a_maintenir: false };

export default function ProduitFormModal({ isOpen, onClose, onSave, produit, allProduits }) {
  const isEdit = !!produit;
  const draftKey = `produit:${produit?.id ?? 'new'}`;
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
    if (produit) {
      setForm({
        label: produit.label, id_editeur: produit.id_editeur ?? '',
        id_produit_parent: produit.id_produit_parent ?? '', a_maintenir: !!produit.a_maintenir,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setDraftRestaure(false);
    setErrors({});
  }, [produit, isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  function validate() {
    const e = {};
    const labelErr = validateRequired(form.label, 'Le label');
    if (labelErr) e.label = labelErr;
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    setLoading(false);
    onSave({
      label: form.label,
      id_editeur: form.id_editeur || null,
      id_produit_parent: form.id_produit_parent || null,
      a_maintenir: form.a_maintenir,
    }, produit);
    clearDraft(draftKey);
    onClose();
  }

  const isValid = !Object.values(validate()).some(Boolean);
  const excludedIds = produit ? getDescendantIds(allProduits, produit.id) : new Set();
  const parentOptions = allProduits.filter(p => p.id !== produit?.id && !excludedIds.has(p.id));

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier le produit client' : 'Nouveau produit client'}
      size="sm"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restaure depuis votre derniere saisie.
          <button onClick={() => { clearDraft(draftKey); setForm(produit ? form : EMPTY_FORM); setDraftRestaure(false); }} className="underline hover:no-underline flex-shrink-0">Vider le brouillon</button>
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
        <FormField label="Label" required error={errors.label}>
          <input className={INPUT_CLS} value={form.label} onChange={e => { setForm(v => ({ ...v, label: e.target.value })); setErrors(v => ({ ...v, label: null })); }} />
        </FormField>
        <FormField label="Editeur" hint="Optionnel">
          <select className={INPUT_CLS} value={form.id_editeur} onChange={e => setForm(v => ({ ...v, id_editeur: e.target.value }))}>
            <option value="">Aucun</option>
            {mockEditeurs.map(ed => <option key={ed.id} value={ed.id}>{ed.raison_sociale}</option>)}
          </select>
        </FormField>
        <FormField label="Produit parent" hint="Optionnel">
          <select className={INPUT_CLS} value={form.id_produit_parent} onChange={e => setForm(v => ({ ...v, id_produit_parent: e.target.value }))}>
            <option value="">Aucun</option>
            {parentOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </FormField>
        <FormField label="Maintenance" hint="Donne droit aux montees de version">
          <label className="flex items-center gap-3 pt-1 cursor-pointer">
            <div
              onClick={() => setForm(v => ({ ...v, a_maintenir: !v.a_maintenir }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.a_maintenir ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.a_maintenir ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300">{form.a_maintenir ? 'A maintenir' : 'Non maintenu'}</span>
          </label>
        </FormField>
      </div>
    </SlideOver>
  );
}
