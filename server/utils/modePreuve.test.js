// Tests du mode d'une preuve (#220, preuves externes) : cohérence du support
// avec le mode, miroir de la contrainte ck_preuve_mode_coherence (072).
// Execution : node --test server/utils/modePreuve.test.js
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  MODES_PREUVE, URL_EXTERNE_MAX, REFERENCE_EXTERNE_MAX,
  modeExterne, urlExterneValide, appliquerMode, controlerValeurMode, controlerMode, coherentPourLaBase,
} from "./modePreuve.js";

const BASE = { label: "Certificat", url_fichier: null, url_externe: null, reference_externe: null };
const code = (corps) => controlerMode(appliquerMode(corps))?.code ?? null;

describe("modeExterne", () => {
  test("seuls url et reference sont externes", () => {
    assert.equal(modeExterne("url"), true);
    assert.equal(modeExterne("reference"), true);
    assert.equal(modeExterne("fichier"), false);
    assert.equal(modeExterne(null), false);
  });
});

describe("urlExterneValide", () => {
  test("adresses http et https admises", () => {
    assert.equal(urlExterneValide("https://ged.exemple.fr/documents/42"), true);
    assert.equal(urlExterneValide("http://intranet/contrats?id=7&v=2#page=3"), true);
    assert.equal(urlExterneValide("  https://ged.exemple.fr/a  "), true);
    assert.equal(urlExterneValide("HTTPS://GED.EXEMPLE.FR/A"), true);
  });
  test("schemas dangereux ou non web refuses", () => {
    assert.equal(urlExterneValide("javascript:alert(1)"), false);
    assert.equal(urlExterneValide("data:text/html,<script>alert(1)</script>"), false);
    assert.equal(urlExterneValide("ftp://serveur/fichier.pdf"), false);
    assert.equal(urlExterneValide("file:///etc/passwd"), false);
  });
  test("formes incompletes refusees", () => {
    assert.equal(urlExterneValide("ged.exemple.fr/documents/42"), false);
    assert.equal(urlExterneValide("http:exemple.fr"), false);
    assert.equal(urlExterneValide("https://"), false);
    assert.equal(urlExterneValide(""), false);
    assert.equal(urlExterneValide("   "), false);
  });
  test("espaces et caracteres de controle refuses", () => {
    assert.equal(urlExterneValide("https://ged.exemple.fr/mon document"), false);
    assert.equal(urlExterneValide("https://ged.exemple.fr/a\nb"), false);
    assert.equal(urlExterneValide("java\tscript://x"), false);
  });
  test("longueur bornee a la colonne", () => {
    const racine = "https://ged.exemple.fr/";
    assert.equal(urlExterneValide(racine + "a".repeat(URL_EXTERNE_MAX - racine.length)), true);
    assert.equal(urlExterneValide(racine + "a".repeat(URL_EXTERNE_MAX - racine.length + 1)), false);
  });
  test("valeurs non textuelles refusees", () => {
    for (const v of [null, undefined, 42, {}, [], true]) assert.equal(urlExterneValide(v), false);
  });
});

describe("appliquerMode", () => {
  test("mode absent lu comme fichier", () => {
    for (const mode of [undefined, null, ""]) {
      const c = appliquerMode({ ...BASE, mode, url_fichier: "en-attente-de-depot" });
      assert.equal(c.mode, "fichier");
      assert.equal(c.url_fichier, "en-attente-de-depot");
    }
  });
  test("le mode decide : les champs des autres modes repartent a null", () => {
    const tout = { ...BASE, url_fichier: "x.pdf", url_externe: "https://a.fr/1", reference_externe: "GED-1" };
    assert.deepEqual(
      (({ url_fichier, url_externe, reference_externe }) => ({ url_fichier, url_externe, reference_externe }))(appliquerMode({ ...tout, mode: "fichier" })),
      { url_fichier: "x.pdf", url_externe: null, reference_externe: null });
    assert.deepEqual(
      (({ url_fichier, url_externe, reference_externe }) => ({ url_fichier, url_externe, reference_externe }))(appliquerMode({ ...tout, mode: "url" })),
      { url_fichier: null, url_externe: "https://a.fr/1", reference_externe: null });
    assert.deepEqual(
      (({ url_fichier, url_externe, reference_externe }) => ({ url_fichier, url_externe, reference_externe }))(appliquerMode({ ...tout, mode: "reference" })),
      { url_fichier: null, url_externe: null, reference_externe: "GED-1" });
  });
  test("blancs retires des valeurs externes", () => {
    assert.equal(appliquerMode({ ...BASE, mode: "url", url_externe: "  https://a.fr/1 " }).url_externe, "https://a.fr/1");
    assert.equal(appliquerMode({ ...BASE, mode: "reference", reference_externe: "  GED-1 " }).reference_externe, "GED-1");
  });
  test("les autres champs du corps sont conserves", () => {
    const c = appliquerMode({ ...BASE, mode: "reference", reference_externe: "GED-1", hash_sha256: "ab", id_contrat: "c1" });
    assert.equal(c.label, "Certificat");
    assert.equal(c.hash_sha256, "ab");
    assert.equal(c.id_contrat, "c1");
  });
});

describe("controlerMode", () => {
  test("mode inconnu : 3235", () => {
    assert.equal(controlerValeurMode("ged")?.code, 3235);
    assert.equal(code({ ...BASE, mode: "ged" }), 3235);
    assert.equal(code({ ...BASE, mode: 42 }), 3235);
    assert.equal(code({ ...BASE, mode: "URL", url_externe: "https://a.fr" }), 3235);
    for (const mode of MODES_PREUVE) assert.equal(controlerValeurMode(mode), null);
  });
  test("mode fichier : comportement d'origine, url_fichier obligatoire (3217)", () => {
    assert.equal(code({ ...BASE, url_fichier: "en-attente-de-depot" }), null);
    assert.equal(code({ ...BASE, mode: "fichier", url_fichier: "en-attente-de-depot" }), null);
    assert.equal(code({ ...BASE, mode: "fichier" }), 3217);
    assert.equal(code({ ...BASE, mode: "fichier", url_fichier: "   " }), 3217);
    // Une URL externe transmise en mode fichier ne tient pas lieu de fichier.
    assert.equal(code({ ...BASE, mode: "fichier", url_externe: "https://a.fr/1" }), 3217);
  });
  test("mode url : URL obligatoire et valide (3236)", () => {
    assert.equal(code({ ...BASE, mode: "url", url_externe: "https://ged.exemple.fr/42" }), null);
    assert.equal(code({ ...BASE, mode: "url" }), 3236);
    assert.equal(code({ ...BASE, mode: "url", url_externe: "" }), 3236);
    assert.equal(code({ ...BASE, mode: "url", url_externe: "   " }), 3236);
    assert.equal(code({ ...BASE, mode: "url", url_externe: "javascript:alert(1)" }), 3236);
    assert.equal(code({ ...BASE, mode: "url", url_externe: 42 }), 3236);
    // Une référence ne tient pas lieu d'URL.
    assert.equal(code({ ...BASE, mode: "url", reference_externe: "GED-1" }), 3236);
  });
  test("mode reference : reference obligatoire et bornee (3237)", () => {
    assert.equal(code({ ...BASE, mode: "reference", reference_externe: "GED-2026-0042" }), null);
    assert.equal(code({ ...BASE, mode: "reference", reference_externe: "a".repeat(REFERENCE_EXTERNE_MAX) }), null);
    assert.equal(code({ ...BASE, mode: "reference" }), 3237);
    assert.equal(code({ ...BASE, mode: "reference", reference_externe: "   " }), 3237);
    assert.equal(code({ ...BASE, mode: "reference", reference_externe: 42 }), 3237);
    assert.equal(code({ ...BASE, mode: "reference", reference_externe: "a".repeat(REFERENCE_EXTERNE_MAX + 1) }), 3237);
    assert.equal(code({ ...BASE, mode: "reference", url_externe: "https://a.fr/1" }), 3237);
  });
});

describe("miroir de la contrainte ck_preuve_mode_coherence", () => {
  const CAS = [
    { ...BASE, url_fichier: "en-attente-de-depot" },
    { ...BASE, mode: "fichier", url_fichier: "x.pdf", url_externe: "https://a.fr/1", reference_externe: "GED-1" },
    { ...BASE, mode: "fichier" },
    { ...BASE, mode: "url", url_externe: "https://a.fr/1", url_fichier: "x.pdf", reference_externe: "GED-1" },
    { ...BASE, mode: "url", url_externe: "   " },
    { ...BASE, mode: "url" },
    { ...BASE, mode: "reference", reference_externe: "GED-1", url_fichier: "x.pdf", url_externe: "https://a.fr/1" },
    { ...BASE, mode: "reference", reference_externe: "  " },
    { ...BASE, mode: "reference" },
    { ...BASE, mode: "ged", url_fichier: "x.pdf" },
  ];
  test("tout corps accepte par l'API est accepte par la base", () => {
    for (const cas of CAS) {
      const corps = appliquerMode(cas);
      if (controlerMode(corps) === null) assert.equal(coherentPourLaBase(corps), true, JSON.stringify(cas));
    }
  });
  test("la contrainte refuse les lignes incoherentes", () => {
    assert.equal(coherentPourLaBase({ mode: "fichier", url_fichier: null, url_externe: null, reference_externe: null }), false);
    assert.equal(coherentPourLaBase({ mode: "fichier", url_fichier: "x.pdf", url_externe: "https://a.fr", reference_externe: null }), false);
    assert.equal(coherentPourLaBase({ mode: "url", url_fichier: null, url_externe: null, reference_externe: null }), false);
    assert.equal(coherentPourLaBase({ mode: "url", url_fichier: "x.pdf", url_externe: "https://a.fr", reference_externe: null }), false);
    assert.equal(coherentPourLaBase({ mode: "url", url_fichier: null, url_externe: "https://a.fr", reference_externe: "GED-1" }), false);
    assert.equal(coherentPourLaBase({ mode: "reference", url_fichier: null, url_externe: null, reference_externe: "" }), false);
    assert.equal(coherentPourLaBase({ mode: "reference", url_fichier: null, url_externe: "https://a.fr", reference_externe: "GED-1" }), false);
    assert.equal(coherentPourLaBase({ mode: "ged", url_fichier: "x.pdf", url_externe: null, reference_externe: null }), false);
  });
  test("mode NULL en base lu comme fichier", () => {
    assert.equal(coherentPourLaBase({ mode: null, url_fichier: "x.pdf", url_externe: null, reference_externe: null }), true);
    assert.equal(coherentPourLaBase({ mode: null, url_fichier: null, url_externe: "https://a.fr", reference_externe: null }), false);
  });
});
