// Test API de bout en bout de la suppression contrôlée et de l'archivage des
// sociétés (#281, issue 60 ; décision client du 08/10/2026 : « archiver »
// remplace « désactiver », les anciennes routes restent en alias le temps de
// la transition). Il parle HTTP à une API déployée portant ce chantier
// (aucun accès base) et s'ignore sans configuration :
//   SS_API_URL=http://127.0.0.1:3002 \
//   SS_API_EMAIL=admin.recette@samsecure.test \
//   SS_API_PASSWORD='Recette#2026' \
//   node --test server/routes/societes.api.test.js
// Le compte doit porter gerer_referentiels (admin de recette). Les sociétés
// créées sont préfixées « ZZ Test suppression » et nettoyées en fin de test.
import test from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.SS_API_URL;
const EMAIL = process.env.SS_API_EMAIL;
const PASSWORD = process.env.SS_API_PASSWORD;
const configure = Boolean(BASE && EMAIL && PASSWORD);

test(
  "sociétés : suppression douce contrôlée et archivage (#281)",
  { skip: configure ? false : "SS_API_URL, SS_API_EMAIL et SS_API_PASSWORD non fournis" },
  async (t) => {
    let jeton;
    async function api(methode, chemin, corps) {
      const reponse = await fetch(`${BASE}/api${chemin}`, {
        method: methode,
        headers: {
          "Content-Type": "application/json",
          ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
        },
        body: corps === undefined ? undefined : JSON.stringify(corps),
      });
      const texte = await reponse.text();
      return { statut: reponse.status, corps: texte ? JSON.parse(texte) : null };
    }

    const login = await api("POST", "/auth/login", { email: EMAIL, password: PASSWORD });
    assert.equal(login.statut, 200, "login de recette");
    jeton = login.corps.accessToken;

    const suffixe = Date.now();
    const mere = await api("POST", "/societes", { raison_sociale: `ZZ Test suppression mère ${suffixe}` });
    assert.equal(mere.statut, 201, "création de la société mère");
    const fille = await api("POST", "/societes", {
      raison_sociale: `ZZ Test suppression fille ${suffixe}`,
      id_societe_parent: mere.corps.id,
    });
    assert.equal(fille.statut, 201, "création de la filiale");

    try {
      await t.test("le refus liste ce qui bloque (une filiale se raccroche)", async () => {
        const refus = await api("DELETE", `/societes/${mere.corps.id}`);
        assert.equal(refus.statut, 409);
        assert.match(refus.corps.error, /^Suppression impossible/);
        assert.match(refus.corps.error, /1 filiale/);
        assert.match(refus.corps.error, /archivage reste possible/);
      });

      await t.test("la liste sert les blocages prêts à l'écran", async () => {
        const liste = await api("GET", "/societes");
        assert.equal(liste.statut, 200);
        const ligneMere = liste.corps.find((s) => s.id === mere.corps.id);
        assert.deepEqual(ligneMere.blocages_suppression, ["1 filiale"]);
        const ligneFille = liste.corps.find((s) => s.id === fille.corps.id);
        assert.deepEqual(ligneFille.blocages_suppression, []);
      });

      await t.test("archiver pose la date, restaurer l'efface", async () => {
        const archivee = await api("POST", `/societes/${fille.corps.id}/archiver`);
        assert.equal(archivee.statut, 200);
        assert.equal(archivee.corps.actif, false);
        assert.ok(archivee.corps.datefinactivite, "date_fin_activite posée");
        const rejouee = await api("POST", `/societes/${fille.corps.id}/archiver`);
        assert.equal(rejouee.statut, 200, "archivage idempotent");
        const restauree = await api("POST", `/societes/${fille.corps.id}/restaurer`);
        assert.equal(restauree.statut, 200);
        assert.equal(restauree.corps.actif, true);
        assert.equal(restauree.corps.datefinactivite, null);
      });

      await t.test("les alias de transition désactiver et réactiver répondent comme archiver et restaurer", async () => {
        const archivee = await api("POST", `/societes/${fille.corps.id}/desactiver`);
        assert.equal(archivee.statut, 200);
        assert.equal(archivee.corps.actif, false);
        assert.ok(archivee.corps.datefinactivite, "l'alias pose la date");
        const restauree = await api("POST", `/societes/${fille.corps.id}/reactiver`);
        assert.equal(restauree.statut, 200);
        assert.equal(restauree.corps.actif, true);
        assert.equal(restauree.corps.datefinactivite, null);
      });

      await t.test("une société vide se supprime en douceur et quitte les listes", async () => {
        const suppression = await api("DELETE", `/societes/${fille.corps.id}`);
        assert.equal(suppression.statut, 204);
        const liste = await api("GET", "/societes");
        assert.ok(!liste.corps.some((s) => s.id === fille.corps.id), "retirée des listes courantes");
        const introuvable = await api("DELETE", `/societes/${fille.corps.id}`);
        assert.equal(introuvable.statut, 404, "une société supprimée est introuvable");
        const mereVide = await api("DELETE", `/societes/${mere.corps.id}`);
        assert.equal(mereVide.statut, 204, "la mère, devenue vide, se supprime");
      });
    } finally {
      // Nettoyage au mieux : les 404 des sociétés déjà supprimées sont ignorés.
      await api("DELETE", `/societes/${fille.corps.id}`);
      await api("DELETE", `/societes/${mere.corps.id}`);
    }
  }
);
