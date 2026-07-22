// CommandeFormModal - creation / edition d'une commande
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { validateRequired } from '../../utils/validation';
import { mockContrats, mockModesCommande } from '../../data/mockContrats';
import { mockSocietes, mockRevendeurs } from '../../data/mockReferentiels';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = {
  label: '', id_contrat: '', id_societe: '', id_revendeur: '', mode: mockModesCommande[0],
  montant: 0, numero_devis: '', reference_interne: '', date_fin: '', a_renouveler: false,
};

export default function CommandeFormModal({ isOpen, onClose, onSave, commande }) {
  const isEdit = !!commande;
  const draftKey = `commande:${commande?.id ?? 'new'}`;
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
    if (commande) {
      setForm({
        label: commande.label, id_contrat: commande.id_contrat, id_societe: commande.id_societe,
        id_revendeur: commande.id_revendeur ?? '', mode: commande.mode, montant: commande.montant,
        numero_devis: commande.numero_devis ?? '', reference_interne: commande.reference_interne ?? '',
        date_fin: commande.date_fin ?? '', a_renouveler: commande.a_renouveler,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setDraftRestaure(false);
    setErrors({});
  }, [commande, isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  function validate() {
    const e = {};
    const labelErr = validateRequired(form.label, 'Le label');
    if (labelErr) e.label = labelErr;
    if (!form.id_contrat) e.id_contrat = 'Le contrat est requis';
    if (!form.id_societe) e.id_societe = 'La societe est requise';
    const montant = Number(form.montant);
    if (!montant || montant <= 0) e.montant = 'Le montant doit etre positif';
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
      id_revendeur: form.id_revendeur || null,
      date_fin: form.date_fin || null,
      montant: Number(form.montant),
      date: commande?.date ?? new Date().toISOString().slice(0, 10),
    }, commande);
    clearDraft(draftKey);
    onClose();
  }

  const isValid = !Object.values(validate()).some(Boolean);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier la commande' : 'Nouvelle commande'}
      size="md"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restaure depuis votre derniere saisie.
          <button onClick={() => { clearDraft(draftKey); setForm(commande ? form : EMPTY_FORM); setDraftRestaure(false); }} className="underline hover:no-underline flex-shrink-0">Vider le brouillon</button>
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
        <FormField label="Contrat" required error={errors.id_contrat}>
          <select className={INPUT_CLS} value={form.id_contrat} onChange={e => { setForm(v => ({ ...v, id_contrat: e.target.value })); setErrors(v => ({ ...v, id_contrat: null })); }}>
            <option value="">Choisir...</option>
            {mockContrats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Societe" required error={errors.id_societe}>
            <select className={INPUT_CLS} value={form.id_societe} onChange={e => { setForm(v => ({ ...v, id_societe: e.target.value })); setErrors(v => ({ ...v, id_societe: null })); }}>
              <option value="">Choisir...</option>
              {mockSocietes.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
            </select>
          </FormField>
          <FormField label="Revendeur" hint="Optionnel">
            <select className={INPUT_CLS} value={form.id_revendeur} onChange={e => setForm(v => ({ ...v, id_revendeur: e.target.value }))}>
              <option value="">Aucun</option>
              {mockRevendeurs.map(r => <option key={r.id} value={r.id}>{r.raison_sociale}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Mode de commande">
            <select className={INPUT_CLS} value={form.mode} onChange={e => setForm(v => ({ ...v, mode: e.target.value }))}>
              {mockModesCommande.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </FormField>
          <FormField label="Montant (EUR)" required error={errors.montant}>
            <input type="number" min={0} className={INPUT_CLS} value={form.montant} onChange={e => { setForm(v => ({ ...v, montant: e.target.value })); setErrors(v => ({ ...v, montant: null })); }} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Numero de devis" hint="Optionnel">
            <input className={INPUT_CLS} value={form.numero_devis} onChange={e => setForm(v => ({ ...v, numero_devis: e.target.value }))} />
          </FormField>
          <FormField label="Reference interne" hint="Optionnelle">
            <input className={INPUT_CLS} value={form.reference_interne} onChange={e => setForm(v => ({ ...v, reference_interne: e.target.value }))} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4 items-end">
          <FormField label="Date de fin (souscription)" hint="Optionnelle">
            <input type="date" className={INPUT_CLS} value={form.date_fin} onChange={e => setForm(v => ({ ...v, date_fin: e.target.value }))} />
          </FormField>
          <FormField label="A renouveler">
            <label className="flex items-center gap-3 pt-1 cursor-pointer">
              <div
                onClick={() => setForm(v => ({ ...v, a_renouveler: !v.a_renouveler }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.a_renouveler ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.a_renouveler ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">{form.a_renouveler ? 'Oui' : 'Non'}</span>
            </label>
          </FormField>
        </div>
      </div>
    </SlideOver>
  );
}
