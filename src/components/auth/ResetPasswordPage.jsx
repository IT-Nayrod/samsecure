// ResetPasswordPage - Section 2 Specs UX v0.5
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import PasswordStrength from '../ui/PasswordStrength';
import { validatePassword } from '../../utils/validation';
import { useToast } from '../../hooks/useToast';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    const pwdErr = validatePassword(password);
    if (pwdErr) e.password = pwdErr;
    if (password !== confirm) e.confirm = 'Les mots de passe ne correspondent pas.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    addToast({ type: 'success', message: 'Mot de passe réinitialisé avec succès.' });
    navigate('/login', { replace: true });
  }

  const isValid = !validatePassword(password) && password === confirm;

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-blue-800">Sam</span>
          <span className="text-2xl font-bold text-gray-800">Secure</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Nouveau mot de passe</h2>
        <p className="text-sm text-gray-500 mb-6">Choisissez un mot de passe sécurisé.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FormField label="Nouveau mot de passe" required error={errors.password}>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setErrors(v => ({ ...v, password: null })); }}
                placeholder="••••••••"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)} aria-label="Afficher le mot de passe" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <PasswordStrength password={password} />
          </FormField>
          <FormField label="Confirmer le mot de passe" required error={errors.confirm}>
            <input
              type={showPwd ? 'text' : 'password'}
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setErrors(v => ({ ...v, confirm: null })); }}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </FormField>
          <Button type="submit" variant="primary" isLoading={loading} disabled={!isValid} className="w-full">
            Réinitialiser le mot de passe
          </Button>
          <Link to="/login" className="text-center text-sm text-gray-500 hover:text-gray-700">Retour à la connexion</Link>
        </form>
      </div>
    </div>
  );
}
