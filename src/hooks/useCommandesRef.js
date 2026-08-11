// useCommandesRef - liste des commandes en lecture, pour les ecrans qui n'ont
// besoin que d'un selecteur ou d'un libelle de commande (documents).
// Pendant de useContratsRef : getCommande garde la signature du helper mock
// qu'il remplace, ce qui limite la retouche a la ligne d'import.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { commandesService } from '../services/commandesService';

export default function useCommandesRef() {
  const [commandes, setCommandes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setCommandes(await commandesService.list());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const parId = useMemo(() => new Map(commandes.map(k => [k.id, k])), [commandes]);
  const getCommande = useCallback((id) => (id ? parId.get(id) ?? null : null), [parId]);

  return { commandes, getCommande, isLoading, error, reload: load };
}
