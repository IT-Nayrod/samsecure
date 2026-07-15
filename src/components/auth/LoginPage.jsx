// LoginPage - Section 2 Specs UX v0.5
import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import Button from '../ui/Button';
import FormField from '../ui/FormField';

const MAX_ATTEMPTS = 5;

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const blocked = attempts >= MAX_ATTEMPTS;

  async function handleSubmit(e) {
    e.preventDefault();
    if (blocked || loading) return;
    setLoading(true);
    setError('');
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate('/dashboard', { replace: true });
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setError(newAttempts >= MAX_ATTEMPTS
        ? 'Compte temporairement bloqué après 5 tentatives. Contactez votre administrateur.'
        : result.error
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-lg p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-blue-800">Sam</span>
          <span className="text-2xl font-bold text-gray-800">Secure</span>
          <p className="text-sm text-gray-500 mt-1">Gestion des actifs logiciels</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FormField label="Adresse email" required>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vous@exemple.fr"
              autoComplete="email"
              disabled={blocked}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
            />
          </FormField>

          <FormField label="Mot de passe" required>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={blocked}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <a href="/forgot-password" className="text-xs text-blue-700 hover:underline self-end mt-1">
              Mot de passe oublié ?
            </a>
          </FormField>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Button type="submit" variant="primary" isLoading={loading} disabled={blocked} className="w-full">
            Se connecter
          </Button>
        </form>
      </div>
    </div>
  );
}
