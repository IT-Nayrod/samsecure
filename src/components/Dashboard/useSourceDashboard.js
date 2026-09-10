// Cache de sources partagées entre widgets (#192).
//
// Plusieurs widgets d'un même dashboard lisent la même ressource (la liste
// des contrats sert deux widgets, la synthèse budget deux autres, la
// conformité trois). Ce module ne charge chaque source qu'une fois et la
// distribue ; chaque widget garde néanmoins ses propres états de chargement
// et d'erreur, et son bouton "Reessayer" relance la source pour tous ses
// consommateurs. Le cache est vide à chaque montage de DashboardPage : les
// données sont fraîches à chaque visite, jamais figées d'une navigation à
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

// clé : identifiant de la source, paramètres compris (ex : "conformite:tout",
// "budget-synthese:2026-01-01:2026-12-31"). chargeur : fonction sans argument
// renvoyant la promesse de données. Deux widgets qui donnent la même clé
// doivent donner un chargeur équivalent : le dernier monté gagne.
export default function useSourceDashboard(cle, chargeur) {
  const [, maj] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    const e = entree(cle);
    e.chargeur = chargeur;
    e.abonnes.add(maj);
    charger(cle);
    return () => { e.abonnes.delete(maj); };
    // Le chargeur est volontairement hors dépendances : il est recréé à chaque
    // rendu mais ne varie qu'avec la clé, qui porte tous les paramètres.
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
