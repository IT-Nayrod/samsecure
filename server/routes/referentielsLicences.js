// referentielsLicences - listes de reference du module 3 (licences), en lecture
// seule, pour les selecteurs du formulaire licence et les filtres de la page.
//
// Distinct de referentiels.js : le catalogue des produits vit en BDD Commune
// (produit_referentiel, version, edition), et l'editeur de chaque produit est
// un lien logique vers la BDD Tenant, resolu ici. Enveloppe normalisee (#68),
// codes 4050-4059 (migration 028), contrairement aux listes historiques de
// referentiels.js qui restent nues.
import express from "express";
import { tenantPool, commonPool } from "../db.js";
import { succes, erreur } from "../utils/reponse.js";

const router = express.Router();

// Catalogue complet en un appel : produits avec leurs versions et editions
// imbriquees, tries par libelle. Le formulaire n'a ainsi qu'une source pour
// les trois selecteurs dependants (produit, puis edition et version).
router.get("/produits", async (req, res) => {
  try {
    const [{ rows: produits }, { rows: versions }, { rows: editions }] = await Promise.all([
      commonPool.query(`SELECT id, label, sku, id_editeur, id_produit_parent
                          FROM produit_referentiel ORDER BY label`),
      commonPool.query(`SELECT id, id_produit, label FROM version ORDER BY label`),
      commonPool.query(`SELECT id, id_produit, label FROM edition ORDER BY label`),
    ]);

    const idsEditeurs = [...new Set(produits.map((p) => p.id_editeur).filter(Boolean))];
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
    const versionsPar = parProduit(versions);
    const editionsPar = parProduit(editions);

    succes(res, 4050, produits.map((p) => {
      const e = p.id_editeur ? editeurs.get(p.id_editeur) : null;
      return {
        ...p,
        editeur_label: e?.raison_sociale ?? null,
        editeur_url_logo_defaut: e?.url_logo_defaut ?? null,
        editeur_url_logo_custom: e?.url_logo_custom ?? null,
        versions: versionsPar.get(p.id) ?? [],
        editions: editionsPar.get(p.id) ?? [],
      };
    }));
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
