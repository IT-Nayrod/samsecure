// OrganisationFormModal - creation / edition d'une organisation (societe reelle)
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { validateRequired, validateSiret } from '../../utils/validation';
import { sortByHierarchy } from '../../utils/societeHierarchy';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

// Une organisation ne peut pas etre sa propre ascendante : on retire l'organisation
// editee et toutes ses descendantes des options de parente.
function getDescendantIds(organisations, rootId) {
  const ids = new Set();
  let frontier = [rootId];
  while (frontier.length) {
    const next = organisations.filter(o => frontier.includes(o.id_societe_parent)).map(o => o.id);
    next.forEach(id => ids.add(id));
    frontier = next;
  }
  return ids;
}

const EMPTY_FORM = { raison_sociale: '', siret: '', id_societe_parent: '', duree_amortissement: 36, revalorisation_annuelle: 3.5, delai_revalidation: 30 };

export default function OrganisationFormModal({ isOpen, onClose, onSubmit, organisation, existingOrganisations }) {
  const isEdit = !!organisation;
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (organisation) {
      setForm({
        raison_sociale: organisation.raison_sociale, siret: organisation.siret ?? '',
        id_societe_parent: organisation.id_societe_parent ?? '',
        duree_amortissement: organisation.duree_amortissement ?? 36,
        revalorisation_annuelle: organisation.revalorisation_annuelle ?? 3.5,
        delai_revalidation: organisation.delai_revalidation ?? 30,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [organisation, isOpen]);

  function validate() {
    const e = {};
    const reqErr = validateRequired(form.raison_sociale, 'La raison sociale');
    if (reqErr) e.raison_sociale = reqErr;
    else {
      const dup = existingOrganisations.some(o => o.id !== organisation?.id && o.raison_sociale.trim().toLowerCase() === form.raison_sociale.trim().toLowerCase());
      if (dup) e.raison_sociale = 'Une organisation avec cette raison sociale existe déjà';
    }
    if (form.siret) {
      const siretErr = validateSiret(form.siret);
      if (siretErr) e.siret = siretErr;
    }
    const amort = Number(form.duree_amortissement);
    if (!amort || amort < 1 || amort > 48) e.duree_amortissement = "La durée d'amortissement doit être comprise entre 1 et 48 mois";
    const revalid = Number(form.delai_revalidation);
    if (!revalid || revalid < 1 || revalid > 366) e.delai_revalidation = 'Le délai de revalidation doit être compris entre 1 et 366 jours';
    return e;
  }

  const isValid = Object.keys(validate()).length === 0;

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      await onSubmit({
        raison_sociale: form.raison_sociale.trim(),
        siret: form.siret.trim() || null,
        id_societe_parent: form.id_societe_parent || null,
        duree_amortissement: Number(form.duree_amortissement),
        revalorisation_annuelle: parseFloat(form.revalorisation_annuelle),
        delai_revalidation: Number(form.delai_revalidation),
      }, organisation);
      onClose();
    } catch (err) {
      setErrors((v) => ({ ...v, global: err.message }));
    } finally {
      setLoading(false);
    }
  }

  const excludedIds = organisation ? getDescendantIds(existingOrganisations, organisation.id) : new Set();
  const parentOptions = sortByHierarchy(existingOrganisations)
    .filter(o => o.id !== organisation?.id && !excludedIds.has(o.id));

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Modifier l'organisation" : 'Nouvelle organisation'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} isLoading={loading} disabled={!isValid}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {errors.global && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm text-red-700">{errors.global}</p>
          </div>
        )}
        <FormField label="Raison sociale" required error={errors.raison_sociale}>
          <input className={INPUT_CLS} value={form.raison_sociale} onChange={e => { setForm(v => ({ ...v, raison_sociale: e.target.value })); setErrors(v => ({ ...v, raison_sociale: null })); }} />
        </FormField>
        <FormField label="SIRET" error={errors.siret} hint="14 chiffres, optionnel">
          <input className={INPUT_CLS} value={form.siret} onChange={e => { setForm(v => ({ ...v, siret: e.target.value })); setErrors(v => ({ ...v, siret: null })); }} maxLength={14} />
        </FormField>
        <FormField label="Organisation parente" hint="Optionnel">
          <select className={INPUT_CLS} value={form.id_societe_parent} onChange={e => setForm(v => ({ ...v, id_societe_parent: e.target.value }))}>
            <option value="">Aucune (organisation mère)</option>
            {parentOptions.map(o => (
              <option key={o.id} value={o.id}>{'  '.repeat(o.depth)}{o.depth > 0 ? '└ ' : ''}{o.raison_sociale}</option>
            ))}
          </select>
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Durée amort. (mois)" error={errors.duree_amortissement}>
            <input type="number" className={INPUT_CLS} value={form.duree_amortissement} onChange={e => { setForm(v => ({ ...v, duree_amortissement: e.target.value })); setErrors(v => ({ ...v, duree_amortissement: null })); }} min={1} max={48} />
          </FormField>
          <FormField label="Revalorisation (%)">
            <input type="number" className={INPUT_CLS} value={form.revalorisation_annuelle} onChange={e => setForm(v => ({ ...v, revalorisation_annuelle: e.target.value }))} step={0.1} min={0} />
          </FormField>
          <FormField label="Délai revalid. (j)" error={errors.delai_revalidation}>
            <input type="number" className={INPUT_CLS} value={form.delai_revalidation} onChange={e => { setForm(v => ({ ...v, delai_revalidation: e.target.value })); setErrors(v => ({ ...v, delai_revalidation: null })); }} min={1} max={366} />
          </FormField>
        </div>
      </div>
    </SlideOver>
  );
}
