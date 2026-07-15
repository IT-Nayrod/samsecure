// ComingSoonPage - Section 10 Specs UX v0.5
import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';

export default function ComingSoonPage({ section }) {
  const location = useLocation();
  const name = section ?? location.pathname.split('/')[1]?.replace(/-/g, ' ') ?? 'Section';
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Construction size={56} className="text-gray-300 dark:text-gray-600 mb-5" strokeWidth={1.5} />
      <h1 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2 capitalize">{name}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
        Cette section sera disponible prochainement dans une prochaine version de SamSecure.
      </p>
    </div>
  );
}
