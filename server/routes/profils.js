// Profils de droits : tout est profil (#276, decision client du 06/10/2026).
//
// Trois familles depuis la migration 097 :
//   - profil_defaut : les personas seedes (IT Ops, Financier, Manager DSI,
//     IT Data input), inalterables (ni suppression ni renommage), matrices
//     configurables (par defaut et par societe) ;
//   - systeme : admin_sam, fige (matrice comprise) ;
//   - ajoute : profils crees par l'administrateur (CRUD complet, corbeille
//     90 jours #64, matrices configurables exactement comme un profil par
//     defaut, dashboard de reference optionnel a la creation).
// Le type historique 'groupe' est bascule en 'ajoute' par la 097 ; tant
// qu'elle n'est pas jouee partout, le code traite 'groupe' comme un profil
// ajoute (TYPES_AJOUTES) : robuste a l'ordre deploiement/migration.
//
// La suppression d'un profil ajoute est douce (008) ; la corbeille (#64) la
// rend visible : liste des profils supprimes depuis moins de 90 jours,
// restauration, purge au-dela (fonction 075 remplacee par la 097). La
// restauration reactive exactement le lot retire par la mise en corbeille
// (egalite d'horodatage transactionnel).
//
// Delegation (#278) : les ecritures de matrices appliquent le garde-fou « on
// n'attribue que des permissions que l'on detient » (verifierDelegation,
// l'acteur admin_sam est exempte) et tracent explicitement les delegations
// (gerer_utilisateurs, gerer_profils) accordees ou retirees.

import express from "express";
import { tenantPool } from "../db.js";
import { estUuid } from "../utils/matriceGroupe.js";
import { auditer, diff } from "../utils/audit.js";
import { validerPermissionIds, matriceSocieteCourante, configurerMatriceSociete } from "../utils/matriceProfil.js";
import { verifierDelegation, PERMISSIONS_DELEGATION, deltaMatrice, TYPES_PROFIL_AJOUTE } from "../utils/droitsUtilisateur.js";

const router = express.Router();

// Projection unique, servie a l'identique en liste, detail et relectures.
const SELECT_PROFIL = `id, code, label, description, type`;

// Types traites comme « profil ajoute » : source unique droitsRegles.js.
const TYPES_AJOUTES = TYPES_PROFIL_AJOUTE;

// Dashboard de reference d'un profil ajoute (#276, choix optionnel a la
// creation, a faire valider par Samuel) : porte par la permission
// acceder_dashboard_* posee dans la matrice par defaut initiale. Aucune
// colonne dediee : la permission est deja le vecteur du selecteur (#73/#190)
// et reste visible et modifiable ensuite dans la matrice.
const DASHBOARDS_REFERENCE = {
  manager_dsi: "acceder_dashboard_manager_dsi",
  financier: "acceder_dashboard_financier",
  it_ops: "acceder_dashboard_it_ops",
};

function natureProfil(type) {
  return type === "systeme" ? "système" : "par défaut";
}

// Refus du garde-fou de delegation (#278), 403 avec le detail des permissions
// manquantes : le message doit permettre a l'administrateur de comprendre ce
// qui lui manque sans lire les logs.
// code_retour: 2080
function refuserDelegation(res, manquantes) {
  return res.status(403).json({
    error: `Vous ne pouvez pas attribuer des permissions que vous ne détenez pas : ${manquantes.join(", ")}.`,
    permissions_manquantes: manquantes,
  });
}

async function log(client, action, entite_type, entite_id, description, payload) {
  await client.query(
    `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [action, entite_type, entite_id || null, description, payload ? JSON.stringify(payload) : null]
  );
}

// Code technique derive du libelle quand l'ecran n'en fournit pas : meme
// regle que le front (slugify), bornee a 50 caracteres comme la colonne.
function codeDepuisLabel(label) {
  return String(label)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
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

// Corbeille (#64, reprise par le tout-profil #276) : profils ajoutes
// supprimes depuis moins de 90 jours, avec les jours restants avant purge.
// Declaree avant /profils/:id, sinon "corbeille" serait lu comme un id. Les
// profils par defaut et systeme n'y passent jamais, leur suppression est
// refusee plus bas.
router.get("/profils/corbeille", async (req, res) => {
  try {
    // Purge au fil de l'eau, meme motif que purgeExceptionsExpirees() : aucun
    // ordonnanceur ne couvre ce module, la lecture de la corbeille fait le
    // menage (fonction bornee, migration 097).
    await tenantPool.query(`SELECT * FROM purger_corbeille_profils()`);
    const { rows } = await tenantPool.query(
      `SELECT ${SELECT_PROFIL}, date_suppression,
              GREATEST(0, 90 - EXTRACT(DAY FROM now() - date_suppression))::int AS jours_restants
         FROM profil
        WHERE type = ANY($1::varchar[]) AND date_suppression IS NOT NULL
          AND date_suppression > now() - INTERVAL '90 days'
        ORDER BY date_suppression DESC`,
      [TYPES_AJOUTES]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /profils/corbeille error", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/profils", async (req, res) => {
  const { code, label, description, dashboard_reference } = req.body || {};
  if (!label || !String(label).trim()) {
    return res.status(400).json({ error: "Le libellé est requis." });
  }
  // Le code technique vient de l'ecran (slug du libelle) ou est derive ici.
  const codeFinal = (code && String(code).trim()) || codeDepuisLabel(label);
  if (!codeFinal) return res.status(400).json({ error: "Le libellé ne permet pas de dériver un code." });
  const reference = dashboard_reference || null;
  if (reference && !DASHBOARDS_REFERENCE[reference]) {
    return res.status(400).json({
      error: "Le dashboard de référence doit être manager_dsi, financier ou it_ops.",
    });
  }
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    // Garde-fou #278 : choisir un dashboard de reference attribue la
    // permission correspondante au profil, l'acteur doit donc la detenir.
    if (reference) {
      const delegation = await verifierDelegation(req.user.id, [DASHBOARDS_REFERENCE[reference]]);
      if (!delegation.ok) {
        await client.query("ROLLBACK");
        return refuserDelegation(res, delegation.manquantes);
      }
    }
    // Le type n'est pas pris du corps : une creation par l'API est toujours
    // un profil ajoute, les profils par defaut viennent des seuls seeds.
    const { rows } = await client.query(
      `INSERT INTO profil (code, label, description, type) VALUES ($1, $2, $3, 'ajoute')
       RETURNING ${SELECT_PROFIL}`,
      [codeFinal, String(label).trim(), description || null]
    );
    if (reference) {
      const { rows: perm } = await client.query(
        `SELECT id FROM permission WHERE code = $1`, [DASHBOARDS_REFERENCE[reference]]
      );
      if (!perm.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "La permission du dashboard de référence est introuvable au catalogue." });
      }
      await client.query(
        `INSERT INTO profil_permission (id_profil, id_permission) VALUES ($1, $2)
         ON CONFLICT (id_profil, id_permission) DO UPDATE SET date_suppression = NULL`,
        [rows[0].id, perm[0].id]
      );
    }
    await log(client, "CREATE", "profil", rows[0].id, `Profil ajouté "${rows[0].label}" créé`, rows[0]);
    // code_retour: 2084
    await auditer(client, req, {
      action: "PROFIL_AJOUTE_CREE", entiteType: "profil", entiteId: rows[0].id,
      apres: {
        code: rows[0].code, label: rows[0].label, description: rows[0].description,
        dashboard_reference: reference,
      },
    });
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /profils error", err);
    // 23505 : unicite du code de profil. 23514 : la contrainte ck_profil_type
    // n'admet pas encore 'ajoute', la migration 097 n'est pas jouee sur cette
    // base ; le message le dit pour que l'exploitation voie la cause.
    if (err.code === "23505") {
      return res.status(409).json({ error: "Un profil porte déjà ce code : choisissez un autre libellé." });
    }
    if (err.code === "23514") {
      return res.status(500).json({ error: "Création impossible : la base n'accepte pas encore les profils ajoutés (migration 097 à jouer)." });
    }
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
    // Etat anterieur, pour que la trace dise ce qui a change.
    const { rows: avant } = await client.query(
      `SELECT label, description, type FROM profil WHERE id = $1 AND date_suppression IS NULL FOR UPDATE`, [id]
    );
    if (!avant.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Profil introuvable" }); }
    // Decision du 06/10/2026 (#276) : les profils par defaut et le profil
    // systeme sont inalterables, ni suppression ni renommage.
    if (!TYPES_AJOUTES.includes(avant[0].type)) {
      await client.query("ROLLBACK");
      // code_retour: 2079
      return res.status(409).json({
        error: `Modification impossible : "${avant[0].label}" est un profil ${natureProfil(avant[0].type)} de la plateforme, il ne se renomme pas.`,
      });
    }
    const { rows } = await client.query(
      `UPDATE profil SET label = COALESCE($2, label), description = COALESCE($3, description)
       WHERE id = $1 AND date_suppression IS NULL
       RETURNING ${SELECT_PROFIL}`,
      [id, label, description]
    );
    await log(client, "UPDATE", "profil", id, `Profil "${rows[0].label}" modifié`, req.body);
    // code_retour: 2085
    const d = diff(
      { label: avant[0].label, description: avant[0].description },
      { label: rows[0].label, description: rows[0].description }
    );
    await auditer(client, req, {
      action: "PROFIL_MODIFIE", entiteType: "profil", entiteId: id,
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

// Restauration depuis la corbeille (#64). Seules les lignes retirees PAR la
// mise en corbeille sont reactivees : la suppression pose le meme now()
// transactionnel sur le profil et ses lignes liees, l'egalite des horodatages
// identifie exactement ce lot. Une permission decochee avant la suppression
// reste donc decochee apres restauration.
router.post("/profils/:id/restaurer", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Ce profil n'est pas dans la corbeille." });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: prof } = await client.query(
      `SELECT label, date_suppression FROM profil
        WHERE id = $1 AND type = ANY($2::varchar[]) AND date_suppression IS NOT NULL
          AND date_suppression > now() - INTERVAL '90 days'
        FOR UPDATE`,
      [id, TYPES_AJOUTES]
    );
    if (!prof.length) {
      await client.query("ROLLBACK");
      // code_retour: 2069
      return res.status(404).json({ error: "Ce profil n'est pas dans la corbeille." });
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
    await log(client, "RESTORE", "profil", id, `Profil "${prof[0].label}" restauré depuis la corbeille`, null);
    // code_retour: 2087
    await auditer(client, req, {
      action: "PROFIL_RESTAURE", entiteType: "profil", entiteId: id,
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
    // #282 : le filtre u.date_suppression levait un 42703 rendu en 500 (la
    // colonne a ete supprimee par la migration 023, le retrait d'un compte
    // est une desactivation). L'impact liste tout porteur d'une attribution
    // active, compte desactive compris : ses droits reviendraient avec sa
    // reactivation, l'administrateur doit le voir avant de supprimer.
    const { rows: users } = await tenantPool.query(
      `SELECT DISTINCT u.id, u.prenom, u.nom, u.email
       FROM utilisateur_profil_societe ups
       JOIN utilisateur u ON u.id = ups.id_utilisateur
       WHERE ups.id_profil = $1 AND ups.date_suppression IS NULL`,
      [id]
    );
    // #57 : plus de volet societes, la diffusion n'existe plus. La cle reste
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
    // Un profil par defaut ou systeme ne se supprime jamais : la matrice
    // reste editable mais le socle seede de la plateforme doit survivre
    // (074, decision du 06/10/2026).
    if (!TYPES_AJOUTES.includes(prof[0].type)) {
      await client.query("ROLLBACK");
      // code_retour: 2068
      return res.status(409).json({
        error: `Suppression impossible : "${prof[0].label}" est un profil ${natureProfil(prof[0].type)} de la plateforme.`,
      });
    }
    // Seules les lignes ACTIVES sont horodatees : sans la borne, une ligne
    // deja retiree (permission decochee, attribution retiree avant la mise en
    // corbeille) prenait le nouvel horodatage et la restauration la
    // reactivait a tort (#282, parcours corbeille).
    await client.query(
      `UPDATE profil_permission SET date_suppression = now()
        WHERE id_profil = $1 AND date_suppression IS NULL`, [id]
    );
    await client.query(
      `UPDATE utilisateur_profil_societe SET date_suppression = now()
        WHERE id_profil = $1 AND date_suppression IS NULL`, [id]
    );
    await client.query(`UPDATE profil SET date_suppression = now() WHERE id = $1`, [id]);
    await log(client, "SOFT_DELETE", "profil", id, `Profil "${prof[0].label}" placé dans la corbeille`, null);
    // code_retour: 2086
    await auditer(client, req, {
      action: "PROFIL_MIS_EN_CORBEILLE", entiteType: "profil", entiteId: id,
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
// Matrices (#249, etendues aux profils ajoutes par le #276), permission
// gerer_profils (Q5).
// ---------------------------------------------------------------------------

// Remplacement complet de la matrice par defaut du tenant (Q2), pour les
// profils par defaut ET les profils ajoutes (ils se configurent exactement
// pareil, decision du 06/10/2026) ; la matrice du profil systeme admin_sam
// est figee. Le remplacement passe par le soft-delete propre a
// profil_permission : les lignes retirees gardent leur trace, les lignes
// recochees se reactivent (contrainte uq respectee).
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
    if (prof[0].type === "systeme") {
      await client.query("ROLLBACK");
      // code_retour: 2074
      return res.status(409).json({ error: `La matrice du profil système "${prof[0].label}" est figée.` });
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
    // Garde-fou #278 : seuls les AJOUTS par rapport a la matrice en place
    // exigent la detention ; decocher reste libre.
    const delta = deltaMatrice(avant.map((r) => r.code), matrice.codes);
    const delegation = await verifierDelegation(req.user.id, delta.ajoutes);
    if (!delegation.ok) {
      await client.query("ROLLBACK");
      return refuserDelegation(res, delegation.manquantes);
    }
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
    // Delegation en cascade (#278) : l'arrivee ou le depart de
    // gerer_utilisateurs / gerer_profils est trace en clair, en plus du
    // remplacement de matrice, pour que l'historique administrateur dise qui
    // a delegue quoi a qui.
    const delegAccordees = delta.ajoutes.filter((c) => PERMISSIONS_DELEGATION.includes(c));
    const delegRetirees = delta.retires.filter((c) => PERMISSIONS_DELEGATION.includes(c));
    if (delegAccordees.length) {
      await log(client, "UPDATE", "profil", id,
        `Délégation accordée au profil "${prof[0].label}" : ${delegAccordees.join(", ")}`, null);
      // code_retour: 2082
      await auditer(client, req, {
        action: "PROFIL_DELEGATION_ACCORDEE", entiteType: "profil", entiteId: id,
        apres: { profil: prof[0].label, permissions: delegAccordees },
      });
    }
    if (delegRetirees.length) {
      await log(client, "UPDATE", "profil", id,
        `Délégation retirée du profil "${prof[0].label}" : ${delegRetirees.join(", ")}`, null);
      // code_retour: 2083
      await auditer(client, req, {
        action: "PROFIL_DELEGATION_RETIREE", entiteType: "profil", entiteId: id,
        avant: { profil: prof[0].label, permissions: delegRetirees },
      });
    }
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

// Parametrage en masse : applique la matrice par defaut COURANTE du profil a
// plusieurs societes d'un coup, chacune devenant configuree (Q3). Une societe
// deja configuree est remplacee : c'est le sens d'« appliquer ». Transaction
// unique, une trace probante par societe (meme action que la configuration
// unitaire, marquee en_masse). Ouverte aux profils ajoutes (#276).
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
    if (prof[0].type === "systeme") {
      await client.query("ROLLBACK");
      // code_retour: 2074
      return res.status(409).json({ error: `La matrice du profil système "${prof[0].label}" est figée.` });
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
    // Garde-fou #278, lecture stricte : appliquer une matrice a des societes
    // attribue toutes ses permissions sur ce perimetre, l'acteur doit donc
    // detenir la matrice entiere (reserve notee au journal du chantier).
    const delegation = await verifierDelegation(req.user.id, codes);
    if (!delegation.ok) {
      await client.query("ROLLBACK");
      return refuserDelegation(res, delegation.manquantes);
    }
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

// Societes configurees d'un profil, pour l'onglet Profils de l'administration
// (liste et liens vers la fiche societe).
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
