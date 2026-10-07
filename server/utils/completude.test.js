// Tests des règles pures de complétude (US #324).
// Exécution : node --test server/utils/completude.test.js (hors npm test
// racine, comme conformite.test.js et successionContrat.test.js).
import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluerCompletude, compterGravites, compterResume, REGLES_COMPLETUDE,
  TYPES_COMPLETUDE, GRAVITE_BLOQUANT, GRAVITE_RECOMMANDE,
} from "./completude.js";

const AUJOURDHUI = "2026-10-07";
const codes = (manques) => manques.map((m) => m.regle);
const actions = (manques) => manques.map((m) => m.action.libelle);

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

test("catalogue : cinq types, règles toutes porteuses d'objet, libellé, gravité et action", () => {
  assert.deepEqual(TYPES_COMPLETUDE.sort(),
    ["affectation", "commande", "contrat", "licence", "logiciel"]);
  for (const [type, regles] of Object.entries(REGLES_COMPLETUDE)) {
    for (const r of regles) {
      assert.ok(r.regle.startsWith(type), `${r.regle} préfixée par son objet`);
      assert.ok([GRAVITE_BLOQUANT, GRAVITE_RECOMMANDE].includes(r.gravite));
      assert.ok(r.libelle, `${r.regle} : libellé`);
      assert.ok(r.action?.code && r.action?.libelle, `${r.regle} : action`);
      assert.equal(typeof r.test, "function");
    }
  }
});

test("type inconnu : erreur explicite", () => {
  assert.throws(() => evaluerCompletude("facture", {}), /inconnu/);
});

// ---------------------------------------------------------------------------
// Commande
// ---------------------------------------------------------------------------

test("commande complète : aucun manque", () => {
  const manques = evaluerCompletude("commande",
    { montant: 600, nb_factures: 1, nb_preuves: 2, nb_licences: 1 });
  assert.deepEqual(manques, []);
});

test("commande sans facture ni preuve (REC Commande prix 2) : les deux actions du brief", () => {
  // Jeu de recette : montant 600, une licence rattachée, ni facture ni preuve.
  const manques = evaluerCompletude("commande",
    { montant: 600, nb_factures: 0, nb_preuves: 0, nb_licences: 1 });
  assert.deepEqual(codes(manques), ["commande_sans_facture", "commande_sans_preuve"]);
  assert.deepEqual(actions(manques), ["Déposer une facture", "Rattacher une preuve"]);
  assert.ok(manques.every((m) => m.gravite === GRAVITE_RECOMMANDE));
});

test("commande sans licence et sans montant : bloquants servis avant les recommandés", () => {
  const manques = evaluerCompletude("commande",
    { montant: null, nb_factures: 0, nb_preuves: 1, nb_licences: 0 });
  assert.deepEqual(codes(manques),
    ["commande_sans_licence", "commande_montant_absent", "commande_sans_facture"]);
  assert.deepEqual(compterGravites(manques), { nb_bloquants: 2, nb_recommandes: 1 });
});

test("commande : une facture est aussi une preuve, le manque de preuve ne double pas", () => {
  // Circuit POST /factures/depot : la preuve support compte dans nb_preuves.
  const manques = evaluerCompletude("commande",
    { montant: 100, nb_factures: 1, nb_preuves: 1, nb_licences: 1 });
  assert.deepEqual(manques, []);
});

// ---------------------------------------------------------------------------
// Contrat
// ---------------------------------------------------------------------------

const CONTRAT_SAIN = {
  archive: false, id_societe: "s1", date_fin: "2027-01-01",
  nb_successeurs: 0, nb_commandes: 2, a_justificatif: true,
};

test("contrat complet : aucun manque", () => {
  assert.deepEqual(evaluerCompletude("contrat", CONTRAT_SAIN, { aujourdhui: AUJOURDHUI }), []);
});

test("contrat sans société signataire : bloquant", () => {
  const manques = evaluerCompletude("contrat",
    { ...CONTRAT_SAIN, id_societe: null }, { aujourdhui: AUJOURDHUI });
  assert.deepEqual(codes(manques), ["contrat_sans_societe"]);
  assert.equal(manques[0].gravite, GRAVITE_BLOQUANT);
});

test("contrat échu sans renouvellement : bloquant, date au libellé", () => {
  const manques = evaluerCompletude("contrat",
    { ...CONTRAT_SAIN, date_fin: "2026-09-30" }, { aujourdhui: AUJOURDHUI });
  assert.deepEqual(codes(manques), ["contrat_echeance_sans_renouvellement"]);
  assert.match(manques[0].libelle, /2026-09-30/);
});

test("contrat échu renouvelé (D35) : aucun signal d'échéance", () => {
  const manques = evaluerCompletude("contrat",
    { ...CONTRAT_SAIN, date_fin: "2026-09-30", nb_successeurs: 1 }, { aujourdhui: AUJOURDHUI });
  assert.deepEqual(manques, []);
});

test("contrat échéant le jour même : encore actif, pas de manque", () => {
  const manques = evaluerCompletude("contrat",
    { ...CONTRAT_SAIN, date_fin: AUJOURDHUI }, { aujourdhui: AUJOURDHUI });
  assert.deepEqual(manques, []);
});

test("contrat perpétuel : jamais d'échéance passée", () => {
  const manques = evaluerCompletude("contrat",
    { ...CONTRAT_SAIN, date_fin: null }, { aujourdhui: AUJOURDHUI });
  assert.deepEqual(manques, []);
});

test("contrat sans commande ni justificatif : deux recommandés", () => {
  const manques = evaluerCompletude("contrat",
    { ...CONTRAT_SAIN, nb_commandes: 0, a_justificatif: false }, { aujourdhui: AUJOURDHUI });
  assert.deepEqual(codes(manques), ["contrat_sans_commande", "contrat_sans_preuve"]);
});

test("contrat archivé : aucune action requise, quels que soient les manques", () => {
  const manques = evaluerCompletude("contrat",
    { archive: true, id_societe: null, date_fin: "2020-01-01", nb_successeurs: 0,
      nb_commandes: 0, a_justificatif: false }, { aujourdhui: AUJOURDHUI });
  assert.deepEqual(manques, []);
});

// ---------------------------------------------------------------------------
// Licence
// ---------------------------------------------------------------------------

const LICENCE_SAINE = {
  type: "perpetuelle", quantite: 10, date_fin_souscription: null,
  nb_successeurs: 0, id_version: "v1", id_edition: "e1", version_geree: true,
  nb_preuves: 1, nb_affectations: 3, nb_affectations_en_attente: 0,
  statut_maintenance: "active",
};

test("licence complète : aucun manque", () => {
  assert.deepEqual(evaluerCompletude("licence", LICENCE_SAINE, { aujourdhui: AUJOURDHUI }), []);
});

test("licence : droits à zéro bloquant", () => {
  const manques = evaluerCompletude("licence",
    { ...LICENCE_SAINE, quantite: 0 }, { aujourdhui: AUJOURDHUI });
  assert.deepEqual(codes(manques), ["licence_droits_zero"]);
});

test("souscription échue sans successeur : bloquant ; renouvelée : rien (D35)", () => {
  const echue = { ...LICENCE_SAINE, type: "souscription", date_fin_souscription: "2026-09-01" };
  assert.deepEqual(codes(evaluerCompletude("licence", echue, { aujourdhui: AUJOURDHUI })),
    ["licence_souscription_echue"]);
  assert.deepEqual(
    evaluerCompletude("licence", { ...echue, nb_successeurs: 1 }, { aujourdhui: AUJOURDHUI }), []);
});

test("souscription échue le jour même : encore dans les droits (borne stricte)", () => {
  const manques = evaluerCompletude("licence",
    { ...LICENCE_SAINE, type: "souscription", date_fin_souscription: AUJOURDHUI },
    { aujourdhui: AUJOURDHUI });
  assert.deepEqual(manques, []);
});

test("version d'essai échue : même règle que la souscription (D44), libellé propre", () => {
  const manques = evaluerCompletude("licence",
    { ...LICENCE_SAINE, type: "essai", date_fin_souscription: "2026-09-01" },
    { aujourdhui: AUJOURDHUI });
  assert.deepEqual(codes(manques), ["licence_souscription_echue"]);
  assert.match(manques[0].libelle, /essai/);
});

test("licence : affectations en attente comptées au libellé", () => {
  const manques = evaluerCompletude("licence",
    { ...LICENCE_SAINE, nb_affectations: 3, nb_affectations_en_attente: 2 },
    { aujourdhui: AUJOURDHUI });
  assert.deepEqual(codes(manques), ["licence_affectations_en_attente"]);
  assert.match(manques[0].libelle, /^2 affectation/);
});

test("licence sans usage déclaré : bloquant", () => {
  const manques = evaluerCompletude("licence",
    { ...LICENCE_SAINE, nb_affectations: 0 }, { aujourdhui: AUJOURDHUI });
  assert.deepEqual(codes(manques), ["licence_sans_usage"]);
});

test("maintenance échue : recommandé sur une perpétuelle seulement, jamais sur un arrêt assumé", () => {
  const echue = { ...LICENCE_SAINE, statut_maintenance: "echue" };
  assert.deepEqual(codes(evaluerCompletude("licence", echue, { aujourdhui: AUJOURDHUI })),
    ["licence_maintenance_echue"]);
  assert.deepEqual(
    evaluerCompletude("licence", { ...echue, type: "souscription" }, { aujourdhui: AUJOURDHUI }), []);
  assert.deepEqual(
    evaluerCompletude("licence", { ...echue, statut_maintenance: "arretee" }, { aujourdhui: AUJOURDHUI }), []);
});

test("licence : version ou édition manquante, bornée aux types à version gérée", () => {
  const sansVersion = { ...LICENCE_SAINE, id_version: null };
  assert.deepEqual(codes(evaluerCompletude("licence", sansVersion, { aujourdhui: AUJOURDHUI })),
    ["licence_declinaison_manquante"]);
  assert.deepEqual(
    evaluerCompletude("licence", { ...sansVersion, version_geree: false }, { aujourdhui: AUJOURDHUI }), []);
});

// ---------------------------------------------------------------------------
// Logiciel
// ---------------------------------------------------------------------------

test("logiciel : usages sans aucun droit (D53) bloquant, héritage déjà dans les droits", () => {
  assert.deepEqual(codes(evaluerCompletude("logiciel", { droits: 0, usages: 4, nb_composants: 0 })),
    ["logiciel_usage_sans_droit"]);
  assert.deepEqual(evaluerCompletude("logiciel", { droits: 5, usages: 4, nb_composants: 0 }), []);
  assert.deepEqual(evaluerCompletude("logiciel", { droits: 0, usages: 0, nb_composants: 0 }), []);
});

test("logiciel composé : un seul composant = composition incomplète (#216)", () => {
  assert.deepEqual(codes(evaluerCompletude("logiciel", { droits: 2, usages: 1, nb_composants: 1 })),
    ["logiciel_compose_sans_composition"]);
  assert.deepEqual(evaluerCompletude("logiciel", { droits: 2, usages: 1, nb_composants: 2 }), []);
});

// ---------------------------------------------------------------------------
// Affectation
// ---------------------------------------------------------------------------

test("affectation en attente (ou sans entrée de workflow) : bloquant", () => {
  assert.deepEqual(codes(evaluerCompletude("affectation", { statut_validation: "en_attente" })),
    ["affectation_en_attente"]);
  assert.deepEqual(codes(evaluerCompletude("affectation", { statut_validation: null })),
    ["affectation_en_attente"]);
});

test("affectation refusée : bloquant, motif au libellé", () => {
  const manques = evaluerCompletude("affectation",
    { statut_validation: "refuse", message_refus: "Quantité invraisemblable" });
  assert.deepEqual(codes(manques), ["affectation_refusee"]);
  assert.match(manques[0].libelle, /Quantité invraisemblable/);
});

test("affectation validée ou à revalider : aucun manque de complétude", () => {
  assert.deepEqual(evaluerCompletude("affectation", { statut_validation: "valide" }), []);
  assert.deepEqual(evaluerCompletude("affectation", { statut_validation: "a_revalider" }), []);
});

// ---------------------------------------------------------------------------
// Résumé
// ---------------------------------------------------------------------------

test("compterResume : entités avec manque, manques par gravité et par règle", () => {
  const c1 = evaluerCompletude("commande", { montant: 600, nb_factures: 0, nb_preuves: 0, nb_licences: 1 });
  const c2 = evaluerCompletude("commande", { montant: null, nb_factures: 0, nb_preuves: 1, nb_licences: 0 });
  const c3 = evaluerCompletude("commande", { montant: 100, nb_factures: 1, nb_preuves: 1, nb_licences: 1 });
  const resume = compterResume([c1, c2, c3]);
  assert.equal(resume.total, 3);
  assert.equal(resume.avec_manque, 2);
  assert.equal(resume.bloquants, 2);
  assert.equal(resume.recommandes, 3);
  assert.deepEqual(resume.par_regle, {
    commande_sans_facture: 2,
    commande_sans_preuve: 1,
    commande_sans_licence: 1,
    commande_montant_absent: 1,
  });
});
