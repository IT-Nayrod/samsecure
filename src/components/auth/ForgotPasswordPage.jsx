// ForgotPasswordPage - Section 2 Specs UX v0.5
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import Button from '../ui/Button';
import FormField from '../ui/FormField';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-blue-800">Sam</span>
          <span className="text-2xl font-bold text-gray-800">Secure</span>
        </div>

        {submitted ? (
          <div className="text-center">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Email envoyé</h2>
            <p className="text-sm text-gray-600 mb-6">
              Si cet email est connu, un lien de réinitialisation vous a été envoyé.
            </p>
            <Link to="/login" className="text-sm text-blue-700 hover:underline">
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Réinitialiser le mot de passe</h2>
            <p className="text-sm text-gray-500 mb-6">Entrez votre email pour recevoir un lien de réinitialisation.</p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <FormField label="Adresse email" required>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="vous@exemple.fr"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </FormField>
              <Button type="submit" variant="primary" isLoading={loading} className="w-full">
                Envoyer le lien
              </Button>
              <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
                <ArrowLeft size={14} /> Retour à la connexion
              </Link>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
