// RevendeurFormModal - creation et edition d'un revendeur.
//
// L'unicite n'est pas verifiee sur une liste chargee en memoire : elle est
// portee par la base et par la detection de doublon de l'API, qui rapproche les
// SIRET identiques et les raisons sociales tres proches. Un controle local
// serait contournable par appel direct, et faux des qu'un autre onglet cree le
// meme revendeur.
//
// Le champ raison sociale propose au fil de la frappe les revendeurs deja
// references. Un clic ouvre l'existant ; si aucune proposition ne correspond,
// une ligne explicite permet de poursuivre la creation. Les formats (SIRET,
// IBAN, email) restent verifies localement, pour ne pas faire un aller-retour
// serveur sur une faute de frappe : l'API les revalide de toute facon.
import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Search, Plus } from 'lucide-react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import FormField from '../ui/FormField';
import { validateRequired, validateSiret, validateIban, validateEmail } from '../../utils/validation';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';
import { revendeursService } from '../../services/referentielsService';
import useSuggestions from '../../hooks/useSuggestions';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = { raison_sociale: '', siret: '', iban: '', email: '' };

function formDepuis(revendeur) {
  return revendeur
    ? {
      raison_sociale: revendeur.raison_sociale,
      siret: revendeur.siret ?? '',
      iban: revendeur.iban ?? '',
      email: revendeur.email ?? '',
    }
    : EMPTY_FORM;
}

export default function RevendeurFormModal({ isOpen, onClose, onSave, revendeur, onOuvrirExistant }) {
  const isEdit = !!revendeur;
  const draftKey = `revendeur:${revendeur?.id ?? 'new'}`;
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [draftRestaure, setDraftRestaure] = useState(false);
  // Passe a true quand l'utilisateur declare qu'aucune proposition ne
  // correspond. Les suggestions se taisent alors jusqu'a la prochaine
  // modification du nom : sans cela, la liste resterait affichee sous le champ
  // pendant toute la saisie du SIRET et de l'IBAN.
  const [ignorerSuggestions, setIgnorerSuggestions] = useState(false);

  const rechercher = useCallback(
    (texte, opts) => revendeursService.rechercher(texte, opts), []);
  const { suggestions, total, chargement, exact } = useSuggestions(
    rechercher, form.raison_sociale, { exclureId: revendeur?.id, actif: isOpen });

  useEffect(() => {
    if (!isOpen) return;
    const draft = loadDraft(draftKey);
    if (draft) {
      setForm(draft);
      setDraftRestaure(true);
      setErrors({});
      setIgnorerSuggestions(false);
      return;
    }
    setForm(formDepuis(revendeur));
    setDraftRestaure(false);
    setErrors({});
    setIgnorerSuggestions(false);
  }, [revendeur, isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  // Formats seulement. L'unicite et le rapprochement des noms appartiennent au
  // serveur, qui seul voit tout le referentiel.
  function validate() {
    const e = {};
    const reqErr = validateRequired(form.raison_sociale, 'La raison sociale');
    if (reqErr) e.raison_sociale = reqErr;
    if (form.siret) { const s = validateSiret(form.siret); if (s) e.siret = s; }
    if (form.iban) { const i = validateIban(form.iban); if (i) e.iban = i; }
    if (form.email) { const m = validateEmail(form.email); if (m) e.email = m; }
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      await onSave({
        raison_sociale: form.raison_sociale.trim(),
        siret: form.siret.trim(),
        iban: form.iban.trim(),
        email: form.email.trim(),
      }, revendeur);
      clearDraft(draftKey);
      onClose();
    } catch (err) {
      // Le doublon est traite par le parent, qui ouvre la boite de
      // confirmation : la modale reste ouverte et la saisie n'est pas perdue.
      // Les autres erreurs partent en toast cote parent.
      if (err?.status === 400) setErrors({ raison_sociale: err.message });
    } finally {
      setLoading(false);
    }
  }

  function changerNom(valeur) {
    setForm(v => ({ ...v, raison_sociale: valeur }));
    setErrors(v => ({ ...v, raison_sociale: null }));
    // Toute modification du nom rouvre la proposition : le texte a change, les
    // suggestions ecartees ne valent plus.
    setIgnorerSuggestions(false);
  }

  function viderBrouillon() {
    clearDraft(draftKey);
    setForm(formDepuis(revendeur));
    setErrors({});
    setDraftRestaure(false);
    setIgnorerSuggestions(false);
  }

  // Un doublon franc est bloque avant l'envoi : l'API le refuserait de toute
  // facon, autant l'annoncer pendant la saisie.
  const bloque = !!exact;
  const restants = total - suggestions.length;
  const montrerSuggestions = !ignorerSuggestions && !exact && suggestions.length > 0;

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier le revendeur' : 'Nouveau revendeur'}
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
          <Button variant="primary" onClick={handleSave} isLoading={loading} disabled={bloque}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Raison sociale" required error={errors.raison_sociale}>
          <input
            className={INPUT_CLS}
            value={form.raison_sociale}
            autoComplete="off"
            onChange={e => changerNom(e.target.value)}
          />
        </FormField>

        {exact && (
          <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 px-3 py-2.5">
            <p className="text-xs text-orange-800 dark:text-orange-300">
              <span className="font-medium">{exact.raison_sociale}</span> est déjà référencé
              {exact.actif ? '.' : ', mais désactivé.'}
            </p>
            <button
              type="button"
              onClick={() => onOuvrirExistant?.(exact)}
              className="mt-1.5 text-xs text-orange-900 dark:text-orange-200 underline hover:no-underline inline-flex items-center gap-1"
            >
              Ouvrir sa fiche <ArrowRight size={12} />
            </button>
          </div>
        )}

        {montrerSuggestions && (
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
                    onClick={() => onOuvrirExistant?.(s)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-gray-800 dark:text-gray-200 truncate">{s.raison_sociale}</span>
                      {s.siret && <span className="block text-xs text-gray-400">SIRET {s.siret}</span>}
                    </span>
                    {!s.actif && <Badge variant="neutral" label="Désactivé" />}
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
            {/* Sortie explicite : sans elle, l'utilisateur qui cree reellement un
                nouveau revendeur resterait devant une liste qui semble lui
                interdire de continuer. */}
            <button
              type="button"
              onClick={() => setIgnorerSuggestions(true)}
              className="w-full px-3 py-2 text-xs text-blue-800 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-gray-200 dark:border-gray-700 flex items-center gap-1.5"
            >
              <Plus size={12} />
              Aucune ne correspond, créer « {form.raison_sociale.trim()} »
            </button>
          </div>
        )}

        {chargement && !suggestions.length && !exact && (
          <p className="text-xs text-gray-400">Recherche des revendeurs déjà référencés...</p>
        )}

        <FormField label="SIRET" error={errors.siret} hint="14 chiffres, optionnel">
          <input className={INPUT_CLS} value={form.siret} onChange={e => { setForm(v => ({ ...v, siret: e.target.value })); setErrors(v => ({ ...v, siret: null })); }} />
        </FormField>
        <FormField label="IBAN" error={errors.iban} hint="Optionnel">
          <input className={INPUT_CLS} value={form.iban} onChange={e => { setForm(v => ({ ...v, iban: e.target.value })); setErrors(v => ({ ...v, iban: null })); }} />
        </FormField>
        <FormField label="Email" error={errors.email} hint="Optionnel">
          <input type="email" className={INPUT_CLS} value={form.email} onChange={e => { setForm(v => ({ ...v, email: e.target.value })); setErrors(v => ({ ...v, email: null })); }} />
        </FormField>
      </div>
    </SlideOver>
  );
}