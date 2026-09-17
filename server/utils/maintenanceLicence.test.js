// Tests de la dérivation de l'état de maintenance depuis les périodes (#201,
// retour client du 16/09/2026 : « sous maintenance » n'est jamais un attribut
// direct de la licence).
// Execution : node --test server/utils/maintenanceLicence.test.js
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  etatMaintenance, periodeReference, periodeCouvre, echeanceMaintenance, STATUTS_MAINTENANCE,
} from "./maintenanceLicence.js";

const AUJOURDHUI = "2026-09-16";
const opts = { aujourdhui: AUJOURDHUI };

const periode = (surcharges = {}) => ({
  id: "p1", id_mainteneur: "m1", mainteneur_label: "Mainteneur Un",
  date_debut: "2026-01-01", date_fin: "2026-12-31", created_at: "2026-01-01T10:00:00Z", ...surcharges,
});
const licence = (surcharges = {}) => ({ id: "l1", date_arret_maintenance: null, ...surcharges });

describe("periodeCouvre", () => {
  test("bornes incluses, fin nulle ouverte", () => {
    assert.equal(periodeCouvre(periode({ date_debut: "2026-09-16", date_fin: "2026-09-16" }), AUJOURDHUI), true);
    assert.equal(periodeCouvre(periode({ date_fin: null }), AUJOURDHUI), true);
    assert.equal(periodeCouvre(periode({ date_debut: "2026-09-17" }), AUJOURDHUI), false);
    assert.equal(periodeCouvre(periode({ date_fin: "2026-09-15" }), AUJOURDHUI), false);
  });
  test("dates servies en Date par pg tolerees", () => {
    assert.equal(periodeCouvre(periode({ date_debut: new Date("2026-01-01T00:00:00Z"), date_fin: new Date("2026-12-31T00:00:00Z") }), AUJOURDHUI), true);
  });
});

describe("periodeReference", () => {
  test("aucune periode : aucune", () => {
    assert.deepEqual(periodeReference([], opts), { statut: "aucune", periode: null });
  });
  test("periode en cours : active", () => {
    const r = periodeReference([periode()], opts);
    assert.equal(r.statut, "active");
    assert.equal(r.periode.id, "p1");
  });
  test("chevauchement : la plus recente des periodes en cours", () => {
    const r = periodeReference([
      periode({ id: "ancienne", date_debut: "2025-06-01", date_fin: null }),
      periode({ id: "recente", date_debut: "2026-03-01", date_fin: "2027-02-28" }),
    ], opts);
    assert.equal(r.statut, "active");
    assert.equal(r.periode.id, "recente");
  });
  test("seulement a venir : la prochaine", () => {
    const r = periodeReference([
      periode({ id: "loin", date_debut: "2027-06-01", date_fin: "2028-05-31" }),
      periode({ id: "proche", date_debut: "2026-10-01", date_fin: "2027-09-30" }),
    ], opts);
    assert.equal(r.statut, "a_venir");
    assert.equal(r.periode.id, "proche");
  });
  test("toutes echues : la fin la plus tardive", () => {
    const r = periodeReference([
      periode({ id: "vieille", date_debut: "2023-01-01", date_fin: "2023-12-31" }),
      periode({ id: "derniere", date_debut: "2025-01-01", date_fin: "2025-12-31" }),
    ], opts);
    assert.equal(r.statut, "echue");
    assert.equal(r.periode.id, "derniere");
  });
  test("echue et a venir : a venir prime", () => {
    const r = periodeReference([
      periode({ id: "passee", date_debut: "2025-01-01", date_fin: "2025-12-31" }),
      periode({ id: "future", date_debut: "2026-11-01", date_fin: "2027-10-31" }),
    ], opts);
    assert.equal(r.statut, "a_venir");
    assert.equal(r.periode.id, "future");
  });
});

describe("etatMaintenance", () => {
  test("sans periode : aucune, aucun mainteneur, aucune date", () => {
    assert.deepEqual(etatMaintenance(licence(), [], opts), {
      statut_maintenance: "aucune", id_maintenance_reference: null,
      id_mainteneur: null, mainteneur_label: null,
      date_debut_maintenance: null, date_fin_maintenance: null, nb_periodes_maintenance: 0,
    });
  });
  test("periode en cours : active, mainteneur et fin de la periode", () => {
    const e = etatMaintenance(licence(), [periode()], opts);
    assert.equal(e.statut_maintenance, "active");
    assert.equal(e.mainteneur_label, "Mainteneur Un");
    assert.equal(e.date_debut_maintenance, "2026-01-01");
    assert.equal(e.date_fin_maintenance, "2026-12-31");
    assert.equal(e.nb_periodes_maintenance, 1);
  });
  test("periode ouverte : active sans fin", () => {
    const e = etatMaintenance(licence(), [periode({ date_fin: null })], opts);
    assert.equal(e.statut_maintenance, "active");
    assert.equal(e.date_fin_maintenance, null);
  });
  test("periode echue : echue, fin de la derniere periode", () => {
    const e = etatMaintenance(licence(), [periode({ date_debut: "2025-01-01", date_fin: "2025-12-31" })], opts);
    assert.equal(e.statut_maintenance, "echue");
    assert.equal(e.date_fin_maintenance, "2025-12-31");
  });
  test("periode a venir : a_venir, bornes de la prochaine", () => {
    const e = etatMaintenance(licence(), [periode({ date_debut: "2026-10-01", date_fin: "2027-09-30" })], opts);
    assert.equal(e.statut_maintenance, "a_venir");
    assert.equal(e.date_debut_maintenance, "2026-10-01");
    assert.equal(e.date_fin_maintenance, "2027-09-30");
  });
  test("arret : arretee prime, fin = date d'arret, mainteneur de la derniere periode", () => {
    const e = etatMaintenance(licence({ date_arret_maintenance: "2026-06-30" }), [
      periode({ id: "p0", mainteneur_label: "Ancien", date_debut: "2024-01-01", date_fin: "2024-12-31" }),
      periode({ id: "p1", mainteneur_label: "Dernier", date_debut: "2026-01-01", date_fin: "2026-06-30" }),
    ], opts);
    assert.equal(e.statut_maintenance, "arretee");
    assert.equal(e.date_fin_maintenance, "2026-06-30");
    assert.equal(e.mainteneur_label, "Dernier");
    assert.equal(e.id_maintenance_reference, "p1");
  });
  test("arret sans periode : arretee, date d'arret servie", () => {
    const e = etatMaintenance(licence({ date_arret_maintenance: new Date("2026-06-30T00:00:00Z") }), [], opts);
    assert.equal(e.statut_maintenance, "arretee");
    assert.equal(e.date_fin_maintenance, "2026-06-30");
    assert.equal(e.mainteneur_label, null);
  });
  test("l'attribut direct a_maintenance n'a aucun effet", () => {
    const sans = etatMaintenance(licence({ a_maintenance: true, date_fin_maintenance: "2027-01-01", id_mainteneur: "x" }), [], opts);
    assert.equal(sans.statut_maintenance, "aucune");
    assert.equal(sans.date_fin_maintenance, null);
    assert.equal(sans.id_mainteneur, null);
    const avec = etatMaintenance(licence({ a_maintenance: false }), [periode()], opts);
    assert.equal(avec.statut_maintenance, "active");
  });
  test("statuts servis appartiennent au vocabulaire", () => {
    for (const cas of [[], [periode()], [periode({ date_debut: "2027-01-01" })], [periode({ date_debut: "2020-01-01", date_fin: "2020-12-31" })]]) {
      assert.ok(STATUTS_MAINTENANCE.includes(etatMaintenance(licence(), cas, opts).statut_maintenance));
    }
    assert.ok(STATUTS_MAINTENANCE.includes(etatMaintenance(licence({ date_arret_maintenance: "2026-01-01" }), [], opts).statut_maintenance));
  });
});

describe("echeanceMaintenance", () => {
  test("periode en cours avec fin : prolongeable", () => {
    assert.deepEqual(echeanceMaintenance(licence(), [periode()], opts), { id_maintenance: "p1", date: "2026-12-31" });
  });
  test("periode echue : prolongeable (la derniere)", () => {
    const e = echeanceMaintenance(licence(), [periode({ id: "p9", date_debut: "2025-01-01", date_fin: "2025-12-31" })], opts);
    assert.deepEqual(e, { id_maintenance: "p9", date: "2025-12-31" });
  });
  test("arretee, sans periode ou ouverte : rien", () => {
    assert.equal(echeanceMaintenance(licence({ date_arret_maintenance: "2026-06-30" }), [periode()], opts), null);
    assert.equal(echeanceMaintenance(licence(), [], opts), null);
    assert.equal(echeanceMaintenance(licence(), [periode({ date_fin: null })], opts), null);
  });
});
