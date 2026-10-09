// Tests purs de la règle de suppression d'une société (#281, issue 60).
// Sans base ni dépendance : node --test server/utils/societeSuppression.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { blocagesSuppression, messageSuppressionImpossible } from "./societeSuppression.js";

const AUCUN = {
  nb_utilisateurs: 0, nb_filiales: 0, nb_contrats: 0, nb_commandes: 0,
  nb_licences: 0, nb_affectations: 0, nb_lignes_budget: 0,
};

test("société vide : aucun blocage", () => {
  assert.deepEqual(blocagesSuppression(AUCUN), []);
  assert.deepEqual(blocagesSuppression({}), []);
  assert.deepEqual(blocagesSuppression(undefined), []);
});

test("singulier et pluriel des libellés", () => {
  assert.deepEqual(blocagesSuppression({ ...AUCUN, nb_utilisateurs: 1 }), ["1 utilisateur rattaché"]);
  assert.deepEqual(blocagesSuppression({ ...AUCUN, nb_utilisateurs: 2 }), ["2 utilisateurs rattachés"]);
  assert.deepEqual(blocagesSuppression({ ...AUCUN, nb_filiales: 1 }), ["1 filiale"]);
  assert.deepEqual(blocagesSuppression({ ...AUCUN, nb_lignes_budget: 1 }), ["1 ligne de budget"]);
  assert.deepEqual(blocagesSuppression({ ...AUCUN, nb_lignes_budget: 3 }), ["3 lignes de budget"]);
});

test("ordre du ticket : utilisateurs, filiales, contrats, commandes, licences, affectations, budget", () => {
  const tous = blocagesSuppression({
    nb_utilisateurs: 2, nb_filiales: 1, nb_contrats: 3, nb_commandes: 4,
    nb_licences: 5, nb_affectations: 6, nb_lignes_budget: 7,
  });
  assert.deepEqual(tous, [
    "2 utilisateurs rattachés", "1 filiale", "3 contrats", "4 commandes",
    "5 licences", "6 affectations", "7 lignes de budget",
  ]);
});

test("compteurs rendus en chaînes par pg : convertis, zéro ignoré", () => {
  assert.deepEqual(blocagesSuppression({ ...AUCUN, nb_contrats: "2" }), ["2 contrats"]);
  assert.deepEqual(blocagesSuppression({ ...AUCUN, nb_contrats: "0" }), []);
});

test("message de refus : un seul blocage", () => {
  assert.equal(
    messageSuppressionImpossible("REC Filiale Nord", ["1 filiale"]),
    'Suppression impossible : la société "REC Filiale Nord" porte encore 1 filiale. L\'archivage reste possible.'
  );
});

test("message de refus : énumération avec virgules et « et »", () => {
  assert.equal(
    messageSuppressionImpossible("REC Groupe Horizon (mère)", ["2 utilisateurs rattachés", "1 filiale", "3 contrats"]),
    'Suppression impossible : la société "REC Groupe Horizon (mère)" porte encore 2 utilisateurs rattachés, 1 filiale et 3 contrats. L\'archivage reste possible.'
  );
});
