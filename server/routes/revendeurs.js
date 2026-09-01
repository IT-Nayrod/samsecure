// revendeurs - referentiel des revendeurs (module 1).
//
// Meme convention que contrats.js, editeurs.js et licences.js : enveloppe
// normalisee (server/utils/reponse.js, codes 5220-5239 seedes par la migration
// 045), helper log() vers journal_ecriture avec id_auteur, trace probante
// auditer() vers audit_log sur chaque ecriture, transaction par ecriture,
// relecture de la projection apres commit.
//
// Ce routeur remplace le GET /revendeurs de referentiels.js, qui servait une
// liste nue de deux colonnes aux selecteurs des formulaires contrat et
// commande. La projection conserve id et raison_sociale ; deballer() dans
// src/services/http.js rend la bascule vers l'enveloppe transparente pour ses
// appelants, et le filtrage des desactives leur evite de proposer a la saisie
// un revendeur retire du catalogue.
//
// Pas de suppression : quatre tables referencent un revendeur (contrat,
// commande, licence, maintenance_historique) et ces lignes doivent continuer de
// le nommer. Le retrait est une desactivation, reversible.
//
// Pas de workflow de validation : contrairement a l'editeur, le revendeur n'est
// pas soumis au circuit de la #53. A ouvrir si la doctrine change, en
// l'ajoutant a ENTITES_VALIDABLES.
import express from "express";
import { tenantPool } from "../db.js";
import { succes, erreur, erreurPivot } from "../utils/reponse.js";
import { auditer, diff } from "../utils/audit.js";

const router = express.Router();

// Convention du projet : helper de journalisation local a chaque routeur.
// id_auteur est lu dans req.user (session JWT) : le routeur est monte apres
// authMiddleware, req.user est donc toujours renseigne. Il avale ses erreurs,
// une trace fonctionnelle manquante ne doit pas annuler l'ecriture. La trace
// probante, elle, passe par auditer() et n'avale rien.
async function log(client, req, action, entite_type, entite_id, description, payload) {
  try {
    await client.query(
      `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, id_auteur, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [action, entite_type, entite_id || null, description, req?.user?.id || null,
       payload ? JSON.stringify(payload) : null]
    );
  } catch (e) {
    console.error("[journal] log failed:", e.message);
  }
}

// Garde-fou : un :id non UUID part sinon en Postgres et ressort en 500
// illisible la ou le revendeur est simplement introuvable.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Projection identique en liste et en detail : garantit qu'aucun champ
// n'apparaisse dans un ecran et pas dans l'autre. Les compteurs disent ce que
// le revendeur porte, et fondent le message de desactivation.
const SELECT_REVENDEUR = `
  SELECT r.id, r.raison_sociale, r.siret, r.iban, r.email, r.actif,
         r.created_at, r.updated_at,
         (SELECT count(*) FROM contrat  c WHERE c.id_revendeur = r.id)::int AS nb_contrats,
         (SELECT count(*) FROM commande o WHERE o.id_revendeur = r.id)::int AS nb_commandes,
         (SELECT count(*) FROM licence  l WHERE l.id_revendeur = r.id)::int AS nb_licences
  FROM revendeur r`;

// Projection courte des suggestions et des propositions de doublon : de quoi
// reconnaitre l'existant, sans les compteurs qui coutent trois sous-requetes.
const SELECT_COURT = `
  SELECT r.id, r.raison_sociale, r.siret, r.actif FROM revendeur r`;

// Colonnes metier ecrivables, dans l'ordre des parametres d'INSERT et d'UPDATE.
const CHAMPS = ["raison_sociale", "siret", "iban", "email"];

// Un <input> vide envoie "" et non null : sans normalisation, "" partirait en
// base et deux revendeurs sans SIRET porteraient la meme chaine vide, que
// l'index unique refuserait. Le SIRET est debarrasse de ses espaces, l'IBAN de
// ses espaces et mis en majuscules, comme le fait la saisie a l'ecran.
function normaliserCorps(body = {}) {
  const vide = (v) => (v === "" || v === undefined || v === null ? null : v);
  const siret = vide(body.siret);
  const iban = vide(body.iban);
  const email = vide(body.email);
  return {
    raison_sociale: body.raison_sociale ?? "",
    siret: siret === null ? null : String(siret).replace(/\s/g, ""),
    iban: iban === null ? null : String(iban).replace(/\s/g, "").toUpperCase(),
    email: email === null ? null : String(email).trim(),
  };
}

// ---- Validation --------------------------------------------------------------

// Le SIRET n'est pas obligatoire, mais s'il est saisi il est complet. Meme
// regle que validateSiret cote front (src/utils/validation.js:13), portee ici
// pour qu'un appel direct a l'API ne la contourne pas.
function siretValide(siret) {
  return /^\d{14}$/.test(siret);
}

// Structure puis cle de controle mod 97, comme validateIban cote front. Le
// modulo se fait par tranches : le nombre reconstitue depasse largement
// Number.MAX_SAFE_INTEGER et un parseInt rendrait un resultat faux sans bruit.
function ibanValide(iban) {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const reordonne = iban.slice(4) + iban.slice(0, 4);
  const numerique = reordonne.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let reste = 0;
  for (const chiffre of numerique) reste = (reste * 10 + Number(chiffre)) % 97;
  return reste === 1;
}

function emailValide(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validerRevendeur(corps) {
  const { raison_sociale, siret, iban, email } = corps;

  if (!raison_sociale || !raison_sociale.trim())
    return { status: 400, code: 5228, error: "La raison sociale est obligatoire." };
  if (siret && !siretValide(siret))
    return { status: 400, code: 5229, error: "Le SIRET doit contenir 14 chiffres." };
  if (iban && !ibanValide(iban))
    return { status: 400, code: 5232, error: "IBAN invalide." };
  if (email && !emailValide(email))
    return { status: 400, code: 5233, error: "Adresse email invalide." };
  return null;
}

// Detection de doublon, deux passes.
//
// Le SIRET d'abord : c'est l'identifiant legal, son egalite ne se discute pas.
// Puis la cle de rapprochement (migration 044), qui rapproche "SCC France",
// "S.C.C. FRANCE" et "SCC France SAS". C'est la que se joue l'essentiel : un
// revendeur est presque toujours resaisi sous une forme voisine, jamais a
// l'identique.
//
// L'existant est rendu a l'appelant, et non seulement signale : l'ecran doit
// pouvoir proposer de l'ouvrir, ou de le reactiver s'il avait ete retire du
// catalogue. Un refus sec conduirait a le recreer sous un troisieme nom.
async function chercherDoublon(client, corps, idExclu) {
  const exclu = idExclu || null;

  if (corps.siret) {
    const { rows } = await client.query(
      `${SELECT_COURT}
        WHERE r.siret = $1 AND ($2::uuid IS NULL OR r.id <> $2)
        LIMIT 1`,
      [corps.siret, exclu]);
    if (rows.length) {
      return { code: 5230, existant: rows[0], motif: "siret" };
    }
  }

  const { rows } = await client.query(
    `${SELECT_COURT}
      WHERE cle_rapprochement(r.raison_sociale) = cle_rapprochement($1)
        AND ($2::uuid IS NULL OR r.id <> $2)
      ORDER BY r.actif DESC, r.raison_sociale
      LIMIT 1`,
    [corps.raison_sociale, exclu]);
  if (rows.length) {
    return { code: 5231, existant: rows[0], motif: "raison_sociale" };
  }
  return null;
}

// Message du refus. Un existant desactive appelle une reactivation, pas une
// creation : le dire evite le troisieme doublon.
function messageDoublon(doublon) {
  const e = doublon.existant;
  const tete = doublon.motif === "siret"
    ? `Le SIRET ${e.siret} est deja porte par "${e.raison_sociale}".`
    : `"${e.raison_sociale}" existe deja sous un nom tres proche.`;
  return e.actif
    ? `${tete} Ouvrez sa fiche plutot que d'en creer un second.`
    : `${tete} Ce revendeur est desactive : reactivez-le plutot que d'en creer un second.`;
}

// Violation de uq_revendeur_siret : deux creations concurrentes passent la
// detection applicative et se croisent sur l'index.
function conflitSiret(err) {
  return err?.code === "23505" && String(err.constraint || "").includes("revendeur_siret");
}

// ---- Lecture ------------------------------------------------------------------

// Les desactives sont masques par defaut : cette route sert aussi de selecteur
// aux formulaires contrat et commande, ou proposer un revendeur retire du
// catalogue serait une erreur. inclure_inactifs=1 les sert avec les autres,
// la colonne actif permettant a l'ecran de les distinguer.
router.get("/revendeurs", async (req, res) => {
  try {
    const inclureInactifs = ["1", "true"].includes(String(req.query.inclure_inactifs ?? ""));
    const { rows } = await tenantPool.query(
      `${SELECT_REVENDEUR} ${inclureInactifs ? "" : "WHERE r.actif = true"} ORDER BY r.raison_sociale`);
    succes(res, 5220, rows);
  } catch (err) {
    console.error("GET /revendeurs error", err);
    erreur(res, 5236, { status: 500, message: "Erreur serveur" });
  }
});

// Recherche incrementale, appelee au fil de la frappe.
//
// Insensible a la casse et aux accents : normaliser_texte est applique des deux
// cotes de la comparaison (migration 044). Le client qui tape "systemes" trouve
// "Systèmes", celui qui tape "ECONOCOM" trouve "Econocom". Sans cela, il
// faudrait que la saisie porte les memes accents que la fiche, ce qu'aucun
// utilisateur ne fera, et le doublon naitrait de cet echec de recherche.
//
// Volontairement pauvre : ni compteurs ni IBAN, contrairement a la liste. Une
// frappe ne doit couter qu'une seule requete, bornee par LIMIT.
//
// Montee en charge : le joker en tete interdit l'usage de idx_revendeur_nom_norm,
// la recherche est un parcours sequentiel. Sur quelques milliers de lignes il se
// compte en millisecondes et le debounce du front espace les appels. Au-dela, la
// reponse est un index trigramme (pg_trgm), non pose ici : l'extension demande
// des droits que le role applicatif n'a pas forcement.
//
// Declaree avant /revendeurs/:id : la route parametree capturerait sinon
// "recherche" comme un identifiant. Meme regle cote routesPermissions.js.
router.get("/revendeurs/recherche", async (req, res) => {
  try {
    const brut = typeof req.query.q === "string" ? req.query.q.trim() : "";
    // Une saisie vide ne suggere rien : renvoyer le referentiel entier a chaque
    // ouverture du formulaire n'aiderait personne et couterait cher.
    if (!brut) return succes(res, 5226, { suggestions: [], total: 0 });

    // % et _ sont les jokers de LIKE : sans echappement, un client tapant
    // "100%" interrogerait le referentiel avec un joker au milieu de son texte.
    const motif = brut.replace(/([\\%_])/g, "\\$1");
    const exclu = UUID_RE.test(String(req.query.exclure ?? "")) ? req.query.exclure : null;
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 8, 1), 25);

    // count(*) OVER () : le total des correspondances sans seconde requete, pour
    // que l'ecran puisse dire combien de resultats ne sont pas montres.
    // L'ordre place la correspondance exacte en tete, puis celles qui commencent
    // par le texte saisi, puis le reste ; les actifs avant les desactives.
    const { rows } = await tenantPool.query(
      `SELECT r.id, r.raison_sociale, r.siret, r.actif,
              normaliser_texte(r.raison_sociale) = normaliser_texte($1) AS exact,
              count(*) OVER ()::int AS total
         FROM revendeur r
        WHERE normaliser_texte(r.raison_sociale)
              LIKE '%' || normaliser_texte($2) || '%' ESCAPE '\\'
          AND ($3::uuid IS NULL OR r.id <> $3)
        ORDER BY CASE
                   WHEN normaliser_texte(r.raison_sociale) = normaliser_texte($1) THEN 0
                   WHEN normaliser_texte(r.raison_sociale)
                        LIKE normaliser_texte($2) || '%' ESCAPE '\\'              THEN 1
                   ELSE 2
                 END,
                 r.actif DESC,
                 r.raison_sociale
        LIMIT $4`,
      [brut, motif, exclu, limite]);

    const total = rows.length ? rows[0].total : 0;
    succes(res, 5226, {
      suggestions: rows.map(({ total: _total, ...r }) => r),
      total,
    });
  } catch (err) {
    console.error("GET /revendeurs/recherche error", err);
    erreur(res, 5236, { status: 500, message: "Erreur serveur" });
  }
});

router.get("/revendeurs/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (!UUID_RE.test(id)) return erreur(res, 5227, { status: 404, message: "Revendeur introuvable." });

    const { rows } = await tenantPool.query(`${SELECT_REVENDEUR} WHERE r.id = $1`, [id]);
    if (!rows.length) return erreur(res, 5227, { status: 404, message: "Revendeur introuvable." });

    succes(res, 5221, rows[0]);
  } catch (err) {
    console.error("GET /revendeurs/:id error", err);
    erreur(res, 5236, { status: 500, message: "Erreur serveur" });
  }
});

// ---- Ecriture -----------------------------------------------------------------

router.post("/revendeurs", async (req, res) => {
  const corps = normaliserCorps(req.body);
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const invalide = validerRevendeur(corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    // L'existant part dans details : l'ecran doit pouvoir l'ouvrir ou le
    // reactiver, pas seulement apprendre qu'il existe.
    const doublon = await chercherDoublon(client, corps, null);
    if (doublon) {
      await client.query("ROLLBACK");
      return erreur(res, doublon.code, {
        status: 409,
        message: messageDoublon(doublon),
        details: { existant: doublon.existant, motif: doublon.motif },
      });
    }

    const raisonSociale = corps.raison_sociale.trim();
    const { rows: [cree] } = await client.query(
      `INSERT INTO revendeur (${CHAMPS.join(", ")}) VALUES ($1, $2, $3, $4) RETURNING id`,
      [raisonSociale, corps.siret, corps.iban, corps.email]);

    await log(client, req, "CREATE", "revendeur", cree.id,
      `Creation du revendeur "${raisonSociale}"`, corps);
    // code_retour: 5237
    await auditer(client, req, {
      action: "REVENDEUR_CREE", entiteType: "revendeur", entiteId: cree.id,
      apres: { ...corps, raison_sociale: raisonSociale },
    });

    const { rows } = await client.query(`${SELECT_REVENDEUR} WHERE r.id = $1`, [cree.id]);
    await client.query("COMMIT");

    succes(res, 5222, rows[0], { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    if (conflitSiret(err)) {
      return erreur(res, 5230, { status: 409, message: "Un revendeur porte deja ce SIRET." });
    }
    console.error("POST /revendeurs error", err);
    erreur(res, 5236, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/revendeurs/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return erreur(res, 5227, { status: 404, message: "Revendeur introuvable." });
    }

    const { rows: existant } = await client.query(
      `SELECT raison_sociale, siret, iban, email FROM revendeur WHERE id = $1`, [id]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      return erreur(res, 5227, { status: 404, message: "Revendeur introuvable." });
    }

    // Fusion avant validation : un PATCH partiel ne doit pas echouer sur un
    // champ obligatoire qui n'a simplement pas ete transmis.
    const patch = normaliserCorps(req.body);
    const corps = { ...existant[0] };
    for (const champ of CHAMPS) {
      if (Object.prototype.hasOwnProperty.call(req.body, champ)) corps[champ] = patch[champ];
    }

    const invalide = validerRevendeur(corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    // Le revendeur modifie est exclu : il ne se signale pas a lui-meme comme un
    // doublon de lui-meme.
    const doublon = await chercherDoublon(client, corps, id);
    if (doublon) {
      await client.query("ROLLBACK");
      return erreur(res, doublon.code, {
        status: 409,
        message: messageDoublon(doublon),
        details: { existant: doublon.existant, motif: doublon.motif },
      });
    }

    const raisonSociale = corps.raison_sociale.trim();
    await client.query(
      `UPDATE revendeur SET raison_sociale = $1, siret = $2, iban = $3, email = $4 WHERE id = $5`,
      [raisonSociale, corps.siret, corps.iban, corps.email, id]);

    await log(client, req, "UPDATE", "revendeur", id,
      `Modification du revendeur "${raisonSociale}"`, patch);
    // Trace probante : seuls les champs reellement modifies, jamais le corps
    // fusionne, sinon on lirait "mis a null" sur les champs conserves.
    // code_retour: 5238
    const d = diff(existant[0], { ...corps, raison_sociale: raisonSociale });
    await auditer(client, req, {
      action: "REVENDEUR_MODIFIE", entiteType: "revendeur", entiteId: id,
      avant: d.avant, apres: d.apres,
    });

    const { rows } = await client.query(`${SELECT_REVENDEUR} WHERE r.id = $1`, [id]);
    await client.query("COMMIT");

    succes(res, 5223, rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    if (conflitSiret(err)) {
      return erreur(res, 5230, { status: 409, message: "Un revendeur porte deja ce SIRET." });
    }
    console.error("PATCH /revendeurs/:id error", err);
    erreur(res, 5236, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// Desactivation et reactivation : un seul traitement, l'etat cible et les
// libelles seuls changent. Rien n'est efface : les contrats, commandes et
// licences qui portent le revendeur continuent de le nommer, il disparait
// seulement des selecteurs de saisie.
async function changerEtat(req, res, actifCible) {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return erreur(res, 5227, { status: 404, message: "Revendeur introuvable." });
    }

    // FOR UPDATE : deux desactivations concurrentes ne doivent pas produire
    // deux traces pour un seul changement d'etat.
    const { rows: existant } = await client.query(
      `SELECT raison_sociale, actif FROM revendeur WHERE id = $1 FOR UPDATE`, [id]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      return erreur(res, 5227, { status: 404, message: "Revendeur introuvable." });
    }

    // Etat deja atteint : refus explicite plutot qu'un succes silencieux, qui
    // ferait croire a une action et laisserait une trace pour rien.
    if (existant[0].actif === actifCible) {
      await client.query("ROLLBACK");
      return actifCible
        ? erreur(res, 5235, { status: 409, message: "Ce revendeur est deja actif." })
        : erreur(res, 5234, { status: 409, message: "Ce revendeur est deja desactive." });
    }

    await client.query(`UPDATE revendeur SET actif = $1 WHERE id = $2`, [actifCible, id]);

    const raisonSociale = existant[0].raison_sociale;
    const verbe = actifCible ? "Reactivation" : "Desactivation";
    await log(client, req, actifCible ? "REACTIVATE" : "DEACTIVATE", "revendeur", id,
      `${verbe} du revendeur "${raisonSociale}"`, null);
    // code_retour: 5239
    await auditer(client, req, {
      action: actifCible ? "REVENDEUR_REACTIVE" : "REVENDEUR_DESACTIVE",
      entiteType: "revendeur", entiteId: id,
      avant: { actif: !actifCible }, apres: { actif: actifCible },
    });

    const { rows } = await client.query(`${SELECT_REVENDEUR} WHERE r.id = $1`, [id]);
    await client.query("COMMIT");

    succes(res, actifCible ? 5225 : 5224, rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`POST /revendeurs/:id/${actifCible ? "reactiver" : "desactiver"} error`, err);
    erreur(res, 5236, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
}

router.post("/revendeurs/:id/desactiver", (req, res) => changerEtat(req, res, false));
router.post("/revendeurs/:id/reactiver",  (req, res) => changerEtat(req, res, true));

export default router;