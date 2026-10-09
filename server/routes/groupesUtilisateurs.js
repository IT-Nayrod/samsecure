// Groupes d'utilisateurs (US #330, decisions client du 08/10/2026, issue
// #213) : un groupe est une somme de comptes dont les acces sont une somme de
// lignes profil × groupe d'organisations (ex. IT Ops sur le groupe A-B-C et
// Manager DSI sur le groupe E-F). Ajouter un compte au groupe lui donne tous
// ces acces ; un compte peut appartenir a plusieurs groupes et garder des
// attributions directes (« et/ou ») : les droits effectifs sont l'union
// (droitsUtilisateur.js, lignesAccesGroupes).
//
// Permissions (routesPermissions.js) : lectures socle sous gerer_utilisateurs
// (comme GET /profils : la fiche utilisateur lit les appartenances et le
// catalogue), ecritures du groupe et des lignes d'acces sous gerer_profils,
// ajout et retrait de membres sous gerer_utilisateurs.
//
// Garde-fous de delegation reutilises (#278, etendus aux groupes) :
//   - composer une ligne d'acces exige de detenir les societes du groupe
//     d'organisations ET la matrice effective du profil sur ces societes
//     (verifierDelegation, 2080) ; admin_sam exempte ;
//   - le profil admin_sam ne se donne PAS par un groupe (2113, decision a
//     valider par Samuel, reserve au journal du chantier) ;
//   - ajouter un membre attribue les acces du groupe : l'acteur doit detenir
//     l'union des permissions conferees par ses lignes actives (2080), la
//     cible doit etre dans son perimetre (2051) et un titulaire admin_sam
//     reste verrouille (2081) ; retirer suit perimetre et verrou, sans
//     condition de detention (retirer reste libre).

import express from "express";
import { tenantPool } from "../db.js";
import { isUserInScope } from "../utils/scope.js";
import { estUuid } from "../utils/matriceGroupe.js";
import { auditer, diff } from "../utils/audit.js";
import {
  scopeAdministration, cibleVerrouilleeAdminSam, verifierDelegation,
  permissionsDuProfil, societesNonDetenues, societesParProfilDesGroupes,
} from "../utils/droitsUtilisateur.js";

const router = express.Router();

// code_retour: 2081
const MESSAGE_ADMIN_SAM =
  "Seul un administrateur SAM peut modifier un compte titulaire du profil Admin SAM.";

const SELECT_GROUPE = `id, nom, description, created_at, updated_at`;

async function log(client, action, entite_type, entite_id, description, payload) {
  await client.query(
    `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [action, entite_type, entite_id || null, description, payload ? JSON.stringify(payload) : null]
  );
}

function erreurServeur(res, err, contexte) {
  console.error(contexte, err);
  if (err.code === "42P01") {
    return res.status(500).json({ error: "Les groupes d'utilisateurs ne sont pas encore installés sur cette base (migrations 106 et 107 à jouer)." });
  }
  return res.status(500).json({ error: "Erreur serveur" });
}

// Lignes d'acces ACTIVES d'un groupe, chacune avec les societes actives de son
// groupe d'organisations : la meme matiere sert le detail, le garde-fou
// d'ajout de membre et les messages.
async function lignesAccesDuGroupe(client, idGroupe) {
  const { rows } = await client.query(
    `SELECT gua.id, gua.id_profil, p.code AS profil_code, p.label AS profil_label, p.type AS profil_type,
            gua.id_groupe_organisation, go.nom AS groupe_organisation_nom,
            COALESCE(soc.ids, '{}') AS societes,
            COALESCE(soc.labels, '{}') AS societes_labels
       FROM groupe_utilisateur_acces gua
       JOIN profil p ON p.id = gua.id_profil AND p.date_suppression IS NULL
       JOIN groupe_organisation go ON go.id = gua.id_groupe_organisation
                                  AND go.date_suppression IS NULL
       LEFT JOIN LATERAL (
         SELECT array_agg(gos.id_societe) AS ids,
                array_agg(s.raison_sociale ORDER BY s.raison_sociale) AS labels
           FROM groupe_organisation_societe gos
           JOIN societe s ON s.id = gos.id_societe AND s.date_suppression IS NULL
          WHERE gos.id_groupe_organisation = go.id
       ) soc ON true
      WHERE gua.id_groupe_utilisateur = $1 AND gua.date_suppression IS NULL
      ORDER BY p.label, go.nom`,
    [idGroupe]
  );
  return rows;
}

// Garde-fou de detention d'une composition (#278 etendu #330) : l'acteur doit
// detenir l'union des permissions conferees par les lignes passees (matrice
// effective de chaque profil sur les societes de son groupe d'organisations).
// Rend null si tout va bien, sinon { manquantes }.
async function detentionManquante(idActeur, lignes) {
  const codes = new Set();
  for (const [idProfil, couvertes] of societesParProfilDesGroupes(lignes)) {
    for (const code of await permissionsDuProfil(idProfil, [...couvertes])) codes.add(code);
  }
  const delegation = await verifierDelegation(idActeur, [...codes]);
  return delegation.ok ? null : { manquantes: delegation.manquantes };
}

// ---------------------------------------------------------------------------
// Lectures socle (gerer_utilisateurs).
// ---------------------------------------------------------------------------

router.get("/groupes-utilisateurs", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(
      `SELECT ${SELECT_GROUPE},
              (SELECT COUNT(*)::int FROM groupe_utilisateur_membre gum
                WHERE gum.id_groupe_utilisateur = g.id AND gum.date_suppression IS NULL) AS nb_membres,
              (SELECT COUNT(*)::int FROM groupe_utilisateur_acces gua
                WHERE gua.id_groupe_utilisateur = g.id AND gua.date_suppression IS NULL) AS nb_acces
         FROM groupe_utilisateur g
        WHERE g.date_suppression IS NULL
        ORDER BY g.nom`
    );
    res.json(rows);
  } catch (err) {
    erreurServeur(res, err, "GET /groupes-utilisateurs error");
  }
});

// Appartenances d'un compte, avec le detail des acces de chaque groupe : la
// section Groupes d'utilisateurs de la fiche utilisateur et la visionneuse
// des droits (provenance) lisent cette route. Chemin litteral distinct des
// routes generiques /utilisateurs/:id du routeur utilisateurs.
router.get("/utilisateurs/:id/groupes-utilisateurs", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Utilisateur introuvable" });
  try {
    const { rows } = await tenantPool.query(
      `SELECT gum.id AS id_appartenance, g.id, g.nom, g.description,
              COALESCE(acc.acces, '[]'::json) AS acces
         FROM groupe_utilisateur_membre gum
         JOIN groupe_utilisateur g ON g.id = gum.id_groupe_utilisateur
                                  AND g.date_suppression IS NULL
         LEFT JOIN LATERAL (
           SELECT json_agg(json_build_object(
                    'id', gua.id,
                    'id_profil', gua.id_profil,
                    'profil_code', p.code,
                    'profil_label', p.label,
                    'id_groupe_organisation', go.id,
                    'groupe_organisation_nom', go.nom,
                    'societes', COALESCE(soc.liste, '[]'::json))
                  ORDER BY p.label, go.nom) AS acces
             FROM groupe_utilisateur_acces gua
             JOIN profil p ON p.id = gua.id_profil AND p.date_suppression IS NULL
             JOIN groupe_organisation go ON go.id = gua.id_groupe_organisation
                                        AND go.date_suppression IS NULL
             LEFT JOIN LATERAL (
               SELECT json_agg(json_build_object('id', s.id, 'raison_sociale', s.raison_sociale)
                               ORDER BY s.raison_sociale) AS liste
                 FROM groupe_organisation_societe gos
                 JOIN societe s ON s.id = gos.id_societe AND s.date_suppression IS NULL
                WHERE gos.id_groupe_organisation = go.id
             ) soc ON true
            WHERE gua.id_groupe_utilisateur = g.id AND gua.date_suppression IS NULL
         ) acc ON true
        WHERE gum.id_utilisateur = $1 AND gum.date_suppression IS NULL
        ORDER BY g.nom`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    // Tables absentes avant les migrations 106/107 : la fiche utilisateur
    // reste servie, section vide (meme tolerance que le calcul des droits).
    if (err.code === "42P01") return res.json([]);
    erreurServeur(res, err, "GET /utilisateurs/:id/groupes-utilisateurs error");
  }
});

router.get("/groupes-utilisateurs/:id", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Groupe d'utilisateurs introuvable" });
  const client = await tenantPool.connect();
  try {
    const { rows } = await client.query(
      `SELECT ${SELECT_GROUPE} FROM groupe_utilisateur g
        WHERE g.id = $1 AND g.date_suppression IS NULL`, [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Groupe d'utilisateurs introuvable" });
    const { rows: membres } = await client.query(
      `SELECT gum.id, gum.id_utilisateur, u.prenom, u.nom, u.email, u.actif
         FROM groupe_utilisateur_membre gum
         JOIN utilisateur u ON u.id = gum.id_utilisateur
        WHERE gum.id_groupe_utilisateur = $1 AND gum.date_suppression IS NULL
        ORDER BY u.nom, u.prenom`,
      [id]
    );
    const acces = await lignesAccesDuGroupe(client, id);
    res.json({ ...rows[0], membres, acces });
  } catch (err) {
    erreurServeur(res, err, "GET /groupes-utilisateurs/:id error");
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Cycle de vie du groupe (gerer_profils).
// ---------------------------------------------------------------------------

router.post("/groupes-utilisateurs", async (req, res) => {
  const { nom, description } = req.body || {};
  if (!nom || !String(nom).trim()) {
    // code_retour: 2112
    return res.status(400).json({ error: "Le nom du groupe d'utilisateurs est requis." });
  }
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO groupe_utilisateur (nom, description, id_cree_par)
       VALUES ($1, $2, $3)
       RETURNING ${SELECT_GROUPE}`,
      [String(nom).trim(), description || null, req.user.id]
    );
    await log(client, "CREATE", "groupe_utilisateur", rows[0].id,
      `Groupe d'utilisateurs "${rows[0].nom}" créé`, rows[0]);
    // code_retour: 2105
    await auditer(client, req, {
      action: "GROUPE_UTILISATEUR_CREE", entiteType: "groupe_utilisateur", entiteId: rows[0].id,
      apres: { nom: rows[0].nom, description: rows[0].description },
    });
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      // code_retour: 2112
      return res.status(409).json({ error: "Un groupe d'utilisateurs porte déjà ce nom : choisissez-en un autre." });
    }
    erreurServeur(res, err, "POST /groupes-utilisateurs error");
  } finally {
    client.release();
  }
});

router.patch("/groupes-utilisateurs/:id", async (req, res) => {
  const { id } = req.params;
  const { nom, description } = req.body || {};
  if (!estUuid(id)) return res.status(404).json({ error: "Groupe d'utilisateurs introuvable" });
  if (nom !== undefined && !String(nom || "").trim()) {
    // code_retour: 2112
    return res.status(400).json({ error: "Le nom du groupe d'utilisateurs est requis." });
  }
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: avant } = await client.query(
      `SELECT nom, description FROM groupe_utilisateur
        WHERE id = $1 AND date_suppression IS NULL FOR UPDATE`, [id]
    );
    if (!avant.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Groupe d'utilisateurs introuvable" }); }
    const { rows } = await client.query(
      `UPDATE groupe_utilisateur
          SET nom = COALESCE($2, nom), description = COALESCE($3, description), updated_at = now()
        WHERE id = $1
        RETURNING ${SELECT_GROUPE}`,
      [id, nom !== undefined ? String(nom).trim() : null, description !== undefined ? (description || null) : null]
    );
    const d = diff(avant[0], { nom: rows[0].nom, description: rows[0].description });
    await log(client, "UPDATE", "groupe_utilisateur", id, `Groupe d'utilisateurs "${rows[0].nom}" modifié`, req.body);
    // code_retour: 2106
    await auditer(client, req, {
      action: "GROUPE_UTILISATEUR_MODIFIE", entiteType: "groupe_utilisateur", entiteId: id,
      avant: d.avant, apres: d.apres,
    });
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      // code_retour: 2112
      return res.status(409).json({ error: "Un groupe d'utilisateurs porte déjà ce nom : choisissez-en un autre." });
    }
    erreurServeur(res, err, "PATCH /groupes-utilisateurs/:id error");
  } finally {
    client.release();
  }
});

// Suppression douce du groupe seul : ses lignes d'acces et appartenances
// restent en base mais cessent de compter dans les droits (toutes les
// lectures joignent le groupe actif). L'ecran confirme avec l'impact.
router.delete("/groupes-utilisateurs/:id", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Groupe d'utilisateurs introuvable" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: grp } = await client.query(
      `SELECT nom FROM groupe_utilisateur WHERE id = $1 AND date_suppression IS NULL FOR UPDATE`, [id]
    );
    if (!grp.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Groupe d'utilisateurs introuvable" }); }
    const { rows: compteurs } = await client.query(
      `SELECT (SELECT COUNT(*)::int FROM groupe_utilisateur_membre
                WHERE id_groupe_utilisateur = $1 AND date_suppression IS NULL) AS membres,
              (SELECT COUNT(*)::int FROM groupe_utilisateur_acces
                WHERE id_groupe_utilisateur = $1 AND date_suppression IS NULL) AS acces`,
      [id]
    );
    await client.query(`UPDATE groupe_utilisateur SET date_suppression = now() WHERE id = $1`, [id]);
    await log(client, "SOFT_DELETE", "groupe_utilisateur", id,
      `Groupe d'utilisateurs "${grp[0].nom}" supprimé (${compteurs[0].membres} membre(s), ${compteurs[0].acces} ligne(s) d'accès)`, null);
    // code_retour: 2107
    await auditer(client, req, {
      action: "GROUPE_UTILISATEUR_SUPPRIME", entiteType: "groupe_utilisateur", entiteId: id,
      avant: { nom: grp[0].nom, membres: compteurs[0].membres, acces: compteurs[0].acces },
    });
    await client.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    erreurServeur(res, err, "DELETE /groupes-utilisateurs/:id error");
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Lignes d'acces profil × groupe d'organisations (gerer_profils).
// ---------------------------------------------------------------------------

router.post("/groupes-utilisateurs/:id/acces", async (req, res) => {
  const { id } = req.params;
  const { id_profil, id_groupe_organisation } = req.body || {};
  if (!estUuid(id)) return res.status(404).json({ error: "Groupe d'utilisateurs introuvable" });
  if (!estUuid(id_profil || "") || !estUuid(id_groupe_organisation || "")) {
    // code_retour: 2112
    return res.status(400).json({ error: "id_profil et id_groupe_organisation sont requis." });
  }
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: grp } = await client.query(
      `SELECT nom FROM groupe_utilisateur WHERE id = $1 AND date_suppression IS NULL FOR UPDATE`, [id]
    );
    if (!grp.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Groupe d'utilisateurs introuvable" }); }

    const { rows: prof } = await client.query(
      `SELECT code, label FROM profil WHERE id = $1 AND date_suppression IS NULL`, [id_profil]
    );
    if (!prof.length) {
      await client.query("ROLLBACK");
      // code_retour: 2112
      return res.status(400).json({ error: "Ce profil n'existe pas." });
    }
    // Decision du 08/10 (a valider par Samuel, reserve au journal) : admin_sam
    // voit tout et ne se donne PAS par un groupe. Le profil systeme reste
    // attribuable individuellement, par un admin_sam (PUT profils, 2081).
    if (prof[0].code === "admin_sam") {
      await client.query("ROLLBACK");
      // code_retour: 2113
      return res.status(409).json({
        error: `Le profil "${prof[0].label}" ne se donne pas par un groupe d'utilisateurs : il s'attribue individuellement, par un administrateur SAM.`,
      });
    }

    const { rows: go } = await client.query(
      `SELECT nom FROM groupe_organisation WHERE id = $1 AND date_suppression IS NULL`, [id_groupe_organisation]
    );
    if (!go.length) {
      await client.query("ROLLBACK");
      // code_retour: 2112
      return res.status(400).json({ error: "Ce groupe d'organisations n'existe pas." });
    }

    // Garde-fous de composition (#278 etendus) : societes du groupe
    // d'organisations dans le perimetre de l'acteur, et matrice effective du
    // profil sur ces societes entierement detenue.
    const { rows: societes } = await client.query(
      `SELECT gos.id_societe FROM groupe_organisation_societe gos
         JOIN societe s ON s.id = gos.id_societe AND s.date_suppression IS NULL
        WHERE gos.id_groupe_organisation = $1`,
      [id_groupe_organisation]
    );
    const societeIds = societes.map((r) => r.id_societe);
    const scope = await scopeAdministration(req.user.id);
    const horsPerimetre = societesNonDetenues(societeIds, scope);
    if (horsPerimetre.length) {
      await client.query("ROLLBACK");
      // code_retour: 2080
      return res.status(403).json({
        error: `Vous ne pouvez pas composer un accès sur le groupe d'organisations "${go[0].nom}" : il contient des sociétés hors de votre périmètre.`,
        societes_hors_perimetre: horsPerimetre,
      });
    }
    const manque = await detentionManquante(req.user.id, [{ id_profil, societes: societeIds }]);
    if (manque) {
      await client.query("ROLLBACK");
      // code_retour: 2080
      return res.status(403).json({
        error: `Vous ne pouvez pas composer l'accès "${prof[0].label}" × "${go[0].nom}" : il confère des permissions que vous ne détenez pas (${manque.manquantes.join(", ")}).`,
        permissions_manquantes: manque.manquantes,
      });
    }

    // Une ligne precedemment retiree se reactive (uq_groupe_utilisateur_acces),
    // meme motif que les attributions de profils.
    const { rows } = await client.query(
      `INSERT INTO groupe_utilisateur_acces (id_groupe_utilisateur, id_profil, id_groupe_organisation, id_ajoute_par)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ON CONSTRAINT uq_groupe_utilisateur_acces
       DO UPDATE SET date_suppression = NULL, id_ajoute_par = EXCLUDED.id_ajoute_par
       RETURNING id, id_profil, id_groupe_organisation`,
      [id, id_profil, id_groupe_organisation, req.user.id]
    );
    await log(client, "CREATE", "groupe_utilisateur_acces", rows[0].id,
      `Accès "${prof[0].label}" × "${go[0].nom}" ajouté au groupe d'utilisateurs "${grp[0].nom}"`, rows[0]);
    // code_retour: 2108
    await auditer(client, req, {
      action: "GROUPE_UTILISATEUR_ACCES_AJOUTE", entiteType: "groupe_utilisateur", entiteId: id,
      apres: { groupe: grp[0].nom, profil: prof[0].label, groupe_organisation: go[0].nom },
    });
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    erreurServeur(res, err, "POST /groupes-utilisateurs/:id/acces error");
  } finally {
    client.release();
  }
});

router.delete("/groupes-utilisateurs/:id/acces/:accesId", async (req, res) => {
  const { id, accesId } = req.params;
  if (!estUuid(id) || !estUuid(accesId)) return res.status(404).json({ error: "Ligne d'accès introuvable" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: a } = await client.query(
      `SELECT gua.id, gu.nom AS groupe_nom, p.label AS profil_label, go.nom AS groupe_organisation_nom
         FROM groupe_utilisateur_acces gua
         JOIN groupe_utilisateur gu ON gu.id = gua.id_groupe_utilisateur
         JOIN profil p ON p.id = gua.id_profil
         JOIN groupe_organisation go ON go.id = gua.id_groupe_organisation
        WHERE gua.id = $1 AND gua.id_groupe_utilisateur = $2 AND gua.date_suppression IS NULL
        FOR UPDATE OF gua`,
      [accesId, id]
    );
    if (!a.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Ligne d'accès introuvable" }); }
    await client.query(
      `UPDATE groupe_utilisateur_acces SET date_suppression = now() WHERE id = $1`, [accesId]
    );
    await log(client, "SOFT_DELETE", "groupe_utilisateur_acces", accesId,
      `Accès "${a[0].profil_label}" × "${a[0].groupe_organisation_nom}" retiré du groupe d'utilisateurs "${a[0].groupe_nom}"`, null);
    // code_retour: 2109
    await auditer(client, req, {
      action: "GROUPE_UTILISATEUR_ACCES_RETIRE", entiteType: "groupe_utilisateur", entiteId: id,
      avant: { groupe: a[0].groupe_nom, profil: a[0].profil_label, groupe_organisation: a[0].groupe_organisation_nom },
    });
    await client.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    erreurServeur(res, err, "DELETE /groupes-utilisateurs/:id/acces/:accesId error");
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Membres (gerer_utilisateurs).
// ---------------------------------------------------------------------------

router.post("/groupes-utilisateurs/:id/membres", async (req, res) => {
  const { id } = req.params;
  const { id_utilisateur } = req.body || {};
  if (!estUuid(id)) return res.status(404).json({ error: "Groupe d'utilisateurs introuvable" });
  if (!estUuid(id_utilisateur || "")) {
    // code_retour: 2112
    return res.status(400).json({ error: "id_utilisateur est requis." });
  }

  // Perimetre et verrou (#278) : memes regles que l'attribution directe d'un
  // profil, l'ajout a un groupe est une ecriture sur le compte cible.
  const scope = await scopeAdministration(req.user.id);
  if (!(await isUserInScope(id_utilisateur, scope))) {
    // code_retour: 2051
    return res.status(403).json({ error: "Cet utilisateur n'est pas dans votre périmètre." });
  }
  if (await cibleVerrouilleeAdminSam(req.user.id, id_utilisateur)) {
    // code_retour: 2081
    return res.status(403).json({ error: MESSAGE_ADMIN_SAM });
  }

  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: grp } = await client.query(
      `SELECT nom FROM groupe_utilisateur WHERE id = $1 AND date_suppression IS NULL FOR UPDATE`, [id]
    );
    if (!grp.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Groupe d'utilisateurs introuvable" }); }
    const { rows: u } = await client.query(
      `SELECT prenom, nom FROM utilisateur WHERE id = $1`, [id_utilisateur]
    );
    if (!u.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Utilisateur introuvable" }); }

    // Garde-fou #278 etendu : ajouter un membre lui attribue tous les acces du
    // groupe, l'acteur doit donc detenir l'union des permissions conferees par
    // les lignes actives (admin_sam exempte dans verifierDelegation).
    const lignes = await lignesAccesDuGroupe(client, id);
    const manque = await detentionManquante(req.user.id, lignes);
    if (manque) {
      await client.query("ROLLBACK");
      // code_retour: 2080
      return res.status(403).json({
        error: `Vous ne pouvez pas ajouter un membre au groupe "${grp[0].nom}" : ses accès confèrent des permissions que vous ne détenez pas (${manque.manquantes.join(", ")}).`,
        permissions_manquantes: manque.manquantes,
      });
    }

    const { rows } = await client.query(
      `INSERT INTO groupe_utilisateur_membre (id_groupe_utilisateur, id_utilisateur, id_ajoute_par)
       VALUES ($1, $2, $3)
       ON CONFLICT ON CONSTRAINT uq_groupe_utilisateur_membre
       DO UPDATE SET date_suppression = NULL, id_ajoute_par = EXCLUDED.id_ajoute_par
       RETURNING id, id_utilisateur`,
      [id, id_utilisateur, req.user.id]
    );
    await log(client, "CREATE", "groupe_utilisateur_membre", rows[0].id,
      `${u[0].prenom || ""} ${u[0].nom || ""} ajouté au groupe d'utilisateurs "${grp[0].nom}"`, rows[0]);
    // entiteId vise le COMPTE : l'historique administrateur d'un utilisateur
    // se lit d'une seule requete sur entite_id (meme regle que PROFIL_ATTRIBUE).
    // code_retour: 2110
    await auditer(client, req, {
      action: "GROUPE_UTILISATEUR_MEMBRE_AJOUTE", entiteId: id_utilisateur,
      apres: { groupe: grp[0].nom, id_groupe: id, id_appartenance: rows[0].id },
    });
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    erreurServeur(res, err, "POST /groupes-utilisateurs/:id/membres error");
  } finally {
    client.release();
  }
});

router.delete("/groupes-utilisateurs/:id/membres/:membreId", async (req, res) => {
  const { id, membreId } = req.params;
  if (!estUuid(id) || !estUuid(membreId)) return res.status(404).json({ error: "Appartenance introuvable" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    // La ligne en base fait foi sur le compte reellement concerne, le
    // parametre d'URL n'est qu'un repli (meme regle que utilisateurProfils).
    const { rows: a } = await client.query(
      `SELECT gum.id, gum.id_utilisateur, gu.nom AS groupe_nom
         FROM groupe_utilisateur_membre gum
         JOIN groupe_utilisateur gu ON gu.id = gum.id_groupe_utilisateur
        WHERE gum.id = $1 AND gum.id_groupe_utilisateur = $2 AND gum.date_suppression IS NULL
        FOR UPDATE OF gum`,
      [membreId, id]
    );
    if (!a.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Appartenance introuvable" }); }
    const porteur = a[0].id_utilisateur;
    const scope = await scopeAdministration(req.user.id);
    if (!(await isUserInScope(porteur, scope))) {
      await client.query("ROLLBACK");
      // code_retour: 2051
      return res.status(403).json({ error: "Cet utilisateur n'est pas dans votre périmètre." });
    }
    if (await cibleVerrouilleeAdminSam(req.user.id, porteur)) {
      await client.query("ROLLBACK");
      // code_retour: 2081
      return res.status(403).json({ error: MESSAGE_ADMIN_SAM });
    }
    await client.query(
      `UPDATE groupe_utilisateur_membre SET date_suppression = now() WHERE id = $1`, [membreId]
    );
    const { rows: u } = await client.query(`SELECT prenom, nom FROM utilisateur WHERE id = $1`, [porteur]);
    await log(client, "SOFT_DELETE", "groupe_utilisateur_membre", membreId,
      `${u[0]?.prenom || ""} ${u[0]?.nom || ""} retiré du groupe d'utilisateurs "${a[0].groupe_nom}"`, null);
    // code_retour: 2111
    await auditer(client, req, {
      action: "GROUPE_UTILISATEUR_MEMBRE_RETIRE", entiteId: porteur,
      avant: { groupe: a[0].groupe_nom, id_groupe: id, id_appartenance: membreId },
    });
    await client.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    erreurServeur(res, err, "DELETE /groupes-utilisateurs/:id/membres/:membreId error");
  } finally {
    client.release();
  }
});

export default router;
