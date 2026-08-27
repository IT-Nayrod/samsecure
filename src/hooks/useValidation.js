// useValidation - geste de validation commun aux trois blocs du module 2.
// Le comportement doit etre identique sur contrats, commandes et documents :
// il vit donc ici et non recopie dans six pages.
import { useCallback } from 'react';
import { validationService } from '../services/validationService';
import { useToast } from './useToast';

export default function useValidation(onTraite) {
  const { addToast } = useToast();

  const traiter = useCallback(async (action, entiteType, id, motif) => {
    try {
      const reponse = action === 'valider'
        ? await validationService.valider(entiteType, id)
        : await validationService.refuser(entiteType, id, motif);
      addToast({ type: 'success', message: action === 'valider' ? 'Saisie validée.' : 'Saisie refusée.' });
      onTraite(reponse);
      return reponse;
    } catch (err) {
      // Message du serveur affiche tel quel, y compris le 409 "Seule une saisie
      // en attente peut etre traitee" quand un autre onglet a deja tranche.
      addToast({ type: 'error', message: err.message, persistent: true });
      throw err;   // laisse ValidationActions garder sa modale ouverte
    }
  }, [addToast, onTraite]);

  return {
    valider: (entiteType, id) => traiter('valider', entiteType, id),
    refuser: (entiteType, id, motif) => traiter('refuser', entiteType, id, motif),
  };
}
