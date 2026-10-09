// Groupes d'organisations (US #277, decisions client du 08/10/2026, issue
// #213) : un groupe est une somme de societes du tenant, choisie librement.
// Une societe peut appartenir a plusieurs groupes ; aucune visibilite
// implicite par la hierarchie, la cascade mere-filles est un confort de
// saisie a l'ecran, seule la composition enregistree fait foi.
//
// Le groupe ne confere rien par lui-meme : il est reference par les lignes
// d'acces des groupes d'utilisateurs (profil × groupe d'organisations,
// routeur groupesUtilisateurs.js). Sa suppression est douce et REFUSEE tant
// qu'une ligne d'acces active s'en sert (2104, message qui liste les usages).
//
// Tout le CRUD est sous gerer_profils (routesPermissions.js). Garde-fou de
// delegation etendu aux groupes (#278 -> #277) : on ne compose un groupe
// qu'avec des societes que l'on detient ; seuls les AJOUTS exigent la
// detention, retirer reste libre (meme doctrine que les matrices). L'acteur
// admin_sam et le rattachement tenant voient tout (scopeAdministration).
//
// La composition est remplacee integralement a chaque enregistrement (meme
// motif que les matrices par societe, 092) : l'avant/apres est porte par
// audit_log, pas de soft-delete sur la table de liaison.

import express from "express";
import { tenantPool } from "../db.js";
import { estUuid } from "../utils/matriceGroupe.js";
import { auditer, diff } from "../utils/audit.js";
import { scopeAdministration, societesNonDetenues } from "../utils/droitsUtilisateur.js";

const router = express.Router();

const SELECT_GROUPE = `id, nom, description, created_at, updated_at`;

// Sous-requete reutilisee en liste et en detail : societes ACTIVES du groupe,
// triees pour un rendu stable (une societe supprimee disparait de la
// composition affichee et des droits, sa ligne reste en base).
const SOCIETES_JSON = `
  COALESCE((SELECT json_agg(json_build_object('id', s.id, 'raison_sociale', s.raison_sociale)
                            ORDER BY s.raison_sociale)
              FROM groupe_organisation_societe gos
              JOIN societe s ON s.id = gos.id_societe AND s.date_suppression IS NULL
             WHERE gos.id_groupe_organisation = g.id), '[]'::json) AS societes`;

// Usages : lignes d'acces ACTIVES de groupes d'utilisateurs ACTIFS qui
// referencent ce groupe. C'est le compteur qui bloque la suppression.
const USAGES_JSON = `
  COALESCE((SELECT json_agg(DISTINCT gu.nom ORDER BY gu.nom)
              FROM groupe_utilisateur_acces gua
              JOIN groupe_utilisateur gu ON gu.id = gua.id_groupe_utilisateur
                                        AND gu.date_suppression IS NULL
             WHERE gua.id_groupe_organisation = g.id
               AND gua.date_suppression IS NULL), '[]'::json) AS utilises_par`;

async function log(client, action, entite_type, entite_id, description, payload) {
  await client.query(
    `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [action, entite_type, entite_id || null, description, payload ? JSON.stringify(payload) : null]
  );
}

// Les tables des groupes n'existent pas tant que la 106 n'est pas jouee : le
// 42P01 sort alors en message exploitable plutot qu'en erreur serveur muette
// (meme pratique que profils.js avec la 097).
function erreurServeur(res, err, contexte) {
  console.error(contexte, err);
  if (err.code === "42P01") {
    return res.status(500).json({ error: "Les groupes d'organisations ne sont pas encore installés sur cette base (migration 106 à jouer)." });
  }
  return res.status(500).json({ error: "Erreur serveur" });
}

// Validation commune de la composition : societe_ids optionnel, liste d'UUID
// de societes actives, dedoublonnee. Rend { ids } ou { erreur }.
async function validerComposition(client, brut) {
  if (brut === undefined || brut === null) return { ids: null };
  if (!Array.isArray(brut) || !brut.every(estUuid)) {
    // code_retour: 2103
    return { erreur: "societe_ids doit être une liste d'identifiants de sociétés." };
  }
  const ids = [...new Set(brut)];
  if (!ids.length) return { ids: [] };
  const { rows } = await client.query(
    `SELECT id FROM societe WHERE id = ANY($1::uuid[]) AND date_suppression IS NULL`, [ids]
  );
  if (rows.length !== ids.length) {
    // code_retour: 2103
    return { erreur: "Société introuvable dans la sélection." };
  }
  return { ids };
}

// Garde-fou de composition (#277) : les societes AJOUTEES doivent etre dans le
// perimetre de l'acteur. Rend null si tout va bien, sinon la reponse 403.
async function refuserSocietesHorsPerimetre(req, res, client, idsAjoutes) {
  if (!idsAjoutes.length) return null;
  const scope = await scopeAdministration(req.user.id);
  const horsPerimetre = societesNonDetenues(idsAjoutes, scope);
  if (!horsPerimetre.length) return null;
  const { rows } = await client.query(
    `SELECT raison_sociale FROM societe WHERE id = ANY($1::uuid[]) ORDER BY raison_sociale`,
    [horsPerimetre]
  );
  const noms = rows.map((r) => `"${r.raison_sociale}"`).join(", ");
  // code_retour: 2080
  res.status(403).json({
    error: `Vous ne pouvez pas composer un groupe avec des sociétés hors de votre périmètre : ${noms}.`,
    societes_hors_perimetre: horsPerimetre,
  });
  return true;
}

router.get("/groupes-organisations", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(
      `SELECT ${SELECT_GROUPE}, ${SOCIETES_JSON}, ${USAGES_JSON}
         FROM groupe_organisation g
        WHERE g.date_suppression IS NULL
        ORDER BY g.nom`
    );
    res.json(rows);
  } catch (err) {
    erreurServeur(res, err, "GET /groupes-organisations error");
  }
});

router.get("/groupes-organisations/:id", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Groupe d'organisations introuvable" });
  try {
    const { rows } = await tenantPool.query(
      `SELECT ${SELECT_GROUPE}, ${SOCIETES_JSON}, ${USAGES_JSON}
         FROM groupe_organisation g
        WHERE g.id = $1 AND g.date_suppression IS NULL`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Groupe d'organisations introuvable" });
    res.json(rows[0]);
  } catch (err) {
    erreurServeur(res, err, "GET /groupes-organisations/:id error");
  }
});

router.post("/groupes-organisations", async (req, res) => {
  const { nom, description, societe_ids } = req.body || {};
  if (!nom || !String(nom).trim()) {
    // code_retour: 2103
    return res.status(400).json({ error: "Le nom du groupe d'organisations est requis." });
  }
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const composition = await validerComposition(client, societe_ids);
    if (composition.erreur) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: composition.erreur });
    }
    const ids = composition.ids || [];
    if (await refuserSocietesHorsPerimetre(req, res, client, ids)) {
      await client.query("ROLLBACK");
      return;
    }
    const { rows } = await client.query(
      `INSERT INTO groupe_organisation (nom, description, id_cree_par)
       VALUES ($1, $2, $3)
       RETURNING ${SELECT_GROUPE}`,
      [String(nom).trim(), description || null, req.user.id]
    );
    if (ids.length) {
      await client.query(
        `INSERT INTO groupe_organisation_societe (id_groupe_organisation, id_societe)
         SELECT $1, unnest($2::uuid[])`,
        [rows[0].id, ids]
      );
    }
    const { rows: societes } = await client.query(
      `SELECT raison_sociale FROM societe WHERE id = ANY($1::uuid[]) ORDER BY raison_sociale`, [ids]
    );
    const labels = societes.map((s) => s.raison_sociale);
    await log(client, "CREATE", "groupe_organisation", rows[0].id,
      `Groupe d'organisations "${rows[0].nom}" créé (${ids.length} société(s))`, { societes: labels });
    // code_retour: 2100
    await auditer(client, req, {
      action: "GROUPE_ORGANISATION_CREE", entiteType: "groupe_organisation", entiteId: rows[0].id,
      apres: { nom: rows[0].nom, description: rows[0].description, societes: labels },
    });
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      // code_retour: 2103
      return res.status(409).json({ error: "Un groupe d'organisations porte déjà ce nom : choisissez-en un autre." });
    }
    erreurServeur(res, err, "POST /groupes-organisations error");
  } finally {
    client.release();
  }
});

// Remplacement : nom et description par COALESCE, composition remplacee
// integralement quand societe_ids est fourni (absent = composition intacte).
router.put("/groupes-organisations/:id", async (req, res) => {
  const { id } = req.params;
  const { nom, description, societe_ids } = req.body || {};
  if (!estUuid(id)) return res.status(404).json({ error: "Groupe d'organisations introuvable" });
  if (nom !== undefined && !String(nom || "").trim()) {
    // code_retour: 2103
    return res.status(400).json({ error: "Le nom du groupe d'organisations est requis." });
  }
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: avant } = await client.query(
      `SELECT nom, description FROM groupe_organisation
        WHERE id = $1 AND date_suppression IS NULL FOR UPDATE`, [id]
    );
    if (!avant.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Groupe d'organisations introuvable" }); }

    const composition = await validerComposition(client, societe_ids);
    if (composition.erreur) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: composition.erreur });
    }

    const { rows: anciennes } = await client.query(
      `SELECT gos.id_societe, s.raison_sociale
         FROM groupe_organisation_societe gos
         JOIN societe s ON s.id = gos.id_societe
        WHERE gos.id_groupe_organisation = $1
        ORDER BY s.raison_sociale`, [id]
    );

    if (composition.ids !== null) {
      // Seuls les AJOUTS exigent la detention (#278 etendu) : retirer une
      // societe, meme hors perimetre, reste libre.
      const avantIds = new Set(anciennes.map((r) => r.id_societe));
      const ajoutees = composition.ids.filter((sid) => !avantIds.has(sid));
      if (await refuserSocietesHorsPerimetre(req, res, client, ajoutees)) {
        await client.query("ROLLBACK");
        return;
      }
      await client.query(`DELETE FROM groupe_organisation_societe WHERE id_groupe_organisation = $1`, [id]);
      if (composition.ids.length) {
        await client.query(
          `INSERT INTO groupe_organisation_societe (id_groupe_organisation, id_societe)
           SELECT $1, unnest($2::uuid[])`,
          [id, composition.ids]
        );
      }
    }

    const { rows } = await client.query(
      `UPDATE groupe_organisation
          SET nom = COALESCE($2, nom), description = COALESCE($3, description), updated_at = now()
        WHERE id = $1
        RETURNING ${SELECT_GROUPE}`,
      [id, nom !== undefined ? String(nom).trim() : null, description !== undefined ? (description || null) : null]
    );

    const { rows: nouvelles } = await client.query(
      `SELECT s.raison_sociale
         FROM groupe_organisation_societe gos
         JOIN societe s ON s.id = gos.id_societe
        WHERE gos.id_groupe_organisation = $1
        ORDER BY s.raison_sociale`, [id]
    );
    const labelsAvant = anciennes.map((r) => r.raison_sociale);
    const labelsApres = nouvelles.map((r) => r.raison_sociale);
    const d = diff(
      { nom: avant[0].nom, description: avant[0].description, societes: labelsAvant.join(", ") },
      { nom: rows[0].nom, description: rows[0].description, societes: labelsApres.join(", ") }
    );
    await log(client, "UPDATE", "groupe_organisation", id,
      `Groupe d'organisations "${rows[0].nom}" modifié (${labelsApres.length} société(s))`, { societes: labelsApres });
    // code_retour: 2101
    await auditer(client, req, {
      action: "GROUPE_ORGANISATION_MODIFIE", entiteType: "groupe_organisation", entiteId: id,
      avant: d.avant, apres: d.apres,
    });
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      // code_retour: 2103
      return res.status(409).json({ error: "Un groupe d'organisations porte déjà ce nom : choisissez-en un autre." });
    }
    erreurServeur(res, err, "PUT /groupes-organisations/:id error");
  } finally {
    client.release();
  }
});

// Suppression douce, refusee tant qu'une ligne d'acces active s'en sert : le
// message liste les groupes d'utilisateurs concernes, l'administrateur sait
// exactement quoi defaire (meme doctrine que les suppressions bloquees par
// compteurs de rattachements des routeurs metier).
router.delete("/groupes-organisations/:id", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Groupe d'organisations introuvable" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: grp } = await client.query(
      `SELECT nom FROM groupe_organisation WHERE id = $1 AND date_suppression IS NULL FOR UPDATE`, [id]
    );
    if (!grp.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Groupe d'organisations introuvable" }); }

    const { rows: usages } = await client.query(
      `SELECT gu.nom, COUNT(*)::int AS lignes
         FROM groupe_utilisateur_acces gua
         JOIN groupe_utilisateur gu ON gu.id = gua.id_groupe_utilisateur
                                   AND gu.date_suppression IS NULL
        WHERE gua.id_groupe_organisation = $1 AND gua.date_suppression IS NULL
        GROUP BY gu.nom
        ORDER BY gu.nom`,
      [id]
    );
    if (usages.length) {
      await client.query("ROLLBACK");
      const detail = usages.map((u) => `"${u.nom}" (${u.lignes} ligne${u.lignes > 1 ? "s" : ""})`).join(", ");
      // code_retour: 2104
      return res.status(409).json({
        error: `Suppression impossible : le groupe d'organisations "${grp[0].nom}" est utilisé par ${usages.length > 1 ? "les groupes d'utilisateurs" : "le groupe d'utilisateurs"} ${detail}. Retirez d'abord ces lignes d'accès.`,
        utilises_par: usages,
      });
    }

    await client.query(`UPDATE groupe_organisation SET date_suppression = now() WHERE id = $1`, [id]);
    await log(client, "SOFT_DELETE", "groupe_organisation", id,
      `Groupe d'organisations "${grp[0].nom}" supprimé`, null);
    // code_retour: 2102
    await auditer(client, req, {
      action: "GROUPE_ORGANISATION_SUPPRIME", entiteType: "groupe_organisation", entiteId: id,
      avant: { nom: grp[0].nom },
    });
    await client.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    erreurServeur(res, err, "DELETE /groupes-organisations/:id error");
  } finally {
    client.release();
  }
});

export default router;
