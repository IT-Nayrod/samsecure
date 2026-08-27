// useSuggestionsEditeurs - editeurs deja references qui correspondent a une
// saisie en cours.
//
// Raison d'etre : le referentiel peut compter des milliers d'editeurs. Personne
// ne peut verifier de visu qu'un editeur en est absent, et le doublon nait de
// cette impossibilite, pas d'une inattention. Les suggestions se montrent
// pendant la frappe, la ou l'erreur se commet, et non a l'enregistrement, ou la
// contrainte d'unicite rendrait un 409 apres coup.
//
// Le hook ne decide rien : il rend ce qui existe. C'est l'ecran qui choisit
// quoi en faire.
import { useState, useEffect, useRef } from 'react';
import { editeursService } from '../services/referentielsService';
import useDebounce from './useDebounce';

export default function useSuggestionsEditeurs(saisie, { exclureId, actif = true, delai = 250 } = {}) {
  const valeur = useDebounce(saisie ?? '', delai);
  const [suggestions, setSuggestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(false);
  // Numero de la derniere requete lancee. Une frappe rapide en declenche
  // plusieurs, dont les reponses peuvent revenir dans le desordre : sans ce
  // garde-fou, une reponse ancienne ecraserait une plus recente et l'ecran
  // afficherait les suggestions d'un texte deja efface.
  const derniere = useRef(0);

  useEffect(() => {
    const texte = valeur.trim();
    if (!actif || !texte) {
      setSuggestions([]);
      setTotal(0);
      setChargement(false);
      return;
    }

    const numero = ++derniere.current;
    let annule = false;
    setChargement(true);

    editeursService.rechercher(texte, { exclure: exclureId })
      .then(reponse => {
        if (annule || numero !== derniere.current) return;
        setSuggestions(reponse.suggestions ?? []);
        setTotal(reponse.total ?? 0);
      })
      .catch(err => {
        if (annule || numero !== derniere.current) return;
        // Une suggestion est une commodite : son echec ne doit jamais empecher
        // la saisie. L'ecart reste visible en console, et l'unicite est de
        // toute facon garantie par la base a l'enregistrement.
        console.info('[suggestions] recherche indisponible :', err.message);
        setSuggestions([]);
        setTotal(0);
      })
      .finally(() => {
        if (!annule && numero === derniere.current) setChargement(false);
      });

    return () => { annule = true; };
  }, [valeur, exclureId, actif]);

  // Correspondance exacte a la casse pres : c'est le doublon franc, celui que
  // la base refusera. L'ecran s'en sert pour prevenir avant l'envoi.
  const exact = suggestions.find(e => e.exact) ?? null;

  return { suggestions, total, chargement, exact };
}
