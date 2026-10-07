// Attributions unitaires de profils ajoutes aux utilisateurs : consultation,
// ajout et retrait dans le perimetre de l'administrateur, chaque ecriture
// laissant une trace probante.
//
// Tout est profil (#276, 06/10/2026) : ces routes servaient les groupes
// personnalises, elles servent desormais les profils AJOUTES (types
// TYPES_PROFIL_AJOUTE : 'ajoute', et 'groupe' tant que la 097 n'est pas
// jouee partout). Elles restent en place pour les consommateurs unitaires
// (simulateur de droits) ; la fiche utilisateur passe par
// PUT /utilisateurs/:id/profils (remplacement de l'ensemble, tous types).
// Une attribution ne porte pas de societe (#57) : id_societe est ecrit NULL,
// la portee suit le rattachement de l'utilisateur ; les lignes historiques
// par societe restent en base, id_societe n'est plus lu.
//
// Garde-fous #278 : perimetre de l'acteur (admin_sam voit tout, sinon ses
// societes de rattachement), verrou des titulaires admin_sam (2081), et « on
// n'attribue que des permissions que l'on detient » (2080) : le profil
// attribue doit etre entierement couvert par les droits de l'acteur, sa
// matrice effective etant evaluee sur les societes couvertes par la CIBLE.

import express from "express";
import { tenantPool } from "../db.js";
import { isUserInScope, scopeWhereClause } from "../utils/scope.js";
import { auditer } from "../utils/audit.js";
import { estUuid } from "../utils/matriceGroupe.js";
import {
  scopeAdministration, cibleVerrouilleeAdminSam, verifierDelegation,
  permissionsDuProfil, societesCouvertes, TYPES_PROFIL_AJOUTE,
} from "../utils/droitsUtilisateur.js";

const router = express.Router();

// code_retour: 2081
const MESSAGE_ADMIN_SAM =
  "Seul un administrateur SAM peut modifier un compte titulaire du profil Admin SAM.";

async function log(client, action, entite_type, entite_id, description, payload) {
  await client.query(
    `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [action, entite_type, entite_id || null, description, payload ? JSON.stringify(payload) : null]
  );
}

router.get("/utilisateurs/:id/profils", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Utilisateur introuvable" });
  try {
    const { rows } = await tenantPool.query(
      `SELECT ups.id, ups.id_utilisateur AS idutilisateur, ups.id_profil AS idprofil
       FROM utilisateur_profil_societe ups
       JOIN profil p ON p.id = ups.id_profil AND p.type = ANY($2::varchar[])
       WHERE ups.id_utilisateur = $1 AND ups.date_suppression IS NULL
       ORDER BY ups.created_at`,
      [id, TYPES_PROFIL_AJOUTE]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/attributions", async (req, res) => {
  try {
    const scope = await scopeAdministration(req.user.id);
    const { clause, params } = scopeWhereClause(scope, 2);
    const { rows } = await tenantPool.query(
      `SELECT ups.id, ups.id_utilisateur AS idutilisateur, ups.id_profil AS idprofil
       FROM utilisateur_profil_societe ups
       JOIN profil p ON p.id = ups.id_profil AND p.type = ANY($1::varchar[])
       JOIN utilisateur u ON u.id = ups.id_utilisateur
       WHERE ups.date_suppression IS NULL
         AND (${clause})
       ORDER BY ups.id_utilisateur, ups.created_at`,
      [TYPES_PROFIL_AJOUTE, ...params]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/utilisateurs/:id/profils", async (req, res) => {
  const { id } = req.params;
  const { id_profil } = req.body;
  if (!estUuid(id)) return res.status(404).json({ error: "Utilisateur introuvable" });
  if (!id_profil) return res.status(400).json({ error: "id_profil requis" });
  if (!estUuid(id_profil)) return res.status(400).json({ error: "Ce profil n'existe pas." });

  // Perimetre (#278) : la cible doit etre dans les societes de l'acteur,
  // un admin_sam n'est pas borne.
  const scope = await scopeAdministration(req.user.id);
  if (!(await isUserInScope(id, scope))) {
    // code_retour: 2051
    return res.status(403).json({ error: "Cet utilisateur n'est pas dans votre périmètre." });
  }
  if (await cibleVerrouilleeAdminSam(req.user.id, id)) {
    // code_retour: 2081
    return res.status(403).json({ error: MESSAGE_ADMIN_SAM });
  }

  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    // Seul un profil ajoute s'attribue ici ; les autres types passent par
    // PUT /utilisateurs/:id/profils (remplacement de l'ensemble).
    const { rows: p } = await client.query(
      `SELECT label, type FROM profil WHERE id = $1 AND date_suppression IS NULL`, [id_profil]
    );
    if (!p.length) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Ce profil n'existe pas." }); }
    if (!TYPES_PROFIL_AJOUTE.includes(p[0].type)) {
      await client.query("ROLLBACK");
      // code_retour: 2077
      return res.status(409).json({
        error: `Le profil "${p[0].label}" s'attribue depuis la section Profils de la fiche utilisateur.`,
      });
    }
    // Garde-fou #278 : attribuer un profil, c'est attribuer ses permissions.
    // La matrice effective du profil est evaluee sur les societes couvertes
    // par la cible, et doit etre entierement detenue par l'acteur.
    const conferees = await permissionsDuProfil(id_profil, await societesCouvertes(id));
    const delegation = await verifierDelegation(req.user.id, [...conferees]);
    if (!delegation.ok) {
      await client.query("ROLLBACK");
      // code_retour: 2080
      return res.status(403).json({
        error: `Vous ne pouvez pas attribuer le profil "${p[0].label}" : il confère des permissions que vous ne détenez pas (${delegation.manquantes.join(", ")}).`,
        permissions_manquantes: delegation.manquantes,
      });
    }
    // DO UPDATE (et non un INSERT nu) : une attribution precedemment retiree
    // (soft-delete), par exemple decochee puis recochee dans l'UI, doit
    // pouvoir etre reactivee sans violation de contrainte unique brute
    // (bug constate : uq_utilisateur_profil_societe). id_societe est NULL
    // depuis le #57 : la portee d'un profil suit le rattachement.
    const { rows } = await client.query(
      `INSERT INTO utilisateur_profil_societe (id_utilisateur, id_profil, id_societe)
       VALUES ($1, $2, NULL)
       ON CONFLICT ON CONSTRAINT uq_utilisateur_profil_societe
       DO UPDATE SET date_suppression = NULL
       RETURNING id, id_utilisateur AS idutilisateur, id_profil AS idprofil`,
      [id, id_profil]
    );
    const { rows: u } = await client.query(`SELECT prenom, nom FROM utilisateur WHERE id = $1`, [id]);
    await log(client, "CREATE", "utilisateur_profil_societe", rows[0].id, `Profil "${p[0].label}" attribué à ${u[0]?.prenom || ''} ${u[0]?.nom || ''}`, rows[0]);
    // entiteId vise le COMPTE et non la ligne d'attribution : l'audit d'un
    // utilisateur doit se lire d'une seule requete sur entite_id, sans avoir a
    // remonter les identifiants techniques des tables de liaison.
    // code_retour: 2088
    await auditer(client, req, {
      action: "PROFIL_ATTRIBUE",
      entiteId: id,
      apres: { id_profil, profil: p[0].label, id_attribution: rows[0].id },
    });
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /utilisateurs/:id/profils error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/utilisateurs/:id/profils/:attribId", async (req, res) => {
  const { id, attribId } = req.params;
  // Garde-fou UUID (#282) : un identifiant malforme partait en Postgres et
  // ressortait en 22P02 rendue en 500, la ou l'attribution est simplement
  // introuvable.
  if (!estUuid(id) || !estUuid(attribId)) {
    return res.status(404).json({ error: "Attribution introuvable" });
  }
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: a } = await client.query(
      `SELECT id_utilisateur, id_profil FROM utilisateur_profil_societe
        WHERE id = $1 AND date_suppression IS NULL
        FOR UPDATE`,
      [attribId]
    );
    if (!a.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Attribution introuvable" }); }
    // L'utilisateur porteur de l'attribution fait foi, le parametre d'URL
    // n'est qu'un repli : c'est la ligne en base qui dit de quel compte le
    // profil est reellement retire, perimetre et verrou compris.
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
      `UPDATE utilisateur_profil_societe SET date_suppression = now() WHERE id = $1`,
      [attribId]
    );
    const { rows: u } = await client.query(`SELECT prenom, nom FROM utilisateur WHERE id = $1`, [porteur]);
    const { rows: p } = await client.query(`SELECT label FROM profil WHERE id = $1`, [a[0].id_profil]);
    await log(client, "SOFT_DELETE", "utilisateur_profil_societe", attribId, `Profil "${p[0]?.label || a[0].id_profil}" retiré de ${u[0]?.prenom || ''} ${u[0]?.nom || ''}`, null);
    // code_retour: 2089
    await auditer(client, req, {
      action: "PROFIL_RETIRE",
      entiteId: porteur,
      avant: { id_profil: a[0].id_profil, profil: p[0]?.label || null, id_attribution: attribId },
    });
    await client.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /utilisateurs/:id/profils/:attribId error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
