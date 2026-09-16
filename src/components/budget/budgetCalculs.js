// Fonctions pures du module budget (page et fiches).
// Aucun import React, aucune donnée. Formats d'affichage, paramétrés de période
// pour l'API, périmètre d'organisation (hiérarchie servie par /societes) et
// cumul des synthèses servies par l'API quand la vue consolidée impose un appel
// par société (le routeur n'accepte qu'un seul id_societe).
// Les montants, engagés, écarts et taux viennent de l'API : rien n'est
// recalculé à partir des lignes ici.

import { libelleContrat } from '../contrats/libelleContrat';

export const TOTAUX_VIDES = Object.freeze({
  previsionnel_capex: 0, previsionnel_opex: 0, previsionnel: 0,
  alloue_capex: 0, alloue_opex: 0, alloue: 0,
  engage: 0, nb_commandes: 0,
  ecart_previsionnel_alloue: 0, ecart_alloue_engage: 0, taux_engagement: null,
});

const CLES_SOMMEES = [
  'previsionnel_capex', 'previsionnel_opex', 'previsionnel',
  'alloue_capex', 'alloue_opex', 'alloue', 'engage', 'nb_commandes',
];

const centime = (x) => Math.round(x * 100) / 100;

export function formatEuros(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n));
}

export function formatPourcentage(taux) {
  if (taux === null || taux === undefined || Number.isNaN(Number(taux))) return '-';
  return `${Number(taux).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

/** 'YYYY-MM-DD' -> 'JJ/MM/AAAA' sans passer par Date (pas de dérive de fuseau). */
export function formatDateIso(iso) {
  if (!iso || typeof iso !== 'string') return '-';
  const [a, m, j] = iso.slice(0, 10).split('-');
  if (!a || !m || !j) return iso;
  return `${j}/${m}/${a}`;
}

export function libelleType(type) {
  return type === 'alloue' ? 'Alloué' : 'Prévisionnel';
}

/** Libelle d'une licence (projection /licences ou ligne /budget) : produit, lot, éditeur, contrat. */
export function libelleLicence(l) {
  if (!l) return '';
  const lot = l.label ?? l.licence_label ?? null;
  const produit = l.produit_label ?? null;
  const nom = produit && lot && lot !== produit ? `${produit} (${lot})` : (produit ?? lot ?? l.id ?? '');
  return [nom, l.editeur_label, libelleContrat(l.contrat_label, l.contrat_societe_label)].filter(Boolean).join(' - ');
}

/** Paramètres de plage attendus par l'API à partir d'une période résolue par PeriodeSelector. */
export function parametresPeriode(periode) {
  if (!periode?.dateDebut || !periode?.dateFin) return {};
  return { date_debut: periode.dateDebut, date_fin: periode.dateFin };
}

/**
 * Exercice cible du préremplissage : l'année de démarrage de la période
 * sélectionnée (clé des périodes annuelles), sinon l'année du premier jour
 * (trimestre).
 */
export function exerciceDePeriode(periode) {
  if (!periode) return undefined;
  const cle = Number(periode.cle);
  if (Number.isInteger(cle)) return cle;
  return periode.debut instanceof Date ? periode.debut.getFullYear() : undefined;
}

/**
 * Ids des filiales directes et indirectes (clé id_societe_parent de /societes).
 * `vues` garde la récursion contre un cycle de la hiérarchie servie.
 */
export function descendantes(idSociete, societes = [], vues = new Set([idSociete])) {
  const directes = societes.filter(s => s.id_societe_parent === idSociete && !vues.has(s.id)).map(s => s.id);
  for (const id of directes) vues.add(id);
  return directes.flatMap(id => [id, ...descendantes(id, societes, vues)]);
}

/**
 * Périmètre du sélecteur d'organisation :
 *   null              -> toutes les organisations (aucun filtre)
 *   [id]              -> la société seule
 *   [id, ...filiales] -> la société et ses filiales (consolidation)
 */
export function perimetreSocietes(idSociete, consolider, societes = []) {
  if (!idSociete) return null;
  return consolider ? [idSociete, ...descendantes(idSociete, societes)] : [idSociete];
}

/**
 * Cumul de plusieurs totaux de synthèse (un par société du périmètre), avec
 * les mêmes formules que l'API pour les écarts et le taux : écarts sur les
 * totaux CAPEX + OPEX, taux null sans alloué.
 */
export function cumulerTotaux(liste = []) {
  const t = { ...TOTAUX_VIDES };
  for (const x of liste) {
    if (!x) continue;
    for (const c of CLES_SOMMEES) t[c] += Number(x[c] ?? 0);
  }
  for (const c of CLES_SOMMEES) if (c !== 'nb_commandes') t[c] = centime(t[c]);
  t.ecart_previsionnel_alloue = centime(t.alloue - t.previsionnel);
  t.ecart_alloue_engage = centime(t.alloue - t.engage);
  t.taux_engagement = t.alloue > 0 ? centime((t.engage / t.alloue) * 100) : null;
  return t;
}

export function cumulerNbLignes(liste = []) {
  const n = { previsionnel: 0, alloue: 0 };
  for (const x of liste) {
    if (!x) continue;
    n.previsionnel += Number(x.previsionnel ?? 0);
    n.alloue += Number(x.alloue ?? 0);
  }
  return n;
}

/** Code couleur du pourcentage réalisé (barres de progression et taux d'engagement). */
export function classesRealisation(pct) {
  if (pct > 100) return { barColor: 'bg-red-700', textColor: 'text-red-700 dark:text-red-400' };
  if (pct >= 91) return { barColor: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400' };
  if (pct >= 76) return { barColor: 'bg-orange-400', textColor: 'text-orange-600 dark:text-orange-400' };
  return { barColor: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400' };
}

/** Une synthèse sans aucun montant ni engagé n'a rien à montrer. */
export function totauxVides(t) {
  if (!t) return true;
  return !(t.previsionnel || t.alloue || t.engage);
}

/** Motifs d'une base de préremplissage vide, tels que codes par l'API. */
export const MOTIFS_BASE_VIDE = {
  maintenance_arretee: 'la maintenance de cette licence est arrêtée',
  maintenance_absente: 'cette licence est sans maintenance',
  aucune_periode_en_cours: 'aucune période de maintenance n’est en cours à ce jour',
};
