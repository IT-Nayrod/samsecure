// Tests de la validation de date ISO (#214, date de la preuve).
// Execution : node --test server/utils/dateIso.test.js
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dateIsoValide } from "./dateIso.js";

describe("dateIsoValide", () => {
  test("date calendaire valide", () => {
    assert.equal(dateIsoValide("2026-09-16"), true);
    assert.equal(dateIsoValide("2024-02-29"), true);
    assert.equal(dateIsoValide("2026-12-31"), true);
  });
  test("format refuse", () => {
    assert.equal(dateIsoValide("16/09/2026"), false);
    assert.equal(dateIsoValide("2026-9-16"), false);
    assert.equal(dateIsoValide("2026-09-16T00:00:00Z"), false);
    assert.equal(dateIsoValide(""), false);
  });
  test("calendrier refuse", () => {
    assert.equal(dateIsoValide("2026-02-31"), false);
    assert.equal(dateIsoValide("2026-13-01"), false);
    assert.equal(dateIsoValide("2026-00-10"), false);
    assert.equal(dateIsoValide("2023-02-29"), false);
  });
  test("valeurs non textuelles refusees", () => {
    assert.equal(dateIsoValide(null), false);
    assert.equal(dateIsoValide(undefined), false);
    assert.equal(dateIsoValide(20260916), false);
    assert.equal(dateIsoValide(new Date("2026-09-16")), false);
  });
});
