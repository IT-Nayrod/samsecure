// HistoriqueModal - trace probante d'un compte, en lecture seule.
//
// Les libelles viennent de l'API et sont affiches tels quels : leur redaction
// est un contrat cote serveur, la reformuler ici ferait diverger deux sources
// pour un meme evenement.
//
// Seul l'horodatage est mis en forme localement, et c'est necessaire : le
// serveur tourne en UTC et son champ "horodatage" affiche 11:10 pour une
// action faite a 13:10 heure de Paris. On repart donc de created_at, en ISO,
// que formatDateTime rend dans le fuseau du navigateur.
import { useState, useEffect, useCallback } from 'react';
import { History } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import { usersService } from '../../services/adminService';
import { formatDateTime } from '../../utils/dateUtils';

export default function HistoriqueModal({ isOpen, utilisateur, onClose }) {
  const [evenements, setEvenements] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [chargeSuite, setChargeSuite] = useState(false);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);

  // charger(1) remplace la liste, charger(n) l'etend : le bouton Voir plus
  // empile les pages au lieu de naviguer, l'historique se lit d'un trait.
  const charger = useCallback(async (numero) => {
    if (!utilisateur) return;
    if (numero === 1) { setIsLoading(true); setError(null); setErrorStatus(null); }
    else setChargeSuite(true);
    try {
      const rep = await usersService.historique(utilisateur.id, numero);
      setEvenements((prev) => (numero === 1 ? rep.evenements : [...prev, ...rep.evenements]));
      setPage(rep.page);
      setPages(rep.pages);
      setTotal(rep.total);
    } catch (err) {
      // Message du serveur affiche tel quel, y compris le refus de droit.
      setError(err.message);
      setErrorStatus(err.status);
    } finally {
      setIsLoading(false);
      setChargeSuite(false);
    }
  }, [utilisateur]);

  // Rechargement a chaque ouverture : un historique affiche doit etre a jour,
  // pas figé sur l'etat du dernier affichage.
  useEffect(() => {
    if (!isOpen) return;
    setEvenements([]);
    setPage(1);
    charger(1);
  }, [isOpen, charger]);

  if (!utilisateur) return null;

  const resteAPage = page < pages;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Historique du compte"
      size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Fermer</Button>}
    >
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {utilisateur.prenom} {utilisateur.nom}
        {total > 0 && <span className="ml-2 text-xs">{total} événement{total > 1 ? 's' : ''}</span>}
      </p>

      {isLoading && <Skeleton lines={6} height="h-8" />}

      {!isLoading && error && (
        <ErrorState message={error} status={errorStatus} onRetry={() => charger(1)} />
      )}

      {!isLoading && !error && evenements.length === 0 && (
        <EmptyState
          icon={History}
          title="Aucun événement"
          description="Aucune action n'a été enregistrée sur ce compte."
        />
      )}

      {!isLoading && !error && evenements.length > 0 && (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
          {evenements.map((e) => (
            <li key={e.id ?? `${e.action}-${e.created_at}`} className="flex items-start gap-4 py-2.5">
              {/* tabular-nums : les horodatages restent alignes d'une ligne a
                  l'autre malgre la largeur variable des chiffres. */}
              <span className="text-xs text-gray-400 whitespace-nowrap tabular-nums pt-0.5">
                {formatDateTime(e.created_at)}
              </span>
              <span className="text-sm text-gray-800 dark:text-gray-200">{e.libelle}</span>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && !error && resteAPage && (
        <div className="flex justify-center mt-4">
          <Button variant="secondary" onClick={() => charger(page + 1)} isLoading={chargeSuite}>
            Voir plus
          </Button>
        </div>
      )}

      {!isLoading && !error && (
        <p className="text-xs text-gray-400 mt-5 pt-3 border-t border-gray-100 dark:border-gray-700">
          Historique des 6 derniers mois.
        </p>
      )}
    </Modal>
  );
}