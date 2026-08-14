// StatutCompteModal - changement d'etat d'un compte, immediat ou programme.
//
// Un seul composant pour les deux sens, activation et desactivation : les deux
// gestes sont symetriques, et les separer ferait diverger deux formulaires qui
// doivent se comporter de la meme facon.
//
// La suppression d'utilisateur n'existe plus (migration 023) : un compte se
// retire en le desactivant, et se retrouve d'un clic.
//
//   Desactivation immediate  : actif = false, plus la date du jour, sans quoi
//                              la colonne Date de desactivation resterait vide.
//   Desactivation programmee : date_finale, deja controlee au login et dans le
//                              calcul des droits.
//   Activation immediate     : actif = true, toute echeance effacee.
//   Activation programmee    : actif = true ET date_mise_en_fonction future.
//
// Ce dernier cas merite une explication : le compte passe bien a actif = true
// des maintenant, ce qui peut surprendre. C'est necessaire. Aucun ordonnanceur
// n'existe dans le projet, rien ne s'execute a une date : ce sont le login et
// le calcul des droits qui evaluent date_mise_en_fonction a chaque appel et
// refusent l'acces avant l'echeance. Laisser actif = false en attendant la
// date ne produirait jamais aucune activation.
import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';

const AUJOURDHUI = () => new Date().toISOString().slice(0, 10);

// Tout ce qui distingue les deux sens tient dans cette table : le reste du
// composant est commun.
const TEXTES = {
  desactivation: {
    titre: "Désactiver l'utilisateur",
    variante: 'destructive',
    introduction: (u) => `${u.prenom} ${u.nom} restera visible dans la liste et pourra être réactivé à tout moment.`,
    labelImmediat: 'Désactivation immédiate',
    aideImmediat: 'La connexion est refusée dès la validation.',
    labelProgramme: 'Désactivation programmée',
    aideProgramme: "Le compte reste actif jusqu'à la date choisie incluse.",
    labelDate: "Dernier jour d'activité",
    boutonImmediat: 'Désactiver maintenant',
    boutonProgramme: 'Programmer la désactivation',
    payloadImmediat: () => ({ actif: false, date_finale: AUJOURDHUI() }),
    payloadProgramme: (date) => ({ date_finale: date }),
  },
  activation: {
    titre: "Réactiver l'utilisateur",
    variante: 'primary',
    introduction: (u) => `${u.prenom} ${u.nom} pourra de nouveau se connecter, avec ses groupes et rattachements actuels.`,
    labelImmediat: 'Réactivation immédiate',
    aideImmediat: 'La connexion est possible dès la validation.',
    labelProgramme: 'Activation programmée',
    aideProgramme: "La connexion reste refusée jusqu'à la date choisie.",
    labelDate: "Premier jour d'activité",
    boutonImmediat: 'Réactiver maintenant',
    boutonProgramme: "Programmer l'activation",
    // date_finale est effacee dans les deux cas : sans cela une echeance
    // depassee continuerait de bloquer la connexion malgre la reactivation.
    payloadImmediat: () => ({ actif: true, date_finale: null, date_mise_en_fonction: null }),
    payloadProgramme: (date) => ({ actif: true, date_finale: null, date_mise_en_fonction: date }),
  },
};

export default function StatutCompteModal({ isOpen, utilisateur, sens = 'desactivation', onClose, onConfirm }) {
  const [mode, setMode] = useState('immediate');
  const [date, setDate] = useState('');
  const [envoi, setEnvoi] = useState(false);

  if (!utilisateur) return null;
  const t = TEXTES[sens];

  function fermer() {
    setMode('immediate');
    setDate('');
    onClose();
  }

  async function confirmer() {
    setEnvoi(true);
    try {
      await onConfirm(mode === 'immediate' ? t.payloadImmediat() : t.payloadProgramme(date));
      fermer();
    } catch {
      // Le message d'erreur est deja affiche par l'appelant.
    } finally {
      setEnvoi(false);
    }
  }

  const dateManquante = mode === 'programmee' && !date;

  return (
    <Modal
      isOpen={isOpen}
      onClose={fermer}
      title={t.titre}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={fermer} disabled={envoi}>Annuler</Button>
          <Button variant={t.variante} onClick={confirmer} disabled={dateManquante || envoi} isLoading={envoi}>
            {mode === 'immediate' ? t.boutonImmediat : t.boutonProgramme}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{t.introduction(utilisateur)}</p>

      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="radio" name="mode-statut-compte" value="immediate" checked={mode === 'immediate'}
            onChange={() => setMode('immediate')} className="mt-0.5" />
          <span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{t.labelImmediat}</span>
            <span className="block text-xs text-gray-500">{t.aideImmediat}</span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="radio" name="mode-statut-compte" value="programmee" checked={mode === 'programmee'}
            onChange={() => setMode('programmee')} className="mt-0.5" />
          <span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{t.labelProgramme}</span>
            <span className="block text-xs text-gray-500">{t.aideProgramme}</span>
          </span>
        </label>

        {mode === 'programmee' && (
          <div className="pl-6">
            <FormField label={t.labelDate} required>
              <input
                type="date"
                value={date}
                min={AUJOURDHUI()}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </FormField>
          </div>
        )}
      </div>
    </Modal>
  );
}
