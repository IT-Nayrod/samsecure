// useSuggestionsEditeurs - éditeurs déjà références qui correspondent à une
// saisie en cours. Habillage de useSuggestions, qui porte toute la mécanique :
// seul l'appel de recherche est propre aux éditeurs.
import { useCallback } from 'react';
import { editeursService } from '../services/referentielsService';
import useSuggestions from './useSuggestions';

export default function useSuggestionsEditeurs(saisie, options = {}) {
  const rechercher = useCallback(
    (texte, opts) => editeursService.rechercher(texte, opts), []);
  return useSuggestions(rechercher, saisie, options);
}