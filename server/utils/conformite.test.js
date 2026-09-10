// Tests des fonctions pures de la balance de conformité (D52, D53).
// Exécution : node --test server/utils/conformite.test.js
// (hors du npm test racine, qui ne couvre que src/utils). Ce module importe
// db.js pour ses requêtes : le pool n'ouvre aucune connexion tant qu'aucune
// requête n'est émise, les fonctions testées ici n'en émettent pas.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  prixUnitaireDerniereCommande, tauxConformite, valoriserBalance,
  statutConformite, niveauConformite,
} from "./conformite.js";

const seuils = { seuilTaux: 90, seuilMontant: 10000 };

describe("prixUnitaireDerniereCommande (D52)", () => {
  test("aucune ligne : null", () => {
    assert.equal(prixUnitaireDerniereCommande([]), null);
    assert.equal(prixUnitaireDerniereCommande(), null);
  });

  test("le prix est celui de la derniere commande, jamais une moyenne", () => {
    // Moyenne des deux lignes : (1000 + 3000) / (10 + 10) = 200. Attendu : 300.
    const lignes = [
      { id: "a", cout_licence: 1000, quantite: 10, date_commande: "2025-01-15", created_at: "2025-01-15T10:00:00" },
      { id: "b", cout_licence: 3000, quantite: 10, date_commande: "2026-03-01", created_at: "2025-02-01T10:00:00" },
    ];
    assert.equal(prixUnitaireDerniereCommande(lignes), 300);
  });

  test("la date de commande prime sur la date de creation", () => {
    // La ligne créée en dernier porte une commande plus ancienne.
    const lignes = [
      { id: "a", cout_licence: 500, quantite: 5, date_commande: "2026-06-01", created_at: "2026-01-01T00:00:00" },
      { id: "b", cout_licence: 800, quantite: 4, date_commande: "2026-02-01", created_at: "2026-08-01T00:00:00" },
    ];
    assert.equal(prixUnitaireDerniereCommande(lignes), 100);
  });

  test("sans date de commande, la date de creation departage, et les lignes datees passent devant", () => {
    const lignes = [
      { id: "a", cout_licence: 120, quantite: 2, date_commande: null, created_at: "2026-08-01T00:00:00" },
      { id: "b", cout_licence: 90, quantite: 3, date_commande: null, created_at: "2026-07-01T00:00:00" },
    ];
    assert.equal(prixUnitaireDerniereCommande(lignes), 60);
    const avecDatee = [...lignes,
      { id: "c", cout_licence: 400, quantite: 8, date_commande: "2024-01-01", created_at: "2024-01-01T00:00:00" }];
    assert.equal(prixUnitaireDerniereCommande(avecDatee), 50);
  });

  test("une derniere ligne sans prix calculable est ignoree au profit de la precedente", () => {
    const lignes = [
      { id: "a", cout_licence: 1000, quantite: 10, date_commande: "2026-01-01", created_at: "2026-01-01T00:00:00" },
      { id: "b", cout_licence: null, quantite: 10, date_commande: "2026-05-01", created_at: "2026-05-01T00:00:00" },
      { id: "c", cout_licence: 500, quantite: 0, date_commande: "2026-06-01", created_at: "2026-06-01T00:00:00" },
    ];
    assert.equal(prixUnitaireDerniereCommande(lignes), 100);
    assert.equal(prixUnitaireDerniereCommande([lignes[1], lignes[2]]), null);
  });

  test("valeurs textuelles du pilote pg et dates JS acceptees, arrondi au centime", () => {
    const lignes = [
      { id: "a", cout_licence: "1000.00", quantite: "3", date_commande: new Date("2026-04-01"), created_at: new Date("2026-04-01") },
    ];
    assert.equal(prixUnitaireDerniereCommande(lignes), 333.33);
  });
});

describe("tauxConformite (D53)", () => {
  test("droits a zero : aucun taux, meme avec des usages", () => {
    assert.equal(tauxConformite(0, 0), null);
    assert.equal(tauxConformite(0, 7), null);
    assert.equal(tauxConformite(null, 3), null);
  });

  test("taux en pourcent des droits, borne a 999.99", () => {
    assert.equal(tauxConformite(10, 9), 90);
    assert.equal(tauxConformite(3, 1), 33.33);
    assert.equal(tauxConformite(1, 5000), 999.99);
  });
});

describe("valoriserBalance", () => {
  test("droits a zero avec usages : depassement, taux null, ecart valorise au prix de la derniere commande", () => {
    const r = valoriserBalance({ droits_total: 0, usages_total: 4, prix_unitaire: 250 }, seuils);
    assert.equal(r.statut_conformite, "depassement");
    assert.equal(r.ecart_pct, null);
    assert.equal(r.usage_sans_droit, true);
    assert.equal(r.ecart, -4);
    assert.equal(r.ecart_valorise, -1000);
  });

  test("droits et usages nuls : conforme, rien a rapprocher, pas d'anomalie", () => {
    const r = valoriserBalance({ droits_total: 0, usages_total: 0, prix_unitaire: null }, seuils);
    assert.equal(r.statut_conformite, "conforme");
    assert.equal(r.ecart_pct, null);
    assert.equal(r.usage_sans_droit, false);
    assert.equal(r.ecart_valorise, null);
  });

  test("le prix unitaire transmis est employe tel quel, pas un rapport cout / droits", () => {
    // 10 droits, 6 usages, prix 300 (dernière commande) : écart 4 x 300 = 1200.
    const r = valoriserBalance({ droits_total: 10, usages_total: 6, prix_unitaire: 300 }, seuils);
    assert.equal(r.ecart_pct, 60);
    assert.equal(r.ecart_valorise, 1200);
    assert.equal(r.usage_sans_droit, false);
    assert.equal(r.statut_conformite, "conforme");
  });

  test("sans prix connu, l'ecart valorise est null et le statut reste calcule", () => {
    const r = valoriserBalance({ droits_total: 10, usages_total: 12, prix_unitaire: null }, seuils);
    assert.equal(r.ecart_valorise, null);
    assert.equal(r.statut_conformite, "depassement");
    assert.equal(r.ecart_pct, 120);
  });

  test("valeurs textuelles du pilote pg acceptees", () => {
    const r = valoriserBalance({ droits_total: "8", usages_total: "8", prix_unitaire: "12.50" }, seuils);
    assert.equal(r.statut_conformite, "attention");
    assert.equal(r.ecart_valorise, 0);
    assert.equal(r.prix_unitaire, 12.5);
  });
});

describe("statutConformite et niveauConformite", () => {
  test("depassement prime, attention au seuil de taux, conforme sinon", () => {
    assert.equal(statutConformite(10, 11, null, seuils), "depassement");
    assert.equal(statutConformite(10, 9, null, seuils), "attention");
    assert.equal(statutConformite(10, 8, null, seuils), "conforme");
    assert.equal(statutConformite(0, 0, null, seuils), "conforme");
    assert.equal(niveauConformite(0, 1), "depassement");
  });

  test("attention sur ecart valorise negatif au-dela du seuil en montant", () => {
    assert.equal(statutConformite(10, 5, -20000, seuils), "attention");
    assert.equal(statutConformite(10, 5, -500, seuils), "conforme");
  });
});
