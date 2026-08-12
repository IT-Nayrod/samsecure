import express from "express";
import { tenantPool } from "../db.js";

const router = express.Router();

router.get("/permissions", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(`
      SELECT
        id,
        code,
        label,
        module
      FROM permission
      ORDER BY module, label
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
