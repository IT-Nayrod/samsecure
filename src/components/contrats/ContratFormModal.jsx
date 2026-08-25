// ContratFormModal - creation / edition d'un contrat, branche sur l'API.
// Les messages d'erreur affiches sont ceux renvoyes par le serveur, jamais des
// messages reconstruits ici.
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { contratsService } from '../../services/contratsService';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';
import { useToast } from '../../hooks/useToast';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

// Un contrat ne peut pas etre son propre ancetre : on retire le contrat edite et
// tous ses descendants des options de parent. Le serveur refait ce controle
// (WITH RECURSIVE), c'est ici un simple confort de saisie.
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
  label: '', id_type_contrat: '', id_editeur: '', id_societe: '', id_revendeur: '',
  id_contrat_parent: '', date_debut: '', date_fin: '', a_renouveler: false, duree_resiliation: '',
};

export default function ContratFormModal({
  isOpen, onClose, onSaved, contrat,
  contrats = [], typesContrat = [], editeurs = [], societes = [], revendeurs = [],
}) {
  const isEdit = !!contrat;
  const draftKey = `contrat:${contrat?.id ?? 'new'}`;
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [erreurApi, setErreurApi] = useState(null);
  const [erreurs, setErreurs] = useState({});
  const [loading, setLoading] = useState(false);
  const [draftRestaure, setDraftRestaure] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErreurApi(null);
    const draft = loadDraft(draftKey);
    if (draft) {
      setForm(draft);
      setDraftRestaure(true);
      return;
    }
    if (contrat) {
      setForm({
        label: contrat.label ?? '',
        id_type_contrat: contrat.id_type_contrat ?? '',
        id_editeur: contrat.id_editeur ?? '',
        id_societe: contrat.id_societe ?? '',
        id_revendeur: contrat.id_revendeur ?? '',
        id_contrat_parent: contrat.id_contrat_parent ?? '',
        date_debut: contrat.date_debut ?? '',
        date_fin: contrat.date_fin ?? '',
        a_renouveler: !!contrat.a_renouveler,
        duree_resiliation: contrat.duree_resiliation ?? '',
      });
    } else {
      // Type par defaut : le premier propose, pour ne pas soumettre un formulaire
      // qui echouerait sur un champ obligatoire cote serveur.
      setForm({ ...EMPTY_FORM, id_type_contrat: typesContrat[0]?.id ?? '' });
    }
    setDraftRestaure(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrat, isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  // Champs obligatoires (#95) : le formulaire refuse d'envoyer une saisie
  // incomplete et nomme le champ manquant ; le serveur applique la meme regle.
  function validate() {
    const e = {};
    if (!form.label.trim()) e.label = 'Le libellé est obligatoire';
    if (!form.id_type_contrat) e.id_type_contrat = 'Le type de contrat est obligatoire';
    if (!form.id_editeur) e.id_editeur = "L'éditeur est obligatoire";
    if (!form.id_societe) e.id_societe = 'La société signataire est obligatoire';
    if (!form.id_revendeur) e.id_revendeur = 'Le revendeur signataire est obligatoire';
    if (!form.date_debut) e.date_debut = 'La date de début est obligatoire';
    return e;
  }

  async function handleSave() {
    const e = validate();
    setErreurs(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    setErreurApi(null);
    const payload = {
      label: form.label,
      id_type_contrat: form.id_type_contrat,
      id_editeur: form.id_editeur,
      id_societe: form.id_societe,
      id_revendeur: form.id_revendeur,
      id_contrat_parent: form.id_contrat_parent,
      date_debut: form.date_debut,
      date_fin: form.date_fin,
      a_renouveler: form.a_renouveler,
      duree_resiliation: form.duree_resiliation,
    };
    try {
      if (isEdit) await contratsService.update(contrat.id, payload);
      else await contratsService.create(payload);
      clearDraft(draftKey);
      addToast({ type: 'success', message: isEdit ? 'Contrat mis à jour.' : 'Contrat créé.' });
      await onSaved?.();
      onClose();
    } catch (err) {
      setErreurApi(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Choisir un parent aligne les dates de l'enfant sur les siennes : valeurs par
  // defaut, modifiables ensuite. Le serveur n'impose pas la plage du parent, il
  // signale seulement une anomalie qualite quand l'enfant en sort.
  function choisirParent(idParent) {
    const parent = contrats.find(c => c.id === idParent) ?? null;
    setForm(v => ({
      ...v,
      id_contrat_parent: idParent,
      date_debut: parent ? (parent.date_debut ?? v.date_debut) : v.date_debut,
      date_fin: parent ? (parent.date_fin ?? v.date_fin) : v.date_fin,
    }));
  }

  const excludedIds = contrat ? getDescendantIds(contrats, contrat.id) : new Set();
  // L'API accepte un parent non cadre et trace une anomalie qualite. Le
  // formulaire ne le propose pas : l'anomalie ne couvre que les cas herites des imports.
  // Un contrat archive n'est plus propose comme parent (#96) ; celui deja en
  // place sur le contrat edite reste selectionnable pour ne pas le perdre.
  const parentOptions = contrats.filter(c => c.type_code === 'cadre' && c.id !== contrat?.id && !excludedIds.has(c.id)
    && (!c.archive || c.id === form.id_contrat_parent));

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier le contrat' : 'Nouveau contrat'}
      size="md"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restauré depuis votre dernière saisie.
          <button onClick={() => { clearDraft(draftKey); setForm(EMPTY_FORM); setDraftRestaure(false); }} className="underline hover:no-underline flex-shrink-0">Vider le brouillon</button>
        </p>
      )}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} isLoading={loading}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {erreurApi && (
          <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2">
            {erreurApi}
          </p>
        )}
        <FormField label="Libellé" required error={erreurs.label}>
          <input className={INPUT_CLS} value={form.label} onChange={e => setForm(v => ({ ...v, label: e.target.value }))} />
        </FormField>
        <FormField label="Type de contrat" required error={erreurs.id_type_contrat}>
          <select className={INPUT_CLS} value={form.id_type_contrat} onChange={e => setForm(v => ({ ...v, id_type_contrat: e.target.value }))}>
            <option value="">Choisir...</option>
            {typesContrat.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </FormField>
        <FormField label="Éditeur" required error={erreurs.id_editeur}>
          <select className={INPUT_CLS} value={form.id_editeur} onChange={e => setForm(v => ({ ...v, id_editeur: e.target.value }))}>
            <option value="">Choisir...</option>
            {editeurs.map(ed => <option key={ed.id} value={ed.id}>{ed.raison_sociale}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Société signataire" required hint="Signataire client" error={erreurs.id_societe}>
            <select className={INPUT_CLS} value={form.id_societe} onChange={e => setForm(v => ({ ...v, id_societe: e.target.value }))}>
              <option value="">Choisir...</option>
              {societes.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
            </select>
          </FormField>
          <FormField label="Revendeur signataire" required error={erreurs.id_revendeur}>
            <select className={INPUT_CLS} value={form.id_revendeur} onChange={e => setForm(v => ({ ...v, id_revendeur: e.target.value }))}>
              <option value="">Choisir...</option>
              {revendeurs.map(r => <option key={r.id} value={r.id}>{r.raison_sociale}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Contrat cadre parent" hint="Optionnel, seuls les contrats de type cadre sont proposés ; ses dates sont reprises, modifiables ensuite">
          <select className={INPUT_CLS} value={form.id_contrat_parent} onChange={e => choisirParent(e.target.value)}>
            <option value="">Aucun</option>
            {parentOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date de début" required error={erreurs.date_debut}>
            <input type="date" className={INPUT_CLS} value={form.date_debut} onChange={e => setForm(v => ({ ...v, date_debut: e.target.value }))} />
          </FormField>
          <FormField label="Date de fin" hint="Optionnelle (perpétuel si vide)">
            <input type="date" className={INPUT_CLS} value={form.date_fin} onChange={e => setForm(v => ({ ...v, date_fin: e.target.value }))} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4 items-end">
          <FormField label="Préavis de résiliation (jours)" hint="Optionnel">
            <input type="number" min={0} className={INPUT_CLS} value={form.duree_resiliation} onChange={e => setForm(v => ({ ...v, duree_resiliation: e.target.value }))} />
          </FormField>
          <FormField label="À renouveler">
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
