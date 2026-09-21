// Tests de la regle d'ecriture de la matrice groupe x permission (#170 :
// erreur 500 a l'ajout d'un droit deja retire une fois).
// Execution : node --test server/utils/matriceGroupe.test.js
// (hors du npm test racine, qui ne couvre que src/utils, comme
// conformite.test.js et successionContrat.test.js).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { estUuid, etatLigne, deciderAjout, deciderRetrait } from "./matriceGroupe.js";

const ACTIVE = { id: "l1", date_suppression: null };
const RETIREE = { id: "l1", date_suppression: new Date("2026-09-10T08:00:00Z") };

describe("etatLigne", () => {
  test("couple jamais ecrit : absente", () => {
    assert.equal(etatLigne(undefined), "absente");
    assert.equal(etatLigne(null), "absente");
  });
  test("ligne sans date de suppression : active", () => {
    assert.equal(etatLigne(ACTIVE), "active");
  });
  test("ligne retiree logiquement : retiree, que la date soit un Date ou un texte", () => {
    assert.equal(etatLigne(RETIREE), "retiree");
    assert.equal(etatLigne({ id: "l1", date_suppression: "2026-09-10 08:00:00" }), "retiree");
  });
});

describe("deciderAjout", () => {
  test("premier ajout : insertion, 201", () => {
    assert.deepEqual(deciderAjout(undefined), { ecriture: "inserer", status: 201 });
  });
  // Le cas du ticket : droit decoche puis recoche. La ligne retiree occupe
  // toujours uq_profil_permission, une insertion leverait 23505.
  test("droit retire puis rajoute : reactivation et non insertion, 201", () => {
    assert.deepEqual(deciderAjout(RETIREE), { ecriture: "reactiver", status: 201 });
  });
  test("droit deja actif : aucune ecriture, 200 et non une erreur", () => {
    assert.deepEqual(deciderAjout(ACTIVE), { ecriture: "aucune", status: 200 });
  });
});

describe("deciderRetrait", () => {
  test("droit actif : retrait, 204", () => {
    assert.deepEqual(deciderRetrait(ACTIVE), { ecriture: "retirer", status: 204 });
  });
  test("droit deja retire : refus 404, aucune ecriture", () => {
    assert.deepEqual(deciderRetrait(RETIREE), { ecriture: "aucune", status: 404 });
  });
  test("couple jamais attribue : refus 404, aucune ecriture", () => {
    assert.deepEqual(deciderRetrait(undefined), { ecriture: "aucune", status: 404 });
  });
});

describe("enchainement cocher / decocher", () => {
  // Rejoue la sequence de l'ecran sur une ligne simulee : aucune etape ne doit
  // demander une insertion une fois la ligne creee.
  test("ajout, retrait, ajout, retrait, ajout : une seule insertion, puis des reactivations", () => {
    let ligne;
    const ecritures = [];
    for (const geste of ["ajout", "retrait", "ajout", "retrait", "ajout"]) {
      const { ecriture } = geste === "ajout" ? deciderAjout(ligne) : deciderRetrait(ligne);
      ecritures.push(ecriture);
      if (ecriture === "inserer" || ecriture === "reactiver") ligne = { id: "l1", date_suppression: null };
      if (ecriture === "retirer") ligne = { id: "l1", date_suppression: "2026-09-21" };
    }
    assert.deepEqual(ecritures, ["inserer", "retirer", "reactiver", "retirer", "reactiver"]);
  });
});

describe("estUuid", () => {
  test("uuid valide, casse indifferente", () => {
    assert.equal(estUuid("3f2a9c1e-7b4d-4e8a-9c6f-1a2b3c4d5e6f"), true);
    assert.equal(estUuid("3F2A9C1E-7B4D-4E8A-9C6F-1A2B3C4D5E6F"), true);
  });
  test("texte quelconque, vide ou non textuel : refuse", () => {
    assert.equal(estUuid("importer_inventaire"), false);
    assert.equal(estUuid(""), false);
    assert.equal(estUuid(undefined), false);
    assert.equal(estUuid(42), false);
    assert.equal(estUuid("3f2a9c1e-7b4d-4e8a-9c6f-1a2b3c4d5e6f' OR 1=1"), false);
  });
});
