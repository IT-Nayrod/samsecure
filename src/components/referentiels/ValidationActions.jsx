// ValidationActions - actions Valider / Refuser sur une saisie en_attente (Manager DSI uniquement)
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import FormField from '../ui/FormField';

export default function ValidationActions({ statut, onValidate, onRefuse, size = 'sm' }) {
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);

  if (statut !== 'en_attente') return null;

  // La modale ne se ferme que sur succes : si l'API refuse, le motif saisi ne
  // doit pas etre perdu, l'erreur remonte deja en toast.
  async function confirmRefuse() {
    setEnvoi(true);
    try {
      await onRefuse(motif.trim());
      setRefuseOpen(false);
      setMotif('');
    } catch (err) {
      // Jamais avale en silence : le message metier part deja en toast cote
      // appelant, mais une erreur de cablage (handler absent) ne laisserait
      // sinon aucune trace et se lirait comme un bouton qui ne fait rien.
      console.error('[validation] refus impossible', err);
    } finally { setEnvoi(false); }
  }

  async function confirmValidate() {
    setEnvoi(true);
    try { await onValidate(); }
    catch (err) { console.error('[validation] validation impossible', err); }
    finally { setEnvoi(false); }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="primary" size={size} onClick={confirmValidate} isLoading={envoi}>
          <Check size={14} /> Valider
        </Button>
        <Button variant="destructive" size={size} onClick={() => setRefuseOpen(true)} disabled={envoi}>
          <X size={14} /> Refuser
        </Button>
      </div>

      <Modal
        isOpen={refuseOpen}
        onClose={() => setRefuseOpen(false)}
        title="Refuser la saisie"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRefuseOpen(false)} disabled={envoi}>Annuler</Button>
            <Button variant="destructive" onClick={confirmRefuse} disabled={!motif.trim() || envoi} isLoading={envoi}>Confirmer le refus</Button>
          </>
        }
      >
        <FormField label="Motif du refus" required hint="Ce message sera visible par l'auteur de la saisie.">
          <textarea
            value={motif}
            onChange={e => setMotif(e.target.value)}
            rows={3}
            disabled={envoi}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </FormField>
      </Modal>
    </>
  );
}
