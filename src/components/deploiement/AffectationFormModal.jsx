// AffectationFormModal - declaration d'une nouvelle affectation (usage)
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { validateRequired } from '../../utils/validation';
import { mockProduits, mockSocietes } from '../../data/mockReferentiels';
import { getProduitsAvecLicence } from '../../data/mockDeploiement';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = { id_produit: '', id_societe: '', quantite: 1, reference_client: '' };

export default function AffectationFormModal({ isOpen, onClose, onSave, affectation }) {
  const isEdit = !!affectation;
  const draftKey = `affectation:${affectation?.id ?? 'new'}`;
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
    if (affectation) {
      setForm({
        id_produit: affectation.id_produit, id_societe: affectation.id_societe,
        quantite: affectation.quantite, reference_client: affectation.reference_client,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setDraftRestaure(false);
    setErrors({});
  }, [affectation, isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  function validate() {
    const e = {};
    if (!form.id_produit) e.id_produit = 'Le produit est requis';
    if (!form.id_societe) e.id_societe = 'La societe est requise';
    const refErr = validateRequired(form.reference_client, 'La reference client');
    if (refErr) e.reference_client = refErr;
    const qte = Number(form.quantite);
    if (!qte || qte < 1) e.quantite = 'La quantite doit etre superieure a 0';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    setLoading(false);
    onSave({ ...form, quantite: Number(form.quantite) }, affectation);
    clearDraft(draftKey);
    onClose();
  }

  const isValid = !Object.values(validate()).some(Boolean);
  const produitsOptions = getProduitsAvecLicence();

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier l\'affectation' : 'Nouvelle affectation'}
      size="sm"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restaure depuis votre derniere saisie.
          <button onClick={() => { clearDraft(draftKey); setForm(affectation ? form : EMPTY_FORM); setDraftRestaure(false); }} className="underline hover:no-underline flex-shrink-0">Vider le brouillon</button>
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
        <FormField label="Produit" required error={errors.id_produit}>
          <select className={INPUT_CLS} value={form.id_produit} onChange={e => { setForm(v => ({ ...v, id_produit: e.target.value })); setErrors(v => ({ ...v, id_produit: null })); }}>
            <option value="">Choisir...</option>
            {produitsOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            {!produitsOptions.some(p => p.id === form.id_produit) && form.id_produit && (
              <option value={form.id_produit}>{mockProduits.find(p => p.id === form.id_produit)?.label}</option>
            )}
          </select>
        </FormField>
        <FormField label="Societe" required error={errors.id_societe}>
          <select className={INPUT_CLS} value={form.id_societe} onChange={e => { setForm(v => ({ ...v, id_societe: e.target.value })); setErrors(v => ({ ...v, id_societe: null })); }}>
            <option value="">Choisir...</option>
            {mockSocietes.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
          </select>
        </FormField>
        <FormField label="Reference client" required error={errors.reference_client} hint="Asset materiel ou utilisateur nomme">
          <input className={INPUT_CLS} value={form.reference_client} onChange={e => { setForm(v => ({ ...v, reference_client: e.target.value })); setErrors(v => ({ ...v, reference_client: null })); }} />
        </FormField>
        <FormField label="Quantite" required error={errors.quantite}>
          <input type="number" min={1} className={INPUT_CLS} value={form.quantite} onChange={e => { setForm(v => ({ ...v, quantite: e.target.value })); setErrors(v => ({ ...v, quantite: null })); }} />
        </FormField>
      </div>
    </SlideOver>
  );
}
