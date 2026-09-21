// Comptes utilisateurs : création, modification, rattachements aux sociétés,
// historique probant et gestion du mot de passe (définition, génération,
// lien de réinitialisation).

import express from "express";
import bcrypt from "bcryptjs";
import { tenantPool } from "../db.js";
import { getAdminScope, isUserInScope, scopeWhereClause } from "../utils/scope.js";
import { auditer, diff } from "../utils/audit.js";
import { traduireEvenement } from "../utils/historiqueLibelles.js";
import { verifierPolitique, genererMotDePasse } from "../utils/motDePasse.js";
import { verifierOrigine, origineAppel } from "../utils/origine.js";
import { genererJeton, hacherJeton, DUREE_VALIDITE_HEURES } from "../utils/reinitialisation.js";
import { envoyerMail } from "../utils/mail.js";

const router = express.Router();

async function log(client, action, entite_type, entite_id, description, payload) {
  try {
    await client.query(
      `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [action, entite_type, entite_id || null, description, payload ? JSON.stringify(payload) : null]
    );
  } catch (e) {
    console.error("[journal] log failed:", e.message);
  }
}

// Tous les comptes sont servis, désactivés compris : la suppression n'existe
// plus, un compte retiré doit rester visible pour être réactivable.
// Dates castées en text, comme POST et PATCH : sans le cast pg sérialise une
// colonne DATE en horodatage UTC (2026-09-30T00:00:00.000Z), que les filtres
// par dates de la liste (#211) et le champ date du formulaire ne lisent pas
// comme un jour AAAA-MM-JJ.
router.get("/utilisateurs", async (req, res) => {
  try {
    const scope = await getAdminScope(req.user.id);
    const { clause, params } = scopeWhereClause(scope, 1);
    const { rows } = await tenantPool.query(
      `SELECT u.id, u.nom, u.prenom, u.email, u.actif,
              u.date_finale::text AS date_finale,
              u.date_mise_en_fonction::text AS date_mise_en_fonction
       FROM utilisateur u
       WHERE (${clause})
       ORDER BY u.nom, u.prenom`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /utilisateurs error", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/utilisateurs", async (req, res) => {
  // Contrat d'Antonin (cf. sandbox handleCreateUser) : le champ s'appelle
  // mot_de_passe_hash. Ce serveur de développement local le hache tout de
  // même via bcrypt par hygiène ; rien ne garantit que l'API réelle d'Antonin
  // fasse de même (sa sandbox de référence y écrit une valeur en clair).
  const { nom, prenom, email, mot_de_passe_hash, actif, langue, date_finale, date_mise_en_fonction } = req.body;
  if (!nom || !prenom || !email) return res.status(400).json({ error: "nom, prenom et email requis" });
  if (!mot_de_passe_hash || mot_de_passe_hash.length < 4) {
    return res.status(400).json({ error: "Un mot de passe initial d'au moins 4 caractères est requis." });
  }

  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const motDePasseHash = await bcrypt.hash(mot_de_passe_hash, 10);
    const fields = ["nom", "prenom", "email", "mot_de_passe_hash", "actif", "langue"];
    const values = [nom, prenom, email, motDePasseHash, actif ?? true, langue || "fr"];
    const placeholders = ["$1", "$2", "$3", "$4", "$5", "$6"];

    if (date_finale !== undefined && date_finale !== null && date_finale !== "") {
      fields.push("date_finale");
      values.push(date_finale);
      placeholders.push(`$${values.length}`);
    }

    // Rien n'est posé si l'administrateur ne demande rien : la colonne reste à
    // NULL. Elle valait CURRENT_DATE par défaut, ce qui remplissait la colonne
    // Mise en fonction de tous les comptes avec leur date de création, sans
    // qu'aucune mise en fonction ait été programmée. Une date d'échéance ne
    // doit exister que si quelqu'un l'a voulue.
    if (date_mise_en_fonction !== undefined && date_mise_en_fonction !== null && date_mise_en_fonction !== "") {
      fields.push("date_mise_en_fonction");
      values.push(date_mise_en_fonction);
      placeholders.push(`$${values.length}`);
    }

    const sql = `INSERT INTO utilisateur (${fields.join(", ")}) VALUES (${placeholders.join(", ")})
                 RETURNING id, nom, prenom, email, actif, langue,
                           date_finale::text AS date_finale,
                           date_mise_en_fonction::text AS date_mise_en_fonction`;
                          
    const { rows } = await client.query(sql, values);
    await log(client, "CREATE", "utilisateur", rows[0].id, `Utilisateur "${prenom} ${nom}" créé`, { email, date_finale, date_mise_en_fonction });
    // code_retour: 2000
    await auditer(client, req, {
      action: "UTILISATEUR_CREE",
      entiteId: rows[0].id,
      apres: { nom, prenom, email, actif: actif ?? true, langue: langue || "fr",
               date_finale: date_finale ?? null, date_mise_en_fonction: date_mise_en_fonction ?? null },
    });
    // Le mot de passe initial est un événement distinct : c'est lui qui ouvre
    // l'accès, et il doit se lire seul dans l'historique. Aucune valeur,
    // aucun hash, l'action porte toute l'information.
    // code_retour: 2010
    await auditer(client, req, {
      action: "MOT_DE_PASSE_DEFINI_PAR_ADMIN",
      entiteId: rows[0].id,
    });
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /utilisateurs error", err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Cet email est déjà utilisé." });
    }
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// POST /api/utilisateurs/desactivation
// Désactivation immédiate d'une sélection de comptes (#212). Même effet que
// la désactivation unitaire immédiate (PATCH actif = false et date du jour),
// une trace UTILISATEUR_DESACTIVE par compte, le tout dans une transaction :
// soit toute la sélection est traitée, soit rien. Les comptes déjà
// désactivés (actif = false) sont ignorés et comptés dans la réponse. Aucune
// suppression, aucun retrait de droit : les groupes et rattachements restent.
// Corps : { ids: [uuid, ...] }. Déclarée avant les routes /utilisateurs/:id.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.post("/utilisateurs/desactivation", async (req, res) => {
  const brut = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const ids = [...new Set(brut.map((v) => String(v).toLowerCase()))];
  // code_retour: 2054
  if (!ids.length || ids.some((id) => !UUID.test(id))) {
    return res.status(400).json({ error: "La sélection est vide ou invalide." });
  }
  // Refus avant toute écriture : un administrateur ne se désactive pas
  // lui-même par une action groupée, il perdrait la main sans l'avoir voulu.
  // La désactivation unitaire reste possible pour ce cas, en connaissance de
  // cause.
  // code_retour: 2055
  if (ids.includes(String(req.user.id).toLowerCase())) {
    return res.status(409).json({ error: "La sélection contient votre propre compte : retirez-le avant de désactiver." });
  }
  // Même contrôle de périmètre que la désactivation unitaire, compte par
  // compte, et refus de toute la sélection au premier compte hors périmètre :
  // rien n'est écrit.
  const scope = await getAdminScope(req.user.id);
  for (const id of ids) {
    if (!(await isUserInScope(id, scope))) {
      // code_retour: 2051
      return res.status(403).json({ error: "Un compte de la sélection n'est pas dans votre périmètre." });
    }
  }

  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    // FOR UPDATE : deux administrateurs traitant la même sélection ne
    // produisent pas deux traces pour un même compte, le second lit l'état
    // désactivé et l'ignore.
    const { rows: comptes } = await client.query(
      `SELECT id, prenom, nom, actif, date_finale::text AS date_finale
         FROM utilisateur WHERE id = ANY($1::uuid[])
        FOR UPDATE`, [ids]);
    // code_retour: 2050
    if (comptes.length !== ids.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Un compte de la sélection est introuvable." });
    }

    const ignores = comptes.filter((c) => !c.actif);
    const desactives = [];
    for (const c of comptes.filter((c) => c.actif)) {
      // date_finale : la date du jour, comme la désactivation unitaire
      // immédiate, sauf échéance déjà passée : elle est conservée, elle dit
      // depuis quand le compte n'a plus accès.
      const { rows: [apres] } = await client.query(
        `UPDATE utilisateur
            SET actif = false,
                date_finale = LEAST(COALESCE(date_finale, CURRENT_DATE), CURRENT_DATE)
          WHERE id = $1
          RETURNING actif, date_finale::text AS date_finale`, [c.id]);
      await log(client, "UPDATE", "utilisateur", c.id,
        `Utilisateur "${c.prenom} ${c.nom}" désactivé (action sur la sélection)`,
        { actif: false, date_finale: apres.date_finale });
      // Même événement, même forme que PATCH /utilisateurs/:id : l'historique
      // du compte ne distingue pas une désactivation groupée d'une unitaire,
      // l'acteur et l'adresse IP sont portés par la trace.
      // code_retour: 2003
      await auditer(client, req, {
        action: "UTILISATEUR_DESACTIVE",
        entiteId: c.id,
        avant: { actif: true, date_finale: c.date_finale },
        apres: { actif: false, date_finale: apres.date_finale },
      });
      desactives.push(c.id);
    }
    await client.query("COMMIT");
    // code_retour: 2053
    res.json({
      desactives: desactives.length,
      ignores: ignores.length,
      ids_desactives: desactives,
      ids_ignores: ignores.map((c) => c.id),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /utilisateurs/desactivation error", err);
    // code_retour: 2099
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/utilisateurs/:id", async (req, res) => {
  const { id } = req.params;
  const { nom, prenom, email, actif, langue, date_finale, date_mise_en_fonction } = req.body;
  const scope = await getAdminScope(req.user.id);
  if (!(await isUserInScope(id, scope))) {
    return res.status(403).json({ error: "Cet utilisateur n'est pas dans votre périmètre." });
  }
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const setFields = [];
    const values = [id];
    let idx = 2;

    if (nom !== undefined) { setFields.push(`nom = $${idx++}`); values.push(nom); }
    if (prenom !== undefined) { setFields.push(`prenom = $${idx++}`); values.push(prenom); }
    if (email !== undefined) { setFields.push(`email = $${idx++}`); values.push(email); }
    if (actif !== undefined) { setFields.push(`actif = $${idx++}`); values.push(actif); }
    if (langue !== undefined) { setFields.push(`langue = $${idx++}`); values.push(langue); }
    if (date_finale !== undefined) { setFields.push(`date_finale = $${idx++}`); values.push(date_finale); }
    if (date_mise_en_fonction !== undefined) { setFields.push(`date_mise_en_fonction = $${idx++}`); values.push(date_mise_en_fonction); }

    if (setFields.length === 0) return res.status(400).json({ error: "Aucun champ à modifier" });

    // État antérieur, indispensable au diff. mot_de_passe_hash n'est pas
    // sélectionné : il n'a rien à faire dans une trace, et cette route ne le
    // modifie pas.
    const { rows: avantRows } = await client.query(
      `SELECT nom, prenom, email, actif, langue,
              date_finale::text AS date_finale,
              date_mise_en_fonction::text AS date_mise_en_fonction
         FROM utilisateur WHERE id = $1`, [id]);
    const avant = avantRows[0] || {};

    const { rows } = await client.query(
      // Cast en text obligatoire : sans lui pg renvoie un objet Date, et la
      // comparaison avec l'état antérieur, déjà lu en text, ne peut jamais
      // être vraie. Le diff signalait donc des champs inchangés, et la date
      // écrite dans la trace ressortait sous la forme "Fri Aug 14".
      `UPDATE utilisateur SET ${setFields.join(", ")} WHERE id = $1
       RETURNING id, nom, prenom, email, actif, langue,
                 date_finale::text AS date_finale,
                 date_mise_en_fonction::text AS date_mise_en_fonction`,
      values
    );
    if (!rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Utilisateur introuvable" }); }
    
    const apres = {
      nom: rows[0].nom, prenom: rows[0].prenom, email: rows[0].email,
      actif: rows[0].actif, langue: rows[0].langue,
      // Déjà en text depuis le RETURNING, aucune conversion à faire.
      date_finale: rows[0].date_finale,
      date_mise_en_fonction: rows[0].date_mise_en_fonction,
    };
    const d = diff(avant, apres);

    // Les champs couverts par un événement dédié sortent du diff : sans cela
    // un même changement produirait deux lignes d'historique, l'événement
    // explicite et une modification générique redondante.
    const retirerDuDiff = (champ) => {
      if (d.avant) delete d.avant[champ];
      if (d.apres) {
        delete d.apres[champ];
        if (!Object.keys(d.apres).length) d.apres = null;
      }
    };

    // Un changement d'état n'est pas une modification comme une autre : il se
    // lit seul dans la trace, sans avoir à comparer deux JSONB. Les trois cas
    // sont exclusifs et priment sur UTILISATEUR_MODIFIE.
    if (avant.actif !== apres.actif) {
      // code_retour: 2002
      // code_retour: 2003
      await auditer(client, req, {
        action: apres.actif ? "UTILISATEUR_ACTIVE" : "UTILISATEUR_DESACTIVE",
        entiteId: id,
        avant: { actif: avant.actif, date_finale: avant.date_finale },
        apres: { actif: apres.actif, date_finale: apres.date_finale },
      });
      retirerDuDiff("actif");
      retirerDuDiff("date_finale");
    } else if (avant.date_finale !== apres.date_finale) {
      // Pose ou levée d'une échéance : c'est une décision d'administrateur,
      // tracée au moment où elle est prise. Rien ne sera écrit à l'échéance
      // elle-même, aucun ordonnanceur n'existe (STOP planification).
      // code_retour: 2004
      // code_retour: 2005
      await auditer(client, req, {
        action: apres.date_finale ? "DESACTIVATION_PLANIFIEE" : "PLANIFICATION_LEVEE",
        entiteId: id,
        avant: { date_finale: avant.date_finale },
        apres: { date_finale: apres.date_finale },
      });
      retirerDuDiff("date_finale");
    } else if (avant.date_mise_en_fonction !== apres.date_mise_en_fonction) {
      // code_retour: 2006
      await auditer(client, req, {
        action: "MISE_EN_FONCTION_PLANIFIEE",
        entiteId: id,
        avant: { date_mise_en_fonction: avant.date_mise_en_fonction },
        apres: { date_mise_en_fonction: apres.date_mise_en_fonction },
      });
      retirerDuDiff("date_mise_en_fonction");
    }

    // Journalise le diff filtré et non req.body : le corps de la requête
    // pourrait porter un champ sensible le jour où cette route en acceptera un.
    await log(client, "UPDATE", "utilisateur", id, `Utilisateur "${rows[0].prenom} ${rows[0].nom}" modifié`, d.apres);

    // Les autres champs modifiés dans la même requête, s'il y en a.
    if (d.apres) {
      // code_retour: 2001
      await auditer(client, req, {
        action: "UTILISATEUR_MODIFIE", entiteId: id, avant: d.avant, apres: d.apres,
      });
    }
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /utilisateurs/:id error", err);
    // 23505 : violation de l'unicité de utilisateur.email. Ce message ne doit
    // sortir que dans ce cas précis. Le renvoyer pour toute erreur faisait
    // mentir l'interface et masquait la cause réelle des pannes de cette route.
    // code_retour: 2007
    if (err.code === "23505") {
      return res.status(409).json({ error: "Cet email est déjà utilisé." });
    }
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// La suppression d'un utilisateur n'existe plus, migration 022 : le retrait
// d'un compte se fait par désactivation, PATCH /utilisateurs/:id { actif:
// false }. Un compte désactivé reste visible à l'écran et réactivable, là où
// un compte supprimé disparaissait de la liste et n'était plus récupérable que
// par une intervention en base.

router.post("/utilisateurs/:id/societes", async (req, res) => {
  const { id } = req.params;
  const { id_societe } = req.body;
  try {
    // DO UPDATE (et non DO NOTHING) : un rattachement précédemment retiré
    // (soft-delete) doit pouvoir être réactivé, y compris l'échelle tenant
    // (id_societe NULL) après un passage à des sociétés spécifiques.
    const { rows } = await tenantPool.query(
      `INSERT INTO utilisateur_societe (id_utilisateur, id_societe) VALUES ($1, $2)
       ON CONFLICT ON CONSTRAINT uq_utilisateur_societe
       DO UPDATE SET date_suppression = NULL
       RETURNING *`,
      [id, id_societe || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/utilisateurs/:id/historique
// Lecture seule de la trace probante d'un compte. N'écrit rien, ne modifie
// rien : consulter un historique ne doit pas en produire une ligne.
router.get("/utilisateurs/:id/historique", async (req, res) => {
  const { id } = req.params;

  // Garde-fou : un :id non UUID partirait en Postgres et ressortirait en 22P02
  // brute remontée en 500, là où le compte est simplement introuvable.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    // code_retour: 2050
    return res.status(404).json({ error: "Utilisateur introuvable" });
  }

  // Même contrôle de périmètre que les autres routes d'administration : un
  // administrateur restreint ne lit pas l'historique d'un compte hors de ses
  // sociétés. La permission gerer_utilisateurs est déjà exigée en amont par le
  // middleware, ceci en est le complément par société.
  const scope = await getAdminScope(req.user.id);
  if (!(await isUserInScope(id, scope))) {
    // code_retour: 2051
    return res.status(403).json({ error: "Cet utilisateur n'est pas dans votre périmètre." });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const parPage = 20;

  try {
    const { rows: cible } = await tenantPool.query(
      `SELECT id, prenom, nom FROM utilisateur WHERE id = $1`, [id]);
    // code_retour: 2050
    if (!cible.length) return res.status(404).json({ error: "Utilisateur introuvable" });

    const { rows } = await tenantPool.query(
      `WITH evenements AS (
         SELECT a.id, a.action, a.valeur_avant, a.valeur_apres,
                a.ip_address, a.created_at, a.id_utilisateur AS id_acteur
           FROM audit_log a
          WHERE a.entite_type = 'utilisateur' AND a.entite_id = $1
         UNION ALL
         -- La creation est reconstituee depuis utilisateur.created_at : elle
         -- survit a l'archivage glissant de six mois d'audit_log, et elle
         -- existe pour les comptes anterieurs a l'instrumentation. Le NOT
         -- EXISTS evite le doublon depuis que POST /utilisateurs trace la
         -- creation : la vraie entree, qui porte son acteur, prime.
         SELECT NULL::uuid, 'UTILISATEUR_CREE', NULL::jsonb, NULL::jsonb,
                NULL::varchar, u.created_at, NULL::uuid
           FROM utilisateur u
          WHERE u.id = $1
            AND NOT EXISTS (
              SELECT 1 FROM audit_log a2
               WHERE a2.entite_type = 'utilisateur' AND a2.entite_id = u.id
                 AND a2.action = 'UTILISATEUR_CREE')
       )
       SELECT e.id, e.action, e.valeur_avant, e.valeur_apres, e.ip_address,
              e.created_at, e.id_acteur,
              acteur.prenom AS acteur_prenom, acteur.nom AS acteur_nom,
              -- Fonction fenetre evaluee avant LIMIT : donne le total sans
              -- seconde requete ni risque de divergence entre les deux.
              count(*) OVER () AS total
         FROM evenements e
         LEFT JOIN utilisateur acteur ON acteur.id = e.id_acteur
        ORDER BY e.created_at DESC
        LIMIT $2 OFFSET $3`,
      [id, parPage, (page - 1) * parPage]
    );

    // count(*) OVER () ne renvoie aucune ligne sur une page vide : le total
    // doit alors être relu, sinon une page hors bornes annoncerait un
    // historique vide au lieu de sa vraie taille.
    let total;
    if (rows.length) {
      total = Number(rows[0].total);
    } else {
      const { rows: [c] } = await tenantPool.query(
        `SELECT (SELECT count(*) FROM audit_log
                  WHERE entite_type = 'utilisateur' AND entite_id = $1)
              + (SELECT count(*) FROM utilisateur u
                  WHERE u.id = $1 AND NOT EXISTS (
                    SELECT 1 FROM audit_log a2
                     WHERE a2.entite_type = 'utilisateur' AND a2.entite_id = u.id
                       AND a2.action = 'UTILISATEUR_CREE')) AS total`,
        [id]);
      total = Number(c?.total || 0);
    }

    // code_retour: 2052
    res.json({
      utilisateur: { id: cible[0].id, prenom: cible[0].prenom, nom: cible[0].nom },
      page,
      par_page: parPage,
      total,
      pages: Math.max(1, Math.ceil(total / parPage)),
      evenements: rows.map((r) => traduireEvenement(r, id)),
    });
  } catch (err) {
    console.error("GET /utilisateurs/:id/historique error", err);
    // code_retour: 2099
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Retrait du rattachement à l'échelle tenant (id_societe NULL) : distinct de
// la route ci-dessous car NULL n'est pas représentable dans un paramètre
// d'URL au sens de l'égalité SQL.
router.delete("/utilisateurs/:id/rattachement-tenant", async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await tenantPool.query(
      `UPDATE utilisateur_societe SET date_suppression = now()
       WHERE id_utilisateur = $1 AND id_societe IS NULL AND date_suppression IS NULL`,
      [id]
    );
    if (!rowCount) return res.status(404).json({ error: "Rattachement tenant introuvable" });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/utilisateurs/:id/societes", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await tenantPool.query(
      `SELECT id, id_utilisateur AS idutilisateur, id_societe AS idsociete
       FROM utilisateur_societe
       WHERE id_utilisateur = $1 AND date_suppression IS NULL`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/utilisateurs/:id/societes/:societeId", async (req, res) => {
  const { id, societeId } = req.params;
  try {
    await tenantPool.query(
      `UPDATE utilisateur_profil_societe SET date_suppression = now()
       WHERE id_utilisateur = $1 AND id_societe = $2 AND date_suppression IS NULL`,
      [id, societeId]
    );
    const { rowCount } = await tenantPool.query(
      `UPDATE utilisateur_societe SET date_suppression = now()
       WHERE id_utilisateur = $1 AND id_societe = $2 AND date_suppression IS NULL`,
      [id, societeId]
    );
    if (!rowCount) return res.status(404).json({ error: "Rattachement introuvable" });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Cœur commun aux deux endpoints : la différence tient à l'origine de la
// valeur, saisie ou générée. Tout le reste, politique, hachage, révocation et
// tracé, est identique et ne doit exister qu'en un exemplaire.
async function appliquerMotDePasse(req, res, { valeur, action }) {
  const { id } = req.params;

  const refusOrigine = verifierOrigine(req);
  if (refusOrigine) return res.status(refusOrigine.status).json({ error: refusOrigine.error });

  const scope = await getAdminScope(req.user.id);
  if (!(await isUserInScope(id, scope))) {
    // code_retour: 2051
    return res.status(403).json({ error: "Cet utilisateur n'est pas dans votre périmètre." });
  }

  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const { rows: cible } = await client.query(
      `SELECT id, prenom, nom FROM utilisateur WHERE id = $1`, [id]);
    // code_retour: 2050
    if (!cible.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Utilisateur introuvable" }); }

    const hash = await bcrypt.hash(valeur, 10);
    await client.query(`UPDATE utilisateur SET mot_de_passe_hash = $2 WHERE id = $1`, [id, hash]);

    // Révocation des sessions ouvertes du compte cible. Sans elle, un mot de
    // passe redéfini pour reprendre la main sur un compte compromis ne protège
    // de rien : les jetons en cours restent valides jusqu'à sept jours.
    const { rowCount: sessionsRevoquees } = await client.query(
      `UPDATE session_token SET revoked = true
        WHERE id_utilisateur = $1 AND revoked = false`, [id]);

    await log(client, "UPDATE", "utilisateur", id,
      `Mot de passe de "${cible[0].prenom} ${cible[0].nom}" redéfini`, null);

    // Aucune valeur, aucun hash, aucune longueur : l'action et son acteur
    // suffisent. filtrerSensibles retirerait de toute façon toute clé portant
    // mot_de_passe ou hash, ceci est la première barrière.
    // code_retour: 2010
    // code_retour: 2018
    await auditer(client, req, {
      action,
      entiteId: id,
      apres: { sessions_revoquees: sessionsRevoquees, origine: origineAppel(req) },
    });

    await client.query("COMMIT");
    return { sessionsRevoquees };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`${req.method} ${req.path} error`, err);
    // code_retour: 2099
    res.status(500).json({ error: "Erreur serveur" });
    return null;
  } finally {
    client.release();
  }
}

// PUT /api/utilisateurs/:id/mot-de-passe
// Définition par un administrateur d'une valeur qu'il a choisie.
router.put("/utilisateurs/:id/mot-de-passe", async (req, res) => {
  const { mot_de_passe } = req.body || {};

  // code_retour: 2016
  if (!mot_de_passe || typeof mot_de_passe !== "string") {
    return res.status(400).json({ error: "Le mot de passe est obligatoire." });
  }

  // La politique est appliquée ici et non seulement dans le formulaire : un
  // appel direct doit se heurter à la même règle, avec le détail de ce qui
  // manque plutôt qu'un refus muet.
  const manques = verifierPolitique(mot_de_passe);
  // code_retour: 2015
  if (manques.length) {
    return res.status(400).json({
      error: `Le mot de passe doit comporter ${manques.join(", ")}.`,
      exigences_non_satisfaites: manques,
    });
  }

  const resultat = await appliquerMotDePasse(req, res, {
    valeur: mot_de_passe,
    action: "MOT_DE_PASSE_DEFINI_PAR_ADMIN",
  });
  if (!resultat) return;

  // Jamais la valeur, jamais le hash, même en confirmation.
  // code_retour: 2013
  res.json({ message: "Mot de passe défini.", sessions_revoquees: resultat.sessionsRevoquees });
});

// POST /api/utilisateurs/:id/mot-de-passe/generer
// Génère une valeur conforme, l'applique, et la renvoie UNE SEULE FOIS : elle
// n'est stockée nulle part ailleurs qu'en hash bcrypt et ne sera jamais
// relisible.
router.post("/utilisateurs/:id/mot-de-passe/generer", async (req, res) => {
  const valeur = genererMotDePasse();

  const resultat = await appliquerMotDePasse(req, res, {
    valeur,
    action: "MOT_DE_PASSE_GENERE_PAR_ADMIN",
  });
  if (!resultat) return;

  // code_retour: 2014
  res.json({
    mot_de_passe: valeur,
    avertissement: "Cette valeur ne sera plus jamais affichée. Transmettez-la maintenant.",
    sessions_revoquees: resultat.sessionsRevoquees,
  });
});

// POST /api/utilisateurs/:id/mot-de-passe/reinitialisation
// Émet un lien de réinitialisation à destination du titulaire du compte.
router.post("/utilisateurs/:id/mot-de-passe/reinitialisation", async (req, res) => {
  const { id } = req.params;

  const refusOrigine = verifierOrigine(req);
  if (refusOrigine) return res.status(refusOrigine.status).json({ error: refusOrigine.error });

  const scope = await getAdminScope(req.user.id);
  if (!(await isUserInScope(id, scope))) {
    // code_retour: 2051
    return res.status(403).json({ error: "Cet utilisateur n'est pas dans votre périmètre." });
  }

  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const { rows: cible } = await client.query(
      `SELECT id, prenom, nom, email, actif FROM utilisateur WHERE id = $1`, [id]);
    // code_retour: 2050
    if (!cible.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Utilisateur introuvable" }); }
    // code_retour: 2029
    if (!cible[0].actif) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Ce compte est désactivé : réactivez-le avant d'envoyer un lien." });
    }

    // Les liens antérieurs non consommés sont neutralisés : deux liens valides
    // en circulation doublent la surface d'attaque sans rien apporter.
    await client.query(
      `UPDATE reset_password_token SET utilise = true
        WHERE id_utilisateur = $1 AND utilise = false`, [id]);

    const jeton = genererJeton();
    await client.query(
      `INSERT INTO reset_password_token (id_utilisateur, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3 || ' hours')::interval)`,
      [id, hacherJeton(jeton), String(DUREE_VALIDITE_HEURES)]
    );

    // Le chemin est celui de la route publique du front (AppRouter.jsx :
    // /reset-password/:token), la seule qui existe pour cette page.
    const lien = `${process.env.URL_PUBLIQUE || ""}/reset-password/${jeton}`;

    // Envoi par le socle #15 (tâche #87). Le lien ne transite que par ce mail :
    // il n'est ni journalisé, ni renvoyé à l'administrateur. Un échec d'envoi
    // ne fait pas échouer la demande : le jeton reste valable, l'état est
    // rendu à l'administrateur qui peut relancer (le lien précédent sera
    // alors invalidé).
    // code_retour: 2011
    const mail = await envoyerMail({
      destinataire: cible[0].email,
      sujet: "Réinitialisation de votre mot de passe SamSecure",
      contenu:
        `Bonjour ${cible[0].prenom},\n\n` +
        "Un administrateur a demandé la réinitialisation de votre mot de passe SamSecure. " +
        "Pour choisir un nouveau mot de passe, ouvrez le lien suivant :\n\n" +
        `${lien}\n\n` +
        `Ce lien est valable ${DUREE_VALIDITE_HEURES} heure et ne peut servir qu'une seule fois. ` +
        "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message : votre mot de passe actuel reste inchangé.",
    });

    await log(client, "UPDATE", "utilisateur", id,
      `Lien de réinitialisation ${mail.envoye ? "envoyé" : "émis, mail non envoyé"} pour "${cible[0].prenom} ${cible[0].nom}"`, null);

    // Ni le jeton, ni le lien, ni aucune valeur : seul le fait qu'une demande
    // a été émise, par qui, pour quel compte, et si le mail est parti.
    // code_retour: 2028
    await auditer(client, req, {
      action: "REINITIALISATION_DEMANDEE",
      entiteId: id,
      apres: { expiration_heures: DUREE_VALIDITE_HEURES, origine: origineAppel(req), mail_envoye: mail.envoye },
    });

    await client.query("COMMIT");

    // code_retour: 2019
    res.json({
      message: mail.envoye
        ? "Mail de réinitialisation envoyé."
        : `Lien généré mais mail non envoyé : ${mail.erreur}`,
      expire_dans_heures: DUREE_VALIDITE_HEURES,
      mail_envoye: mail.envoye,
      ...(mail.envoye ? {} : { erreur_mail: mail.erreur, code_mail: mail.code }),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /utilisateurs/:id/mot-de-passe/reinitialisation error", err);
    // code_retour: 2099
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
