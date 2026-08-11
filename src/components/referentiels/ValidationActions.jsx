// ValidationActions - actions Valider / Refuser sur une saisie en_attente (Manager DSI uniquement)
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import FormField from '../ui/FormField';

export default function ValidationActions({ statut, onValidate, onRefuse }) {
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [motif, setMotif] = useState('');

  if (statut !== 'en_attente') return null;

  function confirmRefuse() {
    onRefuse(motif.trim());
    setRefuseOpen(false);
    setMotif('');
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={onValidate}>
          <Check size={14} /> Valider
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setRefuseOpen(true)}>
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
            <Button variant="secondary" onClick={() => setRefuseOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmRefuse} disabled={!motif.trim()}>Confirmer le refus</Button>
          </>
        }
      >
        <FormField label="Motif du refus" required hint="Ce message sera visible par l'auteur de la saisie.">
          <textarea
            value={motif}
            onChange={e => setMotif(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </FormField>
      </Modal>
    </>
  );
}
