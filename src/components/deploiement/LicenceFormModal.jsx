// LicenceFormModal - creation / edition d'une licence (droit acquis)
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { mockProduits, mockRevendeurs, getVersionsByProduit, getEditionsByProduit } from '../../data/mockReferentiels';
import { mockContrats, mockCommandes } from '../../data/mockContrats';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = {
  id_produit: '', id_edition: '', id_version: '', id_contrat: '', id_commande: '', id_revendeur: '',
  type: 'souscription', unite_mesure: 'utilisateur', quantite: 1, cout: 0,
};

export default function LicenceFormModal({ isOpen, onClose, onSave, licence }) {
  const isEdit = !!licence;
  const draftKey = `licence:${licence?.id ?? 'new'}`;
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
    if (licence) {
      setForm({
        id_produit: licence.id_produit, id_edition: licence.id_edition ?? '', id_version: licence.id_version ?? '',
        id_contrat: licence.id_contrat ?? '', id_commande: licence.id_commande ?? '', id_revendeur: licence.id_revendeur ?? '',
        type: licence.type, unite_mesure: licence.unite_mesure, quantite: licence.quantite, cout: licence.cout,
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

  function validate() {
    const e = {};
    if (!form.id_produit) e.id_produit = 'Le produit est requis';
    const qte = Number(form.quantite);
    if (!qte || qte < 1) e.quantite = 'La quantite doit etre superieure a 0';
    const cout = Number(form.cout);
    if (cout < 0) e.cout = 'Le cout ne peut pas etre negatif';
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
      id_edition: form.id_edition || null,
      id_version: form.id_version || null,
      id_contrat: form.id_contrat || null,
      id_commande: form.id_commande || null,
      id_revendeur: form.id_revendeur || null,
      quantite: Number(form.quantite),
      cout: Number(form.cout),
    }, licence);
    clearDraft(draftKey);
    onClose();
  }

  const isValid = !Object.values(validate()).some(Boolean);
  const versions = form.id_produit ? getVersionsByProduit(form.id_produit) : [];
  const editions = form.id_produit ? getEditionsByProduit(form.id_produit) : [];

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier la licence' : 'Nouvelle licence'}
      size="md"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restaure depuis votre derniere saisie.
          <button onClick={() => { clearDraft(draftKey); setForm(licence ? form : EMPTY_FORM); setDraftRestaure(false); }} className="underline hover:no-underline flex-shrink-0">Vider le brouillon</button>
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
          <select className={INPUT_CLS} value={form.id_produit} onChange={e => { setForm(v => ({ ...v, id_produit: e.target.value, id_edition: '', id_version: '' })); setErrors(v => ({ ...v, id_produit: null })); }}>
            <option value="">Choisir...</option>
            {mockProduits.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Edition" hint="Optionnel">
            <select className={INPUT_CLS} value={form.id_edition} onChange={e => setForm(v => ({ ...v, id_edition: e.target.value }))} disabled={!editions.length}>
              <option value="">Aucune</option>
              {editions.map(ed => <option key={ed.id} value={ed.id}>{ed.label}</option>)}
            </select>
          </FormField>
          <FormField label="Version" hint="Optionnel">
            <select className={INPUT_CLS} value={form.id_version} onChange={e => setForm(v => ({ ...v, id_version: e.target.value }))} disabled={!versions.length}>
              <option value="">Aucune</option>
              {versions.map(ve => <option key={ve.id} value={ve.id}>{ve.label}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Contrat" hint="Optionnel">
            <select className={INPUT_CLS} value={form.id_contrat} onChange={e => setForm(v => ({ ...v, id_contrat: e.target.value }))}>
              <option value="">Aucun</option>
              {mockContrats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </FormField>
          <FormField label="Commande" hint="Optionnel">
            <select className={INPUT_CLS} value={form.id_commande} onChange={e => setForm(v => ({ ...v, id_commande: e.target.value }))}>
              <option value="">Aucune</option>
              {mockCommandes.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Revendeur" hint="Optionnel">
          <select className={INPUT_CLS} value={form.id_revendeur} onChange={e => setForm(v => ({ ...v, id_revendeur: e.target.value }))}>
            <option value="">Aucun</option>
            {mockRevendeurs.map(r => <option key={r.id} value={r.id}>{r.raison_sociale}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Type">
            <select className={INPUT_CLS} value={form.type} onChange={e => setForm(v => ({ ...v, type: e.target.value }))}>
              <option value="souscription">Souscription</option>
              <option value="perpetuelle">Perpetuelle</option>
            </select>
          </FormField>
          <FormField label="Unite de mesure">
            <select className={INPUT_CLS} value={form.unite_mesure} onChange={e => setForm(v => ({ ...v, unite_mesure: e.target.value }))}>
              <option value="utilisateur">Utilisateur</option>
              <option value="device">Device</option>
              <option value="coeur">Coeur</option>
              <option value="instance">Instance</option>
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Quantite" required error={errors.quantite}>
            <input type="number" min={1} className={INPUT_CLS} value={form.quantite} onChange={e => { setForm(v => ({ ...v, quantite: e.target.value })); setErrors(v => ({ ...v, quantite: null })); }} />
          </FormField>
          <FormField label="Cout (EUR)" error={errors.cout}>
            <input type="number" min={0} className={INPUT_CLS} value={form.cout} onChange={e => { setForm(v => ({ ...v, cout: e.target.value })); setErrors(v => ({ ...v, cout: null })); }} />
          </FormField>
        </div>
      </div>
    </SlideOver>
  );
}
