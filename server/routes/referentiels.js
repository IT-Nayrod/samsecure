// referentiels - listes de reference en lecture seule, pour les selecteurs des
// formulaires. Alias en snake_case, comme contrats.js.
import express from "express";
import { tenantPool } from "../db.js";

const router = express.Router();

async function liste(res, sql, contexte) {
  try {
    const { rows } = await tenantPool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error(`${contexte} error`, err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// Le front filtre sur code, jamais sur label : celui-ci est personnalisable
// (copy-on-write sur type_contrat).
router.get("/types-contrat", (req, res) =>
  liste(res, `SELECT id, code, label FROM type_contrat ORDER BY label`, "GET /types-contrat"));

router.get("/editeurs", (req, res) =>
  liste(res, `SELECT id, raison_sociale, url_logo_defaut, url_logo_custom
              FROM editeur ORDER BY raison_sociale`, "GET /editeurs"));

router.get("/revendeurs", (req, res) =>
  liste(res, `SELECT id, raison_sociale FROM revendeur ORDER BY raison_sociale`, "GET /revendeurs"));

router.get("/modes-commande", (req, res) =>
    liste(res, `SELECT id, code, label FROM mode_commande ORDER BY label`, "GET /modes-commande"));

export default router;
