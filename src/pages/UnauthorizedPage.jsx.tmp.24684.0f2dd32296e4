// UnauthorizedPage - Section 10 Specs UX v0.5
import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import Button from '../components/ui/Button';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center text-center px-4">
      <ShieldOff size={56} className="text-red-300 mb-5" strokeWidth={1.5} />
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Accès refusé</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
        Vous n'avez pas les droits nécessaires pour accéder à cette page. Contactez votre administrateur.
      </p>
      <Link to="/dashboard">
        <Button variant="primary">Retour au tableau de bord</Button>
      </Link>
    </div>
  );
}
