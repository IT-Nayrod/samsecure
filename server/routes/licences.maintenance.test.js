// Tests API de la partie maintenance de server/routes/licences.js (decision
// client du 06/10/2026, #280 : une maintenance a toujours une date de fin,
// refus 4039, contrainte de la migration 102 en garde-fou).
// Le source est lu comme texte : importer licences.js entrainerait db.js
// (pools, variables d'environnement) alors que ces tests tournent sans base,
// comme server/utils/notifications/planificateur.test.js.
// Execution : node --test server/routes/licences.maintenance.test.js
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./licences.js", import.meta.url), "utf8");

// Tranche du source entre deux marqueurs, suffisante pour des assertions
// textuelles sur un bloc (fonction, constante).
function bloc(depuis, jusquA) {
  const debut = source.indexOf(depuis);
  assert.notEqual(debut, -1, `marqueur introuvable : ${depuis}`);
  const fin = source.indexOf(jusquA, debut + depuis.length);
  assert.notEqual(fin, -1, `marqueur de fin introuvable : ${jusquA}`);
  return source.slice(debut, fin);
}

describe("validerMaintenance : la date de fin est obligatoire (4039)", () => {
  const corps = bloc("async function validerMaintenance", "const CHAMPS_MAINTENANCE");

  test("le refus 4039 existe, en 400, avec son message rendu", () => {
    assert.match(corps, /status: 400, code: 4039, error: "La date de fin de la maintenance est obligatoire\."/);
  });
  test("exige des la validation du corps, avant le format et les references", () => {
    const refus = corps.indexOf("code: 4039");
    assert.notEqual(refus, -1);
    assert.ok(refus < corps.indexOf("code: 4024"), "le refus 4039 doit preceder le controle de format");
    assert.ok(refus < corps.indexOf("existe(client"), "le refus 4039 doit preceder les controles en base");
  });
  test("plus aucun cas sans date dans les controles de dates", () => {
    assert.doesNotMatch(corps, /m\.date_fin &&/);
  });
});

describe("POST et PATCH maintenance partagent la validation", () => {
  test("les deux ecritures appellent validerMaintenance (fusion du PATCH comprise)", () => {
    const appels = source.match(/await validerMaintenance\(client, m, licence\)/g) ?? [];
    assert.equal(appels.length, 2);
  });
});

describe("statut d'une periode (SELECT_MAINTENANCE)", () => {
  const corps = bloc("const SELECT_MAINTENANCE", "const CHAMPS ");

  test("en cours = date de fin posee et non depassee", () => {
    assert.match(corps, /WHEN h\.date_fin IS NOT NULL AND h\.date_fin >= CURRENT_DATE\s+THEN 'en_cours'/);
  });
  test("une periode sans date de fin n'est plus servie en cours, elle est echue", () => {
    assert.doesNotMatch(corps, /ELSE 'en_cours'/);
    assert.match(corps, /ELSE 'echue'/);
  });
});

describe("ecritures compatibles avec la contrainte 102 (date_fin NOT NULL sur les nouvelles lignes)", () => {
  test("la cloture d'un arret ne pose jamais une fin nulle", () => {
    assert.match(source, /SET date_fin = greatest\(date_debut, \$1::date\)/);
  });
  test("la prolongation pose toujours une date de fin", () => {
    assert.match(source, /UPDATE maintenance_historique SET date_fin = \$1 WHERE id = \$2/);
  });
});
