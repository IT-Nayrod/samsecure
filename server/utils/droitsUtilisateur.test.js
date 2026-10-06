// Tests purs des règles du modèle de droits #249 (matrice effective d'un
// profil par défaut, exceptions à retrait prioritaire), sans base.
// Exécution : node --test server/utils/droitsUtilisateur.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { matriceProfilEffective, appliquerExceptions } from "./droitsRegles.js";

const DEFAUT = ["consulter_licences", "saisir_licence"];

test("aucune société couverte : la matrice par défaut fait foi", () => {
  const codes = matriceProfilEffective({
    societesCouvertes: [],
    matriceDefaut: DEFAUT,
    matricesParSociete: new Map(),
  });
  assert.deepEqual([...codes].sort(), [...DEFAUT].sort());
});

test("société non configurée : suit le défaut", () => {
  const codes = matriceProfilEffective({
    societesCouvertes: ["s1"],
    matriceDefaut: DEFAUT,
    matricesParSociete: new Map(),
  });
  assert.deepEqual([...codes].sort(), [...DEFAUT].sort());
});

test("société configurée : sa matrice fait foi intégralement, le défaut ne complète pas (Q2)", () => {
  const codes = matriceProfilEffective({
    societesCouvertes: ["s1"],
    matriceDefaut: DEFAUT,
    matricesParSociete: new Map([["s1", ["consulter_budget"]]]),
  });
  assert.deepEqual([...codes], ["consulter_budget"]);
});

test("matrice configurée vidée volontairement : configurée, donc aucun droit (Q3)", () => {
  const codes = matriceProfilEffective({
    societesCouvertes: ["s1"],
    matriceDefaut: DEFAUT,
    matricesParSociete: new Map([["s1", []]]),
  });
  assert.equal(codes.size, 0);
});

test("rattachement mixte : union de la matrice configurée et du défaut (Q4)", () => {
  const codes = matriceProfilEffective({
    societesCouvertes: ["s1", "s2"],
    matriceDefaut: DEFAUT,
    matricesParSociete: new Map([["s1", ["consulter_budget"]]]),
  });
  assert.deepEqual([...codes].sort(), ["consulter_budget", ...DEFAUT].sort());
});

test("toutes les sociétés couvertes configurées : le défaut ne contribue plus", () => {
  const codes = matriceProfilEffective({
    societesCouvertes: ["s1", "s2"],
    matriceDefaut: DEFAUT,
    matricesParSociete: new Map([["s1", ["consulter_budget"]], ["s2", ["consulter_contrats"]]]),
  });
  assert.deepEqual([...codes].sort(), ["consulter_budget", "consulter_contrats"]);
});

test("une configuration hors des sociétés couvertes ne contribue pas", () => {
  // La Map ne contient que les sociétés configurées DU rattachement : la règle
  // n'unionne que ce qu'on lui donne. Le garde-fou est que la lecture SQL borne
  // la Map aux societesCouvertes ; ici une société couverte non configurée
  // ramène le défaut, rien d'autre.
  const codes = matriceProfilEffective({
    societesCouvertes: ["s2"],
    matriceDefaut: DEFAUT,
    matricesParSociete: new Map(),
  });
  assert.deepEqual([...codes].sort(), [...DEFAUT].sort());
});

// --- Exceptions -------------------------------------------------------------

function contexte({ isTenantScope = false, societeIds = [] } = {}) {
  const dansPerimetre = (idSociete) =>
    isTenantScope || idSociete === null || societeIds.includes(idSociete);
  return { isTenantScope, dansPerimetre };
}

test("exception accordée dans le périmètre : ajoutée", () => {
  const permissions = appliquerExceptions(
    new Set(),
    [{ type: "accorde", id_societe: null, code: "consulter_budget" }],
    contexte({ societeIds: ["s1"] })
  );
  assert.ok(permissions.has("consulter_budget"));
});

test("retrait prioritaire sur accord, quel que soit l'ordre", () => {
  const permissions = appliquerExceptions(
    new Set(),
    [
      { type: "retire", id_societe: null, code: "saisir_licence" },
      { type: "accorde", id_societe: null, code: "saisir_licence" },
    ],
    contexte({ societeIds: ["s1"] })
  );
  assert.ok(!permissions.has("saisir_licence"));
});

test("retrait borné à une société ne masque pas un droit tenant", () => {
  const permissions = appliquerExceptions(
    new Set(["saisir_licence"]),
    [{ type: "retire", id_societe: "s1", code: "saisir_licence" }],
    contexte({ isTenantScope: true })
  );
  assert.ok(permissions.has("saisir_licence"));
});

test("retrait sur une société du rattachement restreint : prime (tout ou rien)", () => {
  const permissions = appliquerExceptions(
    new Set(["saisir_licence"]),
    [{ type: "retire", id_societe: "s1", code: "saisir_licence" }],
    contexte({ societeIds: ["s1", "s2"] })
  );
  assert.ok(!permissions.has("saisir_licence"));
});

test("exception hors périmètre : ignorée", () => {
  const permissions = appliquerExceptions(
    new Set(),
    [{ type: "accorde", id_societe: "ailleurs", code: "consulter_budget" }],
    contexte({ societeIds: ["s1"] })
  );
  assert.equal(permissions.size, 0);
});
