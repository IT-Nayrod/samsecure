// ErrorState - echec de chargement avec relance, pour les ecrans branches sur l'API.
// Pendant du EmptyState : meme gabarit, meme place dans la page.
import { AlertTriangle } from 'lucide-react';
import Button from './Button';

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <AlertTriangle size={48} className="text-red-400 dark:text-red-500/70 mb-4" strokeWidth={1.5} />
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">Chargement impossible</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">{message}</p>
      {onRetry && <Button onClick={onRetry}>Reessayer</Button>}
    </div>
  );
}
