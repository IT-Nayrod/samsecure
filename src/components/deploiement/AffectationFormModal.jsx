// AffectationFormModal - declaration ou modification d'une affectation,
// branchee sur l'API (#106). La licence remplace le produit du mock :
// affectation.id_licence est la cle reelle, le produit en decoule. Les
// messages d'erreur affiches sont ceux renvoyes par le serveur.
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { affectationsService } from '../../services/affectationsService';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';
import { useToast } from '../../hooks/useToast';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = { id_licence: '', id_societe: '', quantite: 1, reference_client: '' };

function licenceLabel(l) {
  const produit = l.produit_label ? `${l.produit_label} - ` : '';
  return `${produit}${l.label ?? 'Licence sans libelle'} (${l.quantite} droits)`;
}

export default function AffectationFormModal({ isOpen, onClose, onSaved, affectation, licences = [], societes = [] }) {
  const isEdit = !!affectation;
  const draftKey = `affectation:${affectation?.id ?? 'new'}`;
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [erreurApi, setErreurApi] = useState(null);
  const [loading, setLoading] = useState(false);
  const [draftRestaure, setDraftRestaure] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErreurApi(null);
    const draft = loadDraft(draftKey);
    if (draft) { setForm(draft); setDraftRestaure(true); return; }
    if (affectation) {
      setForm({
        id_licence: affectation.id_licence ?? '',
        id_societe: affectation.id_societe ?? '',
        quantite: affectation.quantite ?? 1,
        reference_client: affectation.reference_client ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setDraftRestaure(false);
  }, [affectation, isOpen, draftKey]);

  useEffect(() => { if (isOpen) saveDraft(draftKey, form); }, [form, isOpen, draftKey]);

  // Confort de saisie seulement : le controle de fond est celui de l'API
  // (codes 4111 a 4116), dont le message est affiche tel quel.
  const complet = form.id_licence && form.id_societe && form.reference_client.trim() && Number(form.quantite) > 0;

  async function handleSave() {
    setLoading(true);
    setErreurApi(null);
    const payload = { ...form, reference_client: form.reference_client.trim(), quantite: Number(form.quantite) };
    try {
      if (isEdit) await affectationsService.update(affectation.id, payload);
      else await affectationsService.create(payload);
      clearDraft(draftKey);
      addToast({ type: 'success', message: isEdit ? 'Affectation modifiee et resoumise a validation.' : 'Affectation declaree et soumise a validation.' });
      await onSaved?.();
      onClose();
    } catch (err) {
      setErreurApi(err.message);
    } finally {
      setLoading(false);
    }
  }

  const licenceInconnue = form.id_licence && !licences.some(l => l.id === form.id_licence);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier l\'affectation' : 'Nouvelle affectation'}
      size="sm"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restaure depuis votre derniere saisie.
          <button onClick={() => { clearDraft(draftKey); setForm(EMPTY_FORM); setDraftRestaure(false); }} className="underline hover:no-underline flex-shrink-0">Vider le brouillon</button>
        </p>
      )}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} isLoading={loading} disabled={!complet}>
            {isEdit ? 'Enregistrer et resoumettre' : 'Declarer'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {erreurApi && (
          <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2">
            {erreurApi}
          </p>
        )}
        {isEdit && (
          <p className="text-xs text-gray-500">Toute modification resoumet l&apos;affectation au circuit de validation.</p>
        )}
        <FormField label="Licence" required hint="Le produit decoule de la licence">
          <select className={INPUT_CLS} value={form.id_licence} onChange={e => setForm(v => ({ ...v, id_licence: e.target.value }))}>
            <option value="">Choisir...</option>
            {licences.map(l => <option key={l.id} value={l.id}>{licenceLabel(l)}</option>)}
            {licenceInconnue && <option value={form.id_licence}>{affectation?.licence_label ?? 'Licence actuelle'}</option>}
          </select>
        </FormField>
        <FormField label="Societe" required>
          <select className={INPUT_CLS} value={form.id_societe} onChange={e => setForm(v => ({ ...v, id_societe: e.target.value }))}>
            <option value="">Choisir...</option>
            {societes.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
          </select>
        </FormField>
        <FormField label="Reference client" required hint="Asset materiel ou utilisateur nomme">
          <input className={INPUT_CLS} value={form.reference_client} onChange={e => setForm(v => ({ ...v, reference_client: e.target.value }))} />
        </FormField>
        <FormField label="Quantite" required>
          <input type="number" min={1} step={1} className={INPUT_CLS} value={form.quantite} onChange={e => setForm(v => ({ ...v, quantite: e.target.value }))} />
        </FormField>
      </div>
    </SlideOver>
  );
}
