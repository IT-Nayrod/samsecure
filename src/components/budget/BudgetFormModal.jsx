// BudgetFormModal - Section Saisie Budget - SamSecure v0.5
import { useState, useEffect, useCallback } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';
import { mockLicences, mockMaintenanceHistorique } from '../../data/mockDeploiement';
import { mockContrats } from '../../data/mockContrats';
import { mockEditeurs, mockProduits } from '../../data/mockReferentiels';
import { FACTEUR_INFLATION_DEFAUT } from '../../data/mockBudget';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';
const NUM_CLS = `${INPUT_CLS} text-right`;

const EMPTY_FORM = {
  id_licence: '',
  type: 'previsionnel',
  date_debut: '',
  date_fin: '',
  montant_CAPEX: 0,
  montant_OPEX: 0,
  quantite_CAPEX: 0,
  quantite_OPEX: 0,
  date_CAPEX: '',
};

const licencesOptions = mockLicences.map(l => {
  const contrat = mockContrats.find(c => c.id === l.id_contrat);
  const editeur = mockEditeurs.find(e => e.id === contrat?.id_editeur);
  const produit = mockProduits.find(p => p.id === l.id_produit);
  return {
    value: l.id,
    label: [produit?.label, editeur?.raison_sociale, contrat?.label].filter(Boolean).join(' - '),
  };
});

function runPrefill(idLicence, dateDebut, dateFin) {
  const maintenance = mockMaintenanceHistorique.filter(m => m.id_licence === idLicence);
  if (!maintenance.length) return null;
  const licence = mockLicences.find(l => l.id === idLicence);

  if (dateDebut && dateFin) {
    const pStart = new Date(dateDebut);
    const pEnd = new Date(dateFin);
    const overlapping = maintenance.filter(m =>
      new Date(m.date_debut) <= pEnd && new Date(m.date_fin) >= pStart
    );
    if (overlapping.length) {
      const latest = overlapping.sort((a, b) => new Date(b.date_debut) - new Date(a.date_debut))[0];
      return { montant_OPEX: latest.cout, quantite_OPEX: licence?.quantite ?? 0, note: 'standard' };
    }
    const past = maintenance
      .filter(m => new Date(m.date_fin) < pStart)
      .sort((a, b) => new Date(b.date_fin) - new Date(a.date_fin));
    if (past.length) {
      return {
        montant_OPEX: Math.round(past[0].cout * (1 + FACTEUR_INFLATION_DEFAUT)),
        quantite_OPEX: licence?.quantite ?? 0,
        note: 'inflation',
      };
    }
  }
  return null;
}

export default function BudgetFormModal({ isOpen, onClose, onSave, ligne, defaultDateDebut, defaultDateFin, lockedLicenceId }) {
  const isEdit = !!ligne;
  const draftKey = `budget:${ligne?.id ?? 'new'}`;
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [draftRestaure, setDraftRestaure] = useState(false);
  const [prefillNote, setPrefillNote] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const draft = loadDraft(draftKey);
    if (draft) {
      setForm(draft);
      setDraftRestaure(true);
      setErrors({});
      setPrefillNote(null);
      return;
    }
    setDraftRestaure(false);
    setErrors({});
    if (ligne) {
      setForm({
        id_licence: ligne.id_licence,
        type: ligne.type,
        date_debut: ligne.date_debut,
        date_fin: ligne.date_fin,
        montant_CAPEX: ligne.montant_CAPEX,
        montant_OPEX: ligne.montant_OPEX,
        quantite_CAPEX: ligne.quantite_CAPEX,
        quantite_OPEX: ligne.quantite_OPEX,
        date_CAPEX: ligne.date_CAPEX ?? '',
      });
      setPrefillNote(null);
    } else {
      let initForm = {
        ...EMPTY_FORM,
        date_debut: defaultDateDebut ?? '',
        date_fin: defaultDateFin ?? '',
        id_licence: lockedLicenceId ?? '',
      };
      let note = null;
      if (lockedLicenceId) {
        const prefill = runPrefill(lockedLicenceId, defaultDateDebut ?? '', defaultDateFin ?? '');
        if (prefill) {
          initForm = { ...initForm, montant_OPEX: prefill.montant_OPEX, quantite_OPEX: prefill.quantite_OPEX };
          note = prefill.note;
        }
      }
      setForm(initForm);
      setPrefillNote(note);
    }
  }, [ligne, isOpen, draftKey, defaultDateDebut, defaultDateFin, lockedLicenceId]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  const triggerPrefill = useCallback((idLicence, type, dateDebut, dateFin) => {
    if (type !== 'previsionnel' || !idLicence) return;
    const result = runPrefill(idLicence, dateDebut, dateFin);
    if (!result) return;
    setForm(prev => ({ ...prev, montant_OPEX: result.montant_OPEX, quantite_OPEX: result.quantite_OPEX }));
    setPrefillNote(result.note);
  }, []);

  function handleLicenceChange(idLicence) {
    setForm(prev => ({ ...prev, id_licence: idLicence }));
    triggerPrefill(idLicence, form.type, form.date_debut, form.date_fin);
  }

  function handleTypeChange(type) {
    setForm(prev => ({ ...prev, type }));
    if (type !== 'previsionnel') { setPrefillNote(null); return; }
    triggerPrefill(form.id_licence, type, form.date_debut, form.date_fin);
  }

  function validate() {
    const e = {};
    if (!form.id_licence) e.id_licence = 'La licence est requise.';
    if (!form.type) e.type = 'Le type est requis.';
    if (!form.date_debut) e.date_debut = 'La date de debut est requise.';
    if (!form.date_fin) e.date_fin = 'La date de fin est requise.';
    if (form.date_debut && form.date_fin && form.date_fin <= form.date_debut)
      e.date_fin = 'La date de fin doit etre posterieure a la date de debut.';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    setLoading(false);
    // TODO API: POST/PUT /api/budget - remplacer par appel fetch
    onSave({
      id_licence: form.id_licence,
      type: form.type,
      date_debut: form.date_debut,
      date_fin: form.date_fin,
      montant_CAPEX: Number(form.montant_CAPEX) || 0,
      montant_OPEX: Number(form.montant_OPEX) || 0,
      quantite_CAPEX: Number(form.quantite_CAPEX) || 0,
      quantite_OPEX: Number(form.quantite_OPEX) || 0,
      date_CAPEX: form.date_CAPEX || null,
    });
    clearDraft(draftKey);
    onClose();
  }

  const isValid = !Object.values(validate()).some(Boolean);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier la ligne budgetaire' : 'Ajouter une ligne budgetaire'}
      size="lg"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restaure depuis votre derniere saisie.
          <button
            onClick={() => {
              clearDraft(draftKey);
              setForm(ligne ? { id_licence: ligne.id_licence, type: ligne.type, date_debut: ligne.date_debut, date_fin: ligne.date_fin, montant_CAPEX: ligne.montant_CAPEX, montant_OPEX: ligne.montant_OPEX, quantite_CAPEX: ligne.quantite_CAPEX, quantite_OPEX: ligne.quantite_OPEX, date_CAPEX: ligne.date_CAPEX ?? '' } : { ...EMPTY_FORM, date_debut: defaultDateDebut ?? '', date_fin: defaultDateFin ?? '', id_licence: lockedLicenceId ?? '' });
              setDraftRestaure(false);
              setPrefillNote(null);
            }}
            className="underline hover:no-underline flex-shrink-0"
          >
            Vider le brouillon
          </button>
        </p>
      )}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} isLoading={loading} disabled={!isValid}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Section Identification */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
            Identification
          </h3>
          <div className="flex flex-col gap-4">
            <FormField label="Licence" required error={errors.id_licence}>
              {lockedLicenceId ? (
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2">
                  {licencesOptions.find(o => o.value === lockedLicenceId)?.label ?? lockedLicenceId}
                </p>
              ) : (
                <select
                  className={INPUT_CLS}
                  value={form.id_licence}
                  onChange={e => handleLicenceChange(e.target.value)}
                >
                  <option value="">Choisir une licence...</option>
                  {licencesOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="Type" required error={errors.type}>
              <select
                className={INPUT_CLS}
                value={form.type}
                onChange={e => handleTypeChange(e.target.value)}
              >
                <option value="previsionnel">Previsionnel</option>
                <option value="alloue">Alloue</option>
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Date de debut" required error={errors.date_debut}>
                <input
                  type="date"
                  className={INPUT_CLS}
                  value={form.date_debut}
                  onChange={e => setForm(prev => ({ ...prev, date_debut: e.target.value }))}
                />
              </FormField>
              <FormField label="Date de fin" required error={errors.date_fin}>
                <input
                  type="date"
                  className={INPUT_CLS}
                  value={form.date_fin}
                  min={form.date_debut || undefined}
                  onChange={e => setForm(prev => ({ ...prev, date_fin: e.target.value }))}
                />
              </FormField>
            </div>
          </div>
        </section>

        {/* Section Montants */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
            Montants
          </h3>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Montant CAPEX (EUR)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={NUM_CLS}
                  value={form.montant_CAPEX}
                  onChange={e => setForm(prev => ({ ...prev, montant_CAPEX: e.target.value }))}
                />
              </FormField>
              <FormField label="Quantite CAPEX (licences)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={NUM_CLS}
                  value={form.quantite_CAPEX}
                  onChange={e => setForm(prev => ({ ...prev, quantite_CAPEX: e.target.value }))}
                />
              </FormField>
            </div>
            {Number(form.montant_CAPEX) > 0 && (
              <FormField label="Date d'engagement CAPEX">
                <input
                  type="date"
                  className={INPUT_CLS}
                  value={form.date_CAPEX}
                  onChange={e => setForm(prev => ({ ...prev, date_CAPEX: e.target.value }))}
                />
              </FormField>
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Montant OPEX (EUR)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={NUM_CLS}
                  value={form.montant_OPEX}
                  onChange={e => setForm(prev => ({ ...prev, montant_OPEX: e.target.value }))}
                />
              </FormField>
              <FormField label="Quantite OPEX (licences)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={NUM_CLS}
                  value={form.quantite_OPEX}
                  onChange={e => setForm(prev => ({ ...prev, quantite_OPEX: e.target.value }))}
                />
              </FormField>
            </div>
          </div>

          {form.type === 'previsionnel' && prefillNote && (
            <p className="mt-3 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
              {prefillNote === 'inflation'
                ? `Montant OPEX estime incluant +${Math.round(FACTEUR_INFLATION_DEFAUT * 100)} % d'inflation (renouvellement prevu).`
                : 'Montants pre-remplis a partir des contrats de maintenance existants. Vous pouvez les ajuster.'}
            </p>
          )}
        </section>
      </div>
    </SlideOver>
  );
}
