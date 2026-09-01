// Tests de la fonction pure de l'indice de confiance (US #116).
// Execution : node --test server/utils/indiceConfiance.test.js
// (hors du npm test racine, qui ne couvre que src/utils : le perimetre
// serveur n'a pas de script de test dedie a ce jour).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calculerIndiceConfiance, LIENS_EXHAUSTIVITE } from "./indiceConfiance.js";

const licenceComplete = (id, valeur, extra = {}) => ({
  id, valeur,
  a_commande: true, a_justificatif: true, a_contrat: true, a_societe_signataire: true,
  a_anomalie: false,
  ...extra,
});

describe("calculerIndiceConfiance", () => {
  test("perimetre vide : notes a 100, aucun malus", () => {
    const r = calculerIndiceConfiance({ licences: [], affectations: [] });
    assert.equal(r.indice, 100);
    assert.equal(r.exhaustivite, 100);
    assert.equal(r.coherence, 100);
    assert.equal(r.fraicheur, 100);
    assert.equal(r.valeur_totale, 0);
    assert.deepEqual(r.malus, []);
  });

  test("parc complet et frais : 100 partout", () => {
    const r = calculerIndiceConfiance({
      licences: [licenceComplete("l1", 1000), licenceComplete("l2", 500)],
      affectations: [{ id: "a1", valeur: 300, fraiche: true }],
    });
    assert.equal(r.indice, 100);
    assert.equal(r.valeur_totale, 1500);
    assert.deepEqual(r.malus, []);
  });

  test("exhaustivite ponderee par la valeur : un lien manquant sur 4", () => {
    // 1000 complet + 1000 sans commande : (1000 x 1 + 1000 x 3/4) / 2000 = 87.5
    const r = calculerIndiceConfiance({
      licences: [
        licenceComplete("l1", 1000),
        licenceComplete("l2", 1000, { a_commande: false }),
      ],
      affectations: [],
    });
    assert.equal(r.exhaustivite, 87.5);
    // indice = 0.4 x 87.5 + 0.3 x 100 + 0.3 x 100 = 95
    assert.equal(r.indice, 95);
    const m = r.malus.find((x) => x.composante === "exhaustivite");
    assert.equal(m.entite_type, "licence");
    assert.deepEqual(m.entite_ids, ["l2"]);
    // points perdus : 0.4 x (1000/4) / 2000 x 100 = 5
    assert.equal(m.points, 5);
  });

  test("licence sans aucun lien : les 4 malus sortent et se somment", () => {
    const r = calculerIndiceConfiance({
      licences: [licenceComplete("l1", 800, {
        a_commande: false, a_justificatif: false, a_contrat: false, a_societe_signataire: false,
      })],
      affectations: [],
    });
    assert.equal(r.exhaustivite, 0);
    const malusEx = r.malus.filter((m) => m.composante === "exhaustivite");
    assert.equal(malusEx.length, LIENS_EXHAUSTIVITE.length);
    assert.equal(malusEx.reduce((s, m) => s + m.points, 0), 40);
  });

  test("coherence : un objet multi-anomalies compte une fois", () => {
    // Le drapeau a_anomalie est deja "au moins une anomalie ouverte" : la
    // valeur de l2 ne sort qu'une fois, quel que soit le nombre d'anomalies.
    const r = calculerIndiceConfiance({
      licences: [
        licenceComplete("l1", 750),
        licenceComplete("l2", 250, { a_anomalie: true }),
      ],
      affectations: [],
    });
    assert.equal(r.coherence, 75);
    const m = r.malus.find((x) => x.composante === "coherence");
    assert.deepEqual(m.entite_ids, ["l2"]);
    // points perdus : 0.3 x (100 - 75) = 7.5
    assert.equal(m.points, 7.5);
  });

  test("fraicheur ponderee par la valeur des affectations", () => {
    const r = calculerIndiceConfiance({
      licences: [licenceComplete("l1", 1000)],
      affectations: [
        { id: "a1", valeur: 900, fraiche: true },
        { id: "a2", valeur: 100, fraiche: false },
      ],
    });
    assert.equal(r.fraicheur, 90);
    // indice = 0.4 x 100 + 0.3 x 100 + 0.3 x 90 = 97
    assert.equal(r.indice, 97);
    const m = r.malus.find((x) => x.composante === "fraicheur");
    assert.equal(m.entite_type, "affectation");
    assert.deepEqual(m.entite_ids, ["a2"]);
    assert.equal(m.points, 3);
  });

  test("valeur totale nulle : notes a 100, objets concernes listes a 0 point", () => {
    const r = calculerIndiceConfiance({
      licences: [licenceComplete("l1", 0, { a_commande: false })],
      affectations: [{ id: "a1", valeur: 0, fraiche: false }],
    });
    assert.equal(r.indice, 100);
    const m = r.malus.find((x) => x.composante === "exhaustivite");
    assert.deepEqual(m.entite_ids, ["l1"]);
    assert.equal(m.points, 0);
    const f = r.malus.find((x) => x.composante === "fraicheur");
    assert.deepEqual(f.entite_ids, ["a1"]);
  });

  test("valeurs absentes traitees comme zero, sans NaN", () => {
    const r = calculerIndiceConfiance({
      licences: [licenceComplete("l1", undefined), licenceComplete("l2", 100)],
      affectations: [{ id: "a1", valeur: null, fraiche: true }],
    });
    assert.equal(Number.isFinite(r.indice), true);
    assert.equal(r.valeur_totale, 100);
  });
});
