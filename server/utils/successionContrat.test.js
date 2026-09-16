// Tests de la regle de succession licences / contrats (#209, decision du
// 11/09/2026 : le contrat suit les licences).
// Execution : node --test server/utils/successionContrat.test.js
// (hors du npm test racine, qui ne couvre que src/utils, comme
// conformite.test.js et regles.test.js).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  contratSansSuite, licenceRenouveleeSurContrat, contratDoitSuivre, contratASuivre,
  HORIZON_ECHEANCE_CONTRAT,
} from "./successionContrat.js";

const AUJOURDHUI = "2026-09-16";
const opts = { aujourdhui: AUJOURDHUI };

const contrat = (surcharges = {}) => ({
  date_fin: "2026-10-01", a_renouveler: false, nb_successeurs: 0, archive: false, ...surcharges,
});

describe("contratSansSuite", () => {
  test("echu sans successeur : sans suite", () => {
    assert.equal(contratSansSuite(contrat({ date_fin: "2026-01-31" }), opts), true);
  });
  test("a echeance dans l'horizon sans successeur : sans suite", () => {
    assert.equal(contratSansSuite(contrat({ date_fin: "2026-12-01" }), opts), true);
    assert.equal(HORIZON_ECHEANCE_CONTRAT, 90);
  });
  test("loin de l'echeance : rien", () => {
    assert.equal(contratSansSuite(contrat({ date_fin: "2027-06-30" }), opts), false);
  });
  test("drapeau a_renouveler : a echeance quelle que soit la date", () => {
    assert.equal(contratSansSuite(contrat({ date_fin: "2027-06-30", a_renouveler: true }), opts), true);
  });
  test("renouvele par un successeur : rien, meme echu", () => {
    assert.equal(contratSansSuite(contrat({ date_fin: "2026-01-31", nb_successeurs: 1 }), opts), false);
    assert.equal(contratSansSuite(contrat({ date_fin: "2026-01-31", nb_successeurs: "2" }), opts), false);
  });
  test("perpetuel, archive ou absent : rien", () => {
    assert.equal(contratSansSuite(contrat({ date_fin: null }), opts), false);
    assert.equal(contratSansSuite(contrat({ date_fin: "2026-01-31", archive: true }), opts), false);
    assert.equal(contratSansSuite(null, opts), false);
  });
  test("horizon parametrable", () => {
    assert.equal(contratSansSuite(contrat({ date_fin: "2026-10-01" }), { aujourdhui: AUJOURDHUI, horizonJours: 10 }), false);
    assert.equal(contratSansSuite(contrat({ date_fin: "2026-09-26" }), { aujourdhui: AUJOURDHUI, horizonJours: 10 }), true);
  });
});

describe("licenceRenouveleeSurContrat", () => {
  test("successeur rattache au contrat de son predecesseur", () => {
    assert.equal(licenceRenouveleeSurContrat({ id_contrat: "C1", id_contrat_predecesseur: "C1", nb_successeurs_meme_contrat: 0 }), true);
  });
  test("predecesseur dont un successeur est sur le meme contrat", () => {
    assert.equal(licenceRenouveleeSurContrat({ id_contrat: "C1", id_contrat_predecesseur: null, nb_successeurs_meme_contrat: 1 }), true);
  });
  test("successeur sur un autre contrat : la licence ne dit rien du contrat", () => {
    assert.equal(licenceRenouveleeSurContrat({ id_contrat: "C2", id_contrat_predecesseur: "C1", nb_successeurs_meme_contrat: 0 }), false);
  });
  test("sans contrat ou sans lien de succession : rien", () => {
    assert.equal(licenceRenouveleeSurContrat({ id_contrat: null, id_contrat_predecesseur: null, nb_successeurs_meme_contrat: 3 }), false);
    assert.equal(licenceRenouveleeSurContrat({ id_contrat: "C1", id_contrat_predecesseur: null, nb_successeurs_meme_contrat: 0 }), false);
    assert.equal(licenceRenouveleeSurContrat(null), false);
  });
});

describe("contratDoitSuivre (vue licence) : les trois cas de la mission", () => {
  const successeurSurC1 = { id_contrat: "C1", id_contrat_predecesseur: "C1", nb_successeurs_meme_contrat: 0 };

  test("licence renouvelee, contrat suivi (renouvele par un successeur) : aucun signal", () => {
    assert.equal(contratDoitSuivre(successeurSurC1, contrat({ date_fin: "2026-01-31", nb_successeurs: 1 }), opts), false);
  });
  test("licence renouvelee, contrat echu sans successeur : signal", () => {
    assert.equal(contratDoitSuivre(successeurSurC1, contrat({ date_fin: "2026-01-31" }), opts), true);
  });
  test("licence renouvelee, contrat a echeance sans successeur : signal", () => {
    assert.equal(contratDoitSuivre(successeurSurC1, contrat({ date_fin: "2026-11-15" }), opts), true);
  });
  test("contrat renouvele, licences non renouvelees : aucun signal", () => {
    const nonRenouvelee = { id_contrat: "C1", id_contrat_predecesseur: null, nb_successeurs_meme_contrat: 0 };
    assert.equal(contratDoitSuivre(nonRenouvelee, contrat({ date_fin: "2026-01-31", nb_successeurs: 1 }), opts), false);
    assert.equal(contratDoitSuivre(nonRenouvelee, contrat({ date_fin: "2026-01-31" }), opts), false);
  });
  test("licence renouvelee sur un autre contrat : aucun signal sur le contrat courant", () => {
    const ailleurs = { id_contrat: "C2", id_contrat_predecesseur: "C1", nb_successeurs_meme_contrat: 0 };
    assert.equal(contratDoitSuivre(ailleurs, contrat({ date_fin: "2026-01-31" }), opts), false);
  });
});

describe("contratASuivre (vue contrat)", () => {
  test("echu sans successeur avec des licences renouvelees dessus : signal", () => {
    assert.equal(contratASuivre(contrat({ date_fin: "2026-01-31", nb_licences_renouvelees: 2 }), opts), true);
  });
  test("renouvele par un successeur : aucun signal", () => {
    assert.equal(contratASuivre(contrat({ date_fin: "2026-01-31", nb_licences_renouvelees: 2, nb_successeurs: 1 }), opts), false);
  });
  test("aucune licence renouvelee dessus : aucun signal, meme echu", () => {
    assert.equal(contratASuivre(contrat({ date_fin: "2026-01-31", nb_licences_renouvelees: 0 }), opts), false);
    assert.equal(contratASuivre(contrat({ date_fin: "2026-01-31" }), opts), false);
  });
  test("actif loin de l'echeance : aucun signal", () => {
    assert.equal(contratASuivre(contrat({ date_fin: "2027-09-01", nb_licences_renouvelees: 1 }), opts), false);
  });
});
