// ContactFormModal - creation / edition d'un contact, avec selecteur d'entite de rattachement dependant du type
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import PhotoUploadField from '../ui/PhotoUploadField';
import { validateRequired, validateEmail, validatePhoneFr } from '../../utils/validation';
import { mockFonctions, mockEditeurs, mockRevendeurs, mockSocietes } from '../../data/mockReferentiels';
import { getContactPhoto } from '../../utils/contactPhotos';
import { colorForName, initialsFromParts } from '../../utils/avatar';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const TYPES_RATTACHEMENT = [
  { value: 'client', label: 'Client (societe du groupe)' },
  { value: 'editeur', label: 'Editeur' },
  { value: 'revendeur', label: 'Revendeur' },
];

function entitesForType(type) {
  if (type === 'client') return mockSocietes.map(s => ({ value: s.id, label: s.raison_sociale }));
  if (type === 'editeur') return mockEditeurs.map(e => ({ value: e.id, label: e.raison_sociale }));
  if (type === 'revendeur') return mockRevendeurs.map(r => ({ value: r.id, label: r.raison_sociale }));
  return [];
}

const EMPTY_FORM = { nom: '', prenom: '', email: '', telephone: '', id_fonction: '', type_rattachement: '', id_rattachement: '', date_debut: '', date_fin: '' };

export default function ContactFormModal({ isOpen, onClose, onSave, contact }) {
  const isEdit = !!contact;
  const draftKey = `contact:${contact?.id ?? 'new'}`;
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [draftRestaure, setDraftRestaure] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const draft = loadDraft(draftKey);
    if (draft) {
      setForm(draft);
      setPhoto(contact ? getContactPhoto(contact.id) : null);
      setDraftRestaure(true);
      setErrors({});
      return;
    }
    if (contact) {
      setForm({
        nom: contact.nom, prenom: contact.prenom, email: contact.email ?? '', telephone: contact.telephone ?? '',
        id_fonction: contact.id_fonction ?? '', type_rattachement: contact.type_rattachement ?? '',
        id_rattachement: contact.id_rattachement ?? '', date_debut: contact.date_debut ?? '', date_fin: contact.date_fin ?? '',
      });
      setPhoto(getContactPhoto(contact.id));
    } else {
      setForm(EMPTY_FORM);
      setPhoto(null);
    }
    setDraftRestaure(false);
    setErrors({});
  }, [contact, isOpen, draftKey]);

  // Le brouillon ne couvre que les champs texte (form) : la photo (data URL) n'est pas persistee pour eviter de saturer le localStorage
  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  function validate() {
    const e = {};
    const nomErr = validateRequired(form.nom, 'Le nom');
    if (nomErr) e.nom = nomErr;
    const prenomErr = validateRequired(form.prenom, 'Le prenom');
    if (prenomErr) e.prenom = prenomErr;
    if (form.email) { const m = validateEmail(form.email); if (m) e.email = m; }
    if (form.telephone) { const p = validatePhoneFr(form.telephone); if (p) e.telephone = p; }
    if (!form.type_rattachement) e.type_rattachement = 'Le type de rattachement est requis';
    if (!form.id_rattachement) e.id_rattachement = 'L\'entite de rattachement est requise';
    if (form.date_fin && form.date_debut && form.date_fin < form.date_debut) {
      e.date_fin = 'La date de fin doit etre posterieure ou egale a la date de debut';
    }
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    setLoading(false);
    onSave({ ...form, date_fin: form.date_fin || null }, contact, photo);
    clearDraft(draftKey);
    onClose();
  }

  const isValid = !Object.values(validate()).some(Boolean);
  const entites = entitesForType(form.type_rattachement);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier le contact' : 'Nouveau contact'}
      size="md"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restaure depuis votre derniere saisie.
          <button onClick={() => { clearDraft(draftKey); setForm(contact ? form : EMPTY_FORM); setDraftRestaure(false); }} className="underline hover:no-underline flex-shrink-0">Vider le brouillon</button>
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
            <input className={INPUT_CLS} value={form.nom} onChange={e => { setForm(v => ({ ...v, nom: e.target.value })); setErrors(v => ({ ...v, nom: null })); }} />
          </FormField>
          <FormField label="Prenom" required error={errors.prenom}>
            <input className={INPUT_CLS} value={form.prenom} onChange={e => { setForm(v => ({ ...v, prenom: e.target.value })); setErrors(v => ({ ...v, prenom: null })); }} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Email" error={errors.email}>
            <input type="email" className={INPUT_CLS} value={form.email} onChange={e => { setForm(v => ({ ...v, email: e.target.value })); setErrors(v => ({ ...v, email: null })); }} />
          </FormField>
          <FormField label="Telephone" error={errors.telephone}>
            <input className={INPUT_CLS} value={form.telephone} onChange={e => { setForm(v => ({ ...v, telephone: e.target.value })); setErrors(v => ({ ...v, telephone: null })); }} />
          </FormField>
        </div>
        <FormField label="Fonction">
          <select className={INPUT_CLS} value={form.id_fonction} onChange={e => setForm(v => ({ ...v, id_fonction: e.target.value }))}>
            <option value="">Choisir...</option>
            {mockFonctions.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Type de rattachement" required error={errors.type_rattachement}>
            <select
              className={INPUT_CLS}
              value={form.type_rattachement}
              onChange={e => { setForm(v => ({ ...v, type_rattachement: e.target.value, id_rattachement: '' })); setErrors(v => ({ ...v, type_rattachement: null, id_rattachement: null })); }}
            >
              <option value="">Choisir...</option>
              {TYPES_RATTACHEMENT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>
          <FormField label="Entite de rattachement" required error={errors.id_rattachement}>
            <select
              className={INPUT_CLS}
              value={form.id_rattachement}
              disabled={!form.type_rattachement}
              onChange={e => { setForm(v => ({ ...v, id_rattachement: e.target.value })); setErrors(v => ({ ...v, id_rattachement: null })); }}
            >
              <option value="">{form.type_rattachement ? 'Choisir...' : 'Choisir un type d\'abord'}</option>
              {entites.map(en => <option key={en.value} value={en.value}>{en.label}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date de debut">
            <input type="date" className={INPUT_CLS} value={form.date_debut} onChange={e => setForm(v => ({ ...v, date_debut: e.target.value }))} />
          </FormField>
          <FormField label="Date de fin" error={errors.date_fin} hint="Optionnelle">
            <input type="date" className={INPUT_CLS} value={form.date_fin} onChange={e => { setForm(v => ({ ...v, date_fin: e.target.value })); setErrors(v => ({ ...v, date_fin: null })); }} />
          </FormField>
        </div>
      </div>
    </SlideOver>
  );
}
