// SlideOver - panneau lateral droit pour les formulaires de saisie (remplace Modal pour la creation/edition)
// Reste visible la liste/page en arriere-plan : permet de garder le contexte pendant la saisie.
// Meme API que Modal (isOpen, onClose, title, size, children, footer) pour une migration a cout nul.
import { useEffect } from 'react';
import { X } from 'lucide-react';

const sizes = { sm: 'max-w-[420px]', md: 'max-w-[520px]', lg: 'max-w-[640px]' };

export default function SlideOver({ isOpen, onClose, title, size = 'md', children, footer, banner }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className={`absolute top-0 right-0 h-full w-full ${sizes[size]} bg-white dark:bg-gray-800 shadow-2xl flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} aria-label="Fermer le panneau" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>
        {banner && (
          <div className="px-6 py-2.5 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30 flex-shrink-0">
            {banner}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
