// PreuveFormModal - dépôt d'une preuve : métadonnées puis fichier.
// Deux appels API en séquence, conformément au découpage des tâches : la #48
// crée la preuve avec ses métadonnées, la #49 lui attache le fichier. Si le
// second échoue, la preuve existe déjà : on le dit explicitement plutôt que de
// laisser croire à un échec total, et l'utilisateur peut réessayer le dépôt
// depuis la fiche.
// Depuis la #208, la preuve se rattache à un contrat OU à une commande OU à une
// licence, et les types proposés dépendent de l'objet choisi (liste ferme du
// client). L'API reste tolérante au cumul pour les preuves antérieures ; le
// formulaire, lui, n'envoie qu'un seul rattachement.
import { useState, useEffect, useMemo } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import DocumentUploadField from './DocumentUploadField';
import { preuvesService } from '../../services/documentsService';
import { libelleContrat } from './libelleContrat';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

// Liste ferme décidée par le client (#208) : les codes sont ceux du référentiel
// type_preuve seedé par la migration 053. L'ordre est celui de la décision.
// Un type absent de ces listes (types antérieurs à la 053) n'est plus proposé
// à la saisie mais reste affiché sur les preuves qui le portent.
export const TYPES_PAR_RATTACHEMENT = {
  contrat:  ['contrat_annexes', 'autre'],
  commande: ['bon_commande', 'bon_livraison', 'facture', 'autre'],
  licence:  ['certificat', 'clefs_licence', 'autre'],
};

const RATTACHEMENTS = [
  { code: 'contrat',  label: 'Contrat',  champ: 'id_contrat' },
  { code: 'commande', label: 'Commande', champ: 'id_commande' },
  { code: 'licence',  label: 'Licence',  champ: 'id_licence' },
];

// Une licence n'a pas toujours de libellé propre : le produit fait alors foi,
// comme dans la liste des licences.
const libelleLicence = (l) => l.label ?? l.produit_label ?? l.id;

const EMPTY = { label: '', id_type_preuve: '', rattachement: 'contrat', id_contrat: '', id_commande: '', id_licence: '' };

export default function PreuveFormModal({
  isOpen, onClose, onDone, typesPreuve = [],
  contrats = [], commandes = [], licences = [],
  contratParDefaut, commandeParDefaut, licenceParDefaut,
}) {
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState(null);

  // Types proposés pour le rattachement courant, dans l'ordre de la décision.
  // Repli sur la liste complète tant que la migration 053 n'a pas été jouée :
  // un formulaire sans aucun type serait bloquant.
  const typesProposes = useMemo(() => {
    const codes = TYPES_PAR_RATTACHEMENT[form.rattachement] ?? [];
    const filtres = codes.map(code => typesPreuve.find(t => t.code === code)).filter(Boolean);
    return filtres.length ? filtres : typesPreuve;
  }, [typesPreuve, form.rattachement]);

  useEffect(() => {
    if (!isOpen) return;
    // L'objet d'ouverture décide du rattachement initial : la fiche licence
    // impose la licence, la fiche commande la commande, sinon le contrat.
    const rattachement = licenceParDefaut ? 'licence' : commandeParDefaut ? 'commande' : 'contrat';
    const codes = TYPES_PAR_RATTACHEMENT[rattachement];
    const premierType = codes.map(code => typesPreuve.find(t => t.code === code)).find(Boolean) ?? typesPreuve[0];
    setForm({
      ...EMPTY,
      rattachement,
      id_type_preuve: premierType?.id ?? '',
      id_contrat: contratParDefaut ?? '',
      id_commande: commandeParDefaut ?? '',
      id_licence: licenceParDefaut ?? '',
    });
    setFile(null);
    setErreur(null);
  }, [isOpen, typesPreuve, contratParDefaut, commandeParDefaut, licenceParDefaut]);

  // Changer d'objet de rattachement change la liste des types : le type courant
  // est conservé s'il reste proposé, sinon le premier de la nouvelle liste.
  function choisirRattachement(code) {
    setForm(v => {
      const codes = TYPES_PAR_RATTACHEMENT[code] ?? [];
      const proposes = codes.map(c => typesPreuve.find(t => t.code === c)).filter(Boolean);
      const liste = proposes.length ? proposes : typesPreuve;
      const conserve = liste.some(t => t.id === v.id_type_preuve);
      return { ...v, rattachement: code, id_type_preuve: conserve ? v.id_type_preuve : (liste[0]?.id ?? '') };
    });
  }

  const rattachement = RATTACHEMENTS.find(r => r.code === form.rattachement) ?? RATTACHEMENTS[0];
  const idRattache = form[rattachement.champ];

  // Complément #99 : la société de la commande, portée par la liste des
  // commandes (societe_label de GET /commandes), est rappelée en lecture seule.
  // Aucun champ nouveau : c'est une information, pas une saisie.
  const commandeChoisie = form.rattachement === 'commande'
    ? commandes.find(k => k.id === form.id_commande) ?? null
    : null;

  // Le formulaire ne rejoue pas les règles du serveur, il empêche seulement
  // d'envoyer une requête vouée au refus. Les messages affichés en cas d'échec
  // restent ceux de l'API, mot pour mot.
  const complet = !!(file && form.label.trim() && form.id_type_preuve && idRattache);

  async function handleSave() {
    setLoading(true);
    setErreur(null);
    let creee = null;
    try {
      creee = await preuvesService.create({
        label: form.label.trim(),
        id_type_preuve: form.id_type_preuve,
        // Un seul rattachement part au serveur, les deux autres sont nuls.
        id_contrat: form.rattachement === 'contrat' ? form.id_contrat : null,
        id_commande: form.rattachement === 'commande' ? form.id_commande : null,
        id_licence: form.rattachement === 'licence' ? form.id_licence : null,
        // url_fichier est obligatoire en base : le dépôt qui suit le remplace
        // par le nom physique réel. Cette valeur ne survit jamais à un dépôt
        // réussi.
        url_fichier: 'en-attente-de-depot',
      });
      await preuvesService.deposerFichier(creee.id, file);
      onDone({ type: 'success', message: 'Preuve déposée.' });
      onClose();
    } catch (err) {
      setErreur(creee
        ? `La preuve a été créée mais le fichier n'a pas pu être déposé : ${err.message} Reprenez le dépôt depuis sa fiche.`
        : err.message);
      if (creee) onDone(null);
    } finally {
      setLoading(false);
    }
  }

  // Seuls les objets réellement proposables apparaissent dans le choix du
  // rattachement ; celui en cours reste toujours sélectionnable.
  const listes = { contrat: contrats, commande: commandes, licence: licences };
  const rattachementsProposes = RATTACHEMENTS.filter(r => listes[r.code].length > 0 || r.code === form.rattachement);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title="Déposer une preuve"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} isLoading={loading} disabled={!complet}>Déposer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {erreur && (
          <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{erreur}</p>
        )}
        <FormField label="Fichier" required>
          <DocumentUploadField file={file} onChange={setFile} disabled={loading} />
        </FormField>
        <FormField label="Libellé" required>
          <input className={INPUT_CLS} value={form.label} autoFocus
            onChange={e => setForm(v => ({ ...v, label: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Rattachée à" required>
            <select className={INPUT_CLS} value={form.rattachement}
              onChange={e => choisirRattachement(e.target.value)}>
              {rattachementsProposes.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          </FormField>
          {form.rattachement === 'contrat' && (
            <FormField label="Contrat" required>
              <select className={INPUT_CLS} value={form.id_contrat}
                onChange={e => setForm(v => ({ ...v, id_contrat: e.target.value }))}>
                <option value="">Sélectionnez un contrat</option>
                {contrats.map(c => <option key={c.id} value={c.id}>{libelleContrat(c.label, c.societe_label)}</option>)}
              </select>
            </FormField>
          )}
          {form.rattachement === 'commande' && (
            <FormField label="Commande" required>
              <select className={INPUT_CLS} value={form.id_commande}
                onChange={e => setForm(v => ({ ...v, id_commande: e.target.value }))}>
                <option value="">Sélectionnez une commande</option>
                {commandes.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </FormField>
          )}
          {form.rattachement === 'licence' && (
            <FormField label="Licence" required>
              <select className={INPUT_CLS} value={form.id_licence}
                onChange={e => setForm(v => ({ ...v, id_licence: e.target.value }))}>
                <option value="">Sélectionnez une licence</option>
                {licences.map(l => <option key={l.id} value={l.id}>{libelleLicence(l)}</option>)}
              </select>
            </FormField>
          )}
        </div>
        {commandeChoisie?.societe_label && (
          <FormField label="Société de la commande" hint="Portée par la commande, non modifiable ici">
            <input className={`${INPUT_CLS} bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300`} value={commandeChoisie.societe_label} readOnly />
          </FormField>
        )}
        <FormField label="Type de preuve" required hint="Les types proposés dépendent de l'objet de rattachement">
          <select className={INPUT_CLS} value={form.id_type_preuve}
            onChange={e => setForm(v => ({ ...v, id_type_preuve: e.target.value }))}>
            {typesProposes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </FormField>
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
          Une preuve se rattache à un contrat, à une commande ou à une licence.
          Seul un rattachement direct à la commande la fait sortir de la détection des manques.
        </p>
      </div>
    </SlideOver>
  );
}
