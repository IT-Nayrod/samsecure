// useSuggestions - éléments déjà références qui correspondent à une saisie en
// cours, quel que soit le référentiel interrogé.
//
// Raison d'être : un référentiel peut compter des milliers de lignes. Personne
// ne peut vérifier de visu qu'une fiche en est absente, et le doublon naît de
// cette impossibilité, pas d'une inattention. Les suggestions se montrent
// pendant la frappe, là où l'erreur se commet, et non à l'enregistrement, ou la
// contrainte d'unicité rendrait un 409 après coup.
//
// Le hook ne décide rien : il rend ce qui existe. C'est l'écran qui choisit
// quoi en faire.
import { useState, useEffect, useRef } from 'react';
import useDebounce from './useDebounce';

// rechercher : (texte, { exclure }) => Promise<{ suggestions, total }>
export default function useSuggestions(rechercher, saisie, { exclureId, actif = true, delai = 250 } = {}) {
  const valeur = useDebounce(saisie ?? '', delai);
  const [suggestions, setSuggestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(false);
  // Numéro de la dernière requête lancée. Une frappe rapide en déclenche
  // plusieurs, dont les réponses peuvent revenir dans le désordre : sans ce
  // garde-fou, une réponse ancienne écraserait une plus récente et l'écran
  // afficherait les suggestions d'un texte déjà effacé.
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

    rechercher(texte, { exclure: exclureId })
      .then(reponse => {
        if (annule || numero !== derniere.current) return;
        setSuggestions(reponse.suggestions ?? []);
        setTotal(reponse.total ?? 0);
      })
      .catch(err => {
        if (annule || numero !== derniere.current) return;
        // Une suggestion est une commodité : son échec ne doit jamais empêcher
        // la saisie. L'écart reste visible en console, et l'unicité est de
        // toute façon garantie par la base à l'enregistrement.
        console.info('[suggestions] recherche indisponible :', err.message);
        setSuggestions([]);
        setTotal(0);
      })
      .finally(() => {
        if (!annule && numero === derniere.current) setChargement(false);
      });

    return () => { annule = true; };
    // rechercher est volontairement hors dépendances : les services exposent
    // des fonctions recréées à chaque rendu, les y mettre relancerait une
    // requête à chaque frappe, debounce compris.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur, exclureId, actif]);

  // Correspondance exacte à la casse et aux accents près : c'est le doublon
  // franc, celui que la base refusera. L'écran s'en sert pour prévenir avant
  // l'envoi.
  const exact = suggestions.find(e => e.exact) ?? null;

  return { suggestions, total, chargement, exact };
}