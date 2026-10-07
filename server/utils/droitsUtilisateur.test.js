// Tests purs des règles du modèle de droits #249 (matrice effective d'un
// profil par défaut, union multi-profils du correctif du 06/10/2026,
// exceptions à retrait prioritaire), sans base.
// Exécution : node --test server/utils/droitsUtilisateur.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { matriceProfilEffective, appliquerExceptions, unionPermissions, permissionsManquantes, deltaMatrice, TYPES_PROFIL_AJOUTE, PERMISSIONS_DELEGATION } from "./droitsRegles.js";

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

// --- Multi-profils (#73/#190, correctif du 06/10/2026) ----------------------

test("deux profils : union de leurs matrices effectives", () => {
  const p1 = matriceProfilEffective({
    societesCouvertes: ["s1"],
    matriceDefaut: ["consulter_licences"],
    matricesParSociete: new Map(),
  });
  const p2 = matriceProfilEffective({
    societesCouvertes: ["s1"],
    matriceDefaut: ["consulter_budget"],
    matricesParSociete: new Map(),
  });
  assert.deepEqual([...unionPermissions([p1, p2])].sort(),
    ["consulter_budget", "consulter_licences"]);
});

test("société configurée à vide pour un profil : ne masque pas l'autre profil", () => {
  // s1 configurée à vide pour P1 (Q3) : P1 n'apporte rien sur s1. P2, non
  // configuré sur s1, garde sa matrice par défaut : le masquage Q2/Q3 est
  // propre à chaque profil, il ne traverse pas l'union.
  const p1 = matriceProfilEffective({
    societesCouvertes: ["s1"],
    matriceDefaut: ["saisir_licence"],
    matricesParSociete: new Map([["s1", []]]),
  });
  const p2 = matriceProfilEffective({
    societesCouvertes: ["s1"],
    matriceDefaut: ["consulter_licences"],
    matricesParSociete: new Map(),
  });
  assert.deepEqual([...unionPermissions([p1, p2])], ["consulter_licences"]);
});

test("mono-profil : l'union d'un seul profil est sa matrice, inchangée", () => {
  const seul = matriceProfilEffective({
    societesCouvertes: ["s1"],
    matriceDefaut: DEFAUT,
    matricesParSociete: new Map(),
  });
  assert.deepEqual([...unionPermissions([seul])].sort(), [...DEFAUT].sort());
});

test("aucun profil : union vide", () => {
  assert.equal(unionPermissions([]).size, 0);
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

// ---------------------------------------------------------------------------
// Delegation (#278) : regles pures du garde-fou et du delta de matrices.
// ---------------------------------------------------------------------------

test("permissionsManquantes : vide quand l'acteur detient tout", () => {
  assert.deepEqual(
    permissionsManquantes(["a", "b"], new Set(["a", "b", "c"])),
    []
  );
});

test("permissionsManquantes : liste triee et dedoublonnee de ce qui manque", () => {
  assert.deepEqual(
    permissionsManquantes(["saisir_licence", "gerer_profils", "saisir_licence"], new Set(["consulter_licences"])),
    ["gerer_profils", "saisir_licence"]
  );
});

test("permissionsManquantes : accepte un tableau comme ensemble detenu", () => {
  assert.deepEqual(permissionsManquantes(["a"], ["a"]), []);
  assert.deepEqual(permissionsManquantes(["b"], ["a"]), ["b"]);
});

test("permissionsManquantes : aucune demande, aucun manque", () => {
  assert.deepEqual(permissionsManquantes([], new Set()), []);
});

test("deltaMatrice : ajouts et retraits tries, inchanges ignores", () => {
  const delta = deltaMatrice(["a", "b", "c"], ["b", "d", "c", "e"]);
  assert.deepEqual(delta.ajoutes, ["d", "e"]);
  assert.deepEqual(delta.retires, ["a"]);
});

test("deltaMatrice : matrices identiques, delta vide", () => {
  const delta = deltaMatrice(["a", "b"], ["b", "a"]);
  assert.deepEqual(delta.ajoutes, []);
  assert.deepEqual(delta.retires, []);
});

test("deltaMatrice : depuis et vers une matrice vide", () => {
  assert.deepEqual(deltaMatrice([], ["a"]), { ajoutes: ["a"], retires: [] });
  assert.deepEqual(deltaMatrice(["a"], []), { ajoutes: [], retires: ["a"] });
});

test("constantes de la delegation : types ajoutes et permissions deleguables", () => {
  // Contrat partage entre routeurs : 'groupe' reste un profil ajoute tant
  // que la 097 n'est pas jouee partout, et la delegation porte exactement
  // gerer_utilisateurs et gerer_profils.
  assert.deepEqual([...TYPES_PROFIL_AJOUTE].sort(), ["ajoute", "groupe"]);
  assert.deepEqual([...PERMISSIONS_DELEGATION].sort(), ["gerer_profils", "gerer_utilisateurs"]);
});
