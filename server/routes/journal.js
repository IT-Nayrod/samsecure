import express from "express";
import { tenantPool } from "../db.js";

const router = express.Router();

// Créer une entrée de journal
router.post("/journal", async (req, res) => {
  const { action, entite_type, entite_id, description, id_auteur, payload } = req.body;
  if (!action || !entite_type || !description) {
    return res.status(400).json({ error: "action, entite_type et description requis" });
  }
  try {
    const { rows } = await tenantPool.query(
      `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, id_auteur, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, action, entite_type, entite_id, description, id_auteur, payload, created_at`,
      [action, entite_type, entite_id || null, description, id_auteur || null, payload ? JSON.stringify(payload) : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /journal error", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Liste complète des logs (avec pagination optionnelle)
router.get("/journal", async (req, res) => {
  const { search, limit = 1000, offset = 0 } = req.query;
  try {
    let query = `
      SELECT id, action, entite_type, entite_id, description, id_auteur, payload, created_at
      FROM journal_ecriture
      WHERE 1=1
    `;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      query += ` AND description ILIKE $${params.length}`;
    }
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    const { rows } = await tenantPool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("GET /journal error", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
