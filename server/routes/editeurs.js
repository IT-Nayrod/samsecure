// editeurs - referentiel des editeurs de logiciels (module 1).
//
// Meme convention que contrats.js et licences.js : enveloppe normalisee
// (server/utils/reponse.js, codes 5200-5299 seedes par la migration 041),
// helper log() vers journal_ecriture avec id_auteur, trace probante auditer()
// vers audit_log sur chaque ecriture, transaction par ecriture, relecture de la
// projection apres commit.
//
// Ce routeur remplace le GET /editeurs de referentiels.js, qui servait une
// reponse nue au seul selecteur du formulaire contrat. La projection conserve
// les champs qu'il exposait (id, raison_sociale, url_logo_defaut,
// url_logo_custom) : deballer() dans src/services/http.js rend la bascule vers
// l'enveloppe transparente pour ses appelants.
//
// Deux resolutions ne peuvent pas se faire en SQL, aucune jointure ne
// traversant les deux bases :
//   - le nombre de produits du catalogue global (produit_referentiel, Commune)
//     rattaches a l'editeur ;
//   - la conformite, dont la balance se calcule cote Tenant par produit mais
//     dont le regroupement par editeur suppose de savoir a quel editeur chaque
//     produit appartient, information partagee entre les deux bases.
// Elles sont donc faites ici, en une requete par reponse et jamais par ligne,
// comme referentielsLicences.js et inventaire.js.
import express from "express";
import { tenantPool, commonPool } from "../db.js";
import { succes, erreur, erreurPivot } from "../utils/reponse.js";
import { auditer, diff } from "../utils/audit.js";
import { soumettre, purgerValidations, jointureStatut, COLONNES_STATUT } from "../utils/validationWorkflow.js";
import { balanceParProduit, niveauConformite } from "../utils/conformite.js";

const router = express.Router();

// Convention du projet : helper de journalisation local a chaque routeur.
// id_auteur est lu dans req.user (session JWT) : le routeur est monte apres
// authMiddleware, req.user est donc toujours renseigne. Il avale ses erreurs,
// une trace fonctionnelle manquante ne doit pas annuler l'ecriture.
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
// illisible la ou l'editeur est simplement introuvable.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Auteur de la derniere soumission. Distinct de jointureStatut, qui sert le
// statut sans son auteur : l'ecran affiche les deux. Meme LATERAL, meme index
// idx_workflow_entite.
const JOINTURE_SOUMETTEUR = `
  LEFT JOIN LATERAL (
    SELECT TRIM(CONCAT(u.prenom, ' ', u.nom)) AS soumis_par
      FROM workflow_validation w
      LEFT JOIN utilisateur u ON u.id = w.id_soumis_par
     WHERE w.entite_type = 'editeur' AND w.entite_id = e.id
     ORDER BY w.created_at DESC, w.id DESC
     LIMIT 1
  ) wa ON true`;

// Projection identique en liste et en detail : garantit qu'aucun champ
// n'apparaisse dans un ecran et pas dans l'autre.
// nb_contrats se compte en SQL, les contrats vivant dans la meme base.
// nb_produits n'y est pas : il additionne le catalogue Commune et les produits
// client du Tenant, il est calcule apres lecture.
const SELECT_EDITEUR = `
  SELECT e.id, e.raison_sociale, e.pays,
         e.taux_hausse_annuelle::float8 AS taux_hausse_annuelle,
         e.url_logo_defaut, e.url_logo_custom,
         e.created_at, e.updated_at,
         (SELECT count(*) FROM contrat c WHERE c.id_editeur = e.id)::int AS nb_contrats,
         wa.soumis_par,
         ${COLONNES_STATUT}
  FROM editeur e
  ${jointureStatut("editeur", "e")}
  ${JOINTURE_SOUMETTEUR}`;

// Colonnes metier ecrivables, dans l'ordre des parametres d'INSERT et d'UPDATE.
const CHAMPS = ["raison_sociale", "pays", "taux_hausse_annuelle", "url_logo_custom"];

// Un <input> vide envoie "" et non null. Sans cette normalisation, "" part sur
// une colonne DECIMAL et produit une 22P02 brute remontee en 500.
function normaliserCorps(body = {}) {
  const vide = (v) => (v === "" || v === undefined ? null : v);
  const taux = vide(body.taux_hausse_annuelle);
  return {
    raison_sociale: body.raison_sociale ?? "",
    pays: vide(body.pays),
    taux_hausse_annuelle: taux === null ? null : Number(taux),
    url_logo_custom: vide(body.url_logo_custom),
  };
}

// L'unicite est portee par uq_editeur_raison_sociale (migration 039). Ce
// controle applicatif ne la remplace pas, il la double pour rendre un 409
// lisible la ou la contrainte produirait une 23505 en 500. Le filet reste pose
// dans le catch de chaque ecriture, pour la course entre deux requetes.
async function raisonSocialePrise(client, raisonSociale, idExclu) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM editeur
      WHERE lower(raison_sociale) = lower($1) AND ($2::uuid IS NULL OR id <> $2)
      LIMIT 1`,
    [raisonSociale.trim(), idExclu || null]);
  return rowCount > 0;
}

async function validerEditeur(client, corps, idExclu) {
  const { raison_sociale, taux_hausse_annuelle } = corps;

  if (!raison_sociale || !raison_sociale.trim())
    return { status: 400, code: 5211, error: "La raison sociale est obligatoire." };
  if (taux_hausse_annuelle !== null &&
      (!Number.isFinite(taux_hausse_annuelle) || taux_hausse_annuelle < 0))
    return { status: 400, code: 5211, error: "Le taux de hausse annuelle doit etre un nombre positif ou nul." };
  if (await raisonSocialePrise(client, raison_sociale, idExclu))
    return { status: 409, code: 5212, error: "Un editeur porte deja cette raison sociale." };
  return null;
}

// Violation de uq_editeur_raison_sociale : deux creations concurrentes passent
// le controle applicatif et se croisent sur la contrainte.
function conflitUnicite(err) {
  return err?.code === "23505" && String(err.constraint || "").includes("editeur_raison_sociale");
}

// ---- Resolutions inter-bases -----------------------------------------------

// Produits du catalogue global par editeur. Le catalogue vit en Commune,
// l'editeur en Tenant : le rapprochement est applicatif, id_editeur y etant une
// reference logique sans FK (001_commune_schema.sql:30).
async function produitsCatalogueParEditeur() {
  const { rows } = await commonPool.query(
    `SELECT id, id_editeur, label, sku FROM produit_referentiel
      WHERE id_editeur IS NOT NULL ORDER BY label`);
  const parEditeur = new Map();
  for (const p of rows) {
    const l = parEditeur.get(p.id_editeur) ?? [];
    l.push({ id: p.id, label: p.label, sku: p.sku, source: "catalogue" });
    parEditeur.set(p.id_editeur, l);
  }
  return parEditeur;
}

async function produitsClientParEditeur(client) {
  const { rows } = await client.query(
    `SELECT id, id_editeur, label FROM produit_client
      WHERE id_editeur IS NOT NULL ORDER BY label`);
  const parEditeur = new Map();
  for (const p of rows) {
    const l = parEditeur.get(p.id_editeur) ?? [];
    l.push({ id: p.id, label: p.label, sku: null, source: "client" });
    parEditeur.set(p.id_editeur, l);
  }
  return parEditeur;
}

// Conformite agregee par editeur. La balance se calcule par produit cote
// Tenant ; l'editeur d'un produit se lit en Commune pour le catalogue et en
// Tenant pour les produits client. Le regroupement se fait donc ici.
// Un editeur dont aucun produit ne porte de licence n'a rien a rapprocher :
// il ressort avec niveau null plutot qu'avec un faux conforme, et l'ecran
// affiche un etat neutre.
async function conformiteParEditeur(client, editeurDeProduit) {
  const balance = await balanceParProduit(client);
  const agregat = new Map();
  for (const b of balance) {
    const idEditeur = editeurDeProduit.get(b.id_produit);
    if (!idEditeur) continue;
    const cumul = agregat.get(idEditeur) ?? { droits: 0, usage_declare: 0 };
    cumul.droits += b.droits;
    cumul.usage_declare += b.usage_declare;
    agregat.set(idEditeur, cumul);
  }
  const parEditeur = new Map();
  for (const [idEditeur, cumul] of agregat) {
    parEditeur.set(idEditeur, {
      droits: cumul.droits,
      usage_declare: cumul.usage_declare,
      niveau: niveauConformite(cumul.droits, cumul.usage_declare),
    });
  }
  return parEditeur;
}

// Index produit -> editeur, les deux bases confondues.
function indexEditeurDeProduit(catalogue, client) {
  const index = new Map();
  for (const [idEditeur, produits] of catalogue) {
    for (const p of produits) index.set(p.id, idEditeur);
  }
  for (const [idEditeur, produits] of client) {
    for (const p of produits) index.set(p.id, idEditeur);
  }
  return index;
}

// Enrichissement commun a la liste et au detail.
function enrichir(ligne, catalogue, produitsClient, conformite) {
  const produits = [...(catalogue.get(ligne.id) ?? []), ...(produitsClient.get(ligne.id) ?? [])];
  return {
    ...ligne,
    nb_produits: produits.length,
    conformite: conformite.get(ligne.id) ?? null,
  };
}

// ---- Lecture ----------------------------------------------------------------

router.get("/editeurs", async (req, res) => {
  try {
    const [{ rows }, catalogue, produitsClient] = await Promise.all([
      tenantPool.query(`${SELECT_EDITEUR} ORDER BY e.raison_sociale`),
      produitsCatalogueParEditeur(),
      produitsClientParEditeur(tenantPool),
    ]);
    const conformite = await conformiteParEditeur(
      tenantPool, indexEditeurDeProduit(catalogue, produitsClient));

    succes(res, 5200, rows.map((r) => enrichir(r, catalogue, produitsClient, conformite)));
  } catch (err) {
    console.error("GET /editeurs error", err);
    erreur(res, 5299, { status: 500, message: "Erreur serveur" });
  }
});

// Recherche incrementale, appelee au fil de la frappe par le formulaire.
//
// Raison d'etre : le referentiel peut compter des milliers d'editeurs. Personne
// ne peut verifier de visu qu'un editeur en est absent, et le doublon nait de
// cette impossibilite, pas d'une inattention. Montrer les correspondances
// pendant la saisie evite la creation en double, la contrainte d'unicite
// n'arrivant sinon qu'a l'enregistrement, une fois le formulaire rempli.
//
// Volontairement pauvre et rapide : ni compteurs ni conformite, contrairement a
// la liste, qui interroge les deux bases. Une frappe ne doit couter qu'une
// seule requete, bornee par LIMIT.
//
// Montee en charge : le joker en tete du ILIKE interdit l'usage de
// uq_editeur_raison_sociale, la recherche est donc un parcours sequentiel. Sur
// quelques milliers de lignes il se compte en millisecondes et le debounce du
// front espace les appels. Au-dela, la reponse est un index trigramme :
//   CREATE EXTENSION pg_trgm;
//   CREATE INDEX idx_editeur_raison_sociale_trgm
//     ON editeur USING gin (raison_sociale gin_trgm_ops);
// Non pose ici : l'extension demande des droits que le role applicatif n'a pas
// forcement, et la mesure doit preceder l'optimisation.
//
// Declaree avant /editeurs/:id : la route parametree capturerait sinon
// "recherche" comme un identifiant. Meme regle cote routesPermissions.js.
router.get("/editeurs/recherche", async (req, res) => {
  try {
    const brut = typeof req.query.q === "string" ? req.query.q.trim() : "";
    // Une saisie vide ne suggere rien : renvoyer le referentiel entier a chaque
    // ouverture du formulaire n'aiderait personne et couterait cher.
    if (!brut) return succes(res, 5205, { suggestions: [], total: 0 });

    // % et _ sont les jokers de ILIKE : sans echappement, un client tapant
    // "100%" interrogerait le referentiel avec un joker au milieu de son texte.
    const motif = brut.replace(/([\\%_])/g, "\\$1");

    // exclure : l'editeur en cours de modification ne se signale pas a
    // lui-meme comme un doublon de lui-meme.
    const exclu = UUID_RE.test(String(req.query.exclure ?? "")) ? req.query.exclure : null;
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 8, 1), 25);

    // count(*) OVER () : le total des correspondances sans seconde requete, pour
    // que l'ecran puisse dire combien de resultats ne sont pas montres.
    // L'ordre place la correspondance exacte en tete, puis celles qui commencent
    // par le texte saisi, puis le reste.
    const { rows } = await tenantPool.query(
      `SELECT e.id, e.raison_sociale, e.pays, e.url_logo_defaut, e.url_logo_custom,
              lower(e.raison_sociale) = lower($1) AS exact,
              count(*) OVER ()::int AS total
         FROM editeur e
        WHERE e.raison_sociale ILIKE '%' || $2 || '%' ESCAPE '\\'
          AND ($3::uuid IS NULL OR e.id <> $3)
        ORDER BY CASE
                   WHEN lower(e.raison_sociale) = lower($1)      THEN 0
                   WHEN e.raison_sociale ILIKE $2 || '%' ESCAPE '\\' THEN 1
                   ELSE 2
                 END,
                 e.raison_sociale
        LIMIT $4`,
      [brut, motif, exclu, limite]);

    const total = rows.length ? rows[0].total : 0;
    succes(res, 5205, {
      suggestions: rows.map(({ total: _total, ...e }) => e),
      total,
    });
  } catch (err) {
    console.error("GET /editeurs/recherche error", err);
    erreur(res, 5299, { status: 500, message: "Erreur serveur" });
  }
});

router.get("/editeurs/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (!UUID_RE.test(id)) return erreur(res, 5210, { status: 404, message: "Editeur introuvable." });

    const { rows } = await tenantPool.query(`${SELECT_EDITEUR} WHERE e.id = $1`, [id]);
    if (!rows.length) return erreur(res, 5210, { status: 404, message: "Editeur introuvable." });

    const [catalogue, produitsClient] = await Promise.all([
      produitsCatalogueParEditeur(),
      produitsClientParEditeur(tenantPool),
    ]);
    const conformite = await conformiteParEditeur(
      tenantPool, indexEditeurDeProduit(catalogue, produitsClient));

    const produits = [...(catalogue.get(id) ?? []), ...(produitsClient.get(id) ?? [])];
    const base = enrichir(rows[0], catalogue, produitsClient, conformite);

    // supprimable : l'API fait foi, le front n'affiche Supprimer que sur sa
    // reponse. Memes rattachements que le garde-fou du DELETE.
    succes(res, 5201, {
      ...base,
      produits,
      supprimable: base.nb_contrats === 0 && produits.length === 0,
    });
  } catch (err) {
    console.error("GET /editeurs/:id error", err);
    erreur(res, 5299, { status: 500, message: "Erreur serveur" });
  }
});

// ---- Ecriture ---------------------------------------------------------------

router.post("/editeurs", async (req, res) => {
  const corps = normaliserCorps(req.body);
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const invalide = await validerEditeur(client, corps, null);
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    const raisonSociale = corps.raison_sociale.trim();
    const { rows: [cree] } = await client.query(
      `INSERT INTO editeur (${CHAMPS.join(", ")}) VALUES ($1, $2, $3, $4) RETURNING id`,
      [raisonSociale, corps.pays, corps.taux_hausse_annuelle, corps.url_logo_custom]);

    // Toute saisie part en attente de validation, dans la meme transaction que
    // l'ecriture metier : un editeur cree sans son entree de workflow serait
    // invisible du controle, donc jamais validable.
    await soumettre(client, "editeur", cree.id, req.user?.id);

    await log(client, req, "CREATE", "editeur", cree.id,
      `Creation de l'editeur "${raisonSociale}"`, corps);
    // code_retour: 5290
    await auditer(client, req, {
      action: "EDITEUR_CREE", entiteType: "editeur", entiteId: cree.id,
      apres: { ...corps, raison_sociale: raisonSociale },
    });

    const { rows } = await client.query(`${SELECT_EDITEUR} WHERE e.id = $1`, [cree.id]);
    await client.query("COMMIT");

    succes(res, 5202, { ...rows[0], nb_produits: 0, conformite: null }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    if (conflitUnicite(err)) {
      return erreur(res, 5212, { status: 409, message: "Un editeur porte deja cette raison sociale." });
    }
    console.error("POST /editeurs error", err);
    erreur(res, 5299, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/editeurs/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return erreur(res, 5210, { status: 404, message: "Editeur introuvable." });
    }

    const { rows: existant } = await client.query(
      `SELECT raison_sociale, pays, taux_hausse_annuelle::float8 AS taux_hausse_annuelle,
              url_logo_custom
         FROM editeur WHERE id = $1`, [id]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      return erreur(res, 5210, { status: 404, message: "Editeur introuvable." });
    }

    // Fusion avant validation : un PATCH partiel ne doit pas echouer sur un
    // champ obligatoire qui n'a simplement pas ete transmis.
    const patch = normaliserCorps(req.body);
    const corps = { ...existant[0] };
    for (const champ of CHAMPS) {
      if (Object.prototype.hasOwnProperty.call(req.body, champ)) corps[champ] = patch[champ];
    }

    const invalide = await validerEditeur(client, corps, id);
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    const raisonSociale = corps.raison_sociale.trim();
    await client.query(
      `UPDATE editeur
          SET raison_sociale = $1, pays = $2, taux_hausse_annuelle = $3, url_logo_custom = $4
        WHERE id = $5`,
      [raisonSociale, corps.pays, corps.taux_hausse_annuelle, corps.url_logo_custom, id]);

    // Une modification est une saisie : un editeur valide qui change repasse en
    // attente, sans comparaison avant/apres. Decision de la #53.
    await soumettre(client, "editeur", id, req.user?.id);

    await log(client, req, "UPDATE", "editeur", id,
      `Modification de l'editeur "${raisonSociale}"`, patch);
    // Trace probante : seuls les champs reellement modifies, jamais le corps
    // fusionne, sinon on lirait "mis a null" sur les champs conserves.
    // code_retour: 5291
    const d = diff(existant[0], { ...corps, raison_sociale: raisonSociale });
    await auditer(client, req, {
      action: "EDITEUR_MODIFIE", entiteType: "editeur", entiteId: id,
      avant: d.avant, apres: d.apres,
    });

    const { rows } = await client.query(`${SELECT_EDITEUR} WHERE e.id = $1`, [id]);
    await client.query("COMMIT");

    succes(res, 5203, rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    if (conflitUnicite(err)) {
      return erreur(res, 5212, { status: 409, message: "Un editeur porte deja cette raison sociale." });
    }
    console.error("PATCH /editeurs/:id error", err);
    erreur(res, 5299, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/editeurs/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return erreur(res, 5210, { status: 404, message: "Editeur introuvable." });
    }

    const { rows: existant } = await client.query(
      `SELECT raison_sociale, pays, taux_hausse_annuelle::float8 AS taux_hausse_annuelle
         FROM editeur WHERE id = $1`, [id]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      return erreur(res, 5210, { status: 404, message: "Editeur introuvable." });
    }

    // Rattachements bloquants. Les trois premiers sont des FK reelles vers
    // editeur(id) et feraient echouer le DELETE en 23503 brute ; le quatrieme
    // vit en Commune, ou aucune FK ne protege quoi que ce soit : sans ce
    // controle, la suppression laisserait des produits du catalogue pointant
    // vers un editeur disparu.
    const { rows: [liens] } = await client.query(
      `SELECT (SELECT count(*) FROM contrat        WHERE id_editeur = $1)::int AS contrats,
              (SELECT count(*) FROM produit_client WHERE id_editeur = $1)::int AS produits_client,
              (SELECT count(*) FROM precalcul_financier  WHERE id_editeur = $1)::int AS precalculs_financiers,
              (SELECT count(*) FROM precalcul_conformite WHERE id_editeur = $1)::int AS precalculs_conformite`,
      [id]);
    const { rows: [catalogue] } = await commonPool.query(
      `SELECT count(*)::int AS produits_catalogue FROM produit_referentiel WHERE id_editeur = $1`, [id]);

    const bloquants = [];
    if (liens.contrats) bloquants.push(`${liens.contrats} contrat(s)`);
    const produits = liens.produits_client + catalogue.produits_catalogue;
    if (produits) bloquants.push(`${produits} logiciel(s)`);
    if (liens.precalculs_financiers || liens.precalculs_conformite) {
      bloquants.push("des agregats de conformite ou financiers");
    }

    if (bloquants.length) {
      await client.query("ROLLBACK");
      return erreur(res, 5213, {
        status: 409,
        message: `Suppression impossible : cet editeur porte ${bloquants.join(", ")}.`,
        details: { ...liens, produits_catalogue: catalogue.produits_catalogue },
      });
    }

    // workflow_validation.entite_id est polymorphe et sans FK : le nettoyage est
    // applicatif, dans la meme transaction que la suppression.
    await purgerValidations(client, "editeur", id);
    await client.query(`DELETE FROM editeur WHERE id = $1`, [id]);

    await log(client, req, "DELETE", "editeur", id,
      `Suppression de l'editeur "${existant[0].raison_sociale}"`, null);
    // code_retour: 5292
    await auditer(client, req, {
      action: "EDITEUR_SUPPRIME", entiteType: "editeur", entiteId: id, avant: existant[0],
    });

    await client.query("COMMIT");
    succes(res, 5204, null);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /editeurs/:id error", err);
    erreur(res, 5299, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
