// Breadcrumb - fil d'Ariane generique reutilisable
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function Breadcrumb({ items = [] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={13} className="text-gray-300 flex-shrink-0" />}
            {item.to && !isLast
              ? <Link to={item.to} className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">{item.label}</Link>
              : <span className={isLast ? 'text-gray-700 dark:text-gray-300 font-medium' : ''}>{item.label}</span>
            }
          </span>
        );
      })}
    </nav>
  );
}
