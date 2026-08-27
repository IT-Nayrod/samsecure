// ProduitFormModal - creation et edition d'un logiciel client.
//
// Le catalogue commun ne se cree ni ne se modifie depuis un espace client : il
// est partage par tous les clients SamSecure. Il reste proposable comme parent,
// un logiciel maison pouvant se rattacher a une suite du catalogue.
//
// Le champ Maintenance a disparu : le modele ne le porte plus sur le produit
// (modif 12), c'est un choix client porte par la licence.
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { validateRequired } from '../../utils/validation';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

// Un produit ne peut pas etre son propre ancetre : on retire le produit edite
// et tous ses descendants des options de parent. L'API refait le controle, ce
// filtrage ne fait qu'eviter de proposer un choix qui finirait en 409.
function getDescendantIds(produits, rootId) {
  const ids = new Set();
  let frontier = [rootId];
  while (frontier.length) {
    const next = produits.filter(p => frontier.includes(p.id_produit_parent)).map(p => p.id);
    next.forEach(id => ids.add(id));
    frontier = next;
  }
  return ids;
}

const EMPTY_FORM = { label: '', id_editeur: '', id_produit_parent: '' };

function formDepuis(produit) {
  return produit
    ? {
      label: produit.label,
      id_editeur: produit.id_editeur ?? '',
      id_produit_parent: produit.id_produit_parent ?? '',
    }
    : EMPTY_FORM;
}

export default function ProduitFormModal({ isOpen, onClose, onSave, produit, allProduits = [], editeurs = [] }) {
  const isEdit = !!produit;
  const draftKey = `produit:${produit?.id ?? 'new'}`;
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
    setForm(formDepuis(produit));
    setDraftRestaure(false);
    setErrors({});
  }, [produit, isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  function validate() {
    const e = {};
    const labelErr = validateRequired(form.label, 'Le libellé');
    if (labelErr) e.label = labelErr;
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      await onSave({
        label: form.label.trim(),
        id_editeur: form.id_editeur || null,
        id_produit_parent: form.id_produit_parent || null,
      }, produit);
      clearDraft(draftKey);
      onClose();
    } catch (err) {
      // Rattachement refuse : boucle dans la hierarchie, ou parent disparu
      // depuis le chargement de la liste. Le message du serveur est porte sur
      // le champ concerne, la modale garde la saisie.
      if (err?.status === 409 || err?.status === 400) {
        setErrors({ id_produit_parent: err.message });
      }
    } finally {
      setLoading(false);
    }
  }

  function viderBrouillon() {
    clearDraft(draftKey);
    setForm(formDepuis(produit));
    setErrors({});
    setDraftRestaure(false);
  }

  const isValid = !Object.values(validate()).some(Boolean);
  const excludedIds = produit ? getDescendantIds(allProduits, produit.id) : new Set();
  const parentOptions = allProduits.filter(p => p.id !== produit?.id && !excludedIds.has(p.id));

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier le logiciel client' : 'Nouveau logiciel client'}
      size="sm"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restauré depuis votre dernière saisie.
          <button onClick={viderBrouillon} className="underline hover:no-underline flex-shrink-0">Vider le brouillon</button>
        </p>
      )}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} isLoading={loading} disabled={!isValid}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Libellé" required error={errors.label}>
          <input className={INPUT_CLS} value={form.label} onChange={e => { setForm(v => ({ ...v, label: e.target.value })); setErrors(v => ({ ...v, label: null })); }} />
        </FormField>
        <FormField label="Éditeur" hint="Optionnel">
          <select className={INPUT_CLS} value={form.id_editeur} onChange={e => setForm(v => ({ ...v, id_editeur: e.target.value }))}>
            <option value="">Aucun</option>
            {editeurs.map(ed => <option key={ed.id} value={ed.id}>{ed.raison_sociale}</option>)}
          </select>
        </FormField>
        <FormField label="Produit parent" hint="Optionnel, catalogue commun inclus" error={errors.id_produit_parent}>
          <select
            className={INPUT_CLS}
            value={form.id_produit_parent}
            onChange={e => { setForm(v => ({ ...v, id_produit_parent: e.target.value })); setErrors(v => ({ ...v, id_produit_parent: null })); }}
          >
            <option value="">Aucun</option>
            {parentOptions.map(p => (
              <option key={p.id} value={p.id}>
                {p.label}{p.source === 'catalogue' ? ' (catalogue)' : ''}
              </option>
            ))}
          </select>
        </FormField>
      </div>
    </SlideOver>
  );
}
