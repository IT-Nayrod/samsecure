// Profils de droits : cycle de vie des groupes personnalisés, matrices des
// profils par défaut (#249) et impact d'une suppression sur les attributions.
//
// Depuis la migration 074, la table porte trois types : profil_defaut (seedé,
// non supprimable), groupe (créé par le client, CRUD complet) et systeme
// (admin_sam, non supprimable). La suppression d'un groupe est douce depuis la
// 008 ; la corbeille (#64) la rend visible : liste des groupes supprimés
// depuis moins de 90 jours, restauration, purge au-delà (fonction 075).
//
// Refonte #249 : les groupes ne portent plus de sociétés de diffusion (#57),
// les routes /profils/:id/societes sont retirées et profil_societe n'est plus
// ni lue ni écrite (la table reste en base). La matrice par défaut d'un profil
// se remplace intégralement (PUT /profils/:id/matrice, Q2) et peut être
// appliquée en masse à des sociétés, chacune devenant configurée (Q3). Ces
// routes de paramétrage exigent gerer_profils (Q5) ; le CRUD des groupes
// reste sous gerer_utilisateurs.

import express from "express";
import { tenantPool } from "../db.js";
import { estUuid } from "../utils/matriceGroupe.js";
import { auditer, diff } from "../utils/audit.js";
import { validerPermissionIds, matriceSocieteCourante, configurerMatriceSociete } from "../utils/matriceProfil.js";

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
    // #57 : plus de volet sociétés, la diffusion n'existe plus. La clé reste
    // servie vide pour ne rien casser d'un consommateur retardataire.
    res.json({ utilisateurs: users, societes: [] });
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


// ---------------------------------------------------------------------------
// Matrices des profils par défaut (#249), permission gerer_profils (Q5).
// ---------------------------------------------------------------------------

// Remplacement complet de la matrice par défaut du tenant (Q2). Réservé aux
// profils par défaut : un groupe se coche case par case (profilPermissions.js)
// et la matrice du profil système admin_sam est figée. Le remplacement passe
// par le soft-delete propre à profil_permission : les lignes retirées gardent
// leur trace, les lignes recochées se réactivent (contrainte uq respectée).
router.put("/profils/:id/matrice", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Profil introuvable" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: prof } = await client.query(
      `SELECT id, label, type FROM profil WHERE id = $1 AND date_suppression IS NULL FOR UPDATE`, [id]
    );
    if (!prof.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Profil introuvable" }); }
    if (prof[0].type !== "profil_defaut") {
      await client.query("ROLLBACK");
      // code_retour: 2074
      const message = prof[0].type === "systeme"
        ? `La matrice du profil système "${prof[0].label}" est figée.`
        : `"${prof[0].label}" n'est pas un profil par défaut : la matrice d'un groupe se gère depuis l'onglet Groupes personnalisés.`;
      return res.status(409).json({ error: message });
    }
    const matrice = await validerPermissionIds(client, req.body?.permission_ids);
    if (matrice.erreur) {
      await client.query("ROLLBACK");
      // code_retour: 2076
      return res.status(400).json({ error: matrice.erreur });
    }
    const { rows: avant } = await client.query(
      `SELECT p.code FROM profil_permission pp JOIN permission p ON p.id = pp.id_permission
        WHERE pp.id_profil = $1 AND pp.date_suppression IS NULL ORDER BY p.code`, [id]
    );
    await client.query(
      `UPDATE profil_permission SET date_suppression = now()
        WHERE id_profil = $1 AND date_suppression IS NULL
          AND NOT (id_permission = ANY($2::uuid[]))`,
      [id, matrice.ids]
    );
    if (matrice.ids.length) {
      await client.query(
        `INSERT INTO profil_permission (id_profil, id_permission)
         SELECT $1, unnest($2::uuid[])
         ON CONFLICT (id_profil, id_permission) DO UPDATE SET date_suppression = NULL`,
        [id, matrice.ids]
      );
    }
    await log(client, "UPDATE", "profil", id,
      `Matrice par défaut du profil "${prof[0].label}" remplacée : ${matrice.ids.length} permission(s)`,
      { permissions: matrice.codes });
    // code_retour: 2070
    await auditer(client, req, {
      action: "PROFIL_MATRICE_DEFAUT_REMPLACEE", entiteType: "profil", entiteId: id,
      avant: { permissions: avant.map((r) => r.code) },
      apres: { permissions: matrice.codes },
    });
    await client.query("COMMIT");
    res.json({ id, permission_ids: matrice.ids });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /profils/:id/matrice error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// Paramétrage en masse : applique la matrice par défaut COURANTE du profil à
// plusieurs sociétés d'un coup, chacune devenant configurée (Q3). Une société
// déjà configurée est remplacée : c'est le sens d'« appliquer ». Transaction
// unique, une trace probante par société (même action que la configuration
// unitaire, marquée en_masse).
router.post("/profils/:id/matrice/appliquer", async (req, res) => {
  const { id } = req.params;
  const societeIds = req.body?.societe_ids;
  if (!estUuid(id)) return res.status(404).json({ error: "Profil introuvable" });
  if (!Array.isArray(societeIds) || !societeIds.length || !societeIds.every(estUuid)) {
    return res.status(400).json({ error: "societe_ids doit être une liste de sociétés." });
  }
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: prof } = await client.query(
      `SELECT id, label, type FROM profil WHERE id = $1 AND date_suppression IS NULL FOR UPDATE`, [id]
    );
    if (!prof.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Profil introuvable" }); }
    if (prof[0].type !== "profil_defaut") {
      await client.query("ROLLBACK");
      // code_retour: 2074
      return res.status(409).json({ error: `"${prof[0].label}" n'est pas un profil par défaut.` });
    }
    const ids = [...new Set(societeIds)];
    const { rows: societes } = await client.query(
      `SELECT id, raison_sociale FROM societe WHERE id = ANY($1) AND date_suppression IS NULL`, [ids]
    );
    if (societes.length !== ids.length) {
      await client.query("ROLLBACK");
      // code_retour: 2075
      return res.status(400).json({ error: "Société introuvable dans la sélection." });
    }
    const { rows: defaut } = await client.query(
      `SELECT pp.id_permission, p.code
         FROM profil_permission pp JOIN permission p ON p.id = pp.id_permission
        WHERE pp.id_profil = $1 AND pp.date_suppression IS NULL ORDER BY p.code`, [id]
    );
    const permissionIds = defaut.map((r) => r.id_permission);
    const codes = defaut.map((r) => r.code);
    for (const societe of societes) {
      const { rows: conf } = await client.query(
        `SELECT 1 FROM profil_societe_configuration WHERE id_profil = $1 AND id_societe = $2`,
        [id, societe.id]
      );
      const avantConfigure = conf.length > 0;
      const avantCodes = avantConfigure ? await matriceSocieteCourante(client, id, societe.id) : null;
      await configurerMatriceSociete(client, req, {
        profil: prof[0], societe, ids: permissionIds, codes,
        avantConfigure, avantCodes, enMasse: true,
      });
    }
    await client.query("COMMIT");
    res.json({ societes_configurees: societes.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /profils/:id/matrice/appliquer error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// Sociétés configurées d'un profil, pour l'onglet Profils de l'administration
// (liste et liens vers la fiche société).
router.get("/profils/:id/societes-configurees", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Profil introuvable" });
  try {
    const { rows } = await tenantPool.query(
      `SELECT psc.id_societe, s.raison_sociale, psc.configure_le,
              TRIM(COALESCE(u.prenom, '') || ' ' || COALESCE(u.nom, '')) AS configure_par_label
         FROM profil_societe_configuration psc
         JOIN societe s ON s.id = psc.id_societe AND s.date_suppression IS NULL
         LEFT JOIN utilisateur u ON u.id = psc.id_configure_par
        WHERE psc.id_profil = $1
        ORDER BY s.raison_sociale`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /profils/:id/societes-configurees error", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
