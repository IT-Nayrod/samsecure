// ResetPasswordPage - page publique de consommation d'un lien de
// reinitialisation (tache #85, story #14).
//
// Deux appels a l'API publique, sans session :
//   GET  /api/mot-de-passe/reinitialisation/:jeton  avant d'afficher le formulaire
//   POST /api/mot-de-passe/reinitialisation/:jeton  a la soumission
// Un lien inexistant, expire ou deja consomme recoit le meme message (410) :
// la page ne sait pas, et ne doit pas dire, si un compte existe.
//
// L'indication en direct des regles est un CONFORT D'AFFICHAGE, jamais une
// validation : la politique fait foi cote serveur (server/utils/motDePasse.js,
// la meme que pour la definition par un administrateur), et le message de
// refus affiche est celui de l'API. Meme approche que MotDePasseModal.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, Check } from 'lucide-react';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { http } from '../../services/http';
import { useToast } from '../../hooks/useToast';

// Miroir de server/utils/motDePasse.js, pour l'affichage seul, identique a
// celui de MotDePasseModal. Toute evolution de la politique se reporte ici.
const REGLES = [
  { cle: 'longueur', libelle: '12 caractères minimum', test: (v) => v.length >= 12 },
  { cle: 'majuscule', libelle: 'une majuscule', test: (v) => /[A-Z]/.test(v) },
  { cle: 'minuscule', libelle: 'une minuscule', test: (v) => /[a-z]/.test(v) },
  { cle: 'chiffre', libelle: 'un chiffre', test: (v) => /[0-9]/.test(v) },
  { cle: 'special', libelle: 'un caractère spécial', test: (v) => /[^A-Za-z0-9\s]/.test(v) },
];

function Regle({ satisfaite, libelle }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${satisfaite ? 'text-green-600' : 'text-gray-400'}`}>
      {satisfaite ? <Check size={13} /> : <span className="w-[13px] text-center">·</span>}
      {libelle}
    </li>
  );
}

const CHAMP = 'w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  // 'verification' | 'valide' | 'invalide'
  const [etat, setEtat] = useState('verification');
  const [prenom, setPrenom] = useState('');
  const [messageInvalide, setMessageInvalide] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let annule = false;
    http.get(`/mot-de-passe/reinitialisation/${encodeURIComponent(token)}`)
      .then((rep) => {
        if (annule) return;
        setPrenom(rep?.prenom || '');
        setEtat('valide');
      })
      .catch((err) => {
        if (annule) return;
        // 410 et toute autre erreur : un seul ecran, le message du serveur
        // quand il existe. Aucune distinction entre expire, consomme, inconnu.
        setMessageInvalide(err?.message || "Ce lien n'est plus valide.");
        setEtat('invalide');
      });
    return () => { annule = true; };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setErreur('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    setErreur(null);
    try {
      const rep = await http.post(`/mot-de-passe/reinitialisation/${encodeURIComponent(token)}`, { mot_de_passe: password });
      addToast({ type: 'success', message: rep?.message || 'Mot de passe réinitialisé.' });
      navigate('/login', { replace: true });
    } catch (err) {
      // Un 410 a la soumission : le lien a ete consomme ou a expire entre la
      // verification et l'envoi. Meme ecran que pour un lien invalide.
      if (err?.status === 410) {
        setMessageInvalide(err.message);
        setEtat('invalide');
      } else {
        // Message du serveur tel quel : c'est lui qui fait foi sur la politique.
        setErreur(err?.message || 'Une erreur est survenue.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-blue-800">Sam</span>
          <span className="text-2xl font-bold text-gray-800">Secure</span>
        </div>

        {etat === 'verification' && (
          <p className="text-sm text-gray-500 text-center">Vérification du lien…</p>
        )}

        {etat === 'invalide' && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Lien non valide</h2>
            <p className="text-sm text-gray-600 mb-6">{messageInvalide}</p>
            <Link to="/login" className="block text-center text-sm text-gray-500 hover:text-gray-700">Retour à la connexion</Link>
          </>
        )}

        {etat === 'valide' && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Nouveau mot de passe</h2>
            <p className="text-sm text-gray-500 mb-6">
              {prenom ? `Bonjour ${prenom}, choisissez` : 'Choisissez'} votre nouveau mot de passe.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <FormField label="Nouveau mot de passe" required>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErreur(null); }}
                    autoComplete="new-password"
                    disabled={loading}
                    className={CHAMP}
                  />
                  <button type="button" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                  {REGLES.map((r) => <Regle key={r.cle} libelle={r.libelle} satisfaite={r.test(password)} />)}
                </ul>
              </FormField>
              <FormField label="Confirmer le mot de passe" required error={erreur}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setErreur(null); }}
                  autoComplete="new-password"
                  disabled={loading}
                  className={CHAMP}
                />
              </FormField>
              {/* Volontairement actif des que les deux champs sont remplis :
                  le refus et son message viennent de l'API. */}
              <Button type="submit" variant="primary" isLoading={loading} disabled={!password || !confirm || loading} className="w-full">
                Réinitialiser le mot de passe
              </Button>
              <Link to="/login" className="text-center text-sm text-gray-500 hover:text-gray-700">Retour à la connexion</Link>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
