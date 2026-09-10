// ContactFormModal - creation et edition d'un contact.
//
// Les selecteurs (fonction, entite de rattachement) sont charges depuis l'API
// a l'ouverture : fonctions, societes, editeurs et revendeurs sont les
// referentiels reels, plus aucune donnee de demonstration. Chaque chargement
// passe par optionnel() : un droit manquant prive du selecteur, pas du
// formulaire entier. Le type de rattachement est une commodite d'ecran :
// l'API ne connait que les trois FK id_societe, id_editeur et id_revendeur,
// le formulaire envoie la FK choisie et les deux autres a null.
//
// L'unicite n'est pas verifiee sur une liste chargee en memoire : elle est
// portee par la detection de doublon de l'API, qui rapproche les adresses
// email identiques et les noms tres proches. Le champ nom (ou l'email, s'il
// est saisi) propose au fil de la frappe les contacts deja references
// (useSuggestions, comme les revendeurs). Un clic ouvre l'existant ; si
// aucune proposition ne correspond, une ligne explicite permet de poursuivre.
// Le 409 de doublon est traite par la page, qui ouvre ModalDoublonContact :
// la modale reste ouverte et la saisie n'est pas perdue.
import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Search, Plus } from 'lucide-react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import FormField from '../ui/FormField';
import PhotoUploadField from '../ui/PhotoUploadField';
import { validateRequired, validateEmail, validatePhoneFr } from '../../utils/validation';
import { contactsService } from '../../services/contactsService';
import { editeursService, revendeursService } from '../../services/referentielsService';
import { societesService } from '../../services/adminService';
import { optionnel } from '../../services/http';
import { getContactPhoto } from '../../utils/contactPhotos';
import { colorForName, initialsFromParts } from '../../utils/avatar';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';
import useSuggestions from '../../hooks/useSuggestions';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const TYPES_RATTACHEMENT = [
  { value: 'client', label: 'Client (société du groupe)' },
  { value: 'editeur', label: 'Éditeur' },
  { value: 'revendeur', label: 'Revendeur' },
];

// FK a renseigner pour chaque type. Les trois champs partent toujours dans le
// corps : le changement de type remet les deux autres a null cote serveur.
const FK_PAR_TYPE = { client: 'id_societe', editeur: 'id_editeur', revendeur: 'id_revendeur' };

const EMPTY_FORM = { nom: '', prenom: '', email: '', telephone: '', id_fonction: '', type_rattachement: '', id_rattachement: '', date_debut: '', date_fin: '' };
const REFS_VIDES = { fonctions: [], societes: [], editeurs: [], revendeurs: [] };

function formDepuis(contact) {
  if (!contact) return EMPTY_FORM;
  return {
    nom: contact.nom ?? '',
    prenom: contact.prenom ?? '',
    email: contact.email ?? '',
    telephone: contact.telephone ?? '',
    id_fonction: contact.id_fonction ?? '',
    type_rattachement: contact.type_rattachement ?? '',
    id_rattachement: contact.id_societe ?? contact.id_editeur ?? contact.id_revendeur ?? '',
    date_debut: contact.date_debut ?? '',
    date_fin: contact.date_fin ?? '',
  };
}

export default function ContactFormModal({ isOpen, onClose, onSave, contact, onOuvrirExistant }) {
  const isEdit = !!contact;
  const draftKey = `contact:${contact?.id ?? 'new'}`;
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [draftRestaure, setDraftRestaure] = useState(false);
  const [referentiels, setReferentiels] = useState(REFS_VIDES);
  // Passe a true quand l'utilisateur declare qu'aucune proposition ne
  // correspond. Les suggestions se taisent alors jusqu'a la prochaine
  // modification du nom ou de l'email.
  const [ignorerSuggestions, setIgnorerSuggestions] = useState(false);

  // La recherche porte sur l'email des qu'il est saisi, sinon sur le nom
  // complet : l'adresse est la cle du doublon, le nom sa forme courante.
  const saisieRecherche = form.email.trim() || [form.prenom, form.nom].map(s => s.trim()).filter(Boolean).join(' ');
  const rechercher = useCallback(
    (texte, opts) => contactsService.rechercher(texte, opts), []);
  // Le contact en cours de modification est ecarte : il ne se signale pas a
  // lui-meme comme un doublon de lui-meme.
  const { suggestions, total, chargement, exact } = useSuggestions(
    rechercher, saisieRecherche, { exclureId: contact?.id, actif: isOpen });

  useEffect(() => {
    if (!isOpen) return;
    const draft = loadDraft(draftKey);
    if (draft) {
      setForm(draft);
      setPhoto(contact ? getContactPhoto(contact.id) : null);
      setDraftRestaure(true);
      setErrors({});
      setIgnorerSuggestions(false);
      return;
    }
    setForm(formDepuis(contact));
    setPhoto(contact ? getContactPhoto(contact.id) : null);
    setDraftRestaure(false);
    setErrors({});
    setIgnorerSuggestions(false);
  }, [contact, isOpen, draftKey]);

  // Referentiels des selecteurs, en un chargement par ouverture, chacun par
  // optionnel() : un droit manquant vide le selecteur concerne sans casser le
  // formulaire. Les revendeurs desactives ne se proposent pas aux nouveaux
  // rattachements ; celui du contact en edition reste selectionnable.
  useEffect(() => {
    if (!isOpen) return;
    let annule = false;
    Promise.all([
      optionnel(contactsService.fonctions()),
      optionnel(societesService.list()),
      optionnel(editeursService.list()),
      optionnel(revendeursService.list({ inclureInactifs: true })),
    ])
      .then(([fonctions, societes, editeurs, revendeurs]) => {
        if (annule) return;
        setReferentiels({
          fonctions,
          societes,
          editeurs,
          revendeurs: revendeurs.filter(r => r.actif || r.id === contact?.id_revendeur),
        });
      })
      .catch(() => { if (!annule) setReferentiels(REFS_VIDES); });
    return () => { annule = true; };
  }, [isOpen, contact]);

  // Le brouillon ne couvre que les champs texte (form) : la photo (data URL)
  // n'est pas persistee pour eviter de saturer le localStorage.
  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  function entitesForType(type) {
    if (type === 'client') return referentiels.societes;
    if (type === 'editeur') return referentiels.editeurs;
    if (type === 'revendeur') return referentiels.revendeurs;
    return [];
  }

  // Formats seulement. L'unicite et le rapprochement des noms appartiennent au
  // serveur, qui seul voit tout le referentiel.
  function validate() {
    const e = {};
    const nomErr = validateRequired(form.nom, 'Le nom');
    if (nomErr) e.nom = nomErr;
    if (form.email) { const m = validateEmail(form.email); if (m) e.email = m; }
    if (form.telephone) { const p = validatePhoneFr(form.telephone); if (p) e.telephone = p; }
    if (form.type_rattachement && !form.id_rattachement) {
      e.id_rattachement = 'Choisissez l\'entité de rattachement, ou retirez le type';
    }
    if (form.date_fin && form.date_debut && form.date_fin < form.date_debut) {
      e.date_fin = 'La date de fin doit être postérieure ou égale à la date de début';
    }
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const fk = FK_PAR_TYPE[form.type_rattachement] ?? null;
      await onSave({
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        email: form.email.trim(),
        telephone: form.telephone.trim(),
        id_fonction: form.id_fonction || null,
        id_societe: fk === 'id_societe' ? form.id_rattachement : null,
        id_editeur: fk === 'id_editeur' ? form.id_rattachement : null,
        id_revendeur: fk === 'id_revendeur' ? form.id_rattachement : null,
        date_debut: form.date_debut || null,
        date_fin: form.date_fin || null,
      }, contact, photo);
      clearDraft(draftKey);
      onClose();
    } catch (err) {
      // Le doublon est traite par la page, qui ouvre ModalDoublonContact : la
      // modale reste ouverte et la saisie n'est pas perdue. Les autres erreurs
      // partent en toast cote page.
      if (err?.status === 400) setErrors({ nom: err.message });
    } finally {
      setLoading(false);
    }
  }

  function changerChampRecherche(champ, valeur) {
    setForm(v => ({ ...v, [champ]: valeur }));
    setErrors(v => ({ ...v, [champ]: null }));
    // Toute modification du nom ou de l'email rouvre la proposition : le texte
    // a change, les suggestions ecartees ne valent plus.
    setIgnorerSuggestions(false);
  }

  function viderBrouillon() {
    clearDraft(draftKey);
    setForm(formDepuis(contact));
    setErrors({});
    setDraftRestaure(false);
    setIgnorerSuggestions(false);
  }

  // Un doublon franc est bloque avant l'envoi : l'API le refuserait de toute
  // facon, autant l'annoncer pendant la saisie.
  const bloque = !!exact;
  const restants = total - suggestions.length;
  const montrerSuggestions = !ignorerSuggestions && !exact && suggestions.length > 0;
  const entites = entitesForType(form.type_rattachement);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier le contact' : 'Nouveau contact'}
      size="md"
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
        <FormField label="Photo">
          <PhotoUploadField
            value={photo}
            onChange={setPhoto}
            size={64}
            fallback={
              <span
                className="w-full h-full rounded-full inline-flex items-center justify-center font-semibold text-white"
                style={{ backgroundColor: colorForName(`${form.prenom} ${form.nom}`), fontSize: 22 }}
              >
                {initialsFromParts(form.prenom, form.nom)}
              </span>
            }
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Nom" required error={errors.nom}>
            <input className={INPUT_CLS} value={form.nom} autoComplete="off" onChange={e => changerChampRecherche('nom', e.target.value)} />
          </FormField>
          <FormField label="Prénom" error={errors.prenom}>
            <input className={INPUT_CLS} value={form.prenom} autoComplete="off" onChange={e => changerChampRecherche('prenom', e.target.value)} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Email" error={errors.email}>
            <input type="email" className={INPUT_CLS} value={form.email} autoComplete="off" onChange={e => changerChampRecherche('email', e.target.value)} />
          </FormField>
          <FormField label="Téléphone" error={errors.telephone}>
            <input className={INPUT_CLS} value={form.telephone} onChange={e => { setForm(v => ({ ...v, telephone: e.target.value })); setErrors(v => ({ ...v, telephone: null })); }} />
          </FormField>
        </div>

        {exact && (
          <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 px-3 py-2.5">
            <p className="text-xs text-orange-800 dark:text-orange-300">
              <span className="font-medium">{`${exact.prenom ?? ''} ${exact.nom}`.trim()}</span> est déjà référencé
              {exact.actif ? '.' : ', mais inactif.'}
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
                      <span className="block text-sm text-gray-800 dark:text-gray-200 truncate">{`${s.prenom ?? ''} ${s.nom}`.trim()}</span>
                      {s.email && <span className="block text-xs text-gray-400 truncate">{s.email}</span>}
                    </span>
                    {!s.actif && <Badge variant="neutral" label="Inactif" />}
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
            {/* Sortie explicite : sans elle, l'utilisateur qui cree reellement
                un nouveau contact resterait devant une liste qui semble lui
                interdire de continuer. */}
            <button
              type="button"
              onClick={() => setIgnorerSuggestions(true)}
              className="w-full px-3 py-2 text-xs text-blue-800 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-gray-200 dark:border-gray-700 flex items-center gap-1.5"
            >
              <Plus size={12} />
              Aucune ne correspond, poursuivre la saisie
            </button>
          </div>
        )}

        {chargement && !suggestions.length && !exact && (
          <p className="text-xs text-gray-400">Recherche des contacts déjà référencés...</p>
        )}

        <FormField label="Fonction">
          <select className={INPUT_CLS} value={form.id_fonction} onChange={e => setForm(v => ({ ...v, id_fonction: e.target.value }))}>
            <option value="">Choisir...</option>
            {referentiels.fonctions.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Type de rattachement">
            <select
              className={INPUT_CLS}
              value={form.type_rattachement}
              onChange={e => { setForm(v => ({ ...v, type_rattachement: e.target.value, id_rattachement: '' })); setErrors(v => ({ ...v, id_rattachement: null })); }}
            >
              <option value="">Aucun</option>
              {TYPES_RATTACHEMENT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>
          <FormField label="Entité de rattachement" error={errors.id_rattachement}>
            <select
              className={INPUT_CLS}
              value={form.id_rattachement}
              disabled={!form.type_rattachement}
              onChange={e => { setForm(v => ({ ...v, id_rattachement: e.target.value })); setErrors(v => ({ ...v, id_rattachement: null })); }}
            >
              <option value="">{form.type_rattachement ? 'Choisir...' : 'Choisir un type d\'abord'}</option>
              {entites.map(en => <option key={en.id} value={en.id}>{en.raison_sociale}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date de début">
            <input type="date" className={INPUT_CLS} value={form.date_debut} onChange={e => setForm(v => ({ ...v, date_debut: e.target.value }))} />
          </FormField>
          <FormField label="Date de fin" error={errors.date_fin} hint="Une date échue rend le contact inactif">
            <input type="date" className={INPUT_CLS} value={form.date_fin} onChange={e => { setForm(v => ({ ...v, date_fin: e.target.value })); setErrors(v => ({ ...v, date_fin: null })); }} />
          </FormField>
        </div>
      </div>
    </SlideOver>
  );
}
