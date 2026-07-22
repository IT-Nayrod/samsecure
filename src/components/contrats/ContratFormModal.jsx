// ContratFormModal - creation / edition d'un contrat
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { validateRequired } from '../../utils/validation';
import { mockEditeurs, mockSocietes } from '../../data/mockReferentiels';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

// Un contrat ne peut pas etre son propre ancetre : on retire le contrat edite et tous ses descendants des options de parent
function getDescendantIds(contrats, rootId) {
  const ids = new Set();
  let frontier = [rootId];
  while (frontier.length) {
    const next = contrats.filter(c => frontier.includes(c.id_contrat_parent)).map(c => c.id);
    next.forEach(id => ids.add(id));
    frontier = next;
  }
  return ids;
}

const EMPTY_FORM = {
  label: '', numero: '', type: 'simple', id_editeur: '', id_societe: '', id_contrat_parent: '',
  date_debut: '', date_fin: '', a_renouveler: false, preavis_resiliation_jours: '',
};

export default function ContratFormModal({ isOpen, onClose, onSave, contrat, existingContrats }) {
  const isEdit = !!contrat;
  const draftKey = `contrat:${contrat?.id ?? 'new'}`;
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
    if (contrat) {
      setForm({
        label: contrat.label, numero: contrat.numero ?? '', type: contrat.type, id_editeur: contrat.id_editeur ?? '',
        id_societe: contrat.id_societe ?? '', id_contrat_parent: contrat.id_contrat_parent ?? '',
        date_debut: contrat.date_debut ?? '', date_fin: contrat.date_fin ?? '',
        a_renouveler: contrat.a_renouveler, preavis_resiliation_jours: contrat.preavis_resiliation_jours ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setDraftRestaure(false);
    setErrors({});
  }, [contrat, isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  function validate() {
    const e = {};
    const labelErr = validateRequired(form.label, 'Le label');
    if (labelErr) e.label = labelErr;
    if (!form.id_editeur) e.id_editeur = 'L\'editeur est requis';
    if (!form.id_societe) e.id_societe = 'La societe est requise';
    if (form.date_fin && form.date_debut && form.date_fin < form.date_debut) {
      e.date_fin = 'La date de fin doit etre posterieure a la date de debut';
    }
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
      id_contrat_parent: form.id_contrat_parent || null,
      date_fin: form.date_fin || null,
      preavis_resiliation_jours: form.preavis_resiliation_jours ? Number(form.preavis_resiliation_jours) : null,
    }, contrat);
    clearDraft(draftKey);
    onClose();
  }

  const isValid = !Object.values(validate()).some(Boolean);
  const excludedIds = contrat ? getDescendantIds(existingContrats, contrat.id) : new Set();
  const parentOptions = existingContrats.filter(c => c.type === 'cadre' && c.id !== contrat?.id && !excludedIds.has(c.id));

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier le contrat' : 'Nouveau contrat'}
      size="md"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restaure depuis votre derniere saisie.
          <button onClick={() => { clearDraft(draftKey); setForm(contrat ? form : EMPTY_FORM); setDraftRestaure(false); }} className="underline hover:no-underline flex-shrink-0">Vider le brouillon</button>
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
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Numero" hint="Optionnel">
            <input className={INPUT_CLS} value={form.numero} onChange={e => setForm(v => ({ ...v, numero: e.target.value }))} />
          </FormField>
          <FormField label="Type">
            <select className={INPUT_CLS} value={form.type} onChange={e => setForm(v => ({ ...v, type: e.target.value }))}>
              <option value="simple">Simple</option>
              <option value="cadre">Cadre</option>
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Editeur" required error={errors.id_editeur}>
            <select className={INPUT_CLS} value={form.id_editeur} onChange={e => { setForm(v => ({ ...v, id_editeur: e.target.value })); setErrors(v => ({ ...v, id_editeur: null })); }}>
              <option value="">Choisir...</option>
              {mockEditeurs.map(ed => <option key={ed.id} value={ed.id}>{ed.raison_sociale}</option>)}
            </select>
          </FormField>
          <FormField label="Societe" required error={errors.id_societe}>
            <select className={INPUT_CLS} value={form.id_societe} onChange={e => { setForm(v => ({ ...v, id_societe: e.target.value })); setErrors(v => ({ ...v, id_societe: null })); }}>
              <option value="">Choisir...</option>
              {mockSocietes.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Contrat cadre parent" hint="Optionnel">
          <select className={INPUT_CLS} value={form.id_contrat_parent} onChange={e => setForm(v => ({ ...v, id_contrat_parent: e.target.value }))}>
            <option value="">Aucun</option>
            {parentOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date de debut">
            <input type="date" className={INPUT_CLS} value={form.date_debut} onChange={e => setForm(v => ({ ...v, date_debut: e.target.value }))} />
          </FormField>
          <FormField label="Date de fin" error={errors.date_fin} hint="Optionnelle (perpetuel si vide)">
            <input type="date" className={INPUT_CLS} value={form.date_fin} onChange={e => { setForm(v => ({ ...v, date_fin: e.target.value })); setErrors(v => ({ ...v, date_fin: null })); }} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4 items-end">
          <FormField label="Preavis de resiliation (jours)" hint="Optionnel">
            <input type="number" min={0} className={INPUT_CLS} value={form.preavis_resiliation_jours} onChange={e => setForm(v => ({ ...v, preavis_resiliation_jours: e.target.value }))} />
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
