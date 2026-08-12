// DesactivationModal - retrait d'un compte, immediat ou programme.
//
// La suppression d'utilisateur n'existe plus (migration 023) : un compte se
// retire en le desactivant, et se retrouve d'un clic. Deux formes :
//   - immediate : actif = false, la connexion est refusee des la validation ;
//   - programmee : date_finale, deja controlee au login et dans le calcul des
//     droits. Le compte reste pleinement actif jusqu'a cette date incluse,
//     aucune colonne supplementaire n'est necessaire.
import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';

const AUJOURDHUI = () => new Date().toISOString().slice(0, 10);

export default function DesactivationModal({ isOpen, utilisateur, onClose, onConfirm }) {
  const [mode, setMode] = useState('immediate');
  const [date, setDate] = useState('');
  const [envoi, setEnvoi] = useState(false);

  if (!utilisateur) return null;

  function fermer() {
    setMode('immediate');
    setDate('');
    onClose();
  }

  async function confirmer() {
    setEnvoi(true);
    try {
      // Immediate : actif = false, et toute echeance anterieure est effacee
      // pour que le statut affiche reste lisible.
      // Programmee : le compte reste actif, seule l'echeance change.
      await onConfirm(mode === 'immediate'
        // La date du jour est posee en meme temps que le retrait : sans elle,
        // une desactivation immediate ne laisserait aucune trace de sa date et
        // la colonne resterait vide pour la plupart des comptes retires.
        ? { actif: false, date_finale: AUJOURDHUI() }
        : { date_finale: date });
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
      title="Désactiver l'utilisateur"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={fermer} disabled={envoi}>Annuler</Button>
          <Button variant="destructive" onClick={confirmer} disabled={dateManquante || envoi} isLoading={envoi}>
            {mode === 'immediate' ? 'Désactiver maintenant' : 'Programmer la désactivation'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        {utilisateur.prenom} {utilisateur.nom} restera visible dans la liste et pourra être réactivé à tout moment.
      </p>

      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="radio" name="mode-desactivation" value="immediate" checked={mode === 'immediate'}
            onChange={() => setMode('immediate')} className="mt-0.5" />
          <span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Désactivation immédiate</span>
            <span className="block text-xs text-gray-500">La connexion est refusée dès la validation.</span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="radio" name="mode-desactivation" value="programmee" checked={mode === 'programmee'}
            onChange={() => setMode('programmee')} className="mt-0.5" />
          <span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Désactivation programmée</span>
            <span className="block text-xs text-gray-500">Le compte reste actif jusqu&apos;à la date choisie incluse.</span>
          </span>
        </label>

        {mode === 'programmee' && (
          <div className="pl-6">
            <FormField label="Dernier jour d'activité" required>
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
