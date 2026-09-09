// useContratsRef - liste des contrats en lecture seule, pour les écrans qui n'ont
  // besoin que d'un sélecteur ou d'un libellé de contrat (commandes, documents).
  // getContrat garde la signature du helper mock qu'il remplace, ce qui limite la
  // retouche des composants à la ligne d'import.
  import { useState, useEffect, useCallback, useMemo } from 'react';
  import { contratsService } from '../services/contratsService';

  export default function useContratsRef() {
    const [contrats, setContrats] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      try {
        setContrats(await contratsService.list());
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }, []);

    useEffect(() => { load(); }, [load]);

    const parId = useMemo(() => new Map(contrats.map(c => [c.id, c])), [contrats]);
    const getContrat = useCallback((id) => (id ? parId.get(id) ?? null : null), [parId]);

    return { contrats, getContrat, isLoading, error, reload: load };
  }
