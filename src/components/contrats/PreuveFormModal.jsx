// PreuveFormModal - depot d'une preuve : metadonnees puis fichier.
// Deux appels API en sequence, conformement au decoupage des taches : la #48
// cree la preuve avec ses metadonnees, la #49 lui attache le fichier. Si le
// second echoue, la preuve existe deja : on le dit explicitement plutot que de
// laisser croire a un echec total, et l'utilisateur peut reessayer le depot
// depuis la fiche.
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import DocumentUploadField from './DocumentUploadField';
import { preuvesService } from '../../services/documentsService';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY = { label: '', id_type_preuve: '', id_contrat: '', id_commande: '' };

export default function PreuveFormModal({ isOpen, onClose, onDone, typesPreuve, contrats, commandes, contratParDefaut, commandeParDefaut }) {
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      ...EMPTY,
      id_type_preuve: typesPreuve[0]?.id ?? '',
      id_contrat: contratParDefaut ?? '',
      id_commande: commandeParDefaut ?? '',
    });
    setFile(null);
    setErreur(null);
  }, [isOpen, typesPreuve, contratParDefaut, commandeParDefaut]);

  // Le formulaire ne rejoue pas les regles du serveur, il empeche seulement
  // d'envoyer une requete vouee au refus. Les messages affiches en cas d'echec
  // restent ceux de l'API, mot pour mot.
  const complet = !!(file && form.label.trim() && form.id_type_preuve && (form.id_contrat || form.id_commande));

  async function handleSave() {
    setLoading(true);
    setErreur(null);
    let creee = null;
    try {
      creee = await preuvesService.create({
        label: form.label.trim(),
        id_type_preuve: form.id_type_preuve,
        id_contrat: form.id_contrat || null,
        id_commande: form.id_commande || null,
        // url_fichier est obligatoire en base : le depot qui suit le remplace
        // par le nom physique reel. Cette valeur ne survit jamais a un depot
        // reussi.
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
        <FormField label="Type de preuve" required>
          <select className={INPUT_CLS} value={form.id_type_preuve}
            onChange={e => setForm(v => ({ ...v, id_type_preuve: e.target.value }))}>
            {typesPreuve.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Contrat rattaché">
            <select className={INPUT_CLS} value={form.id_contrat}
              onChange={e => setForm(v => ({ ...v, id_contrat: e.target.value }))}>
              <option value="">Aucun</option>
              {contrats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </FormField>
          <FormField label="Commande rattachée">
            <select className={INPUT_CLS} value={form.id_commande}
              onChange={e => setForm(v => ({ ...v, id_commande: e.target.value }))}>
              <option value="">Aucune</option>
              {commandes.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </FormField>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
          Une preuve doit être rattachée à un contrat, à une commande, ou aux deux.
          Seul un rattachement direct à la commande la fait sortir de la détection des manques.
        </p>
      </div>
    </SlideOver>
  );
}
