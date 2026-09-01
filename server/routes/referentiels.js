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

// GET /editeurs a demenage vers routes/editeurs.js, qui sert le referentiel
// complet du module 1 sous enveloppe normalisee. La projection y conserve les
// quatre champs servis ici, et deballer() dans src/services/http.js rend le
// changement de forme transparent pour le selecteur du formulaire contrat.

// GET /revendeurs a demenage vers routes/revendeurs.js, qui sert le referentiel
// complet du module 1 sous enveloppe normalisee. La projection y conserve id et
// raison_sociale, et masque par defaut les revendeurs desactives : un revendeur
// retire du catalogue n'a plus a etre proposable a la saisie.
router.get("/modes-commande", (req, res) =>
    liste(res, `SELECT id, code, label FROM mode_commande ORDER BY label`, "GET /modes-commande"));

// Type de preuve : referentiel du module documents (#48). Meme copy-on-write
// que type_contrat, le front filtre donc sur code et affiche label.
router.get("/types-preuve", (req, res) =>
    liste(res, `SELECT id, code, label FROM type_preuve ORDER BY label`, "GET /types-preuve"));

export default router;
