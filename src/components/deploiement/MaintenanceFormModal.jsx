// MaintenanceFormModal - ajout / modification d'une période de maintenance
// (maintenance_historique) d'une licence. Écriture par l'API, les règles de
// validation serveur (4031 à 4033, 4022, 4016, 4024, 4014) sont rendues telles
// quelles. La période peut porter la version qu'elle apporte (D59, #209) : la
// version courante de la licence suit alors la période la plus récente, tant
// que la maintenance n'est pas arrêtée. Le champ n'est proposé que sur un type
// à version (versionGeree) et hors arrêt (versions vide sinon).
//
// Décisions du 11/09/2026 : la période se rattache à une commande (migration
// 062, celles du contrat de la licence proposées en premier) ; le revendeur
// n'est plus saisi, il se lit par la commande. Une version absente du
// catalogue s'ajoute à la volée (complément du client, migration 063).
import { useState, useEffect, useMemo } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { licencesService, commandesPourMaintenance } from '../../services/licencesService';
import { useToast } from '../../hooks/useToast';
import LicenceDeclinaisonAjout from './LicenceDeclinaisonAjout';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY_FORM = { date_debut: '', date_fin: '', cout: '', id_mainteneur: '', id_commande: '', id_version: '' };

export default function MaintenanceFormModal({
  isOpen, onClose, onSaved, licenceId, periode, mainteneurs = [], commandes = [], idContrat = null, idProduit = null,
  montantsVisibles = true, versions = [], versionGeree = true,
}) {
  const isEdit = !!periode;
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [versionsAjoutees, setVersionsAjoutees] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setForm(periode ? {
      date_debut: periode.date_debut ?? '', date_fin: periode.date_fin ?? '',
      cout: periode.cout ?? '', id_mainteneur: periode.id_mainteneur ?? '', id_commande: periode.id_commande ?? '',
      id_version: periode.id_version ?? '',
    } : EMPTY_FORM);
    setErrors({});
  }, [periode, isOpen]);

  const commandesProposees = useMemo(() => commandesPourMaintenance(commandes, idContrat), [commandes, idContrat]);
  const commande = commandesProposees.find(c => c.id === form.id_commande) ?? null;
  const versionsListe = useMemo(() => {
    const connus = new Set(versions.map(v => v.id));
    return [...versions, ...versionsAjoutees.filter(v => !connus.has(v.id))];
  }, [versions, versionsAjoutees]);

  function validate() {
    const e = {};
    if (!form.date_debut) e.date_debut = 'La date de début est requise';
    if (form.date_fin && form.date_fin < form.date_debut) e.date_fin = 'La date de fin doit être postérieure à la date de début';
    if (form.cout !== '' && Number(form.cout) < 0) e.cout = 'Le coût ne peut pas être négatif';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const payload = { ...form };
      // Sans le droit de voir les montants, le coût n'est pas touché : un PATCH
      // sans la clé laisse la valeur en base, un POST la laisse vide.
      if (!montantsVisibles) delete payload.cout;
      const saved = isEdit
        ? await licencesService.maintenance.update(licenceId, periode.id, payload)
        : await licencesService.maintenance.create(licenceId, payload);
      addToast({ type: 'success', message: isEdit ? 'Période de maintenance mise à jour.' : 'Période de maintenance ajoutée.' });
      onSaved(saved);
      onClose();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  const isValid = !Object.values(validate()).some(Boolean);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier la période de maintenance' : 'Nouvelle période de maintenance'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} isLoading={loading} disabled={!isValid}>Enregistrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date de début" required error={errors.date_debut}>
            <input type="date" className={INPUT_CLS} value={form.date_debut} onChange={e => { setForm(v => ({ ...v, date_debut: e.target.value })); setErrors(v => ({ ...v, date_debut: null })); }} />
          </FormField>
          <FormField label="Date de fin" hint="Vide = en cours" error={errors.date_fin}>
            <input type="date" className={INPUT_CLS} value={form.date_fin} onChange={e => { setForm(v => ({ ...v, date_fin: e.target.value })); setErrors(v => ({ ...v, date_fin: null })); }} />
          </FormField>
        </div>
        <FormField label="Mainteneur">
          <select className={INPUT_CLS} value={form.id_mainteneur} onChange={e => setForm(v => ({ ...v, id_mainteneur: e.target.value }))}>
            <option value="">Non renseigné</option>
            {mainteneurs.map(m => <option key={m.id} value={m.id}>{m.raison_sociale}</option>)}
          </select>
        </FormField>
        <FormField label="Commande" hint={commande?.revendeur_label ? `Revendeur : ${commande.revendeur_label}` : 'Optionnel : le revendeur de la période se lit par sa commande'}>
          <select className={INPUT_CLS} value={form.id_commande} onChange={e => setForm(v => ({ ...v, id_commande: e.target.value }))} disabled={!commandesProposees.length && !form.id_commande}>
            <option value="">Aucune</option>
            {commandesProposees.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}{c.contrat_label ? ` (${c.contrat_label})` : ''}{idContrat && c.id_contrat === idContrat ? ' - contrat de la licence' : ''}
              </option>
            ))}
            {form.id_commande && !commandesProposees.some(c => c.id === form.id_commande) && (
              <option value={form.id_commande}>{periode?.commande_label ?? 'Commande actuelle'}</option>
            )}
          </select>
        </FormField>
        {isEdit && periode?.revendeur_label && !periode?.id_commande && (
          <p className="text-xs text-gray-500">Revendeur saisi avant le rattachement aux commandes : {periode.revendeur_label}. Il est conservé tant qu&apos;aucune commande n&apos;est choisie.</p>
        )}
        {versionGeree && (
          <FormField label="Version apportée" hint={versionsListe.length ? 'Optionnel : devient la version courante de la licence' : 'Aucune version sélectionnable (logiciel sans version ou maintenance arrêtée)'}>
            <select className={INPUT_CLS} value={form.id_version} onChange={e => setForm(v => ({ ...v, id_version: e.target.value }))} disabled={!versionsListe.length && !form.id_version}>
              <option value="">Aucune</option>
              {versionsListe.map(ve => <option key={ve.id} value={ve.id}>{ve.label}</option>)}
              {form.id_version && !versionsListe.some(ve => ve.id === form.id_version) && (
                <option value={form.id_version}>{periode?.version_label ?? 'Version actuelle'}</option>
              )}
            </select>
            <LicenceDeclinaisonAjout
              type="versions" idProduit={idProduit}
              onAjout={creee => { setVersionsAjoutees(v => [...v, creee]); setForm(v => ({ ...v, id_version: creee.id })); }}
            />
          </FormField>
        )}
        {montantsVisibles && (
          <FormField label="Coût (EUR)" error={errors.cout}>
            <input type="number" min={0} step="0.01" className={INPUT_CLS} value={form.cout} onChange={e => { setForm(v => ({ ...v, cout: e.target.value })); setErrors(v => ({ ...v, cout: null })); }} />
          </FormField>
        )}
      </div>
    </SlideOver>
  );
}
