// Listes de référence du module 3 (licences), en lecture
// seule, pour les sélecteurs du formulaire licence et les filtres de la page.
//
// Distinct de referentiels.js : le catalogue des produits vit en BDD Commune
// (produit_referentiel, version, edition), et l'éditeur de chaque produit est
// un lien logique vers la BDD Tenant, résolu ici. Enveloppe normalisée (#68),
// codes 4050-4059 (migration 028), contrairement aux listes historiques de
// referentiels.js qui restent nues.
import express from "express";
import { tenantPool, commonPool } from "../db.js";
import { succes, erreur } from "../utils/reponse.js";

const router = express.Router();

// Catalogue complet en un appel : produits avec leurs versions et éditions
// imbriquées, triés par libellé. Le formulaire n'a ainsi qu'une source pour
// les trois sélecteurs dépendants (produit, puis édition et version).
// Correctif du 06/10/2026 (bug bloquant signalé par Samuel) : les logiciels
// créés par le client (produit_client, 040) sont servis au même titre que le
// catalogue Commune, avec leurs déclinaisons propres (version_client,
// edition_client) ; chaque ligne porte source ('catalogue' ou 'client'), une
// licence pouvant viser les deux (lien logique sans FK, comme inventaire.js).
router.get("/produits", async (req, res) => {
  try {
    const [{ rows: produits }, { rows: versions }, { rows: editions },
           { rows: produitsClient }, { rows: versionsClient }, { rows: editionsClient }] = await Promise.all([
      commonPool.query(`SELECT id, label, sku, id_editeur, id_produit_parent
                          FROM produit_referentiel ORDER BY label`),
      commonPool.query(`SELECT id, id_produit, label FROM version ORDER BY label`),
      commonPool.query(`SELECT id, id_produit, label FROM edition ORDER BY label`),
      tenantPool.query(`SELECT id, label, id_editeur, id_produit_parent
                          FROM produit_client ORDER BY label`),
      tenantPool.query(`SELECT id, id_produit, label FROM version_client ORDER BY label`),
      tenantPool.query(`SELECT id, id_produit, label FROM edition_client ORDER BY label`),
    ]);

    const idsEditeurs = [...new Set([...produits, ...produitsClient]
      .map((p) => p.id_editeur).filter(Boolean))];
    const editeurs = new Map();
    if (idsEditeurs.length) {
      const { rows } = await tenantPool.query(
        `SELECT id, raison_sociale, url_logo_defaut, url_logo_custom FROM editeur WHERE id = ANY($1)`,
        [idsEditeurs]);
      for (const e of rows) editeurs.set(e.id, e);
    }

    const parProduit = (liste) => {
      const index = new Map();
      for (const x of liste) {
        const l = index.get(x.id_produit) ?? [];
        l.push({ id: x.id, label: x.label });
        index.set(x.id_produit, l);
      }
      return index;
    };
    const versionsPar = parProduit([...versions, ...versionsClient]);
    const editionsPar = parProduit([...editions, ...editionsClient]);

    const habiller = (p, source) => {
      const e = p.id_editeur ? editeurs.get(p.id_editeur) : null;
      return {
        ...p,
        sku: p.sku ?? null,
        source,
        editeur_label: e?.raison_sociale ?? null,
        editeur_url_logo_defaut: e?.url_logo_defaut ?? null,
        editeur_url_logo_custom: e?.url_logo_custom ?? null,
        versions: versionsPar.get(p.id) ?? [],
        editions: editionsPar.get(p.id) ?? [],
      };
    };
    // Les deux origines se mêlent dans un seul tri sur le libellé, comme la
    // liste de l'écran Logiciels : la source n'est qu'une donnée de la ligne.
    succes(res, 4050, [
      ...produits.map((p) => habiller(p, "catalogue")),
      ...produitsClient.map((p) => habiller(p, "client")),
    ].sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true })));
  } catch (err) {
    console.error("GET /produits error", err);
    erreur(res, 4059, { status: 500, message: "Erreur serveur" });
  }
});

// Le front filtre sur code, jamais sur label : celui-ci est personnalisable
// (copy-on-write sur unite_mesure).
router.get("/unites-mesure", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(
      `SELECT id, code, label, description FROM unite_mesure ORDER BY label`);
    succes(res, 4051, rows);
  } catch (err) {
    console.error("GET /unites-mesure error", err);
    erreur(res, 4059, { status: 500, message: "Erreur serveur" });
  }
});

router.get("/mainteneurs", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(
      `SELECT id, raison_sociale FROM mainteneur ORDER BY raison_sociale`);
    succes(res, 4052, rows);
  } catch (err) {
    console.error("GET /mainteneurs error", err);
    erreur(res, 4059, { status: 500, message: "Erreur serveur" });
  }
});

export default router;
