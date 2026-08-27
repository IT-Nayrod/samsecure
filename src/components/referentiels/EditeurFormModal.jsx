// EditeurFormModal - creation et edition d'un editeur.
//
// L'unicite de la raison sociale n'est pas verifiee ici sur une liste chargee
// en memoire : elle est portee par la base (uq_editeur_raison_sociale) et
// rendue en 409 par l'API. Un controle local serait contournable par appel
// direct, et faux des qu'un autre onglet cree le meme editeur.
//
// A la place, le champ propose au fil de la frappe les editeurs deja
// references (useSuggestionsEditeurs). Le referentiel pouvant compter des
// milliers de lignes, personne ne peut verifier de visu qu'un editeur en est
// absent : le doublon nait de cette impossibilite, pas d'une inattention. Les
// suggestions se montrent donc la ou l'erreur se commet, pendant la saisie, et
// non a l'enregistrement.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import LogoEditeur from './LogoEditeur';
import { validateRequired } from '../../utils/validation';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';
import useSuggestionsEditeurs from '../../hooks/useSuggestionsEditeurs';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = { raison_sociale: '', pays: '' };

function formDepuis(editeur) {
  return editeur
    ? { raison_sociale: editeur.raison_sociale, pays: editeur.pays ?? '' }
    : EMPTY_FORM;
}

export default function EditeurFormModal({ isOpen, onClose, onSave, editeur }) {
  const isEdit = !!editeur;
  const navigate = useNavigate();
  const draftKey = `editeur:${editeur?.id ?? 'new'}`;
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [draftRestaure, setDraftRestaure] = useState(false);

  // L'editeur en cours de modification est ecarte : il ne se signale pas a
  // lui-meme comme un doublon de lui-meme.
  const { suggestions, total, chargement, exact } = useSuggestionsEditeurs(
    form.raison_sociale, { exclureId: editeur?.id, actif: isOpen });

  useEffect(() => {
    if (!isOpen) return;
    const draft = loadDraft(draftKey);
    if (draft) {
      setForm(draft);
      setDraftRestaure(true);
      setErrors({});
      return;
    }
    setForm(formDepuis(editeur));
    setDraftRestaure(false);
    setErrors({});
  }, [editeur, isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  function validate() {
    const e = {};
    const reqErr = validateRequired(form.raison_sociale, 'La raison sociale');
    if (reqErr) e.raison_sociale = reqErr;
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      await onSave({ raison_sociale: form.raison_sociale.trim(), pays: form.pays.trim() }, editeur);
      clearDraft(draftKey);
      onClose();
    } catch (err) {
      // 409 : raison sociale deja prise. Les autres erreurs partent deja en
      // toast cote appelant, les porter aussi sur le champ serait redondant.
      if (err?.status === 409) setErrors({ raison_sociale: err.message });
    } finally {
      setLoading(false);
    }
  }

  // Aller voir l'editeur existant plutot que d'en creer un second. La saisie en
  // cours n'est pas perdue : le brouillon reste en localStorage et sera restaure
  // a la prochaine ouverture du formulaire.
  function ouvrirFiche(id) {
    onClose();
    navigate(`/referentiels/editeurs/${id}`);
  }

  // Vider le brouillon revient aux valeurs d'origine : celles de l'editeur en
  // edition, un formulaire vide en creation.
  function viderBrouillon() {
    clearDraft(draftKey);
    setForm(formDepuis(editeur));
    setErrors({});
    setDraftRestaure(false);
  }

  // Un doublon franc est bloque avant l'envoi : l'API le refuserait de toute
  // facon, autant l'annoncer pendant la saisie.
  const isValid = !Object.values(validate()).some(Boolean) && !exact;
  const restants = total - suggestions.length;

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier l\'éditeur' : 'Nouvel éditeur'}
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
        <FormField label="Raison sociale" required error={errors.raison_sociale}>
          <input
            className={INPUT_CLS}
            value={form.raison_sociale}
            autoComplete="off"
            onChange={e => { setForm(v => ({ ...v, raison_sociale: e.target.value })); setErrors(v => ({ ...v, raison_sociale: null })); }}
          />
        </FormField>

        {exact && (
          <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 px-3 py-2.5">
            <p className="text-xs text-orange-800 dark:text-orange-300">
              <span className="font-medium">{exact.raison_sociale}</span> est déjà référencé.
              Ouvrez sa fiche plutôt que d&apos;en créer un second.
            </p>
            <button
              type="button"
              onClick={() => ouvrirFiche(exact.id)}
              className="mt-1.5 text-xs text-orange-900 dark:text-orange-200 underline hover:no-underline inline-flex items-center gap-1"
            >
              Ouvrir la fiche <ArrowRight size={12} />
            </button>
          </div>
        )}

        {/* Suggestions : ce qui existe deja et ressemble a la saisie. La
            correspondance exacte est traitee au-dessus, elle n'est pas repetee
            dans la liste. */}
        {!exact && suggestions.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <p className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-1.5">
              <Search size={11} />
              Déjà référencé{suggestions.length > 1 ? 's' : ''}, vérifiez avant de créer
            </p>
            <ul className="max-h-52 overflow-y-auto">
              {suggestions.map(s => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => ouvrirFiche(s.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
                  >
                    <LogoEditeur editeur={s} size={20} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-gray-800 dark:text-gray-200 truncate">{s.raison_sociale}</span>
                      {s.pays && <span className="block text-xs text-gray-400">{s.pays}</span>}
                    </span>
                    <ArrowRight size={13} className="text-gray-300 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
            {restants > 0 && (
              <p className="px-3 py-1.5 text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
                et {restants} autre{restants > 1 ? 's' : ''} correspondance{restants > 1 ? 's' : ''}, affinez votre saisie
              </p>
            )}
          </div>
        )}

        {chargement && !suggestions.length && !exact && (
          <p className="text-xs text-gray-400">Recherche des éditeurs déjà référencés...</p>
        )}

        <FormField label="Pays" hint="Optionnel">
          <input className={INPUT_CLS} value={form.pays} onChange={e => setForm(v => ({ ...v, pays: e.target.value }))} />
        </FormField>
      </div>
    </SlideOver>
  );
}
