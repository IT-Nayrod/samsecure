// TwoFactorPage - Section 2 Specs UX v0.5
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import Button from '../ui/Button';

const VALID_CODE = '123456'; // demo
const MAX_ATTEMPTS = 3;

export default function TwoFactorPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const blocked = attempts >= MAX_ATTEMPTS;

  async function handleSubmit(e) {
    e.preventDefault();
    if (blocked) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setLoading(false);
    if (code === VALID_CODE) {
      navigate('/dashboard', { replace: true });
    } else {
      const n = attempts + 1;
      setAttempts(n);
      setCode('');
      setError(n >= MAX_ATTEMPTS
        ? 'Trop de tentatives incorrectes. Accès bloqué.'
        : `Code incorrect. ${MAX_ATTEMPTS - n} tentative${MAX_ATTEMPTS - n > 1 ? 's' : ''} restante${MAX_ATTEMPTS - n > 1 ? 's' : ''}.`
      );
      inputRef.current?.focus();
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="mb-6">
          <span className="text-2xl font-bold text-blue-800">Sam</span>
          <span className="text-2xl font-bold text-gray-800">Secure</span>
        </div>
        <ShieldCheck size={40} className="text-blue-700 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Double authentification</h2>
        <p className="text-sm text-gray-500 mb-6">Entrez le code à 6 chiffres généré par votre application d'authentification.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
            disabled={blocked}
            placeholder="000000"
            className="w-full text-center text-2xl tracking-[0.5em] py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono disabled:bg-gray-50"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" variant="primary" isLoading={loading} disabled={blocked || code.length !== 6} className="w-full">
            Valider
          </Button>
        </form>
        <button className="mt-4 text-sm text-blue-700 hover:underline">
          Utiliser un code de secours
        </button>
      </div>
    </div>
  );
}
