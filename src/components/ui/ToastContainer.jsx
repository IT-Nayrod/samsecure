// ToastContainer - Section 8 Specs UX v0.5
import { useToast } from '../../hooks/useToast';
import Toast from './Toast';

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast {...t} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
}
