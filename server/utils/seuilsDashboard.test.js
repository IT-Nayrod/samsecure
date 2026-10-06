// Tests des règles pures de l'édition des seuils de dashboard.
// Exécution : node --test server/utils/seuilsDashboard.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { validerValeurSeuil, verifierCoherenceSeuil } from "./seuilsDashboard.js";

test("validerValeurSeuil accepte un nombre positif ou nul", () => {
  assert.equal(validerValeurSeuil(0), null);
  assert.equal(validerValeurSeuil(10.5), null);
  assert.equal(validerValeurSeuil(9999999999.99), null);
});

test("validerValeurSeuil refuse ce qui n'est pas un nombre fini", () => {
  assert.notEqual(validerValeurSeuil("10"), null);
  assert.notEqual(validerValeurSeuil(NaN), null);
  assert.notEqual(validerValeurSeuil(Infinity), null);
  assert.notEqual(validerValeurSeuil(null), null);
  assert.notEqual(validerValeurSeuil(undefined), null);
});

test("validerValeurSeuil refuse le négatif et le dépassement du DECIMAL(12,2)", () => {
  assert.notEqual(validerValeurSeuil(-1), null);
  assert.notEqual(validerValeurSeuil(10000000000), null);
});

const HAUT = [
  { echelle: 1, valeur: 0, direction: "haut" },
  { echelle: 2, valeur: 10, direction: "haut" },
  { echelle: 3, valeur: 20, direction: "haut" },
  { echelle: 4, valeur: 30, direction: "haut" },
];

test("direction haut : une valeur qui respecte la croissance passe", () => {
  assert.equal(verifierCoherenceSeuil(HAUT, 2, 15), null);
  // L'égalité est admise (seuil N <= seuil N+1).
  assert.equal(verifierCoherenceSeuil(HAUT, 2, 20), null);
  assert.equal(verifierCoherenceSeuil(HAUT, 2, 0), null);
});

test("direction haut : une valeur qui casse la croissance est refusée", () => {
  assert.notEqual(verifierCoherenceSeuil(HAUT, 2, 25), null);
  assert.notEqual(verifierCoherenceSeuil(HAUT, 1, 11), null);
  assert.notEqual(verifierCoherenceSeuil(HAUT, 4, 19), null);
});

const BAS = [
  { echelle: 1, valeur: 3, direction: "bas" },
  { echelle: 2, valeur: 2, direction: "bas" },
  { echelle: 3, valeur: 1, direction: "bas" },
  { echelle: 4, valeur: 0, direction: "bas" },
];

test("direction bas : une valeur qui respecte la décroissance passe", () => {
  assert.equal(verifierCoherenceSeuil(BAS, 1, 6), null);
  assert.equal(verifierCoherenceSeuil(BAS, 2, 3), null);
  assert.equal(verifierCoherenceSeuil(BAS, 4, 0), null);
});

test("direction bas : une valeur qui casse la décroissance est refusée", () => {
  assert.notEqual(verifierCoherenceSeuil(BAS, 3, 2.5), null);
  assert.notEqual(verifierCoherenceSeuil(BAS, 1, 1), null);
});

test("échelle unique ou direction inconnue : aucune contrainte d'ordre", () => {
  assert.equal(verifierCoherenceSeuil([{ echelle: 1, valeur: 90, direction: "max" }], 1, 50), null);
  assert.equal(verifierCoherenceSeuil([], 1, 50), null);
  assert.equal(verifierCoherenceSeuil(null, 1, 50), null);
});
