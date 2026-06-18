// ConfirmModal - Section 8 Specs UX v0.5
import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirmer', isDestructive = false }) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); onClose(); }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Annuler</Button>
          <Button variant={isDestructive ? 'destructive' : 'primary'} onClick={handle} isLoading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-700 dark:text-gray-300">{message}</p>
    </Modal>
  );
}
