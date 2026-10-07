// Tests purs du planificateur (correctif recette du 06/10/2026, BUG-1 des
// attendus) : la colonne licence.id_contrat a disparu avec la migration 014 ;
// une requete qui reference l.id_contrat echoue au parse (42703) et fait
// tomber tout le traitement quotidien des la detection fautive. Le contrat
// d'une licence se deduit par sa commande (licence.id_commande ->
// commande.id_contrat), comme partout ailleurs dans le depot.
// Le source est lu comme texte : importer planificateur.js entrainerait
// db.js (pools, variables d'environnement) alors que ces tests tournent sans
// base, comme les autres tests purs du module.
// Execution : node --test server/utils/notifications/planificateur.test.js
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./planificateur.js", import.meta.url), "utf8");

describe("detecterFinsMaintenance : contrat par la chaine licence -> commande -> contrat", () => {
  const debut = source.indexOf("export async function detecterFinsMaintenance");
  const fin = source.indexOf("export async function", debut + 1);
  const corps = debut === -1 ? "" : source.slice(debut, fin === -1 ? source.length : fin);

  test("la detection existe et joint la commande de la licence", () => {
    assert.notEqual(debut, -1);
    assert.match(corps, /LEFT JOIN commande co ON co\.id = l\.id_commande/);
  });

  test("les successeurs de contrat se comptent sur commande.id_contrat", () => {
    assert.match(corps, /co\.id_contrat IS NOT NULL/);
    assert.match(corps, /cx\.id_contrat_predecesseur = co\.id_contrat/);
  });

  test("une periode sans date de fin ne compte pas comme periode suivante (#280, decision du 06/10/2026)", () => {
    assert.doesNotMatch(corps, /mx\.date_fin IS NULL/);
    assert.match(corps, /AND mx\.date_fin > m\.date_fin/);
  });
});

test("aucune requete du planificateur ne reference licence.id_contrat (colonne supprimee par la 014)", () => {
  assert.doesNotMatch(source, /\bl\.id_contrat\b/);
});
