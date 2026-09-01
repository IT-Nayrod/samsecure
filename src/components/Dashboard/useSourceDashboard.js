// Cache de sources partagees entre widgets (#192).
//
// Plusieurs widgets d'un meme dashboard lisent la meme ressource (la liste
// des contrats sert deux widgets, la synthese budget deux autres, la
// conformite trois). Ce module ne charge chaque source qu'une fois et la
// distribue ; chaque widget garde neanmoins ses propres etats de chargement
// et d'erreur, et son bouton "Reessayer" relance la source pour tous ses
// consommateurs. Le cache est vide a chaque montage de DashboardPage : les
// donnees sont fraiches a chaque visite, jamais figees d'une navigation a
// l'autre.
import { useEffect, useReducer } from 'react';

const sources = new Map();

function entree(cle) {
  if (!sources.has(cle)) {
    sources.set(cle, {
      statut: 'inactif', data: null, erreur: null, chargeur: null, abonnes: new Set(),
    });
  }
  return sources.get(cle);
}

function notifier(e) {
  for (const fn of e.abonnes) fn();
}

function charger(cle) {
  const e = entree(cle);
  if (!e.chargeur || e.statut === 'chargement' || e.statut === 'charge') return;
  e.statut = 'chargement';
  e.erreur = null;
  notifier(e);
  e.chargeur().then(
    (data) => { e.data = data; e.statut = 'charge'; notifier(e); },
    (erreur) => { e.erreur = erreur; e.statut = 'erreur'; notifier(e); },
  );
}

export function relancerSource(cle) {
  const e = entree(cle);
  if (e.statut === 'chargement') return;
  e.statut = 'inactif';
  e.data = null;
  e.erreur = null;
  charger(cle);
}

export function viderSourcesDashboard() {
  for (const e of sources.values()) {
    if (e.statut !== 'chargement') {
      e.statut = 'inactif';
      e.data = null;
      e.erreur = null;
    }
  }
}

// cle : identifiant de la source, parametres compris (ex : "conformite:tout",
// "budget-synthese:2026-01-01:2026-12-31"). chargeur : fonction sans argument
// renvoyant la promesse de donnees. Deux widgets qui donnent la meme cle
// doivent donner un chargeur equivalent : le dernier monte gagne.
export default function useSourceDashboard(cle, chargeur) {
  const [, maj] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    const e = entree(cle);
    e.chargeur = chargeur;
    e.abonnes.add(maj);
    charger(cle);
    return () => { e.abonnes.delete(maj); };
    // Le chargeur est volontairement hors dependances : il est recree a chaque
    // rendu mais ne varie qu'avec la cle, qui porte tous les parametres.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  const e = entree(cle);
  return {
    data: e.data,
    chargement: e.statut === 'chargement' || e.statut === 'inactif',
    erreur: e.erreur,
    relancer: () => relancerSource(cle),
  };
}
