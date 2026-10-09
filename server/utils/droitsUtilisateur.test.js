// Tests purs des règles du modèle de droits #249 (matrice effective d'un
// profil par défaut, union multi-profils du correctif du 06/10/2026,
// exceptions à retrait prioritaire), sans base.
// Exécution : node --test server/utils/droitsUtilisateur.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { matriceProfilEffective, appliquerExceptions, unionPermissions, permissionsManquantes, deltaMatrice, TYPES_PROFIL_AJOUTE, PERMISSIONS_DELEGATION, societesNonDetenues, societesParProfilDesGroupes } from "./droitsRegles.js";

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

// ---------------------------------------------------------------------------
// Groupes d'utilisateurs (#277/#330) : union des droits, lignes de groupes,
// garde-fous de composition.
// ---------------------------------------------------------------------------

// La matrice effective d'une ligne profil × groupe d'organisations se calcule
// avec les memes regles que le direct : ces tests composent
// societesParProfilDesGroupes + matriceProfilEffective + unionPermissions,
// exactement comme permissionsEffectives (bloc 1bis).
function droitsDesLignes(lignes, matricesParProfil) {
  const matrices = [];
  for (const [idProfil, couvertes] of societesParProfilDesGroupes(lignes)) {
    const m = matricesParProfil[idProfil];
    matrices.push(matriceProfilEffective({
      societesCouvertes: [...couvertes],
      matriceDefaut: m.defaut,
      matricesParSociete: m.parSociete || new Map(),
    }));
  }
  return unionPermissions(matrices);
}

test("groupes : union des sociétés par profil, lignes de plusieurs groupes cumulées", () => {
  const parProfil = societesParProfilDesGroupes([
    { id_profil: "it_ops", societes: ["sA", "sB"] },     // IT Ops sur groupe A-B
    { id_profil: "it_ops", societes: ["sC"] },           // IT Ops sur groupe C (autre groupe)
    { id_profil: "manager_dsi", societes: ["sE", "sF"] },
  ]);
  assert.deepEqual([...parProfil.get("it_ops")].sort(), ["sA", "sB", "sC"]);
  assert.deepEqual([...parProfil.get("manager_dsi")].sort(), ["sE", "sF"]);
});

test("groupes : une ligne dont le groupe d'organisations est vide ne confère RIEN", () => {
  // Pas de repli sur la matrice par defaut, contrairement a un rattachement
  // vide : la portee d'une ligne est exactement celle de son groupe.
  const parProfil = societesParProfilDesGroupes([
    { id_profil: "it_ops", societes: [] },
    { id_profil: "financier", societes: [null] },
  ]);
  assert.equal(parProfil.size, 0);
});

test("groupes : cumul attribution directe + ligne de groupe (« et/ou », union)", () => {
  // Direct : IT Data input sur le rattachement (saisir_affectation).
  const direct = matriceProfilEffective({
    societesCouvertes: ["sNord"],
    matriceDefaut: ["saisir_affectation"],
    matricesParSociete: new Map(),
  });
  // Groupe « Exploitation Sud » : IT Ops sur le groupe « Filiales Sud ».
  const groupes = droitsDesLignes(
    [{ id_profil: "it_ops", societes: ["sSud"] }],
    { it_ops: { defaut: ["consulter_licences", "saisir_affectation"] } }
  );
  const union = unionPermissions([direct, groupes]);
  assert.deepEqual([...union].sort(), ["consulter_licences", "saisir_affectation"]);
});

test("groupes : le retrait d'un membre retire la contribution du groupe", () => {
  const matrices = { it_ops: { defaut: ["consulter_licences"] } };
  const avant = droitsDesLignes([{ id_profil: "it_ops", societes: ["sSud"] }], matrices);
  assert.ok(avant.has("consulter_licences"));
  // Plus membre d'aucun groupe : plus aucune ligne, la contribution tombe.
  const apres = droitsDesLignes([], matrices);
  assert.equal(apres.size, 0);
});

test("groupes : une société configurée s'applique aussi via une ligne de groupe (Q2/Q3)", () => {
  // La matrice configuree (profil, societe) fait foi pour la societe du
  // groupe, exactement comme pour une attribution directe.
  const droits = droitsDesLignes(
    [{ id_profil: "it_ops", societes: ["sSud"] }],
    { it_ops: { defaut: ["consulter_licences", "saisir_licence"],
                parSociete: new Map([["sSud", ["consulter_licences"]]]) } }
  );
  assert.deepEqual([...droits], ["consulter_licences"]);
});

test("groupes : l'exception « retire » prime aussi sur un droit venu d'un groupe", () => {
  const permissions = droitsDesLignes(
    [{ id_profil: "it_ops", societes: ["sSud"] }],
    { it_ops: { defaut: ["consulter_licences", "saisir_affectation"] } }
  );
  appliquerExceptions(permissions,
    [{ type: "retire", id_societe: null, code: "saisir_affectation" }],
    { isTenantScope: false, dansPerimetre: () => true });
  assert.deepEqual([...permissions], ["consulter_licences"]);
});

test("societesNonDetenues : un délégataire ne compose qu'avec ses sociétés", () => {
  const scope = { isTenantScope: false, societeIds: ["sA", "sB"] };
  assert.deepEqual(societesNonDetenues(["sA", "sB"], scope), []);
  assert.deepEqual(societesNonDetenues(["sA", "sC", "sD", "sC"], scope), ["sC", "sD"]);
});

test("societesNonDetenues : admin_sam et rattachement tenant voient tout", () => {
  assert.deepEqual(societesNonDetenues(["sX", "sY"], { isTenantScope: true, societeIds: [] }), []);
});

test("groupes : délégataire, détention de l'union des permissions conférées par les lignes", () => {
  // Ajouter un membre attribue toutes les lignes du groupe : le garde-fou
  // verifie l'union des codes conferes contre les droits de l'acteur.
  const conferees = droitsDesLignes(
    [
      { id_profil: "it_ops", societes: ["sSud"] },
      { id_profil: "financier", societes: ["sSud"] },
    ],
    {
      it_ops: { defaut: ["consulter_licences"] },
      financier: { defaut: ["consulter_budget", "consulter_kpi_financiers"] },
    }
  );
  const acteurIncomplet = new Set(["consulter_licences", "consulter_budget"]);
  assert.deepEqual(permissionsManquantes([...conferees], acteurIncomplet), ["consulter_kpi_financiers"]);
  const acteurComplet = new Set([...acteurIncomplet, "consulter_kpi_financiers"]);
  assert.deepEqual(permissionsManquantes([...conferees], acteurComplet), []);
});
