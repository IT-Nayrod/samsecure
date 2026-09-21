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
  licenceExpiree, LICENCE_EXPIREE, TYPES_A_ECHEANCE, TYPE_VERSION_ESSAI,
  droitsHeritesParComposant, appliquerHeritageComposes,
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

describe("licenceExpiree (D44 etendu : versions d'essai)", () => {
  const aujourdhui = "2026-09-10";

  test("une perpetuelle n'expire jamais, meme avec une date de fin", () => {
    assert.equal(licenceExpiree({ type: "perpetuelle", date_fin_souscription: "2020-01-01" }, aujourdhui), false);
  });

  test("une souscription sort des droits le lendemain de sa date de fin", () => {
    assert.equal(licenceExpiree({ type: "souscription", date_fin_souscription: "2026-09-09" }, aujourdhui), true);
    assert.equal(licenceExpiree({ type: "souscription", date_fin_souscription: "2026-09-10" }, aujourdhui), false);
    assert.equal(licenceExpiree({ type: "souscription", date_fin_souscription: "2026-12-31" }, aujourdhui), false);
  });

  test("une version d'essai suit exactement la regle de la souscription", () => {
    assert.equal(licenceExpiree({ type: TYPE_VERSION_ESSAI, date_fin_souscription: "2026-09-09" }, aujourdhui), true);
    assert.equal(licenceExpiree({ type: TYPE_VERSION_ESSAI, date_fin_souscription: "2026-09-10" }, aujourdhui), false);
    assert.equal(licenceExpiree({ type: TYPE_VERSION_ESSAI, date_fin_souscription: null }, aujourdhui), false);
  });

  test("sans date de fin, une licence a echeance reste active", () => {
    assert.equal(licenceExpiree({ type: "souscription", date_fin_souscription: null }, aujourdhui), false);
    assert.equal(licenceExpiree({ type: "souscription" }, aujourdhui), false);
  });

  test("repli : un type inconnu du referentiel (055 non jouee ou autre code) n'echoit pas", () => {
    assert.equal(licenceExpiree({ type: "location", date_fin_souscription: "2020-01-01" }, aujourdhui), false);
    assert.equal(licenceExpiree({ type: null, date_fin_souscription: "2020-01-01" }, aujourdhui), false);
  });

  test("dates JS et chaines ISO comparees au jour calendaire", () => {
    assert.equal(licenceExpiree(
      { type: "souscription", date_fin_souscription: new Date("2026-09-09T23:59:00Z") },
      new Date("2026-09-10T00:01:00Z")), true);
    assert.equal(licenceExpiree(
      { type: "souscription", date_fin_souscription: new Date("2026-09-10T00:00:00Z") },
      new Date("2026-09-10T23:00:00Z")), false);
  });

  test("le code de la version d'essai est celui du referentiel type_licence seede par la 055", () => {
    assert.equal(TYPE_VERSION_ESSAI, "essai");
    assert.ok(TYPES_A_ECHEANCE.includes("essai"));
    assert.equal(licenceExpiree({ type: "essai", date_fin_souscription: "2026-09-09" }, aujourdhui), true);
    assert.equal(licenceExpiree({ type: "essai", date_fin_souscription: "2026-09-10" }, aujourdhui), false);
    // L'ancien code provisoire ne doit plus apparaitre : il ne correspond a
    // aucune licence et n'expirerait rien.
    assert.equal(licenceExpiree({ type: "version_essai", date_fin_souscription: "2020-01-01" }, aujourdhui), false);
    assert.ok(!LICENCE_EXPIREE.includes("version_essai"));
  });

  test("le fragment SQL porte les memes types que la regle JS", () => {
    assert.deepEqual(TYPES_A_ECHEANCE, ["souscription", TYPE_VERSION_ESSAI]);
    for (const t of TYPES_A_ECHEANCE) assert.ok(LICENCE_EXPIREE.includes(`'${t}'`));
    assert.ok(LICENCE_EXPIREE.includes("l.date_fin_souscription < CURRENT_DATE"));
  });
});

// Règle client du 17/09/2026 (#216). Exemple de référence : Office, composé
// de Word et d'Excel, même éditeur. Les lignes d'entrée portent les droits
// PROPRES (licences actives du logiciel) et les usages du logiciel lui-même.
describe("logiciels composes : heritage des droits (#216)", () => {
  const OFFICE = "office", WORD = "word", EXCEL = "excel";
  const compositionOffice = [
    { id_produit_compose: OFFICE, id_produit_composant: WORD },
    { id_produit_compose: OFFICE, id_produit_composant: EXCEL },
  ];
  const ligne = (id, droits, usages) => ({ id_produit: id, droits_total: droits, usages_total: usages });
  const parId = (lignes) => new Map(lignes.map((l) => [l.id_produit, l]));
  const balance = (l, prix = null) => valoriserBalance({ ...l, prix_unitaire: prix }, seuils);

  test("exemple Office : la licence du compose couvre Word et Excel", () => {
    // 10 licences Office, aucune licence Word ou Excel active, 8 usages Word
    // et 7 usages Excel : une licence Office seule suffit.
    const r = parId(appliquerHeritageComposes(
      [ligne(OFFICE, 10, 0), ligne(WORD, 0, 8), ligne(EXCEL, 0, 7)], compositionOffice));
    assert.equal(r.get(WORD).droits_total, 10);
    assert.equal(r.get(WORD).droits_herites, 10);
    assert.equal(r.get(WORD).droits_propres, 0);
    assert.equal(r.get(EXCEL).droits_total, 10);
    const word = balance(r.get(WORD)), excel = balance(r.get(EXCEL));
    assert.equal(word.statut_conformite, "conforme");
    assert.equal(word.usage_sans_droit, false);
    assert.equal(word.ecart, 2);
    assert.equal(word.ecart_pct, 80);
    assert.equal(excel.statut_conformite, "conforme");
    // Sans la composition, les deux composants seraient en usage sans droit.
    const sans = balance(ligne(WORD, 0, 8));
    assert.equal(sans.statut_conformite, "depassement");
    assert.equal(sans.usage_sans_droit, true);
  });

  test("exemple Office : une licence de composant ne couvre jamais le compose", () => {
    // 50 licences Word, 10 licences Office, 12 usages Office : le compose
    // reste en depassement, les droits de Word ne remontent pas.
    const r = parId(appliquerHeritageComposes(
      [ligne(OFFICE, 10, 12), ligne(WORD, 50, 0), ligne(EXCEL, 50, 0)], compositionOffice));
    assert.equal(r.get(OFFICE).droits_total, 10);
    assert.equal(r.get(OFFICE).droits_herites, 0);
    assert.equal(balance(r.get(OFFICE)).statut_conformite, "depassement");
    assert.equal(balance(r.get(OFFICE)).ecart, -2);
  });

  test("exemple Office : cumul des licences propres et de la licence du compose", () => {
    // 5 licences Word + 10 licences Office = 15 droits effectifs sur Word.
    const r = parId(appliquerHeritageComposes(
      [ligne(OFFICE, 10, 0), ligne(WORD, 5, 12), ligne(EXCEL, 0, 0)], compositionOffice));
    assert.equal(r.get(WORD).droits_propres, 5);
    assert.equal(r.get(WORD).droits_herites, 10);
    assert.equal(r.get(WORD).droits_total, 15);
    assert.equal(balance(r.get(WORD)).statut_conformite, "conforme");
    assert.equal(balance(ligne(WORD, 5, 12)).statut_conformite, "depassement");
    // Au-dela du cumul, le depassement se mesure sur le droit effectif.
    const depasse = balance({ ...r.get(WORD), usages_total: 18 });
    assert.equal(depasse.statut_conformite, "depassement");
    assert.equal(depasse.ecart, -3);
  });

  test("les usages de chacun restent les siens", () => {
    const entree = [ligne(OFFICE, 10, 9), ligne(WORD, 5, 3), ligne(EXCEL, 0, 4)];
    const r = parId(appliquerHeritageComposes(entree, compositionOffice));
    assert.equal(r.get(OFFICE).usages_total, 9);
    assert.equal(r.get(WORD).usages_total, 3);
    assert.equal(r.get(EXCEL).usages_total, 4);
    // Les lignes d'entree ne sont pas modifiees.
    assert.equal(entree[1].droits_total, 5);
    assert.equal(entree[1].droits_herites, undefined);
  });

  test("un composant de plusieurs composes cumule leurs droits", () => {
    const compositions = [...compositionOffice, { id_produit_compose: "m365", id_produit_composant: WORD }];
    const herites = droitsHeritesParComposant(new Map([[OFFICE, 10], ["m365", 4], [WORD, 5]]), compositions);
    assert.equal(herites.get(WORD), 14);
    assert.equal(herites.get(EXCEL), 10);
    assert.equal(herites.has(OFFICE), false);
    assert.equal(herites.has("m365"), false);
  });

  test("un compose sans droit actif (licence echue) ne transmet rien", () => {
    // Les droits propres fournis sont deja nets des licences echues : un
    // compose echu vaut 0 et le composant retombe en usage sans droit.
    const r = parId(appliquerHeritageComposes([ligne(OFFICE, 0, 0), ligne(WORD, 0, 3)], compositionOffice));
    assert.equal(r.get(WORD).droits_total, 0);
    assert.equal(balance(r.get(WORD)).usage_sans_droit, true);
    assert.equal(balance(r.get(WORD)).ecart_pct, null);
  });

  test("un seul niveau : seuls les droits propres du compose se transmettent", () => {
    // Donnee fautive (interdite par la 068 et par l'API) : suite -> office -> word.
    const compositions = [
      { id_produit_compose: "suite", id_produit_composant: OFFICE },
      { id_produit_compose: OFFICE, id_produit_composant: WORD },
    ];
    const r = parId(appliquerHeritageComposes(
      [ligne("suite", 100, 0), ligne(OFFICE, 10, 0), ligne(WORD, 0, 0)], compositions));
    assert.equal(r.get(OFFICE).droits_total, 110);
    assert.equal(r.get(WORD).droits_total, 10);  // 10 et non 110
  });

  test("couple repete, reflexif ou incomplet : sans effet", () => {
    const compositions = [
      ...compositionOffice, compositionOffice[0],
      { id_produit_compose: WORD, id_produit_composant: WORD },
      { id_produit_compose: null, id_produit_composant: EXCEL },
      null,
    ];
    const herites = droitsHeritesParComposant({ [OFFICE]: 10, [WORD]: 5 }, compositions);
    assert.equal(herites.get(WORD), 10);
    assert.equal(herites.get(EXCEL), 10);
  });

  test("liste filtree : les droits du compose viennent de la table fournie", () => {
    // La ligne d'Office est absente (filtre sur Word) : ses droits propres
    // sont lus dans droitsPropres, pas dans les lignes.
    const [word] = appliquerHeritageComposes([ligne(WORD, 5, 12)], compositionOffice, new Map([[OFFICE, 10], [WORD, 5]]));
    assert.equal(word.droits_total, 15);
    // Sans table, l'heritage se limite aux lignes presentes.
    const [seul] = appliquerHeritageComposes([ligne(WORD, 5, 12)], compositionOffice);
    assert.equal(seul.droits_total, 5);
  });

  test("valorisation : un excedent herite n'est pas valorise sur le composant", () => {
    // Word : 5 propres + 10 herites, prix 100.
    const w = (usages) => valoriserBalance(
      { droits_total: 15, droits_herites: 10, usages_total: usages, prix_unitaire: 100 }, seuils);
    assert.equal(w(3).ecart, 12);
    assert.equal(w(3).ecart_valorise, 200);   // excedent propre : 5 - 3
    assert.equal(w(8).ecart, 7);
    assert.equal(w(8).ecart_valorise, 0);     // couvert par l'heritage, aucun excedent propre
    assert.equal(w(18).ecart, -3);
    assert.equal(w(18).ecart_valorise, -300); // un manque reste valorise en entier
    assert.equal(w(18).statut_conformite, "depassement");
  });

  test("sans composition, la balance est celle d'avant la 068", () => {
    const entree = [ligne("a", 10, 4), ligne("b", 0, 2)];
    const r = appliquerHeritageComposes(entree, []);
    assert.deepEqual(r.map((l) => [l.droits_total, l.droits_herites, l.droits_propres]), [[10, 0, 10], [0, 0, 0]]);
    const b = valoriserBalance({ droits_total: 10, usages_total: 4, prix_unitaire: 50 }, seuils);
    assert.equal(b.ecart_valorise, 300);
    assert.equal(b.droits_herites, 0);
    assert.equal(b.droits_propres, 10);
    const d = valoriserBalance({ droits_total: 10, usages_total: 14, prix_unitaire: 50 }, seuils);
    assert.equal(d.ecart_valorise, -200);
  });
});
