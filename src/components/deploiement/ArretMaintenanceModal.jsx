// ArretMaintenanceModal - arret de la maintenance d'une licence : date d'arret
// et version figee (par defaut la version courante). L'API (4009) fige la
// version et la date sans retirer de droit quantitatif.
import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { licencesService } from '../../services/licencesService';
import { useToast } from '../../hooks/useToast';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

export default function ArretMaintenanceModal({ isOpen, onClose, onSaved, licence, versions = [] }) {
  const { addToast } = useToast();
  const [dateArret, setDateArret] = useState('');
  const [versionFigee, setVersionFigee] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDateArret(new Date().toISOString().slice(0, 10));
    setVersionFigee(licence?.id_version ?? '');
  }, [isOpen, licence]);

  async function handleConfirm() {
    setLoading(true);
    try {
      const saved = await licencesService.arreterMaintenance(licence.id, {
        date_arret_maintenance: dateArret,
        version_figee_id: versionFigee || null,
      });
      addToast({ type: 'success', message: 'Maintenance arrêtée, version figée.' });
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
      title="Arrêter la maintenance"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleConfirm} isLoading={loading} disabled={!dateArret}>Arrêter la maintenance</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          La licence conserve ses <strong>{licence?.quantite} {licence?.unite_label ?? ''}</strong> de droits acquis.
          Seul le droit aux montées de version cesse : la version est figée à la date d&apos;arrêt.
        </p>
        <FormField label="Date d'arrêt" required>
          <input type="date" className={INPUT_CLS} value={dateArret} onChange={e => setDateArret(e.target.value)} />
        </FormField>
        <FormField label="Version figée" hint={versions.length ? 'Par défaut, la version courante de la licence' : 'Aucune version connue pour ce produit'}>
          <select className={INPUT_CLS} value={versionFigee} onChange={e => setVersionFigee(e.target.value)} disabled={!versions.length}>
            <option value="">Sans version</option>
            {versions.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </FormField>
      </div>
    </Modal>
  );
}
