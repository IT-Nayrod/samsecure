// LicenceFormModal - création / édition d'une licence (droit acquis), par l'API.
// Référentiels : catalogue des produits (versions et éditions imbriquées),
// commandes (le contrat se déduit de la commande, jamais saisi ici),
// revendeurs, unités de mesure, mainteneurs. Les règles de validation serveur
// (4011 à 4024, 4031, 4032) sont rendues telles quelles en toast.
//
// Stories #209 et #210 : le type choisi (sept valeurs, TYPES_LICENCE) pilote
// les dates : une date obligatoire est exigée, une date facultative est
// affichée, une date masquée n'est ni affichée ni envoyée. La version n'est
// pas saisissable sur un type sans version (D58, souscription). L'unité de
// mesure est une liste fermée de huit valeurs. La licence renouvelée
// (id_licence_predecesseur, D35) se choisit parmi les autres licences.
import { useState, useEffect, useMemo } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { licencesService, TYPES_LICENCE, regleType, unitesProposees } from '../../services/licencesService';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';
import { useToast } from '../../hooks/useToast';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = {
  label: '', id_produit: '', id_edition: '', id_version: '', id_commande: '', id_revendeur: '',
  id_unite_mesure: '', type: 'souscription', quantite: 1, cout_licence: '', date_debut: '', date_fin_souscription: '',
  a_maintenance: false, id_mainteneur: '', date_fin_maintenance: '', id_licence_predecesseur: '',
};

export default function LicenceFormModal({
  isOpen, onClose, onSaved, licence,
  produits = [], commandes = [], revendeurs = [], unites = [], mainteneurs = [], licences = [],
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
        date_debut: licence.date_debut ?? '',
        date_fin_souscription: licence.date_fin_souscription ?? '',
        a_maintenance: !!licence.a_maintenance, id_mainteneur: licence.id_mainteneur ?? '',
        date_fin_maintenance: licence.date_fin_maintenance ?? '',
        id_licence_predecesseur: licence.id_licence_predecesseur ?? '',
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

  // Règle du type courant : celle servie par l'API quand la licence éditée
  // garde son type, sinon le miroir local.
  const regle = useMemo(() => regleType(form.type, licence), [form.type, licence]);
  const debutVisible = regle.regle_date_debut !== 'masquee';
  const finVisible = regle.regle_date_fin !== 'masquee';
  const versionVisible = regle.version_geree;

  // Types proposés : les sept du référentiel, plus le type déjà porté par la
  // licence s'il n'en fait pas partie (valeur conservée, plus proposée).
  const typesProposes = useMemo(() => {
    const codes = new Set(TYPES_LICENCE.map(t => t.code));
    return licence?.type && !codes.has(licence.type)
      ? [...TYPES_LICENCE, { code: licence.type, label: licence.type_label ?? licence.type }]
      : TYPES_LICENCE;
  }, [licence]);

  // Liste fermée des unités (#210), plus l'unité déjà portée par la licence.
  const unitesListe = useMemo(() => unitesProposees(unites, licence?.id_unite_mesure ?? null), [unites, licence]);

  // Licence renouvelée : n'importe quelle autre licence, celles du même produit
  // en premier ; jamais la licence elle-même.
  const predecesseurs = useMemo(() => {
    const autres = licences.filter(l => l.id !== licence?.id);
    const memeProduit = form.id_produit ? autres.filter(l => l.id_produit === form.id_produit) : [];
    const reste = autres.filter(l => !memeProduit.includes(l));
    return [...memeProduit, ...reste];
  }, [licences, licence, form.id_produit]);
  const libellePredecesseur = (l) => `${l.label ?? l.produit_label ?? l.id}${l.produit_label && l.label ? ` (${l.produit_label})` : ''}${l.date_fin_souscription ? ` - fin ${l.date_fin_souscription}` : ''}`;

  function validate() {
    const e = {};
    if (!form.id_produit) e.id_produit = 'Le produit est requis';
    const qte = Number(form.quantite);
    if (!Number.isInteger(qte) || qte < 1) e.quantite = 'La quantité doit être un entier supérieur à 0';
    if (form.cout_licence !== '' && Number(form.cout_licence) < 0) e.cout_licence = 'Le coût ne peut pas être négatif';
    if (regle.regle_date_debut === 'obligatoire' && !form.date_debut) e.date_debut = `La date de début est requise pour une licence de type ${regle.label}`;
    if (regle.regle_date_fin === 'obligatoire' && !form.date_fin_souscription) e.date_fin_souscription = `La date de fin est requise pour une licence de type ${regle.label}`;
    if (debutVisible && finVisible && form.date_debut && form.date_fin_souscription && form.date_fin_souscription < form.date_debut) {
      e.date_fin_souscription = 'La date de fin doit être postérieure à la date de début';
    }
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      // Les champs masqués par la règle du type partent vides : l'API les
      // efface elle aussi (coherer), le brouillon ne réveille rien.
      const payload = {
        ...form,
        quantite: Number(form.quantite),
        date_debut: debutVisible ? form.date_debut : '',
        date_fin_souscription: finVisible ? form.date_fin_souscription : '',
        id_version: versionVisible ? form.id_version : '',
      };
      // Sans le droit de voir les montants, le coût n'est jamais envoyé : un
      // PATCH sans la clé conserve la valeur en base.
      if (!montantsVisibles) delete payload.cout_licence;
      const saved = isEdit
        ? await licencesService.update(licence.id, payload)
        : await licencesService.create(payload);
      addToast({ type: 'success', message: isEdit ? 'Licence mise à jour.' : 'Licence créée.' });
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

  const hintDate = (r) => (r === 'obligatoire' ? undefined : 'Optionnel');

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier la licence' : 'Nouvelle licence'}
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
          <Button variant="primary" onClick={handleSave} isLoading={loading} disabled={!isValid}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Libellé du lot" hint="Optionnel, le produit sert de libellé par défaut">
          <input type="text" className={INPUT_CLS} value={form.label} onChange={champ('label')} placeholder="Ex. M365, siège" />
        </FormField>
        <FormField label="Produit" required error={errors.id_produit}>
          <select className={INPUT_CLS} value={form.id_produit} onChange={e => { setForm(v => ({ ...v, id_produit: e.target.value, id_edition: '', id_version: '' })); setErrors(v => ({ ...v, id_produit: null })); }}>
            <option value="">Choisir...</option>
            {produits.map(p => <option key={p.id} value={p.id}>{p.label}{p.editeur_label ? ` (${p.editeur_label})` : ''}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Type" required>
            <select className={INPUT_CLS} value={form.type} onChange={champ('type')}>
              {typesProposes.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
          </FormField>
          <FormField label="Unité de mesure">
            <select className={INPUT_CLS} value={form.id_unite_mesure} onChange={champ('id_unite_mesure')}>
              <option value="">Non renseignée</option>
              {unitesListe.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Édition" hint="Optionnel">
            <select className={INPUT_CLS} value={form.id_edition} onChange={champ('id_edition')} disabled={!editions.length}>
              <option value="">Aucune</option>
              {editions.map(ed => <option key={ed.id} value={ed.id}>{ed.label}</option>)}
            </select>
          </FormField>
          {versionVisible ? (
            <FormField label="Version" hint="Optionnel, suivie par la maintenance">
              <select className={INPUT_CLS} value={form.id_version} onChange={champ('id_version')} disabled={!versions.length}>
                <option value="">Aucune</option>
                {versions.map(ve => <option key={ve.id} value={ve.id}>{ve.label}</option>)}
              </select>
            </FormField>
          ) : (
            <FormField label="Version" hint="Sans objet pour ce type de licence">
              <input type="text" className={`${INPUT_CLS} bg-gray-50 dark:bg-gray-800`} value="" readOnly placeholder="Version courante de l'éditeur" />
            </FormField>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Commande" hint="Optionnel">
            <select className={INPUT_CLS} value={form.id_commande} onChange={champ('id_commande')}>
              <option value="">Aucune</option>
              {commandes.map(c => <option key={c.id} value={c.id}>{c.label}{c.contrat_label ? ` (${c.contrat_label})` : ''}</option>)}
            </select>
          </FormField>
          <FormField label="Contrat" hint="Déduit de la commande">
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
          <FormField label="Quantité" required error={errors.quantite}>
            <input type="number" min={1} step={1} className={INPUT_CLS} value={form.quantite} onChange={champ('quantite')} />
          </FormField>
          {montantsVisibles && (
            <FormField label="Coût (EUR)" error={errors.cout_licence}>
              <input type="number" min={0} step="0.01" className={INPUT_CLS} value={form.cout_licence} onChange={champ('cout_licence')} />
            </FormField>
          )}
        </div>
        {(debutVisible || finVisible) ? (
          <div className="grid grid-cols-2 gap-4">
            {debutVisible && (
              <FormField label="Date de début" required={regle.regle_date_debut === 'obligatoire'} error={errors.date_debut} hint={hintDate(regle.regle_date_debut)}>
                <input type="date" className={INPUT_CLS} value={form.date_debut} onChange={champ('date_debut')} />
              </FormField>
            )}
            {finVisible && (
              <FormField label="Date de fin" required={regle.regle_date_fin === 'obligatoire'} error={errors.date_fin_souscription} hint="Expirée le jour même, sans tolérance">
                <input type="date" className={INPUT_CLS} value={form.date_fin_souscription} onChange={champ('date_fin_souscription')} />
              </FormField>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Une licence de type {regle.label} ne porte ni date de début ni date de fin.</p>
        )}
        <FormField label="Renouvelle la licence" hint="Optionnel : la licence renouvelée ne déclenche plus d'alerte d'échéance">
          <select className={INPUT_CLS} value={form.id_licence_predecesseur} onChange={champ('id_licence_predecesseur')} disabled={!predecesseurs.length}>
            <option value="">Aucune</option>
            {predecesseurs.map(l => <option key={l.id} value={l.id}>{libellePredecesseur(l)}</option>)}
          </select>
        </FormField>
        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={form.a_maintenance} onChange={e => setForm(v => ({ ...v, a_maintenance: e.target.checked }))} />
            Sous maintenance (droit aux montées de version)
          </label>
          {form.a_maintenance && (
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Mainteneur">
                <select className={INPUT_CLS} value={form.id_mainteneur} onChange={champ('id_mainteneur')}>
                  <option value="">Non renseigné</option>
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
