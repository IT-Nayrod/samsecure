// Profils de droits : cycle de vie, diffusion par société et impact d'une
// suppression sur les attributions existantes.
//
// Depuis la migration 074, la table porte trois types : profil_defaut (seedé,
// non supprimable), groupe (créé par le client, CRUD complet) et systeme
// (admin_sam, non supprimable). La suppression d'un groupe est douce depuis la
// 008 ; la corbeille (#64) la rend visible : liste des groupes supprimés
// depuis moins de 90 jours, restauration, purge au-delà (fonction 075).

import express from "express";
import { tenantPool } from "../db.js";
import { estUuid } from "../utils/matriceGroupe.js";
import { auditer, diff } from "../utils/audit.js";

const router = express.Router();

// Projection unique, servie à l'identique en liste, détail et relectures.
const SELECT_PROFIL = `id, code, label, description, type`;

async function log(client, action, entite_type, entite_id, description, payload) {
  await client.query(
    `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [action, entite_type, entite_id || null, description, payload ? JSON.stringify(payload) : null]
  );
}

router.get("/profils", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(
      `SELECT ${SELECT_PROFIL} FROM profil WHERE date_suppression IS NULL ORDER BY label`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Corbeille (#64) : groupes supprimés depuis moins de 90 jours, avec les jours
// restants avant purge. Déclarée avant /profils/:id, sinon "corbeille" serait
// lu comme un id. Les profils par défaut et système n'y passent jamais, leur
// suppression est refusée plus bas.
router.get("/profils/corbeille", async (req, res) => {
  try {
    // Purge au fil de l'eau, même motif que purgeExceptionsExpirees() : aucun
    // ordonnanceur ne couvre ce module, la lecture de la corbeille fait le
    // ménage (fonction bornée, migration 075).
    await tenantPool.query(`SELECT * FROM purger_corbeille_profils()`);
    const { rows } = await tenantPool.query(
      `SELECT ${SELECT_PROFIL}, date_suppression,
              GREATEST(0, 90 - EXTRACT(DAY FROM now() - date_suppression))::int AS jours_restants
         FROM profil
        WHERE type = 'groupe' AND date_suppression IS NOT NULL
          AND date_suppression > now() - INTERVAL '90 days'
        ORDER BY date_suppression DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /profils/corbeille error", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/profils", async (req, res) => {
  const { code, label, description } = req.body;
  if (!code || !label) return res.status(400).json({ error: "code et label requis" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    // Le type n'est pas pris du corps : une création par l'API est toujours un
    // groupe personnalisé, les profils par défaut viennent des seuls seeds.
    const { rows } = await client.query(
      `INSERT INTO profil (code, label, description) VALUES ($1, $2, $3)
       RETURNING ${SELECT_PROFIL}`,
      [code, label, description || null]
    );
    await log(client, "CREATE", "profil", rows[0].id, `Groupe "${label}" créé`, rows[0]);
    // code_retour: 2060
    await auditer(client, req, {
      action: "GROUPE_CREE", entiteType: "profil", entiteId: rows[0].id,
      apres: { code: rows[0].code, label: rows[0].label, description: rows[0].description },
    });
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.get("/profils/:id", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Profil introuvable" });
  try {
    const { rows } = await tenantPool.query(
      `SELECT ${SELECT_PROFIL} FROM profil WHERE id = $1 AND date_suppression IS NULL`, [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Profil introuvable" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.patch("/profils/:id", async (req, res) => {
  const { id } = req.params;
  const { label, description } = req.body;
  if (!estUuid(id)) return res.status(404).json({ error: "Profil introuvable" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    // État antérieur, pour que la trace dise ce qui a changé.
    const { rows: avant } = await client.query(
      `SELECT label, description FROM profil WHERE id = $1 AND date_suppression IS NULL FOR UPDATE`, [id]
    );
    if (!avant.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Profil introuvable" }); }
    const { rows } = await client.query(
      `UPDATE profil SET label = COALESCE($2, label), description = COALESCE($3, description)
       WHERE id = $1 AND date_suppression IS NULL
       RETURNING ${SELECT_PROFIL}`,
      [id, label, description]
    );
    await log(client, "UPDATE", "profil", id, `Groupe "${rows[0].label}" modifié`, req.body);
    // code_retour: 2061
    const d = diff(avant[0], { label: rows[0].label, description: rows[0].description });
    await auditer(client, req, {
      action: "GROUPE_MODIFIE", entiteType: "profil", entiteId: id,
      avant: d.avant, apres: d.apres,
    });
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// Restauration depuis la corbeille (#64). Seules les lignes retirées PAR la
// mise en corbeille sont réactivées : la suppression pose le même now()
// transactionnel sur le profil et ses lignes liées, l'égalité des horodatages
// identifie exactement ce lot. Une permission décochée avant la suppression
// reste donc décochée après restauration.
router.post("/profils/:id/restaurer", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Ce groupe n'est pas dans la corbeille." });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: prof } = await client.query(
      `SELECT label, date_suppression FROM profil
        WHERE id = $1 AND type = 'groupe' AND date_suppression IS NOT NULL
          AND date_suppression > now() - INTERVAL '90 days'
        FOR UPDATE`,
      [id]
    );
    if (!prof.length) {
      await client.query("ROLLBACK");
      // code_retour: 2069
      return res.status(404).json({ error: "Ce groupe n'est pas dans la corbeille." });
    }
    const ts = prof[0].date_suppression;
    await client.query(
      `UPDATE profil_permission SET date_suppression = NULL WHERE id_profil = $1 AND date_suppression = $2`, [id, ts]
    );
    await client.query(
      `UPDATE profil_societe SET date_suppression = NULL WHERE id_profil = $1 AND date_suppression = $2`, [id, ts]
    );
    await client.query(
      `UPDATE utilisateur_profil_societe SET date_suppression = NULL WHERE id_profil = $1 AND date_suppression = $2`, [id, ts]
    );
    const { rows } = await client.query(
      `UPDATE profil SET date_suppression = NULL WHERE id = $1 RETURNING ${SELECT_PROFIL}`, [id]
    );
    await log(client, "RESTORE", "profil", id, `Groupe "${prof[0].label}" restauré depuis la corbeille`, null);
    // code_retour: 2063
    await auditer(client, req, {
      action: "GROUPE_RESTAURE", entiteType: "profil", entiteId: id,
      apres: { label: prof[0].label },
    });
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /profils/:id/restaurer error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.get("/profils/:id/societes", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Profil introuvable" });
  try {
    const { rows } = await tenantPool.query(
      `SELECT ps.id, ps.id_societe AS idsociete, s.raison_sociale AS raisonsociale
       FROM profil_societe ps
       LEFT JOIN societe s ON s.id = ps.id_societe
       WHERE ps.id_profil = $1 AND ps.date_suppression IS NULL`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/profils/:id/societes/:psId", async (req, res) => {
  const { id, psId } = req.params;
  if (!estUuid(id) || !estUuid(psId)) return res.status(404).json({ error: "Diffusion introuvable" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: ps } = await client.query(`SELECT id_societe FROM profil_societe WHERE id = $1`, [psId]);
    const { rowCount } = await client.query(
      `UPDATE profil_societe SET date_suppression = now() WHERE id = $1 AND id_profil = $2 AND date_suppression IS NULL`,
      [psId, id]
    );
    if (!rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Diffusion introuvable" }); }
    const { rows: prof } = await client.query(`SELECT label FROM profil WHERE id = $1`, [id]);
    const { rows: soc } = await client.query(`SELECT raison_sociale FROM societe WHERE id = $1`, [ps[0]?.id_societe]);
    const portee = soc[0]?.raison_sociale || ps[0]?.id_societe || "tenant";
    await log(client, "SOFT_DELETE", "profil_societe", psId, `Diffusion du groupe "${prof[0]?.label || id}" retirée de la société "${portee}"`, null);
    // code_retour: 2067
    await auditer(client, req, {
      action: "GROUPE_DIFFUSION_RETIREE", entiteType: "profil", entiteId: id,
      avant: { groupe: prof[0]?.label || null, portee },
    });
    await client.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.get("/profils/:id/impact", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Profil introuvable" });
  try {
    const { rows: users } = await tenantPool.query(
      `SELECT DISTINCT u.id, u.prenom, u.nom, u.email
       FROM utilisateur_profil_societe ups
       JOIN utilisateur u ON u.id = ups.id_utilisateur
       WHERE ups.id_profil = $1 AND ups.date_suppression IS NULL AND u.date_suppression IS NULL`,
      [id]
    );
    const { rows: societes } = await tenantPool.query(
      `SELECT DISTINCT s.id, s.raison_sociale AS raisonsociale
       FROM profil_societe ps
       JOIN societe s ON s.id = ps.id_societe
       WHERE ps.id_profil = $1 AND ps.id_societe IS NOT NULL AND ps.date_suppression IS NULL`,
      [id]
    );
    res.json({ utilisateurs: users, societes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/profils/:id", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Profil introuvable" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: prof } = await client.query(
      `SELECT label, type FROM profil WHERE id = $1 AND date_suppression IS NULL FOR UPDATE`, [id]
    );
    if (!prof.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Profil introuvable" }); }
    // Un profil par défaut ou système ne se supprime jamais : la matrice reste
    // éditable mais le socle seedé de la plateforme doit survivre (074).
    if (prof[0].type !== "groupe") {
      await client.query("ROLLBACK");
      const nature = prof[0].type === "systeme" ? "système" : "par défaut";
      // code_retour: 2068
      return res.status(409).json({
        error: `Suppression impossible : "${prof[0].label}" est un profil ${nature} de la plateforme.`,
      });
    }
    await client.query(`UPDATE profil_permission SET date_suppression = now() WHERE id_profil = $1`, [id]);
    await client.query(`UPDATE profil_societe SET date_suppression = now() WHERE id_profil = $1`, [id]);
    await client.query(`UPDATE utilisateur_profil_societe SET date_suppression = now() WHERE id_profil = $1`, [id]);
    await client.query(`UPDATE profil SET date_suppression = now() WHERE id = $1`, [id]);
    await log(client, "SOFT_DELETE", "profil", id, `Groupe "${prof[0].label}" placé dans la corbeille`, null);
    // code_retour: 2062
    await auditer(client, req, {
      action: "GROUPE_MIS_EN_CORBEILLE", entiteType: "profil", entiteId: id,
      avant: { label: prof[0].label },
    });
    await client.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.post("/profils/:id/societes", async (req, res) => {
  const { id } = req.params;
  const { id_societe } = req.body;
  if (!estUuid(id)) return res.status(404).json({ error: "Profil introuvable" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    // DO UPDATE (et non un INSERT nu) : une diffusion précédemment retirée
    // (soft-delete) doit pouvoir être réactivée sans provoquer une violation
    // de contrainte unique brute (bug constaté : uq_profil_societe).
    const { rows } = await client.query(
      `INSERT INTO profil_societe (id_profil, id_societe) VALUES ($1, $2)
       ON CONFLICT ON CONSTRAINT uq_profil_societe
       DO UPDATE SET date_suppression = NULL
       RETURNING *`,
      [id, id_societe || null]
    );
    const { rows: prof } = await client.query(`SELECT label FROM profil WHERE id = $1`, [id]);
    const { rows: soc } = await client.query(`SELECT raison_sociale FROM societe WHERE id = $1`, [id_societe || null]);
    const portee = soc[0]?.raison_sociale || id_societe || "tenant";
    await log(client, "CREATE", "profil_societe", rows[0].id, `Diffusion du groupe "${prof[0]?.label || id}" ajoutée à la société "${portee}"`, rows[0]);
    // code_retour: 2066
    await auditer(client, req, {
      action: "GROUPE_DIFFUSION_AJOUTEE", entiteType: "profil", entiteId: id,
      apres: { groupe: prof[0]?.label || null, portee },
    });
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
