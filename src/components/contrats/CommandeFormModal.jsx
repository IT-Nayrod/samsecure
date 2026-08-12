// CommandeFormModal - creation / edition d'une commande, branchee sur l'API.
// Les messages d'erreur affiches sont ceux renvoyes par le serveur.
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { commandesService } from '../../services/commandesService';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';
import { useToast } from '../../hooks/useToast';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = {
  label: '', numero_devis: '', reference_interne: '', id_contrat: '', id_societe: '',
  id_revendeur: '', id_mode_commande: '', montant: '', date_commande: '', date_fin: '',
  a_renouveler: false,
};

export default function CommandeFormModal({
  isOpen, onClose, onSaved, commande,
  contrats = [], societes = [], revendeurs = [], modes = [],
}) {
  const isEdit = !!commande;
  const draftKey = `commande:${commande?.id ?? 'new'}`;
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
    if (commande) {
      setForm({
        label: commande.label ?? '',
        numero_devis: commande.numero_devis ?? '',
        reference_interne: commande.reference_interne ?? '',
        id_contrat: commande.id_contrat ?? '',
        id_societe: commande.id_societe ?? '',
        id_revendeur: commande.id_revendeur ?? '',
        id_mode_commande: commande.id_mode_commande ?? '',
        montant: commande.montant ?? '',
        date_commande: commande.date_commande ?? '',
        date_fin: commande.date_fin ?? '',
        a_renouveler: !!commande.a_renouveler,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setDraftRestaure(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commande, isOpen, draftKey]);

  useEffect(() => { if (isOpen) saveDraft(draftKey, form); }, [form, isOpen, draftKey]);

  // Confort de saisie : le bouton reste inactif tant que le montant n'est pas
  // Confort de saisie : le bouton reste inactif tant que le montant n'est pas
  // strictement positif, pour eviter un aller-retour serveur previsible. Le
  // message affiche en cas d'echec reste celui de l'API, jamais un texte local.
  const montantValide = form.montant !== '' && Number(form.montant) > 0;

  async function handleSave() {
    setLoading(true);
    setErreurApi(null);
    const payload = { ...form, montant: form.montant === '' ? null : Number(form.montant) };
    try {
      if (isEdit) await commandesService.update(commande.id, payload);
      else await commandesService.create(payload);
      clearDraft(draftKey);
      addToast({ type: 'success', message: isEdit ? 'Commande mise a jour.' : 'Commande creee.' });
      await onSaved?.();
      onClose();
    } catch (err) {
      setErreurApi(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier la commande' : 'Nouvelle commande'}
      size="md"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restaure depuis votre derniere saisie.
          <button onClick={() => { clearDraft(draftKey); setForm(EMPTY_FORM); setDraftRestaure(false); }} className="underline hover:no-underline flex-shrink-0">Vider le brouillon</button>
        </p>
      )}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} isLoading={loading} disabled={!montantValide}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {erreurApi && (
          <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2">
            {erreurApi}
          </p>
        )}
        <FormField label="Label" required>
          <input className={INPUT_CLS} value={form.label} onChange={e => setForm(v => ({ ...v, label: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Numero de devis" hint="Emis par le fournisseur">
            <input className={INPUT_CLS} value={form.numero_devis} onChange={e => setForm(v => ({ ...v, numero_devis: e.target.value }))} />
          </FormField>
          <FormField label="Reference interne" hint="Optionnel">
            <input className={INPUT_CLS} value={form.reference_interne} onChange={e => setForm(v => ({ ...v, reference_interne: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Contrat" required>
          <select className={INPUT_CLS} value={form.id_contrat} onChange={e => setForm(v => ({ ...v, id_contrat: e.target.value }))}>
            <option value="">Choisir...</option>
            {contrats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Societe acheteuse" required>
            <select className={INPUT_CLS} value={form.id_societe} onChange={e => setForm(v => ({ ...v, id_societe: e.target.value }))}>
              <option value="">Choisir...</option>
              {societes.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
            </select>
          </FormField>
          <FormField label="Revendeur" hint="Optionnel">
            <select className={INPUT_CLS} value={form.id_revendeur} onChange={e => setForm(v => ({ ...v, id_revendeur: e.target.value }))}>
              <option value="">Aucun</option>
              {revendeurs.map(r => <option key={r.id} value={r.id}>{r.raison_sociale}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Mode de commande" hint="Optionnel">
            <select className={INPUT_CLS} value={form.id_mode_commande} onChange={e => setForm(v => ({ ...v, id_mode_commande: e.target.value }))}>
              <option value="">Aucun</option>
              {modes.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </FormField>
          <FormField label="Montant (€)" required>
            <input type="number" min={0} step="0.01" className={INPUT_CLS} value={form.montant} onChange={e => setForm(v => ({ ...v, montant: e.target.value }))} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date de commande" required>
            <input type="date" className={INPUT_CLS} value={form.date_commande} onChange={e => setForm(v => ({ ...v, date_commande: e.target.value }))} />
          </FormField>
          <FormField label="Date de fin" hint="Optionnelle (perpetuel si vide)">
            <input type="date" className={INPUT_CLS} value={form.date_fin} onChange={e => setForm(v => ({ ...v, date_fin: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="A renouveler">
          <label className="flex items-center gap-3 pt-1 cursor-pointer">
            <div onClick={() => setForm(v => ({ ...v, a_renouveler: !v.a_renouveler }))}
                 className={`relative w-10 h-5 rounded-full transition-colors ${form.a_renouveler ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.a_renouveler ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300">{form.a_renouveler ? 'Oui' : 'Non'}</span>
          </label>
        </FormField>
      </div>
    </SlideOver>
  );
}