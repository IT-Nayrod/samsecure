// DocumentFormModal - ajout / edition d'une facture ou d'une preuve
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import DocumentUploadField from './DocumentUploadField';
import { validateRequired } from '../../utils/validation';
import { mockContrats, mockCommandes, mockTypesPreuve } from '../../data/mockContrats';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = { type: 'facture', label: '', type_preuve: '', id_contrat: '', id_commande: '', nom_fichier: null };

export default function DocumentFormModal({ isOpen, onClose, onSave, doc }) {
  const isEdit = !!doc;
  const draftKey = `document:${doc?.id ?? 'new'}`;
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
    if (doc) {
      setForm({
        type: doc.type, label: doc.label, type_preuve: doc.type_preuve ?? '',
        id_contrat: doc.id_contrat ?? '', id_commande: doc.id_commande ?? '', nom_fichier: doc.nom_fichier ?? null,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setDraftRestaure(false);
    setErrors({});
  }, [doc, isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  function validate() {
    const e = {};
    const labelErr = validateRequired(form.label, 'Le label');
    if (labelErr) e.label = labelErr;
    if (!form.id_contrat && !form.id_commande) e.liaison = 'Liez ce document a un contrat et / ou une commande';
    if (!form.nom_fichier) e.nom_fichier = 'Joignez un document';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    setLoading(false);
    onSave({
      ...form,
      type_preuve: form.type === 'preuve' ? (form.type_preuve || mockTypesPreuve[0]) : null,
      id_contrat: form.id_contrat || null,
      id_commande: form.id_commande || null,
      date: doc?.date ?? new Date().toISOString().slice(0, 10),
    }, doc);
    clearDraft(draftKey);
    onClose();
  }

  const isValid = !Object.values(validate()).some(Boolean);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier le document' : 'Ajouter un document'}
      size="md"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restaure depuis votre derniere saisie.
          <button onClick={() => { clearDraft(draftKey); setForm(doc ? form : EMPTY_FORM); setDraftRestaure(false); }} className="underline hover:no-underline flex-shrink-0">Vider le brouillon</button>
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
        <FormField label="Document" error={errors.nom_fichier}>
          <DocumentUploadField nomFichier={form.nom_fichier} onChange={f => { setForm(v => ({ ...v, nom_fichier: f })); setErrors(v => ({ ...v, nom_fichier: null })); }} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Type de document">
            <select className={INPUT_CLS} value={form.type} onChange={e => setForm(v => ({ ...v, type: e.target.value }))}>
              <option value="facture">Facture</option>
              <option value="preuve">Preuve</option>
            </select>
          </FormField>
          {form.type === 'preuve' && (
            <FormField label="Type de preuve">
              <select className={INPUT_CLS} value={form.type_preuve} onChange={e => setForm(v => ({ ...v, type_preuve: e.target.value }))}>
                {mockTypesPreuve.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
          )}
        </div>
        <FormField label="Label" required error={errors.label}>
          <input className={INPUT_CLS} value={form.label} onChange={e => { setForm(v => ({ ...v, label: e.target.value })); setErrors(v => ({ ...v, label: null })); }} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Contrat lie" hint="Optionnel" error={errors.liaison}>
            <select className={INPUT_CLS} value={form.id_contrat} onChange={e => { setForm(v => ({ ...v, id_contrat: e.target.value })); setErrors(v => ({ ...v, liaison: null })); }}>
              <option value="">Aucun</option>
              {mockContrats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </FormField>
          <FormField label="Commande liee" hint="Optionnelle">
            <select className={INPUT_CLS} value={form.id_commande} onChange={e => { setForm(v => ({ ...v, id_commande: e.target.value })); setErrors(v => ({ ...v, liaison: null })); }}>
              <option value="">Aucune</option>
              {mockCommandes.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </FormField>
        </div>
      </div>
    </SlideOver>
  );
}
