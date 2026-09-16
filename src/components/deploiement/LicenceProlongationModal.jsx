// LicenceProlongationModal - prolongation d'une licence à échéance (décision
// du 11/09/2026) : la date de fin de la période en cours est étendue (fin de
// souscription ou d'essai, ou fin de la maintenance en cours d'une perpétuelle),
// sans créer de licence. L'API (4025) trace l'opération et libère l'alerte
// d'échéance pour la nouvelle date ; elle refuse une date antérieure ou égale
// à l'échéance actuelle (4027).
import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { licencesService, echeanceProlongeable, lendemain } from '../../services/licencesService';
import { useToast } from '../../hooks/useToast';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

export default function LicenceProlongationModal({ isOpen, onClose, onSaved, licence }) {
  const { addToast } = useToast();
  const [dateFin, setDateFin] = useState('');
  const [loading, setLoading] = useState(false);
  const echeance = echeanceProlongeable(licence);

  useEffect(() => {
    if (!isOpen) return;
    setDateFin('');
  }, [isOpen, licence]);

  const posterieure = !!echeance && !!dateFin && dateFin > echeance.date;

  async function handleConfirm() {
    if (!posterieure) return;
    setLoading(true);
    try {
      const saved = await licencesService.prolonger(licence.id, dateFin);
      addToast({ type: 'success', message: `Licence prolongée jusqu'au ${dateFin}.` });
      onSaved(saved);
      onClose();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Prolonger la licence"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleConfirm} isLoading={loading} disabled={!posterieure}>Prolonger</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {echeance ? (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {echeance.mode === 'souscription'
                ? <>La période en cours prend fin le <strong>{echeance.date}</strong>. La prolongation étend cette date : la licence reste la même, aucune nouvelle période n&apos;est créée.</>
                : <>La maintenance en cours prend fin le <strong>{echeance.date}</strong>. La prolongation étend cette date sur la période de maintenance la plus récente.</>}
            </p>
            <FormField label="Nouvelle date de fin" required hint={`Postérieure au ${echeance.date}`} error={dateFin && !posterieure ? 'La nouvelle date doit être postérieure à l\'échéance actuelle' : null}>
              <input type="date" className={INPUT_CLS} value={dateFin} min={lendemain(echeance.date)} onChange={e => setDateFin(e.target.value)} />
            </FormField>
            <p className="text-xs text-gray-500">Pour une nouvelle période (nouvelle licence liée à celle-ci, l&apos;actuelle conservant son terme), utilisez « Nouvelle période ».</p>
          </>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-300">Cette licence ne porte aucune échéance à prolonger : ni date de fin, ni maintenance en cours.</p>
        )}
      </div>
    </Modal>
  );
}
