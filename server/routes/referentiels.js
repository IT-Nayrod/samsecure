// Listes de référence en lecture seule, pour les sélecteurs des
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

// GET /editeurs est servi par routes/editeurs.js, qui sert le référentiel
// complet du module 1 sous enveloppe normalisée. La projection y conserve les
// quatre champs servis ici, et deballer() dans src/services/http.js rend le
// changement de forme transparent pour le sélecteur du formulaire contrat.

// GET /revendeurs est servi par routes/revendeurs.js, qui sert le référentiel
// complet du module 1 sous enveloppe normalisée. La projection y conserve id et
// raison_sociale, et masque par défaut les revendeurs désactivés : un revendeur
// retiré du catalogue n'a plus à être proposable à la saisie.
router.get("/modes-commande", (req, res) =>
    liste(res, `SELECT id, code, label FROM mode_commande ORDER BY label`, "GET /modes-commande"));

// Type de preuve : référentiel du module documents (#48). Même copy-on-write
// que type_contrat, le front filtre donc sur code et affiche label.
router.get("/types-preuve", (req, res) =>
    liste(res, `SELECT id, code, label FROM type_preuve ORDER BY label`, "GET /types-preuve"));

export default router;
