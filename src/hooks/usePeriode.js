// État type x fenêtre et période résolue, sans interface (US #164).
// Pour les consommateurs qui portent leur propre commande (fiches, rapports, query params)
// ou qui veulent piloter <PeriodeSelector> en mode contrôlé.
//
//   const { periode, type, fenetre, setType, setFenetre } = usePeriode({ societe, type: 'fiscale' });
//   periode.dateDebut / periode.dateFin (ISO) pour l'API, periode.debut / periode.fin (Date) pour les filtres.
import { useState, useMemo } from 'react';
import { resoudrePeriode, normaliserDebutExercice } from '../utils/periode';

export default function usePeriode({
  type: typeInitial = 'calendaire',
  fenetre: fenetreInitiale = 'courant',
  societe = null,
  debutExercice = null,
  reference = null,
} = {}) {
  const [type, setType] = useState(typeInitial);
  const [fenetre, setFenetre] = useState(fenetreInitiale);

  // debutExercice explicite prime sur la société (objet portant debut_exercice_fiscal).
  // Memo sur la clé jour/mois : les objets société changent d'identité à chaque rechargement.
  const { jour, mois } = normaliserDebutExercice(debutExercice ?? societe);
  const periode = useMemo(
    () => resoudrePeriode({ type, fenetre, debutExercice: { jour, mois }, reference: reference ?? new Date() }),
    [type, fenetre, jour, mois, reference]
  );

  return { periode, type, fenetre, setType, setFenetre };
}
