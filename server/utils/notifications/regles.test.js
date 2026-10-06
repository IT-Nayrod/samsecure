// Tests des regles pures du module notifications (story #121).
// Execution : node --test server/utils/notifications/regles.test.js
// (hors du npm test racine, qui ne couvre que src/utils, comme
// indiceConfiance.test.js).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cleEvenement, cleEcheance, couvreSociete, selectionnerDestinataires, modeCourrier,
  statutCourrierInitial, paliersDepuisSeuils, palierAtteint,
  composerCourrier, composerRecapitulatif, prefixeSujet, maintenanceNotifiable,
  normaliserLangue, resoudreTraduction,
  composantsParis, dateParis, instantParis, prochaineOccurrence, heurePassee,
} from "./regles.js";
import {
  composerTexte, PROFILS, TYPES_CODES, TYPES, formatEuros, formatDateFr, appliquerModele,
} from "./catalogue.js";

const candidat = (id, permissions, { tenant = false, societes = [] } = {}) => ({
  id, email: `${id}@exemple.fr`, prenom: id, nom: "Test",
  permissions: new Set(permissions), isTenantScope: tenant, societeIds: societes,
});

describe("cleEvenement", () => {
  test("type puis segments, valeurs vides explicites", () => {
    assert.equal(cleEvenement("echeance_contrat", "c1", 30), "echeance_contrat:c1:30");
    assert.equal(cleEvenement("budget_seuil", null, 2026), "budget_seuil:aucun:2026");
    assert.equal(cleEvenement("x", "", undefined), "x:aucun:aucun");
  });
  test("deux evenements distincts ne partagent pas de cle", () => {
    assert.notEqual(cleEvenement("t", "a", "b"), cleEvenement("t", "ab"));
  });
});

describe("cleEcheance (cle d'echeance durable, 16/09/2026)", () => {
  test("type, entite, date de fin au jour, palier", () => {
    assert.equal(cleEcheance("echeance_contrat", "c1", "2026-12-31", 30), "echeance_contrat:c1:2026-12-31:30");
    assert.equal(cleEcheance("echeance_souscription", "l1", "2027-03-01", 30), "echeance_souscription:l1:2027-03-01:30");
  });
  test("anti-doublon : meme entite, meme date de fin, meme palier donnent la meme cle", () => {
    assert.equal(cleEcheance("echeance_contrat", "c1", "2026-12-31", 30), cleEcheance("echeance_contrat", "c1", "2026-12-31", 30));
    assert.equal(cleEcheance("echeance_contrat", "c1", new Date("2026-12-31T00:00:00Z"), 30), cleEcheance("echeance_contrat", "c1", "2026-12-31", 30));
    assert.equal(cleEcheance("echeance_contrat", "c1", "2026-12-31T00:00:00.000Z", 30), cleEcheance("echeance_contrat", "c1", "2026-12-31", 30));
  });
  test("une prolongation (nouvelle date de fin) produit une nouvelle cle, sans liberation manuelle", () => {
    const avant = cleEcheance("echeance_souscription", "l1", "2026-12-31", 30);
    const apres = cleEcheance("echeance_souscription", "l1", "2027-12-31", 30);
    assert.notEqual(avant, apres);
    assert.ok(avant.startsWith("echeance_souscription:l1:") && apres.startsWith("echeance_souscription:l1:"));
  });
  test("paliers distincts, cles distinctes ; date absente rendue explicite", () => {
    assert.notEqual(cleEcheance("echeance_contrat", "c1", "2026-12-31", 30), cleEcheance("echeance_contrat", "c1", "2026-12-31", 60));
    assert.equal(cleEcheance("echeance_contrat", "c1", null, 30), "echeance_contrat:c1:aucun:30");
    assert.equal(cleEcheance("echeance_contrat", "c1", "", 30), "echeance_contrat:c1:aucun:30");
  });
  test("compatible avec cleEvenement : meme separateur, meme rendu des vides", () => {
    assert.equal(cleEcheance("echeance_contrat", "c1", "2026-12-31", 30), cleEvenement("echeance_contrat", "c1", "2026-12-31", 30));
  });
});

describe("couvreSociete et selectionnerDestinataires", () => {
  const manager = candidat("m", [PROFILS.manager_dsi, "valider_saisie", "consulter_kpi_financiers"], { societes: ["S1"] });
  const admin = candidat("a", Object.values(PROFILS).concat(["valider_saisie"]), { tenant: true });
  const financier = candidat("f", [PROFILS.financier], { societes: ["S2"] });
  const itops = candidat("i", [PROFILS.it_ops], { societes: ["S1", "S2"] });
  const sansDroit = candidat("z", [], { tenant: true });
  const candidats = [manager, admin, financier, itops, sansDroit];

  test("portee : tenant couvre tout, rattachement sinon", () => {
    assert.equal(couvreSociete(admin, "S9"), true);
    assert.equal(couvreSociete(manager, "S1"), true);
    assert.equal(couvreSociete(manager, "S2"), false);
    assert.equal(couvreSociete(manager, null), true);
  });

  test("echeance_contrat : Manager DSI et Admin SAM de la portee", () => {
    const ids = selectionnerDestinataires(candidats, { type: "echeance_contrat", id_societe: "S1" }).map((c) => c.id);
    assert.deepEqual(ids.sort(), ["a", "m"]);
    const horsPortee = selectionnerDestinataires(candidats, { type: "echeance_contrat", id_societe: "S2" }).map((c) => c.id);
    assert.deepEqual(horsPortee, ["a"]);
  });

  test("contrat_a_suivre : Manager DSI et Admin SAM de la portee, comme l'echeance de contrat", () => {
    const ids = selectionnerDestinataires(candidats, { type: "contrat_a_suivre", id_societe: "S1" }).map((c) => c.id);
    assert.deepEqual(ids.sort(), ["a", "m"]);
    assert.deepEqual(selectionnerDestinataires(candidats, { type: "contrat_a_suivre", id_societe: "S2" }).map((c) => c.id), ["a"]);
  });

  test("depassement_conformite sans societe : Manager DSI, Admin SAM, IT Ops ; plus le Financier (v1.1), jamais le sans-droit", () => {
    const ids = selectionnerDestinataires(candidats, { type: "depassement_conformite", id_societe: null }).map((c) => c.id);
    assert.deepEqual(ids.sort(), ["a", "i", "m"]);
  });

  test("retrait du Financier (retours Samuel 27/09) : souscriptions et conformite sans lui, budget avec", () => {
    assert.ok(!TYPES.echeance_souscription.audience.includes(PROFILS.financier));
    assert.ok(!TYPES.depassement_conformite.audience.includes(PROFILS.financier));
    assert.ok(TYPES.budget_seuil.audience.includes(PROFILS.financier));
    const ids = selectionnerDestinataires(candidats, { type: "budget_seuil", id_societe: "S2" }).map((c) => c.id);
    assert.ok(ids.includes("f"));
  });

  test("fin_maintenance : Manager DSI, Admin SAM et IT Ops de la portee", () => {
    const ids = selectionnerDestinataires(candidats, { type: "fin_maintenance", id_societe: "S1" }).map((c) => c.id);
    assert.deepEqual(ids.sort(), ["a", "i", "m"]);
  });

  test("validation_en_attente : porteurs de valider_saisie, auteur exclu", () => {
    const ids = selectionnerDestinataires(candidats, { type: "validation_en_attente", id_societe: "S1", exclure: ["m"] }).map((c) => c.id);
    assert.deepEqual(ids, ["a"]);
  });

  test("destinataires explicites : l'auteur seul, meme hors audience", () => {
    const ids = selectionnerDestinataires(candidats, { type: "saisie_traitee", destinataires: ["z"] }).map((c) => c.id);
    assert.deepEqual(ids, ["z"]);
    assert.deepEqual(selectionnerDestinataires(candidats, { type: "saisie_traitee", destinataires: ["z"], exclure: ["z"] }), []);
    assert.deepEqual(selectionnerDestinataires(candidats, { type: "saisie_traitee" }), []);
  });

  test("permissions passees en tableau acceptees", () => {
    const c = { ...itops, permissions: [PROFILS.it_ops] };
    assert.equal(selectionnerDestinataires([c], { type: "revalidation_echue", id_societe: "S2" }).length, 1);
  });
});

describe("composerTexte contrat_a_suivre (decision du 11/09/2026)", () => {
  test("contrat echu : texte accentue, lien vers la fiche, gravite rouge", () => {
    const t = composerTexte("contrat_a_suivre", {
      id_contrat: "c1", label: "Contrat Microsoft", date_fin: "2026-01-31", jours_restants: -10,
      nb_licences_renouvelees: 2, societe_label: "Filiale A",
    });
    assert.match(t.message, /^Ce contrat doit être renouvelé ou prolongé : 2 licences ont été renouvelées dessus\./);
    assert.match(t.message, /échu depuis le 31\/01\/2026/);
    assert.equal(t.lien, "/contrats/liste/c1");
    assert.equal(t.gravite, "rouge");
  });
  test("contrat a echeance, une seule licence : gravite orange", () => {
    const t = composerTexte("contrat_a_suivre", {
      id_contrat: "c1", label: "Contrat Oracle", date_fin: "2026-12-01", jours_restants: 45, nb_licences_renouvelees: 1,
    });
    assert.match(t.message, /une licence a été renouvelée dessus/);
    assert.match(t.message, /dans 45 jours/);
    assert.equal(t.gravite, "orange");
    assert.ok(TYPES_CODES.includes("contrat_a_suivre"));
  });
});

describe("maintenanceNotifiable (D59-D60, continuite comme les souscriptions)", () => {
  test("notifiable sans suite, sans successeur, sans arret", () => {
    assert.equal(maintenanceNotifiable({}), true);
    assert.equal(maintenanceNotifiable({ nb_maintenances_suivantes: 0, nb_successeurs_licence: 0, nb_successeurs_contrat: 0 }), true);
  });
  test("une maintenance qui se poursuit, une licence ou un contrat renouveles eteignent l'alerte", () => {
    assert.equal(maintenanceNotifiable({ nb_maintenances_suivantes: 1 }), false);
    assert.equal(maintenanceNotifiable({ nb_successeurs_licence: 2 }), false);
    assert.equal(maintenanceNotifiable({ nb_successeurs_contrat: 1 }), false);
  });
  test("un arret volontaire de la maintenance n'est pas une echeance a surveiller", () => {
    assert.equal(maintenanceNotifiable({ date_arret: "2026-05-01" }), false);
  });
});

describe("modeCourrier", () => {
  test("defaut du catalogue sans preference", () => {
    assert.equal(modeCourrier(null, "echeance_contrat"), "quotidien");
    assert.equal(modeCourrier(null, "depassement_conformite"), "immediat");
  });
  test("preference prime, urgence force l'immediat sauf si desactive", () => {
    assert.equal(modeCourrier("desactive", "saisie_traitee", "immediat"), "desactive");
    assert.equal(modeCourrier("quotidien", "saisie_traitee", "immediat"), "immediat");
    assert.equal(modeCourrier("quotidien", "saisie_traitee", null), "quotidien");
    assert.equal(modeCourrier("immediat", "echeance_contrat"), "immediat");
  });
  test("statut initial du courrier", () => {
    assert.equal(statutCourrierInitial("desactive"), "sans_objet");
    assert.equal(statutCourrierInitial("quotidien"), "a_envoyer");
  });
});

describe("paliers d'echeance", () => {
  test("seuils du tenant en mois convertis en jours, zero ignore, tri decroissant", () => {
    const seuils = [
      { echelle: 1, valeur: 3, unite: "mois" }, { echelle: 2, valeur: 2, unite: "mois" },
      { echelle: 3, valeur: 1, unite: "mois" }, { echelle: 4, valeur: 0, unite: "mois" },
    ];
    assert.deepEqual(paliersDepuisSeuils(seuils), [90, 60, 30]);
    assert.deepEqual(paliersDepuisSeuils([{ valeur: 45, unite: "jours" }, { valeur: 15, unite: "jours" }]), [45, 15]);
    assert.deepEqual(paliersDepuisSeuils([]), [90, 60, 30]);
    assert.deepEqual(paliersDepuisSeuils([{ valeur: 0 }]), [90, 60, 30]);
  });
  test("palier atteint : le plus serre, un seul a la fois", () => {
    assert.equal(palierAtteint(95), null);
    assert.equal(palierAtteint(90), 90);
    assert.equal(palierAtteint(61), 90);
    assert.equal(palierAtteint(45), 60);
    assert.equal(palierAtteint(20), 30);
    assert.equal(palierAtteint(0), 30);
    assert.equal(palierAtteint(-1), null);
  });
});

describe("composition des textes", () => {
  test("tous les types du catalogue produisent titre, message, lien, gravite", () => {
    const donnees = {
      echeance_contrat: { id_contrat: "c1", label: "EA Microsoft", date_fin: "2026-12-01", jours_restants: 30, societe_label: "Acme" },
      echeance_souscription: { id_licence: "l1", produit_label: "Adobe CC", quantite: 12, date_fin: "2026-10-02", jours_restants: 30 },
      depassement_conformite: { id_produit: "p1", produit_label: "Oracle DB", droits: 10, usages: 14, ecart_valorise: -4000, statut: "depassement" },
      budget_seuil: { id_societe: "s1", societe_label: "Acme", exercice: 2026, taux: 92.5, seuil: 90, alloue: 100000, engage: 92500 },
      validation_en_attente: { entite_type: "contrat", entite_id: "c1", label: "EA", auteur: { prenom: "Jean", nom: "Dupont" } },
      saisie_traitee: { entite_type: "commande", entite_id: "k1", label: "Cmd 12", statut: "refuse", motif: "Quantité incorrecte" },
      revalidation_echue: { id_affectation: "a1", label: "Poste 12", id_societe: "s1", societe_label: "Acme", date_prochaine: "2026-08-01", jours_retard: 32 },
      fin_maintenance: { id_licence: "l2", licence_label: "Pack CAO", produit_label: "AutoCAD", date_fin: "2026-10-20", jours_restants: 14, societe_label: "Acme" },
      contrat_a_suivre: { id_contrat: "c2", label: "EA", date_fin: "2026-09-01", jours_restants: -35, nb_licences_renouvelees: 1 },
    };
    for (const type of TYPES_CODES) {
      const t = composerTexte(type, donnees[type], { montantsVisibles: true });
      assert.ok(t.titre && t.message && t.lien && t.gravite, `type ${type}`);
    }
  });

  test("masquage financier : aucun montant sans consulter_kpi_financiers", () => {
    const d = { id_produit: "p1", produit_label: "Oracle DB", droits: 10, usages: 14, ecart_valorise: -4000, statut: "depassement", seuil_montant: 1000 };
    const avec = composerTexte("depassement_conformite", d, { montantsVisibles: true });
    const sans = composerTexte("depassement_conformite", d, { montantsVisibles: false });
    assert.match(avec.message, /€/);
    assert.doesNotMatch(sans.message, /€/);
    assert.match(sans.message, /14 usages/);
    const b = { societe_label: "Acme", exercice: 2026, taux: 95, seuil: 90, alloue: 100000, engage: 95000 };
    assert.doesNotMatch(composerTexte("budget_seuil", b, { montantsVisibles: false }).message, /€/);
    assert.match(composerTexte("budget_seuil", b, { montantsVisibles: true }).message, /€/);
  });

  test("refus : motif inclus, gravite orange ; validation : info", () => {
    const refus = composerTexte("saisie_traitee", { entite_type: "contrat", entite_id: "c", label: "X", statut: "refuse", motif: "Doublon" });
    assert.match(refus.message, /Doublon/);
    assert.equal(refus.gravite, "orange");
    const ok = composerTexte("saisie_traitee", { entite_type: "facture", entite_id: "f", label: "F1", statut: "valide" });
    assert.match(ok.message, /validée/);
    assert.equal(ok.gravite, "info");
  });

  test("fin_maintenance : texte accentue, lien vers la licence, gravite jaune", () => {
    const t = composerTexte("fin_maintenance", {
      id_licence: "l2", licence_label: "Pack CAO", produit_label: "AutoCAD",
      date_fin: "2026-10-20", jours_restants: 14, societe_label: "Acme",
    });
    assert.match(t.titre, /Maintenance de « AutoCAD » à échéance dans 14 jours/);
    assert.match(t.message, /prend fin le 20\/10\/2026/);
    assert.match(t.message, /société Acme/);
    assert.equal(t.lien, "/conformite/licences/l2");
    assert.equal(t.gravite, "jaune");
  });

  test("multilingue : un traducteur sert le modele de la langue, repli francais sans lui", () => {
    const dico = new Map([
      ["app.echeance_contrat.titre", "Contract “{label}” expiring {quand}"],
      ["app.commun.dans_jours", "in {n} days"],
    ]);
    const traduire = (cle) => dico.get(cle) || null;
    const d = { id_contrat: "c1", label: "EA Microsoft", date_fin: "2026-12-01", jours_restants: 30 };
    const en = composerTexte("echeance_contrat", d, { traduire });
    assert.equal(en.titre, "Contract “EA Microsoft” expiring in 30 days");
    // Cle absente du referentiel : modele francais du code.
    assert.match(en.message, /arrive à échéance le 01\/12\/2026, in 30 days/);
    const fr = composerTexte("echeance_contrat", d);
    assert.equal(fr.titre, "Contrat « EA Microsoft » à échéance dans 30 jours");
  });

  test("appliquerModele : substitution, parametres absents effaces", () => {
    assert.equal(appliquerModele("Bonjour {nom}", { nom: "Samuel" }), "Bonjour Samuel");
    assert.equal(appliquerModele("x{absent}y", {}), "xy");
    assert.equal(appliquerModele("brut sans parametres", null), "brut sans parametres");
    assert.equal(appliquerModele(null, { a: 1 }), "");
  });

  test("resolution des traductions : langue puis repli, null sinon", () => {
    const parLangue = new Map([
      ["en", new Map([["k1", "one"]])],
      ["fr", new Map([["k1", "un"], ["k2", "deux"]])],
    ]);
    assert.equal(resoudreTraduction(parLangue, ["en", "fr"], "k1"), "one");
    assert.equal(resoudreTraduction(parLangue, ["en", "fr"], "k2"), "deux");
    assert.equal(resoudreTraduction(parLangue, ["en", "fr"], "k3"), null);
    assert.equal(normaliserLangue("fr-FR"), "fr");
    assert.equal(normaliserLangue(" EN_us "), "en");
    assert.equal(normaliserLangue(null), null);
  });

  test("formats francais", () => {
    assert.equal(formatDateFr("2026-09-02"), "02/09/2026");
    assert.match(formatEuros(1234.5), /1.234,5 €/);
  });
});

describe("courriers (confidentialite v1.1, retours Samuel du 27/09)", () => {
  // Notification volontairement chargee en donnees sensibles : rien ne doit
  // en sortir dans le courrier.
  const notifSensible = {
    type: "depassement_conformite",
    titre: "Dépassement de conformité : Oracle DB",
    message: "Le logiciel « Oracle DB » est en dépassement : 14 usages déclarés pour 10 droits acquis. Écart valorisé : 4 000 €",
    lien: "/conformite/licences?produit=p1",
  };

  test("courrier immediat : libelle generique, lien, mention ; jamais le titre ni le message", () => {
    const c = composerCourrier(notifSensible, { urlBase: "https://ss.exemple.fr/", nomTenant: "Acme" });
    assert.equal(c.sujet, "SamSecure - Acme : Alerte de conformité");
    assert.match(c.contenu, /Un logiciel présente un écart de conformité\./);
    assert.match(c.contenu, /https:\/\/ss\.exemple\.fr\/conformite\/licences\?produit=p1/);
    assert.match(c.contenu, /préférences de notification/);
    assert.doesNotMatch(c.contenu, /Oracle DB/);
    assert.doesNotMatch(c.contenu, /€/);
    assert.doesNotMatch(c.contenu, /14|10/);
  });

  test("refus de saisie : courrier generique, jamais le motif", () => {
    const c = composerCourrier({
      type: "saisie_traitee",
      titre: "Saisie refusée : Cmd 12",
      message: "Votre saisie de la commande « Cmd 12 » a été refusée. Motif : Quantité incorrecte",
      lien: "/contrats/commandes/k1",
    }, { urlBase: "https://ss.exemple.fr" });
    assert.equal(c.sujet, "SamSecure : Saisie traitée");
    assert.doesNotMatch(c.contenu, /Motif|Quantité|Cmd 12/);
    assert.match(c.contenu, /Une de vos saisies a été traitée\./);
  });

  test("prefixe d'objet : SamSecure plus le nom du tenant", () => {
    assert.equal(prefixeSujet("Acme"), "SamSecure - Acme");
    assert.equal(prefixeSujet(null), "SamSecure");
  });

  test("courrier traduit : objets et messages servis par le referentiel", () => {
    const dico = new Map([
      ["courriel.depassement_conformite.objet", "Compliance alert"],
      ["courriel.depassement_conformite.message", "A software shows a compliance gap."],
      ["courriel.commun.ouvrir", "View the details in SamSecure: {lien}"],
    ]);
    const c = composerCourrier(notifSensible, {
      urlBase: "https://ss.exemple.fr", nomTenant: "Acme", traduire: (cle) => dico.get(cle) || null,
    });
    assert.equal(c.sujet, "SamSecure - Acme : Compliance alert");
    assert.match(c.contenu, /A software shows a compliance gap\./);
    assert.match(c.contenu, /View the details in SamSecure: https:\/\/ss\.exemple\.fr/);
  });

  test("recapitulatif : comptes par type dans l'ordre du catalogue et liens, aucun texte de notification", () => {
    const notifs = [
      { type: "saisie_traitee", titre: "Saisie validée : A", message: "Saisie A validée.", lien: "/contrats/liste/a" },
      { type: "echeance_contrat", titre: "Contrat B", message: "Contrat B à échéance.", lien: "/contrats/liste/b" },
      { type: "echeance_contrat", titre: "Contrat C", message: "Contrat C à échéance.", lien: "/contrats/liste/c" },
    ];
    const r = composerRecapitulatif(notifs, { urlBase: "https://ss.exemple.fr", dateLabel: "1er septembre 2026", nomTenant: "Acme" });
    assert.match(r.sujet, /^SamSecure - Acme : récapitulatif quotidien, 3 notifications$/);
    assert.match(r.contenu, /3 nouvelles notifications/);
    const posEcheance = r.contenu.indexOf("Échéances de contrats (2)");
    const posSaisie = r.contenu.indexOf("Saisies traitées (1)");
    assert.ok(posEcheance >= 0 && posSaisie > posEcheance);
    assert.match(r.contenu, /https:\/\/ss\.exemple\.fr\/contrats\/liste\/b/);
    assert.match(r.contenu, /1er septembre 2026/);
    assert.doesNotMatch(r.contenu, /à échéance\.|validée\./);
  });

  test("recapitulatif : liens identiques d'un meme type dedoublonnes, compte conserve", () => {
    const r = composerRecapitulatif([
      { type: "budget_seuil", lien: "/budget" },
      { type: "budget_seuil", lien: "/budget" },
    ], { urlBase: "https://ss.exemple.fr" });
    assert.match(r.contenu, /Seuil budgétaire \(2\)/);
    assert.equal(r.contenu.match(/https:\/\/ss\.exemple\.fr\/budget/g).length, 1);
  });

  test("recapitulatif d'une seule notification au singulier", () => {
    const r = composerRecapitulatif([{ type: "budget_seuil", lien: "/budget" }]);
    assert.match(r.sujet, /1 notification$/);
    assert.match(r.contenu, /1 nouvelle notification/);
  });
});

describe("heure de Paris", () => {
  test("composants et date du jour vus de Paris", () => {
    // 2026-07-01T22:30Z = 2 juillet 00:30 a Paris (UTC+2)
    const c = composantsParis(new Date("2026-07-01T22:30:00Z"));
    assert.deepEqual([c.annee, c.mois, c.jour, c.heure, c.minute], [2026, 7, 2, 0, 30]);
    assert.equal(dateParis(new Date("2026-07-01T22:30:00Z")), "2026-07-02");
    assert.equal(dateParis(new Date("2026-01-15T23:30:00Z")), "2026-01-16");
  });

  test("instantParis : 7 h de Paris en hiver (UTC+1) et en ete (UTC+2)", () => {
    assert.equal(instantParis(2026, 1, 15, 7, 0).toISOString(), "2026-01-15T06:00:00.000Z");
    assert.equal(instantParis(2026, 7, 15, 7, 0).toISOString(), "2026-07-15T05:00:00.000Z");
  });

  test("changements d'heure : 29 mars 2026 et 25 octobre 2026", () => {
    assert.equal(instantParis(2026, 3, 29, 7, 0).toISOString(), "2026-03-29T05:00:00.000Z");
    assert.equal(instantParis(2026, 10, 25, 7, 0).toISOString(), "2026-10-25T06:00:00.000Z");
  });

  test("prochaineOccurrence : aujourd'hui si l'heure n'est pas passee, demain sinon", () => {
    const avant = new Date("2026-09-02T04:00:00Z"); // 6 h Paris
    assert.equal(prochaineOccurrence(7, 0, avant).toISOString(), "2026-09-02T05:00:00.000Z");
    const apres = new Date("2026-09-02T05:00:00Z"); // 7 h pile Paris : strictement apres
    assert.equal(prochaineOccurrence(7, 0, apres).toISOString(), "2026-09-03T05:00:00.000Z");
    const soir = new Date("2026-09-02T21:30:00Z"); // 23 h 30 Paris
    assert.equal(prochaineOccurrence(7, 30, soir).toISOString(), "2026-09-03T05:30:00.000Z");
  });

  test("heurePassee", () => {
    assert.equal(heurePassee(7, 0, new Date("2026-09-02T04:59:00Z")), false);
    assert.equal(heurePassee(7, 0, new Date("2026-09-02T05:00:00Z")), true);
    assert.equal(heurePassee(7, 30, new Date("2026-09-02T05:10:00Z")), false);
  });
});
