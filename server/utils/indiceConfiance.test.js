// Tests de la fonction pure de l'indice de confiance (US #116, formule
// révisée le 10/09/2026, #190).
// Exécution : node --test server/utils/indiceConfiance.test.js
// (hors du npm test racine, qui ne couvre que src/utils : le périmètre
// serveur n'a pas de script de test dédié à ce jour).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calculerIndiceConfiance, LIENS_EXHAUSTIVITE, PART_PLANCHER } from "./indiceConfiance.js";

const licenceComplete = (id, valeur, extra = {}) => ({
  id, valeur,
  a_commande: true, a_justificatif: true, a_contrat: true, a_societe_signataire: true,
  a_anomalie: false,
  ...extra,
});

describe("calculerIndiceConfiance", () => {
  test("perimetre vide : notes a 100, aucun malus, plancher a une unite", () => {
    const r = calculerIndiceConfiance({ licences: [], affectations: [], anomalies: [] });
    assert.equal(r.indice, 100);
    assert.equal(r.exhaustivite, 100);
    assert.equal(r.coherence, 100);
    assert.equal(r.fraicheur, 100);
    assert.equal(r.valeur_totale, 0);
    assert.equal(r.plancher, 1);
    assert.equal(r.nb_objets_anomalie, 0);
    assert.deepEqual(r.malus, []);
  });

  test("parc complet, sain et frais : 100 partout, plancher a 1 pour cent du parc", () => {
    const r = calculerIndiceConfiance({
      licences: [licenceComplete("l1", 1000), licenceComplete("l2", 500)],
      affectations: [{ id: "a1", valeur: 300, fraiche: true }],
    });
    assert.equal(r.indice, 100);
    assert.equal(r.valeur_totale, 1500);
    assert.equal(r.plancher, 1500 * PART_PLANCHER);
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

  test("coherence : un objet multi-anomalies compte une fois, drapeau ou liste", () => {
    const licences = [
      licenceComplete("l1", 750),
      licenceComplete("l2", 250, { a_anomalie: true, id_commande: "c2" }),
    ];
    const r = calculerIndiceConfiance({ licences, affectations: [] });
    assert.equal(r.coherence, 75);
    const m = r.malus.find((x) => x.composante === "coherence");
    assert.deepEqual(m.entite_ids, ["l2"]);
    // points perdus : 0.3 x (100 - 75) = 7.5
    assert.equal(m.points, 7.5);

    // Trois anomalies visant la même licence (directement et par sa
    // commande) ne la sortent qu'une fois de la valeur saine.
    const r2 = calculerIndiceConfiance({
      licences: licences.map((l) => ({ ...l, a_anomalie: false })),
      affectations: [],
      anomalies: [
        { entite_type: "licence", entite_id: "l2" },
        { entite_type: "licence", entite_id: "l2" },
        { entite_type: "commande", entite_id: "c2" },
      ],
    });
    assert.equal(r2.coherence, 75);
    assert.equal(r2.nb_objets_anomalie, 1);
    assert.equal(r2.malus.filter((x) => x.composante === "coherence").length, 1);
  });

  test("coherence : une anomalie sur la chaine (commande, contrat) marque la licence, sans objet en plus", () => {
    const r = calculerIndiceConfiance({
      licences: [
        licenceComplete("l1", 600, { id_commande: "c1", id_contrat: "k1" }),
        licenceComplete("l2", 400, { id_commande: "c2", id_contrat: "k1" }),
      ],
      affectations: [],
      anomalies: [{ entite_type: "contrat", entite_id: "k1" }],
    });
    // Les deux licences du contrat k1 sortent : rien de sain.
    assert.equal(r.coherence, 0);
    assert.equal(r.nb_objets_anomalie, 2);
    const m = r.malus.filter((x) => x.composante === "coherence");
    assert.equal(m.length, 1);
    assert.deepEqual(m[0].entite_ids, ["l1", "l2"]);
    assert.equal(m[0].points, 30);
  });

  test("coherence : une anomalie sur un objet sans licence reliee pese le plancher", () => {
    // Parc 1000, plancher 10 : (1000) / (1000 + 10) = 99.0099 -> 99.0
    const r = calculerIndiceConfiance({
      licences: [licenceComplete("l1", 1000, { id_commande: "c1", id_contrat: "k1" })],
      affectations: [],
      anomalies: [{ entite_type: "contrat", entite_id: "k-sans-licence" }],
    });
    assert.equal(r.coherence, 99);
    // indice = 40 + 0.3 x 99 + 30 = 99.7 : jamais 100 avec une anomalie ouverte
    assert.equal(r.indice, 99.7);
    assert.equal(r.nb_objets_anomalie, 1);
    const m = r.malus.find((x) => x.composante === "coherence");
    assert.equal(m.entite_type, "contrat");
    assert.deepEqual(m.entite_ids, ["k-sans-licence"]);
    assert.equal(m.points, 0.3);
  });

  test("coherence : objets de plusieurs types, dedoublonnes, valeur transmise respectee", () => {
    const r = calculerIndiceConfiance({
      licences: [licenceComplete("l1", 1000)],
      affectations: [],
      anomalies: [
        { entite_type: "contrat", entite_id: "k1" },
        { entite_type: "contrat", entite_id: "k1" },
        { entite_type: "produit", entite_id: "p1" },
        { entite_type: "affectation", entite_id: "a9", valeur: 500 },
      ],
    });
    // total = 1000 + 10 + 10 + 500 = 1520, sain = 1000 -> 65.789 -> 65.8
    assert.equal(r.coherence, 65.8);
    assert.equal(r.nb_objets_anomalie, 3);
    const types = r.malus.filter((x) => x.composante === "coherence").map((x) => x.entite_type).sort();
    assert.deepEqual(types, ["affectation", "contrat", "produit"]);
    const ma = r.malus.find((x) => x.entite_type === "affectation");
    // 0.3 x 500 / 1520 x 100 = 9.868 -> 9.9
    assert.equal(ma.points, 9.9);
  });

  test("jamais 100 avec un defaut ouvert, meme quand l'arrondi y conduirait", () => {
    const licences = [];
    for (let i = 0; i < 50000; i += 1) licences.push(licenceComplete(`l${i}`, 0));
    const r = calculerIndiceConfiance({
      licences,
      affectations: [],
      anomalies: [{ entite_type: "licence", entite_id: "l0" }],
    });
    // 49999 / 50000 = 99.998, arrondi 100.0, borne a 99.9
    assert.equal(r.coherence, 99.9);
    assert.equal(r.indice, 99.9);
    assert.equal(r.exhaustivite, 100);
  });

  test("une licence valorisee ne pese jamais moins que le plancher", () => {
    // 1 000 000 sain + 0.01 en anomalie : sans plancher, 99.999999 -> 100.
    const r = calculerIndiceConfiance({
      licences: [licenceComplete("l1", 1000000), licenceComplete("l2", 0.01, { a_anomalie: true })],
      affectations: [],
    });
    // plancher 10000 : 1000000 / 1010000 = 99.0099 -> 99.0
    assert.equal(r.coherence, 99);
    assert.equal(r.plancher, 10000);
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

  test("valeur totale nulle : les objets pesent le plancher, les defauts comptent", () => {
    const r = calculerIndiceConfiance({
      licences: [licenceComplete("l1", 0, { a_commande: false })],
      affectations: [{ id: "a1", valeur: 0, fraiche: false }],
    });
    assert.equal(r.plancher, 1);
    assert.equal(r.exhaustivite, 75);
    assert.equal(r.coherence, 100);
    assert.equal(r.fraicheur, 0);
    // indice = 0.4 x 75 + 0.3 x 100 + 0.3 x 0 = 60
    assert.equal(r.indice, 60);
    const m = r.malus.find((x) => x.composante === "exhaustivite");
    assert.deepEqual(m.entite_ids, ["l1"]);
    assert.equal(m.points, 10);
    const f = r.malus.find((x) => x.composante === "fraicheur");
    assert.deepEqual(f.entite_ids, ["a1"]);
    assert.equal(f.points, 30);
  });

  test("valeurs absentes traitees comme zero, sans NaN", () => {
    const r = calculerIndiceConfiance({
      licences: [licenceComplete("l1", undefined), licenceComplete("l2", 100)],
      affectations: [{ id: "a1", valeur: null, fraiche: true }],
      anomalies: [null, { entite_type: "contrat" }, { entite_id: "x" }],
    });
    assert.equal(Number.isFinite(r.indice), true);
    assert.equal(r.valeur_totale, 100);
    assert.equal(r.nb_objets_anomalie, 0);
  });
});
