// EmptyState - Section 8 Specs UX v0.5
import { Inbox } from 'lucide-react';
import Button from './Button';

export default function EmptyState({ icon: Icon = Inbox, title, description, ctaLabel, onCta }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <Icon size={48} className="text-gray-300 dark:text-gray-600 mb-4" strokeWidth={1.5} />
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">{title}</h3>
      {description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">{description}</p>}
      {ctaLabel && onCta && <Button onClick={onCta}>{ctaLabel}</Button>}
    </div>
  );
}
