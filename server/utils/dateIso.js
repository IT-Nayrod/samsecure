// Validation d'une date calendaire au format ISO AAAA-MM-JJ, sans heure ni
// fuseau. Règle pure, partagée par les routeurs qui reçoivent une date saisie
// (preuves.js et factures.js pour la date de la preuve, #214) : le motif seul
// laisserait passer 2026-02-31, que Postgres refuserait en 22008 brute remontée
// en 500 ; l'aller-retour par Date, en UTC pour ne subir aucun glissement de
// fuseau, tranche le calendrier (années bissextiles comprises).
// Test : node --test server/utils/dateIso.test.js (hors du npm test racine,
// comme conformite.test.js).
const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dateIsoValide(valeur) {
  if (typeof valeur !== "string" || !DATE_ISO_RE.test(valeur)) return false;
  const t = Date.parse(`${valeur}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === valeur;
}
