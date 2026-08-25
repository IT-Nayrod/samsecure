// MaintenanceFormModal - ajout / modification d'une periode de maintenance
// (maintenance_historique) d'une licence. Ecriture par l'API, les regles de
// validation serveur (4031 a 4033, 4022, 4016, 4024) sont rendues telles quelles.
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { licencesService } from '../../services/licencesService';
import { useToast } from '../../hooks/useToast';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = { date_debut: '', date_fin: '', cout: '', id_mainteneur: '', id_revendeur: '' };

export default function MaintenanceFormModal({ isOpen, onClose, onSaved, licenceId, periode, mainteneurs = [], revendeurs = [], montantsVisibles = true }) {
  const isEdit = !!periode;
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(periode ? {
      date_debut: periode.date_debut ?? '', date_fin: periode.date_fin ?? '',
      cout: periode.cout ?? '', id_mainteneur: periode.id_mainteneur ?? '', id_revendeur: periode.id_revendeur ?? '',
    } : EMPTY_FORM);
    setErrors({});
  }, [periode, isOpen]);

  function validate() {
    const e = {};
    if (!form.date_debut) e.date_debut = 'La date de début est requise';
    if (form.date_fin && form.date_fin < form.date_debut) e.date_fin = 'La date de fin doit être postérieure à la date de début';
    if (form.cout !== '' && Number(form.cout) < 0) e.cout = 'Le coût ne peut pas être négatif';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const payload = { ...form };
      // Sans le droit de voir les montants, le cout n'est pas touche : un PATCH
      // sans la cle laisse la valeur en base, un POST la laisse vide.
      if (!montantsVisibles) delete payload.cout;
      const saved = isEdit
        ? await licencesService.maintenance.update(licenceId, periode.id, payload)
        : await licencesService.maintenance.create(licenceId, payload);
      addToast({ type: 'success', message: isEdit ? 'Période de maintenance mise à jour.' : 'Période de maintenance ajoutée.' });
      onSaved(saved);
      onClose();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  const isValid = !Object.values(validate()).some(Boolean);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier la période de maintenance' : 'Nouvelle période de maintenance'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} isLoading={loading} disabled={!isValid}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date de début" required error={errors.date_debut}>
            <input type="date" className={INPUT_CLS} value={form.date_debut} onChange={e => { setForm(v => ({ ...v, date_debut: e.target.value })); setErrors(v => ({ ...v, date_debut: null })); }} />
          </FormField>
          <FormField label="Date de fin" hint="Vide = en cours" error={errors.date_fin}>
            <input type="date" className={INPUT_CLS} value={form.date_fin} onChange={e => { setForm(v => ({ ...v, date_fin: e.target.value })); setErrors(v => ({ ...v, date_fin: null })); }} />
          </FormField>
        </div>
        <FormField label="Mainteneur">
          <select className={INPUT_CLS} value={form.id_mainteneur} onChange={e => setForm(v => ({ ...v, id_mainteneur: e.target.value }))}>
            <option value="">Non renseigné</option>
            {mainteneurs.map(m => <option key={m.id} value={m.id}>{m.raison_sociale}</option>)}
          </select>
        </FormField>
        <FormField label="Revendeur">
          <select className={INPUT_CLS} value={form.id_revendeur} onChange={e => setForm(v => ({ ...v, id_revendeur: e.target.value }))}>
            <option value="">Non renseigné</option>
            {revendeurs.map(r => <option key={r.id} value={r.id}>{r.raison_sociale}</option>)}
          </select>
        </FormField>
        {montantsVisibles && (
          <FormField label="Coût (EUR)" error={errors.cout}>
            <input type="number" min={0} step="0.01" className={INPUT_CLS} value={form.cout} onChange={e => { setForm(v => ({ ...v, cout: e.target.value })); setErrors(v => ({ ...v, cout: null })); }} />
          </FormField>
        )}
      </div>
    </SlideOver>
  );
}
