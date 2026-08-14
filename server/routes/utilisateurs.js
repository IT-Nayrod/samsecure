import express from "express";
import bcrypt from "bcryptjs";
import { tenantPool } from "../db.js";
import { getAdminScope, isUserInScope, scopeWhereClause } from "../utils/scope.js";
import { auditer, diff } from "../utils/audit.js";
import { traduireEvenement } from "../utils/historiqueLibelles.js";
import { verifierPolitique, genererMotDePasse, POLITIQUE } from "../utils/motDePasse.js";
import { verifierOrigine, origineAppel } from "../utils/origine.js";

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

// Tous les comptes sont servis, desactives compris : la suppression n'existe
// plus, un compte retire doit rester visible pour etre reactivable.
router.get("/utilisateurs", async (req, res) => {
  try {
    const scope = await getAdminScope(req.user.id);
    const { clause, params } = scopeWhereClause(scope, 1);
    const { rows } = await tenantPool.query(
      `SELECT u.id, u.nom, u.prenom, u.email, u.actif, u.date_finale, u.date_mise_en_fonction
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

    if (date_mise_en_fonction !== undefined && date_mise_en_fonction !== null && date_mise_en_fonction !== "") {
      fields.push("date_mise_en_fonction");
      values.push(date_mise_en_fonction);
      placeholders.push(`$${values.length}`);
    } else {
      fields.push("date_mise_en_fonction");
      placeholders.push("CURRENT_DATE");
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
    // Le mot de passe initial est un evenement distinct : c'est lui qui ouvre
    // l'acces, et il doit se lire seul dans l'historique. Aucune valeur,
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

    // Etat anterieur, indispensable au diff. mot_de_passe_hash n'est pas
    // selectionne : il n'a rien a faire dans une trace, et cette route ne le
    // modifie pas.
    const { rows: avantRows } = await client.query(
      `SELECT nom, prenom, email, actif, langue,
              date_finale::text AS date_finale,
              date_mise_en_fonction::text AS date_mise_en_fonction
         FROM utilisateur WHERE id = $1`, [id]);
    const avant = avantRows[0] || {};

    const { rows } = await client.query(
      // Cast en text obligatoire : sans lui pg renvoie un objet Date, et la
      // comparaison avec l'etat anterieur, deja lu en text, ne peut jamais
      // etre vraie. Le diff signalait donc des champs inchanges, et la date
      // ecrite dans la trace ressortait sous la forme "Fri Aug 14".
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
      // Deja en text depuis le RETURNING, aucune conversion a faire.
      date_finale: rows[0].date_finale,
      date_mise_en_fonction: rows[0].date_mise_en_fonction,
    };
    const d = diff(avant, apres);

    // Les champs couverts par un evenement dedie sortent du diff : sans cela
    // un meme changement produirait deux lignes d'historique, l'evenement
    // explicite et une modification generique redondante.
    const retirerDuDiff = (champ) => {
      if (d.avant) delete d.avant[champ];
      if (d.apres) {
        delete d.apres[champ];
        if (!Object.keys(d.apres).length) d.apres = null;
      }
    };

    // Un changement d'etat n'est pas une modification comme une autre : il se
    // lit seul dans la trace, sans avoir a comparer deux JSONB. Les trois cas
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
      // Pose ou levee d'une echeance : c'est une decision d'administrateur,
      // tracee au moment ou elle est prise. Rien ne sera ecrit a l'echeance
      // elle-meme, aucun ordonnanceur n'existe (STOP planification).
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

    // Journalise le diff filtre et non req.body : le corps de la requete
    // pourrait porter un champ sensible le jour ou cette route en acceptera un.
    await log(client, "UPDATE", "utilisateur", id, `Utilisateur "${rows[0].prenom} ${rows[0].nom}" modifié`, d.apres);

    // Les autres champs modifies dans la meme requete, s'il y en a.
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
    // 23505 : violation de l'unicite de utilisateur.email. Ce message ne doit
    // sortir que dans ce cas precis. Le renvoyer pour toute erreur faisait
    // mentir l'interface et masquait la cause reelle des pannes de cette route.
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
// d'un compte se fait par desactivation, PATCH /utilisateurs/:id { actif:
// false }. Un compte desactive reste visible a l'ecran et reactivable, la ou
// un compte supprime disparaissait de la liste et n'etait plus recuperable que
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
// Lecture seule de la trace probante d'un compte. N'ecrit rien, ne modifie
// rien : consulter un historique ne doit pas en produire une ligne.
router.get("/utilisateurs/:id/historique", async (req, res) => {
  const { id } = req.params;

  // Garde-fou : un :id non UUID partirait en Postgres et ressortirait en 22P02
  // brute remontee en 500, la ou le compte est simplement introuvable.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    // code_retour: 2050
    return res.status(404).json({ error: "Utilisateur introuvable" });
  }

  // Meme controle de perimetre que les autres routes d'administration : un
  // administrateur restreint ne lit pas l'historique d'un compte hors de ses
  // societes. La permission gerer_utilisateurs est deja exigee en amont par le
  // middleware, ceci en est le complement par societe.
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
    // doit alors etre relu, sinon une page hors bornes annoncerait un
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

// Coeur commun aux deux endpoints : la difference tient a l'origine de la
// valeur, saisie ou generee. Tout le reste, politique, hachage, revocation et
// trace, est identique et ne doit exister qu'en un exemplaire.
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

    // Revocation des sessions ouvertes du compte cible. Sans elle, un mot de
    // passe redefini pour reprendre la main sur un compte compromis ne protege
    // de rien : les jetons en cours restent valides jusqu'a sept jours.
    const { rowCount: sessionsRevoquees } = await client.query(
      `UPDATE session_token SET revoked = true
        WHERE id_utilisateur = $1 AND revoked = false`, [id]);

    await log(client, "UPDATE", "utilisateur", id,
      `Mot de passe de "${cible[0].prenom} ${cible[0].nom}" redéfini`, null);

    // Aucune valeur, aucun hash, aucune longueur : l'action et son acteur
    // suffisent. filtrerSensibles retirerait de toute facon toute cle portant
    // mot_de_passe ou hash, ceci est la premiere barriere.
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
// Definition par un administrateur d'une valeur qu'il a choisie.
router.put("/utilisateurs/:id/mot-de-passe", async (req, res) => {
  const { mot_de_passe } = req.body || {};

  // code_retour: 2016
  if (!mot_de_passe || typeof mot_de_passe !== "string") {
    return res.status(400).json({ error: "Le mot de passe est obligatoire." });
  }

  // La politique est appliquee ici et non seulement dans le formulaire : un
  // appel direct doit se heurter a la meme regle, avec le detail de ce qui
  // manque plutot qu'un refus muet.
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

  // Jamais la valeur, jamais le hash, meme en confirmation.
  // code_retour: 2013
  res.json({ message: "Mot de passe défini.", sessions_revoquees: resultat.sessionsRevoquees });
});

// POST /api/utilisateurs/:id/mot-de-passe/generer
// Genere une valeur conforme, l'applique, et la renvoie UNE SEULE FOIS : elle
// n'est stockee nulle part ailleurs qu'en hash bcrypt et ne sera jamais
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

export default router;
