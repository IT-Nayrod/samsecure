// LicenceFormModal - creation / edition d'une licence (droit acquis), par l'API.
// Referentiels : catalogue des produits (versions et editions imbriquees),
// commandes (le contrat se deduit de la commande, jamais saisi ici),
// revendeurs, unites de mesure, mainteneurs. Les regles de validation serveur
// (4011 a 4024) sont rendues telles quelles en toast.
import { useState, useEffect, useMemo } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { licencesService } from '../../services/licencesService';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';
import { useToast } from '../../hooks/useToast';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = {
  label: '', id_produit: '', id_edition: '', id_version: '', id_commande: '', id_revendeur: '',
  id_unite_mesure: '', type: 'souscription', quantite: 1, cout_licence: '', date_fin_souscription: '',
  a_maintenance: false, id_mainteneur: '', date_fin_maintenance: '',
};

export default function LicenceFormModal({
  isOpen, onClose, onSaved, licence,
  produits = [], commandes = [], revendeurs = [], unites = [], mainteneurs = [],
  montantsVisibles = true,
}) {
  const isEdit = !!licence;
  const { addToast } = useToast();
  const draftKey = `licence:${licence?.id ?? 'new'}`;
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [draftRestaure, setDraftRestaure] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const draft = loadDraft(draftKey);
    if (draft) {
      setForm({ ...EMPTY_FORM, ...draft });
      setDraftRestaure(true);
      setErrors({});
      return;
    }
    if (licence) {
      setForm({
        label: licence.label ?? '',
        id_produit: licence.id_produit ?? '', id_edition: licence.id_edition ?? '', id_version: licence.id_version ?? '',
        id_commande: licence.id_commande ?? '', id_revendeur: licence.id_revendeur ?? '',
        id_unite_mesure: licence.id_unite_mesure ?? '', type: licence.type,
        quantite: licence.quantite, cout_licence: licence.cout_licence ?? '',
        date_fin_souscription: licence.date_fin_souscription ?? '',
        a_maintenance: !!licence.a_maintenance, id_mainteneur: licence.id_mainteneur ?? '',
        date_fin_maintenance: licence.date_fin_maintenance ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setDraftRestaure(false);
    setErrors({});
  }, [licence, isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  const produit = useMemo(() => produits.find(p => p.id === form.id_produit) ?? null, [produits, form.id_produit]);
  const versions = produit?.versions ?? [];
  const editions = produit?.editions ?? [];
  const commande = useMemo(() => commandes.find(c => c.id === form.id_commande) ?? null, [commandes, form.id_commande]);

  function validate() {
    const e = {};
    if (!form.id_produit) e.id_produit = 'Le produit est requis';
    const qte = Number(form.quantite);
    if (!Number.isInteger(qte) || qte < 1) e.quantite = 'La quantite doit etre un entier superieur a 0';
    if (form.cout_licence !== '' && Number(form.cout_licence) < 0) e.cout_licence = 'Le cout ne peut pas etre negatif';
    if (form.type === 'souscription' && !form.date_fin_souscription) e.date_fin_souscription = 'La date de fin est requise pour une souscription';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const payload = { ...form, quantite: Number(form.quantite) };
      // Sans le droit de voir les montants, le cout n'est jamais envoye : un
      // PATCH sans la cle conserve la valeur en base.
      if (!montantsVisibles) delete payload.cout_licence;
      const saved = isEdit
        ? await licencesService.update(licence.id, payload)
        : await licencesService.create(payload);
      addToast({ type: 'success', message: isEdit ? 'Licence mise a jour.' : 'Licence creee.' });
      clearDraft(draftKey);
      onSaved(saved);
      onClose();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  const isValid = !Object.values(validate()).some(Boolean);
  const champ = (cle) => (e) => { setForm(v => ({ ...v, [cle]: e.target.value })); setErrors(v => ({ ...v, [cle]: null })); };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier la licence' : 'Nouvelle licence'}
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
          <Button variant="primary" onClick={handleSave} isLoading={loading} disabled={!isValid}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Libelle du lot" hint="Optionnel, le produit sert de libelle par defaut">
          <input type="text" className={INPUT_CLS} value={form.label} onChange={champ('label')} placeholder="Ex. M365, siege" />
        </FormField>
        <FormField label="Produit" required error={errors.id_produit}>
          <select className={INPUT_CLS} value={form.id_produit} onChange={e => { setForm(v => ({ ...v, id_produit: e.target.value, id_edition: '', id_version: '' })); setErrors(v => ({ ...v, id_produit: null })); }}>
            <option value="">Choisir...</option>
            {produits.map(p => <option key={p.id} value={p.id}>{p.label}{p.editeur_label ? ` (${p.editeur_label})` : ''}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Edition" hint="Optionnel">
            <select className={INPUT_CLS} value={form.id_edition} onChange={champ('id_edition')} disabled={!editions.length}>
              <option value="">Aucune</option>
              {editions.map(ed => <option key={ed.id} value={ed.id}>{ed.label}</option>)}
            </select>
          </FormField>
          <FormField label="Version" hint="Optionnel">
            <select className={INPUT_CLS} value={form.id_version} onChange={champ('id_version')} disabled={!versions.length}>
              <option value="">Aucune</option>
              {versions.map(ve => <option key={ve.id} value={ve.id}>{ve.label}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Commande" hint="Optionnel">
            <select className={INPUT_CLS} value={form.id_commande} onChange={champ('id_commande')}>
              <option value="">Aucune</option>
              {commandes.map(c => <option key={c.id} value={c.id}>{c.label}{c.contrat_label ? ` (${c.contrat_label})` : ''}</option>)}
            </select>
          </FormField>
          <FormField label="Contrat" hint="Deduit de la commande">
            <input type="text" className={`${INPUT_CLS} bg-gray-50 dark:bg-gray-800`} value={commande?.contrat_label ?? ''} readOnly placeholder="-" />
          </FormField>
        </div>
        <FormField label="Revendeur" hint="Optionnel">
          <select className={INPUT_CLS} value={form.id_revendeur} onChange={champ('id_revendeur')}>
            <option value="">Aucun</option>
            {revendeurs.map(r => <option key={r.id} value={r.id}>{r.raison_sociale}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Type">
            <select className={INPUT_CLS} value={form.type} onChange={champ('type')}>
              <option value="souscription">Souscription</option>
              <option value="perpetuelle">Perpetuelle</option>
            </select>
          </FormField>
          <FormField label="Unite de mesure">
            <select className={INPUT_CLS} value={form.id_unite_mesure} onChange={champ('id_unite_mesure')}>
              <option value="">Non renseignee</option>
              {unites.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Quantite" required error={errors.quantite}>
            <input type="number" min={1} step={1} className={INPUT_CLS} value={form.quantite} onChange={champ('quantite')} />
          </FormField>
          {montantsVisibles && (
            <FormField label="Cout (EUR)" error={errors.cout_licence}>
              <input type="number" min={0} step="0.01" className={INPUT_CLS} value={form.cout_licence} onChange={champ('cout_licence')} />
            </FormField>
          )}
        </div>
        {form.type === 'souscription' && (
          <FormField label="Fin de souscription" required error={errors.date_fin_souscription} hint="Expiree le jour meme, sans tolerance">
            <input type="date" className={INPUT_CLS} value={form.date_fin_souscription} onChange={champ('date_fin_souscription')} />
          </FormField>
        )}
        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={form.a_maintenance} onChange={e => setForm(v => ({ ...v, a_maintenance: e.target.checked }))} />
            Sous maintenance (droit aux montees de version)
          </label>
          {form.a_maintenance && (
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Mainteneur">
                <select className={INPUT_CLS} value={form.id_mainteneur} onChange={champ('id_mainteneur')}>
                  <option value="">Non renseigne</option>
                  {mainteneurs.map(m => <option key={m.id} value={m.id}>{m.raison_sociale}</option>)}
                </select>
              </FormField>
              <FormField label="Fin de maintenance" hint="Optionnel">
                <input type="date" className={INPUT_CLS} value={form.date_fin_maintenance} onChange={champ('date_fin_maintenance')} />
              </FormField>
            </div>
          )}
        </div>
      </div>
    </SlideOver>
  );
}
