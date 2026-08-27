// BudgetFormModal - Section Saisie Budget - SamSecure v0.5
// Creation et modification d'une ligne budgetaire par l'API (POST / PATCH
// /budget). La licence est choisie dans la liste reelle des licences ;
// l'organisation payeuse, le contrat et l'editeur qui en decoulent sont
// affiches en lecture seule, jamais saisis. En previsionnel, la selection de
// la licence appelle GET /budget/preremplissage : montant et quantite OPEX
// d'apres la maintenance en cours et l'inflation calculee par l'API, bornes de
// l'exercice cible, aucun CAPEX propose, le tout modifiable. Les regles de
// validation serveur (5111 a 5122) sont rendues telles quelles en toast.
import { useState, useEffect, useMemo, useRef } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { budgetService } from '../../services/budgetService';
import { loadDraft, saveDraft, clearDraft } from '../../utils/formDraft';
import { useToast } from '../../hooks/useToast';
import { libelleLicence, libelleType, formatEuros, formatDateIso, MOTIFS_BASE_VIDE } from './budgetCalculs';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';
const NUM_CLS = `${INPUT_CLS} text-right`;
const LECTURE_CLS = 'text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2';

const EMPTY_FORM = {
  id_licence: '',
  type: 'previsionnel',
  date_debut: '',
  date_fin: '',
  montant_capex: '',
  quantite_capex: '',
  date_capex: '',
  montant_opex: '',
  quantite_opex: '',
};

const valeurOuVide = (v) => (v === null || v === undefined ? '' : v);
const nombreOuNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

function formDepuisLigne(ligne) {
  return {
    id_licence: ligne.id_licence ?? '',
    type: ligne.type ?? 'previsionnel',
    date_debut: ligne.date_debut ?? '',
    date_fin: ligne.date_fin ?? '',
    montant_capex: valeurOuVide(ligne.montant_capex),
    quantite_capex: valeurOuVide(ligne.quantite_capex),
    date_capex: ligne.date_capex ?? '',
    montant_opex: valeurOuVide(ligne.montant_opex),
    quantite_opex: valeurOuVide(ligne.quantite_opex),
  };
}

function formInitial(ligne, defaultDateDebut, defaultDateFin, lockedLicenceId) {
  if (ligne) return formDepuisLigne(ligne);
  return {
    ...EMPTY_FORM,
    date_debut: defaultDateDebut ?? '',
    date_fin: defaultDateFin ?? '',
    id_licence: lockedLicenceId ?? '',
  };
}

export default function BudgetFormModal({
  isOpen, onClose, onSaved, ligne,
  licences = [], defaultDateDebut, defaultDateFin, exercice, lockedLicenceId,
}) {
  const isEdit = !!ligne;
  const { addToast } = useToast();
  const draftKey = `budget:${ligne?.id ?? (lockedLicenceId ? `new:${lockedLicenceId}` : 'new')}`;
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [draftRestaure, setDraftRestaure] = useState(false);
  // Derniere reponse de preremplissage et jeton de la derniere demande : une
  // reponse tardive d'une licence deselectionnee ne doit pas ecraser la saisie.
  const [prefill, setPrefill] = useState(null);
  const [prefillEnCours, setPrefillEnCours] = useState(false);
  const demande = useRef(0);

  const licence = useMemo(() => licences.find(l => l.id === form.id_licence) ?? null, [licences, form.id_licence]);

  // Organisation deduite, en lecture seule : la licence choisie (projection
  // /licences), a defaut la ligne editee (projection /budget) quand la liste
  // des licences n'est pas accessible.
  const organisation = useMemo(() => {
    if (licence) return licence;
    if (ligne && ligne.id_licence === form.id_licence) return ligne;
    return null;
  }, [licence, ligne, form.id_licence]);

  async function demanderPreremplissage(idLicence) {
    if (!idLicence) return;
    const jeton = ++demande.current;
    setPrefillEnCours(true);
    try {
      const p = await budgetService.preremplissage({ id_licence: idLicence, exercice });
      if (jeton !== demande.current) return;
      setPrefill(p);
      // La ligne proposee est celle que l'API a preparee : montant OPEX annuel
      // borne sur l'exercice cible, CAPEX absent (null). Quand la base n'est
      // pas vide, ses bornes remplacent celles de la periode affichee : un
      // montant annuel pose sur un trimestre serait faux. Tout reste modifiable.
      const proposee = !p.motif_base_vide && p.ligne;
      setForm(prev => ({
        ...prev,
        montant_opex: valeurOuVide(p.ligne?.montant_opex),
        quantite_opex: valeurOuVide(p.ligne?.quantite_opex),
        montant_capex: valeurOuVide(p.ligne?.montant_capex),
        quantite_capex: valeurOuVide(p.ligne?.quantite_capex),
        date_debut: (proposee && p.ligne.date_debut) || prev.date_debut || p.ligne?.date_debut || '',
        date_fin: (proposee && p.ligne.date_fin) || prev.date_fin || p.ligne?.date_fin || '',
      }));
    } catch (err) {
      if (jeton !== demande.current) return;
      setPrefill(null);
      addToast({ type: 'error', message: err.message });
    } finally {
      if (jeton === demande.current) setPrefillEnCours(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    demande.current += 1;
    setPrefill(null);
    setPrefillEnCours(false);
    setErrors({});
    const draft = loadDraft(draftKey);
    if (draft) {
      setForm({ ...EMPTY_FORM, ...draft });
      setDraftRestaure(true);
      return;
    }
    setDraftRestaure(false);
    const initial = formInitial(ligne, defaultDateDebut, defaultDateFin, lockedLicenceId);
    setForm(initial);
    // Licence verrouillee (fiche licence) en creation : proposition immediate.
    if (!ligne && lockedLicenceId && initial.type === 'previsionnel') demanderPreremplissage(lockedLicenceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligne, isOpen, draftKey, defaultDateDebut, defaultDateFin, lockedLicenceId]);

  useEffect(() => {
    if (!isOpen) return;
    saveDraft(draftKey, form);
  }, [form, isOpen, draftKey]);

  // Toute nouvelle selection invalide la demande de preremplissage en cours :
  // une reponse tardive pour l'ancienne licence ou l'ancien type est ignoree.
  function invaliderPreremplissage() {
    demande.current += 1;
    setPrefill(null);
    setPrefillEnCours(false);
  }

  function handleLicenceChange(idLicence) {
    setForm(prev => ({ ...prev, id_licence: idLicence }));
    invaliderPreremplissage();
    if (!isEdit && idLicence && form.type === 'previsionnel') demanderPreremplissage(idLicence);
  }

  const montantsVides = () => nombreOuNull(form.montant_capex) === null && nombreOuNull(form.montant_opex) === null;

  function handleTypeChange(type) {
    setForm(prev => ({ ...prev, type }));
    invaliderPreremplissage();
    // Retour au previsionnel : proposition seulement si rien n'a ete saisi,
    // pour ne pas ecraser des montants deja renseignes.
    if (type === 'previsionnel' && !isEdit && form.id_licence && montantsVides()) demanderPreremplissage(form.id_licence);
  }

  function viderBrouillon() {
    clearDraft(draftKey);
    setForm(formInitial(ligne, defaultDateDebut, defaultDateFin, lockedLicenceId));
    setDraftRestaure(false);
    setPrefill(null);
    setErrors({});
  }

  // Memes regles que l'API (5111 a 5122), pour un retour immediat ; l'API
  // reste l'autorite et son message est affiche tel quel en cas de refus.
  function validate() {
    const e = {};
    if (!form.id_licence) e.id_licence = 'La licence est obligatoire.';
    if (!form.type) e.type = 'Le type est obligatoire.';
    if (!form.date_debut) e.date_debut = 'La date de début est obligatoire.';
    if (!form.date_fin) e.date_fin = 'La date de fin est obligatoire.';
    if (form.date_debut && form.date_fin && form.date_fin < form.date_debut)
      e.date_fin = 'La date de fin doit être postérieure ou égale à la date de début.';
    const capex = nombreOuNull(form.montant_capex);
    const opex = nombreOuNull(form.montant_opex);
    if (capex === null && opex === null) e.montants = 'Renseignez au moins un montant, CAPEX ou OPEX.';
    if (capex !== null && (!Number.isFinite(capex) || capex < 0)) e.montant_capex = 'Le montant CAPEX doit être positif ou nul.';
    if (opex !== null && (!Number.isFinite(opex) || opex < 0)) e.montant_opex = 'Le montant OPEX doit être positif ou nul.';
    const qc = nombreOuNull(form.quantite_capex);
    const qo = nombreOuNull(form.quantite_opex);
    if (qc !== null && (!Number.isFinite(qc) || qc < 0)) e.quantite_capex = 'La quantité CAPEX doit être positive ou nulle.';
    if (qo !== null && (!Number.isFinite(qo) || qo < 0)) e.quantite_opex = 'La quantité OPEX doit être positive ou nulle.';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const payload = {
      id_licence: form.id_licence,
      type: form.type,
      date_debut: form.date_debut,
      date_fin: form.date_fin,
      montant_capex: nombreOuNull(form.montant_capex),
      quantite_capex: nombreOuNull(form.quantite_capex),
      date_capex: form.date_capex || null,
      montant_opex: nombreOuNull(form.montant_opex),
      quantite_opex: nombreOuNull(form.quantite_opex),
    };
    setLoading(true);
    try {
      const saved = isEdit
        ? await budgetService.update(ligne.id, payload)
        : await budgetService.create(payload);
      addToast({ type: 'success', message: isEdit ? 'Ligne budgétaire modifiée.' : 'Ligne budgétaire créée.' });
      clearDraft(draftKey);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  const isValid = !Object.values(validate()).some(Boolean);
  const licenceVerrouillee = lockedLicenceId
    ? (licences.find(l => l.id === lockedLicenceId) ?? (ligne?.id_licence === lockedLicenceId ? ligne : null))
    : null;

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier la ligne budgétaire' : 'Ajouter une ligne budgétaire'}
      size="lg"
      banner={draftRestaure && (
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2">
          Brouillon restauré depuis votre dernière saisie.
          <button onClick={viderBrouillon} className="underline hover:no-underline flex-shrink-0">
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
                <p className={LECTURE_CLS}>{libelleLicence(licenceVerrouillee) || 'Licence de la fiche'}</p>
              ) : (
                <select
                  className={INPUT_CLS}
                  value={form.id_licence}
                  onChange={e => handleLicenceChange(e.target.value)}
                >
                  <option value="">Choisir une licence…</option>
                  {licences.map(l => (
                    <option key={l.id} value={l.id}>{libelleLicence(l)}</option>
                  ))}
                  {/* Ligne editee dont la licence n'est plus dans la liste (droit ou filtre) : conservee. */}
                  {form.id_licence && !licences.some(l => l.id === form.id_licence) && (
                    <option value={form.id_licence}>{libelleLicence(ligne) || 'Licence de la ligne'}</option>
                  )}
                </select>
              )}
            </FormField>

            <FormField label="Organisation payeuse" hint="Déduite de la commande d'origine de la licence, non modifiable.">
              {form.id_licence ? (
                <div className={`${LECTURE_CLS} flex flex-col gap-0.5`}>
                  <span className="font-medium">
                    {organisation?.id_societe
                      ? organisation.societe_label
                      : <span className="text-gray-500">Non déterminée (licence sans commande)</span>}
                  </span>
                  {/* Editeur volontairement absent : /licences sert l'editeur du produit,
                      la ligne budgetaire porte celui du contrat, les deux peuvent differer. */}
                  {organisation && (organisation.contrat_label || organisation.commande_label) && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {[
                        organisation.commande_label ? `Commande ${organisation.commande_label}` : null,
                        organisation.contrat_label ? `Contrat ${organisation.contrat_label}` : null,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
              ) : (
                <p className={`${LECTURE_CLS} text-gray-400`}>Choisissez une licence.</p>
              )}
            </FormField>

            <FormField label="Type" required error={errors.type}>
              <select
                className={INPUT_CLS}
                value={form.type}
                onChange={e => handleTypeChange(e.target.value)}
              >
                <option value="previsionnel">Prévisionnel</option>
                <option value="alloue">Alloué</option>
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Date de début" required error={errors.date_debut}>
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
              <FormField label="Montant CAPEX (EUR)" error={errors.montant_capex}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={NUM_CLS}
                  value={form.montant_capex}
                  onChange={e => setForm(prev => ({ ...prev, montant_capex: e.target.value }))}
                />
              </FormField>
              <FormField label="Quantité CAPEX (licences)" error={errors.quantite_capex}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={NUM_CLS}
                  value={form.quantite_capex}
                  onChange={e => setForm(prev => ({ ...prev, quantite_capex: e.target.value }))}
                />
              </FormField>
            </div>
            {Number(form.montant_capex) > 0 && (
              <FormField label="Date d'engagement CAPEX" hint="À défaut, le CAPEX est imputé au mois de la date de début.">
                <input
                  type="date"
                  className={INPUT_CLS}
                  value={form.date_capex}
                  onChange={e => setForm(prev => ({ ...prev, date_capex: e.target.value }))}
                />
              </FormField>
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Montant OPEX (EUR)" error={errors.montant_opex}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={NUM_CLS}
                  value={form.montant_opex}
                  onChange={e => setForm(prev => ({ ...prev, montant_opex: e.target.value }))}
                />
              </FormField>
              <FormField label="Quantité OPEX (licences)" error={errors.quantite_opex}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={NUM_CLS}
                  value={form.quantite_opex}
                  onChange={e => setForm(prev => ({ ...prev, quantite_opex: e.target.value }))}
                />
              </FormField>
            </div>
            {errors.montants && <p className="text-xs text-red-600 dark:text-red-400">{errors.montants}</p>}
          </div>

          {form.type === 'previsionnel' && (
            <div className="mt-3 flex flex-col gap-2">
              {prefillEnCours && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Recherche de la maintenance en cours…</p>
              )}
              {!prefillEnCours && prefill && prefill.motif_base_vide && (
                <p className="text-xs text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2">
                  Aucune proposition : {MOTIFS_BASE_VIDE[prefill.motif_base_vide] ?? 'aucune maintenance en cours'}. Saisissez les montants manuellement.
                </p>
              )}
              {!prefillEnCours && prefill && !prefill.motif_base_vide && (
                <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                  Proposition d&apos;après la maintenance en cours : {formatEuros(prefill.base_montant)} par an
                  {prefill.nb_couts_inconnus > 0 ? ` (${prefill.nb_couts_inconnus} période${prefill.nb_couts_inconnus > 1 ? 's' : ''} sans coût renseigné)` : ''},
                  inflation de {prefill.taux_inflation} % sur {prefill.nb_annees} an{prefill.nb_annees > 1 ? 's' : ''} pour l&apos;exercice {prefill.exercice_cible}
                  {prefill.ligne?.date_debut ? ` (${formatDateIso(prefill.ligne.date_debut)} au ${formatDateIso(prefill.ligne.date_fin)})` : ''}.
                  Aucun CAPEX proposé. Montants et dates restent modifiables.
                </p>
              )}
              {!prefillEnCours && prefill?.societe_indeterminee && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Licence sans commande : organisation payeuse non déterminée, exercice par défaut appliqué.
                </p>
              )}
              {!prefillEnCours && prefill?.lignes_existantes?.length > 0 && (
                <p className="text-xs text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2">
                  {prefill.lignes_existantes.length > 1 ? 'Lignes déjà saisies' : 'Ligne déjà saisie'} sur l&apos;exercice {prefill.exercice_cible} pour cette licence :{' '}
                  {prefill.lignes_existantes.map(x => `${libelleType(x.type)} ${formatEuros(x.montant_total)}`).join(', ')}.
                </p>
              )}
              {!isEdit && form.id_licence && !prefillEnCours && (
                <button
                  type="button"
                  onClick={() => demanderPreremplissage(form.id_licence)}
                  className="self-start text-xs text-blue-700 dark:text-blue-400 hover:underline"
                >
                  Proposer les montants d&apos;après la maintenance en cours
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </SlideOver>
  );
}
