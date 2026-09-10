// FactureFormModal - dépôt d'une facture avec son justificatif.
// Arbitrage du flux rendu le 11/08 : une facture ne se saisit pas sans son
// document. Un seul appel, POST /api/factures/depot, qui crée le fichier, la
// preuve et la facture dans une transaction serveur. En cas d'échec, rien n'est
// créé : il n'y a donc pas d'état intermédiaire à rattraper ici, contrairement
// au dépôt d'une preuve seule.
// Objet unique (#204) : la preuve créée est de type Facture, le serveur le
// résout seul. L'utilisateur ne voit qu'une ligne dans Factures & Preuves et
// une seule validation.
import { useState, useEffect } from 'react';
import SlideOver from '../ui/SlideOver';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import DocumentUploadField from './DocumentUploadField';
import { facturesService } from '../../services/documentsService';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const EMPTY = { label: '', id_commande: '' };

export default function FactureFormModal({ isOpen, onClose, onDone, commandes, commandeParDefaut }) {
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      ...EMPTY,
      id_commande: commandeParDefaut ?? '',
    });
    setFile(null);
    setErreur(null);
  }, [isOpen, commandeParDefaut]);

  const complet = !!(file && form.label.trim() && form.id_commande);

  async function handleSave() {
    setLoading(true);
    setErreur(null);
    try {
      await facturesService.deposer({
        file,
        label: form.label.trim(),
        idCommande: form.id_commande,
      });
      onDone({ type: 'success', message: 'Facture enregistrée avec son justificatif.' });
      onClose();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title="Déposer une facture"
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
        <FormField label="Facture" required>
          <DocumentUploadField file={file} onChange={setFile} disabled={loading} />
        </FormField>
        <FormField label="Libellé" required>
          <input className={INPUT_CLS} value={form.label} autoFocus
            onChange={e => setForm(v => ({ ...v, label: e.target.value }))} />
        </FormField>
        <FormField label="Commande" required>
          <select className={INPUT_CLS} value={form.id_commande}
            onChange={e => setForm(v => ({ ...v, id_commande: e.target.value }))}>
            <option value="">Sélectionnez une commande</option>
            {commandes.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </FormField>
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
          Le fichier déposé est enregistré comme preuve de type Facture, rattachée à cette commande.
          La facture apparaît une seule fois dans Factures &amp; Preuves et se valide une seule fois.
        </p>
      </div>
    </SlideOver>
  );
}
