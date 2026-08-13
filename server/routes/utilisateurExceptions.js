import express from "express";
import { tenantPool } from "../db.js";
import { getAdminScope, scopeWhereClause } from "../utils/scope.js";
import { auditer } from "../utils/audit.js";

const router = express.Router();

async function log(client, action, entite_type, entite_id, description, payload) {
  await client.query(
    `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [action, entite_type, entite_id || null, description, payload ? JSON.stringify(payload) : null]
  );
}

async function purgeExceptionsExpirees() {
  await tenantPool.query(
    `UPDATE exception_droit SET date_suppression = now()
     WHERE date_fin IS NOT NULL AND date_fin < CURRENT_DATE AND date_suppression IS NULL`
  );
}

router.get("/utilisateurs/:id/exceptions", async (req, res) => {
  const { id } = req.params;
  const { societeId } = req.query;
  try {
    await purgeExceptionsExpirees();
    let query = `
      SELECT id, id_utilisateur AS idutilisateur, id_permission AS idpermission,
             id_societe AS idsociete, type, motif, date_debut AS datedebut, date_fin AS datefin,
             motif_modification
      FROM exception_droit
      WHERE id_utilisateur = $1 AND date_suppression IS NULL
    `;
    const params = [id];
    if (societeId) {
      query += " AND (id_societe IS NULL OR id_societe = $2)";
      params.push(societeId);
    }
    const { rows } = await tenantPool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/exceptions", async (req, res) => {
  try {
    await purgeExceptionsExpirees();
    const scope = await getAdminScope(req.user.id);
    const { clause, params } = scopeWhereClause(scope, 1);
    const { rows } = await tenantPool.query(
      `SELECT ed.id, ed.id_utilisateur AS idutilisateur, ed.id_permission AS idpermission,
              ed.id_societe AS idsociete, ed.type, ed.motif, ed.date_debut AS datedebut, ed.date_fin AS datefin,
              ed.motif_modification
       FROM exception_droit ed
       JOIN utilisateur u ON u.id = ed.id_utilisateur
       WHERE ed.date_suppression IS NULL
         AND (${clause})
       ORDER BY ed.id_utilisateur, ed.id_societe`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/utilisateurs/:id/exceptions", async (req, res) => {
  const { id } = req.params;
  const { id_permission, id_societe, type, motif, date_debut, date_fin } = req.body;
  if (!id_permission || !type) return res.status(400).json({ error: "id_permission et type requis" });
  if (!motif || !motif.trim()) return res.status(400).json({ error: "Le motif est obligatoire." });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    // DO UPDATE : même règle que pour les attributions (uq_exception_droit),
    // une exception précédemment retirée doit pouvoir être recréée.
    const { rows } = await client.query(
      `INSERT INTO exception_droit (id_utilisateur, id_permission, id_societe, type, motif, date_debut, date_fin)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ON CONSTRAINT uq_exception_droit
       DO UPDATE SET motif = EXCLUDED.motif, date_debut = EXCLUDED.date_debut, date_fin = EXCLUDED.date_fin, date_suppression = NULL
       RETURNING id, id_utilisateur AS idutilisateur, id_permission AS idpermission,
                 id_societe AS idsociete, type, motif, date_debut AS datedebut, date_fin AS datefin,
                 motif_modification`,
      [id, id_permission, id_societe || null, type, motif || null, date_debut || null, date_fin || null]
    );
    const { rows: u } = await client.query(`SELECT prenom, nom FROM utilisateur WHERE id = $1`, [id]);
    const { rows: p } = await client.query(`SELECT label, code FROM permission WHERE id = $1`, [id_permission]);
    const { rows: s } = id_societe ? await client.query(`SELECT raison_sociale FROM societe WHERE id = $1`, [id_societe]) : { rows: [{ raison_sociale: null }] };
    await log(client, "CREATE", "exception_droit", rows[0].id, `Exception "${p[0]?.label || p[0]?.code || id_permission}" (${type}) créée pour ${u[0]?.prenom || ''} ${u[0]?.nom || ''} sur ${s[0]?.raison_sociale || id_societe || 'toutes sociétés'}`, rows[0]);
    // entiteId vise le COMPTE et non la ligne d'exception : l'historique d'un
    // utilisateur doit se lire d'une seule requete sur entite_id.
    // code_retour: 2022
    await auditer(client, req, {
      action: "EXCEPTION_AJOUTEE",
      entiteId: id,
      apres: {
        permission: p[0]?.label || p[0]?.code || null,
        type,
        portee: s[0]?.raison_sociale || "toutes sociétés",
        motif: motif || null,
        date_debut: date_debut || null,
        date_fin: date_fin || null,
        id_exception: rows[0].id,
      },
    });
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /utilisateurs/:id/exceptions error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/utilisateurs/:id/exceptions/:excId", async (req, res) => {
  const { excId } = req.params;
  const { date_debut, date_fin, motif_modification } = req.body;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    // Etat anterieur, pour que la trace dise ce qui a change et non seulement
    // qu'une modification a eu lieu.
    const { rows: avant } = await client.query(
      `SELECT id_utilisateur, id_permission, id_societe, type,
              date_debut::text AS date_debut, date_fin::text AS date_fin, motif_modification
         FROM exception_droit WHERE id = $1 AND date_suppression IS NULL`, [excId]);
    if (!avant.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Exception introuvable" }); }

    const { rows } = await client.query(
      `UPDATE exception_droit
       SET date_debut = COALESCE($2, date_debut), date_fin = COALESCE($3, date_fin), motif_modification = COALESCE($4, motif_modification)
       WHERE id = $1 AND date_suppression IS NULL
       RETURNING id, id_utilisateur AS idutilisateur, id_permission AS idpermission,
                 id_societe AS idsociete, type, motif,
                 date_debut::text AS datedebut, date_fin::text AS datefin,
                 motif_modification`,
      [excId, date_debut, date_fin, motif_modification]
    );
    if (!rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Exception introuvable" }); }

    const { rows: p } = await client.query(`SELECT label, code FROM permission WHERE id = $1`, [avant[0].id_permission]);
    const { rows: s } = avant[0].id_societe
      ? await client.query(`SELECT raison_sociale FROM societe WHERE id = $1`, [avant[0].id_societe])
      : { rows: [{ raison_sociale: null }] };

    await log(client, "UPDATE", "exception_droit", excId,
      `Exception "${p[0]?.label || p[0]?.code || avant[0].id_permission}" modifiee`,
      { date_debut: rows[0].datedebut, date_fin: rows[0].datefin });

    // code_retour: 2023
    await auditer(client, req, {
      action: "EXCEPTION_MODIFIEE",
      entiteId: avant[0].id_utilisateur,
      avant: { date_debut: avant[0].date_debut, date_fin: avant[0].date_fin },
      apres: {
        permission: p[0]?.label || p[0]?.code || null,
        portee: s[0]?.raison_sociale || "toutes sociétés",
        date_debut: rows[0].datedebut,
        date_fin: rows[0].datefin,
        motif_modification: rows[0].motif_modification || null,
      },
    });

    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /utilisateurs/:id/exceptions/:excId error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/utilisateurs/:id/exceptions/:excId", async (req, res) => {
  const { excId } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: e } = await client.query(`SELECT id_utilisateur, id_permission, id_societe FROM exception_droit WHERE id = $1`, [excId]);
    const { rowCount } = await tenantPool.query(
      `UPDATE exception_droit SET date_suppression = now() WHERE id = $1 AND date_suppression IS NULL`,
      [excId]
    );
    if (!rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Exception introuvable" }); }
    const { rows: u } = await client.query(`SELECT prenom, nom FROM utilisateur WHERE id = $1`, [e[0]?.id_utilisateur]);
    const { rows: p } = await client.query(`SELECT label, code FROM permission WHERE id = $1`, [e[0]?.id_permission]);
    const { rows: s } = e[0]?.id_societe ? await client.query(`SELECT raison_sociale FROM societe WHERE id = $1`, [e[0].id_societe]) : { rows: [{ raison_sociale: null }] };
    await log(client, "SOFT_DELETE", "exception_droit", excId, `Exception "${p[0]?.label || p[0]?.code || e[0]?.id_permission}" supprimée pour ${u[0]?.prenom || ''} ${u[0]?.nom || ''} sur ${s[0]?.raison_sociale || e[0]?.id_societe || 'toutes sociétés'}`, null);
    // e[0] est lu avant l'UPDATE : le compte porteur est connu meme apres le
    // retrait. id n'existe pas dans cette portee, seul excId est destructure.
    // code_retour: 2024
    await auditer(client, req, {
      action: "EXCEPTION_SUPPRIMEE",
      entiteId: e[0]?.id_utilisateur,
      avant: {
        permission: p[0]?.label || p[0]?.code || null,
        portee: s[0]?.raison_sociale || "toutes sociétés",
        id_exception: excId,
      },
    });
    await client.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /utilisateurs/:id/exceptions/:excId error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;