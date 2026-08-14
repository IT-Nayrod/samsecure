// MotDePasseModal - les trois actions de gestion du mot de passe d'un compte.
//
// L'indication en direct des regles est un CONFORT D'AFFICHAGE, jamais une
// validation : le bouton reste actif meme si une regle n'est pas satisfaite,
// et c'est l'API qui refuse. Dupliquer la politique ici pour bloquer la
// soumission ferait exister deux regles, dont l'une pourrait deriver de
// l'autre en silence. Le message de refus affiche est celui du serveur.
//
// Le mot de passe genere n'est conserve nulle part : il vit dans un state
// efface a la fermeture, et n'est jamais renvoye a l'API ni relu.
import { useState } from 'react';
import { Copy, Check, Eye, EyeOff, RefreshCw, Mail } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { usersService } from '../../services/adminService';
import { useToast } from '../../hooks/useToast';

// Miroir de server/utils/motDePasse.js, pour l'affichage seul. Toute
// evolution de la politique doit etre reportee dans les deux fichiers : c'est
// le prix assume d'un retour immediat a la frappe, sans appel reseau.
const REGLES = [
  { cle: 'longueur', libelle: '12 caractères minimum', test: (v) => v.length >= 12 },
  { cle: 'majuscule', libelle: 'une majuscule', test: (v) => /[A-Z]/.test(v) },
  { cle: 'minuscule', libelle: 'une minuscule', test: (v) => /[a-z]/.test(v) },
  { cle: 'chiffre', libelle: 'un chiffre', test: (v) => /[0-9]/.test(v) },
  { cle: 'special', libelle: 'un caractère spécial', test: (v) => /[^A-Za-z0-9\s]/.test(v) },
];

function Regle({ satisfaite, libelle }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${satisfaite ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
      {satisfaite ? <Check size={13} /> : <span className="w-[13px] text-center">·</span>}
      {libelle}
    </li>
  );
}

export default function MotDePasseModal({ isOpen, utilisateur, onClose }) {
  const { addToast } = useToast();
  const [valeur, setValeur] = useState('');
  const [visible, setVisible] = useState(false);
  const [envoi, setEnvoi] = useState(null);          // 'definir' | 'generer' | 'lien'
  const [genere, setGenere] = useState(null);
  const [copie, setCopie] = useState(false);
  const [confirmeLien, setConfirmeLien] = useState(false);
  const [lienTemporaire, setLienTemporaire] = useState(null);

  if (!utilisateur) return null;

  // Fermeture : tout est efface. Le mot de passe genere ne doit survivre ni a
  // la fermeture ni a une reouverture, c'est la regle "affiche une seule fois".
  function fermer() {
    setValeur(''); setVisible(false); setGenere(null);
    setCopie(false); setConfirmeLien(false); setLienTemporaire(null);
    onClose();
  }

  async function definir() {
    setEnvoi('definir');
    try {
      const rep = await usersService.definirMotDePasse(utilisateur.id, valeur);
      addToast({ type: 'success', message: rep.sessions_revoquees
        ? `Mot de passe défini. ${rep.sessions_revoquees} session(s) fermée(s).`
        : 'Mot de passe défini.' });
      setValeur('');
    } catch (err) {
      // Message du serveur affiche tel quel : c'est lui qui fait foi sur la
      // politique, y compris s'il refuse ce que l'affichage jugeait conforme.
      addToast({ type: 'error', message: err.message, persistent: true });
    } finally {
      setEnvoi(null);
    }
  }

  async function generer() {
    setEnvoi('generer');
    try {
      const rep = await usersService.genererMotDePasse(utilisateur.id);
      setGenere(rep.mot_de_passe);
      setCopie(false);
    } catch (err) {
      addToast({ type: 'error', message: err.message, persistent: true });
    } finally {
      setEnvoi(null);
    }
  }

  async function envoyerLien() {
    setEnvoi('lien');
    try {
      const rep = await usersService.envoyerLienReinitialisation(utilisateur.id);
      setConfirmeLien(false);
      // Le socle d'envoi de mails n'existe pas encore : l'API renvoie le lien
      // en clair (tache 85, option A). Ce bloc disparait avec la story #15.
      if (rep.lien) setLienTemporaire(rep.lien);
      addToast({ type: 'success', message: rep.lien
        ? `Lien généré, valable ${rep.expire_dans_heures} h. L'envoi par mail arrivera avec le socle mail.`
        : 'Mail de réinitialisation envoyé.' });
    } catch (err) {
      addToast({ type: 'error', message: err.message, persistent: true });
    } finally {
      setEnvoi(null);
    }
  }

  async function copier(texte) {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      addToast({ type: 'error', message: 'Copie impossible depuis ce navigateur.' });
    }
  }

  const enCours = envoi !== null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={fermer}
      title="Mot de passe"
      size="md"
      footer={<Button variant="secondary" onClick={fermer}>Fermer</Button>}
    >
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        {utilisateur.prenom} {utilisateur.nom}
      </p>

      {/* ---- 1. Saisie manuelle ---- */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Définir un mot de passe</h3>
        <FormField label="Nouveau mot de passe" required>
          <div className="relative">
            <input
              type={visible ? 'text' : 'password'}
              value={valeur}
              onChange={(e) => setValeur(e.target.value)}
              autoComplete="new-password"
              disabled={enCours}
              className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              {visible ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </FormField>

        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 mb-3">
          {REGLES.map((r) => <Regle key={r.cle} libelle={r.libelle} satisfaite={r.test(valeur)} />)}
        </ul>

        <div className="flex justify-end">
          {/* Volontairement actif meme si une regle n'est pas satisfaite :
              le refus et son message viennent de l'API. */}
          <Button variant="primary" onClick={definir} isLoading={envoi === 'definir'} disabled={!valeur || enCours}>
            Définir
          </Button>
        </div>
      </section>

      <hr className="border-gray-100 dark:border-gray-700 mb-6" />

      {/* ---- 2. Génération ---- */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Générer un mot de passe</h3>

        {!genere ? (
          <>
            <p className="text-xs text-gray-500 mb-3">
              Un mot de passe conforme est produit et appliqué immédiatement. Il ne sera affiché qu&apos;une seule fois.
            </p>
            <Button variant="secondary" onClick={generer} isLoading={envoi === 'generer'} disabled={enCours}>
              <RefreshCw size={14} /> Générer
            </Button>
          </>
        ) : (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-2">
              Transmettez cette valeur maintenant, elle ne sera plus jamais affichée.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono bg-white dark:bg-gray-900 px-3 py-2 rounded border border-amber-200 dark:border-amber-800 break-all">
                {genere}
              </code>
              <Button variant="secondary" size="sm" onClick={() => copier(genere)}>
                {copie ? <><Check size={14} className="text-green-600" /> Copié</> : <><Copy size={14} /> Copier</>}
              </Button>
            </div>
          </div>
        )}
      </section>

      <hr className="border-gray-100 dark:border-gray-700 mb-6" />

      {/* ---- 3. Lien de réinitialisation ---- */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Réinitialisation par l&apos;utilisateur
        </h3>

        {!confirmeLien ? (
          <>
            <p className="text-xs text-gray-500 mb-3">
              Un lien à usage unique, valable 1 heure, permet à l&apos;utilisateur de choisir lui-même son mot de passe.
            </p>
            <Button variant="secondary" onClick={() => setConfirmeLien(true)} disabled={enCours}>
              <Mail size={14} /> Envoyer un lien de réinitialisation
            </Button>
          </>
        ) : (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              Envoyer un lien de réinitialisation à {utilisateur.prenom} {utilisateur.nom} ?
              Tout lien précédent sera invalidé.
            </p>
            <div className="flex gap-2">
              <Button variant="primary" onClick={envoyerLien} isLoading={envoi === 'lien'}>Confirmer</Button>
              <Button variant="secondary" onClick={() => setConfirmeLien(false)} disabled={enCours}>Annuler</Button>
            </div>
          </div>
        )}

        {lienTemporaire && (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-3">
            <p className="text-xs text-blue-800 dark:text-blue-300 mb-2">
              Le socle d&apos;envoi de mails n&apos;est pas encore en place : transmettez ce lien vous-même.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-white dark:bg-gray-900 px-2 py-1.5 rounded break-all">
                {lienTemporaire}
              </code>
              <Button variant="secondary" size="sm" onClick={() => copier(lienTemporaire)}>
                <Copy size={14} /> Copier
              </Button>
            </div>
          </div>
        )}
      </section>
    </Modal>
  );
}