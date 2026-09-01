// logiciels - referentiel des produits, ecran Referentiels > Logiciels (module 1).
//
// Deux tables sous un seul ecran, et c'est la doctrine posee en 001 et 002 :
//   - produit_referentiel (BDD Commune) est le catalogue global maintenu par
//     SamSecure, partage entre tous les clients en lecture seule. Aucune
//     ecriture ne part d'ici : une modification faite depuis un espace client
//     s'imposerait a tous les autres.
//   - produit_client (BDD Tenant) porte les logiciels propres au client.
//     C'est la seule table que ce routeur ecrit.
// La reponse porte donc source, catalogue ou client, et le front n'ouvre
// l'edition que sur les seconds. Toute ecriture visant un identifiant du
// catalogue est refusee en 409, jamais silencieusement ignoree.
//
// Aucune jointure ne traverse les deux bases : la fusion, la resolution des
// editeurs et le comptage des licences sont applicatifs, en une requete par
// reponse et jamais par ligne, comme referentielsLicences.js et inventaire.js.
//
// Distinct de GET /produits (referentielsLicences.js), qui sert le seul
// catalogue global au selecteur du formulaire licence et reste inchange.
//
// Enveloppe normalisee, codes 5300-5399 seedes par la migration 041.
import express from "express";
import { tenantPool, commonPool } from "../db.js";
import { succes, erreur, erreurPivot } from "../utils/reponse.js";
import { auditer, diff } from "../utils/audit.js";
import { soumettre, purgerValidations, jointureStatut, COLONNES_STATUT } from "../utils/validationWorkflow.js";

const router = express.Router();

// Convention du projet : helper de journalisation local a chaque routeur.
// Il avale ses erreurs, une trace fonctionnelle manquante ne doit pas annuler
// l'ecriture.
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Auteur de la derniere soumission, en pendant de jointureStatut qui sert le
// statut sans son auteur.
const JOINTURE_SOUMETTEUR = `
  LEFT JOIN LATERAL (
    SELECT TRIM(CONCAT(u.prenom, ' ', u.nom)) AS soumis_par
      FROM workflow_validation w
      LEFT JOIN utilisateur u ON u.id = w.id_soumis_par
     WHERE w.entite_type = 'produit_client' AND w.entite_id = p.id
     ORDER BY w.created_at DESC, w.id DESC
     LIMIT 1
  ) wa ON true`;

const SELECT_PRODUIT_CLIENT = `
  SELECT p.id, p.label, p.id_editeur, p.id_produit_parent,
         p.created_at, p.updated_at,
         wa.soumis_par,
         ${COLONNES_STATUT}
  FROM produit_client p
  ${jointureStatut("produit_client", "p")}
  ${JOINTURE_SOUMETTEUR}`;

const CHAMPS = ["label", "id_editeur", "id_produit_parent"];

function normaliserCorps(body = {}) {
  const vide = (v) => (v === "" || v === undefined ? null : v);
  return {
    label: body.label ?? "",
    id_editeur: vide(body.id_editeur),
    id_produit_parent: vide(body.id_produit_parent),
  };
}

// ---- Lectures et resolutions ------------------------------------------------

// Declinaisons d'une base, indexees par produit. Sert les quatre tables :
// version et edition en Commune, version_client et edition_client en Tenant.
async function declinaisons(client, table) {
  const { rows } = await client.query(
    `SELECT id, id_produit, label FROM ${table} ORDER BY label`);
  const index = new Map();
  for (const d of rows) {
    const l = index.get(d.id_produit) ?? [];
    l.push({ id: d.id, label: d.label });
    index.set(d.id_produit, l);
  }
  return index;
}

// Editeurs resolus en une passe. Les produits du catalogue portent un
// id_editeur qui vise la BDD Tenant sans FK possible : un identifiant inconnu
// ressort avec un libelle null plutot qu'en erreur.
async function editeursParId() {
  const { rows } = await tenantPool.query(
    `SELECT id, raison_sociale, url_logo_defaut, url_logo_custom FROM editeur`);
  return new Map(rows.map((e) => [e.id, e]));
}

// Licences par produit. licence.id_produit est polymorphe : il designe un
// produit du catalogue ou un produit client, sans FK ni discriminant
// (inventaire.js:56). Le comptage vaut donc pour les deux.
async function licencesParProduit(client) {
  const { rows } = await client.query(
    `SELECT id_produit, count(*)::int AS nb FROM licence
      WHERE id_produit IS NOT NULL GROUP BY id_produit`);
  return new Map(rows.map((r) => [r.id_produit, r.nb]));
}

function habiller(ligne, source, editeurs, versions, editions, licences) {
  const e = ligne.id_editeur ? editeurs.get(ligne.id_editeur) : null;
  return {
    ...ligne,
    source,
    editeur_label: e?.raison_sociale ?? null,
    editeur_url_logo_defaut: e?.url_logo_defaut ?? null,
    editeur_url_logo_custom: e?.url_logo_custom ?? null,
    versions: versions.get(ligne.id) ?? [],
    editions: editions.get(ligne.id) ?? [],
    nb_licences: licences.get(ligne.id) ?? 0,
    // Le catalogue global ne se modifie pas depuis un espace client : l'API
    // fait foi, le front n'affiche Editer et Supprimer que sur sa reponse.
    modifiable: source === "client",
  };
}

// Catalogue global. Les produits n'ont pas de statut de validation : ils ne
// sont pas saisis par le client, ils lui sont livres.
async function chargerCatalogue(editeurs, licences) {
  const [{ rows }, versions, editions] = await Promise.all([
    commonPool.query(
      `SELECT id, label, sku, id_editeur, id_produit_parent, created_at
         FROM produit_referentiel ORDER BY label`),
    declinaisons(commonPool, "version"),
    declinaisons(commonPool, "edition"),
  ]);
  return rows.map((r) => habiller(
    { ...r, updated_at: null, soumis_par: null, statut_validation: null,
      statut_validation_label: null, message_refus: null },
    "catalogue", editeurs, versions, editions, licences));
}

async function chargerProduitsClient(editeurs, licences, filtreSql = "", params = []) {
  const [{ rows }, versions, editions] = await Promise.all([
    tenantPool.query(`${SELECT_PRODUIT_CLIENT} ${filtreSql} ORDER BY p.label`, params),
    declinaisons(tenantPool, "version_client"),
    declinaisons(tenantPool, "edition_client"),
  ]);
  return rows.map((r) => habiller({ ...r, sku: null }, "client", editeurs, versions, editions, licences));
}

// ---- Validation -------------------------------------------------------------

async function existeTenant(client, table, id) {
  if (!id) return true;
  const { rowCount } = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return rowCount > 0;
}

// Le parent peut vivre dans l'une ou l'autre base : produit_client.id_produit_parent
// est une reference logique sans FK, precisement pour qu'un logiciel maison
// puisse se rattacher a une suite du catalogue global (002_tenant_schema.sql:290).
async function parentExiste(client, idParent) {
  if (!idParent) return true;
  if (await existeTenant(client, "produit_client", idParent)) return true;
  const { rowCount } = await commonPool.query(
    `SELECT 1 FROM produit_referentiel WHERE id = $1`, [idParent]);
  return rowCount > 0;
}

// Cycle : on remonte la chaine des parents depuis le parent vise. Si l'on
// retombe sur le produit modifie, le rattachement fermerait une boucle.
// La remontee s'arrete au premier parent du catalogue : il n'est pas modifiable
// depuis ici, sa propre hierarchie est protegee par une FK auto-referencee et
// ne peut donc pas redescendre vers un produit client.
// En creation (idProduit null), le controle est sans objet.
async function fermeUneBoucle(client, idParent, idProduit) {
  if (!idParent || !idProduit) return false;
  const { rows } = await client.query(`SELECT id, id_produit_parent FROM produit_client`);
  const parentDe = new Map(rows.map((r) => [r.id, r.id_produit_parent]));
  const vus = new Set();
  let courant = idParent;
  while (courant) {
    if (courant === idProduit) return true;
    if (vus.has(courant)) return false;  // boucle preexistante, sans rapport
    vus.add(courant);
    courant = parentDe.get(courant) ?? null;
  }
  return false;
}

async function validerProduit(client, corps, idProduit) {
  const { label, id_editeur, id_produit_parent } = corps;

  if (!label || !label.trim())
    return { status: 400, code: 5311, error: "Le libelle est obligatoire." };
  if (!(await existeTenant(client, "editeur", id_editeur)))
    return { status: 400, code: 5312, error: "Editeur introuvable." };
  if (!(await parentExiste(client, id_produit_parent)))
    return { status: 400, code: 5313, error: "Produit parent introuvable." };
  if (idProduit && id_produit_parent === idProduit)
    return { status: 409, code: 5314, error: "Un produit ne peut pas etre son propre parent." };
  if (await fermeUneBoucle(client, id_produit_parent, idProduit))
    return { status: 409, code: 5315, error: "Ce rattachement fermerait une boucle dans la hierarchie." };
  return null;
}

// Barriere commune a toutes les ecritures : l'identifiant doit designer un
// produit client existant. Un identifiant du catalogue global rend 409 et non
// 404 : le produit existe, c'est l'ecriture qui n'a pas lieu d'etre.
async function chargerProduitClientEcrivable(client, id) {
  if (!UUID_RE.test(id)) {
    return { erreur: { status: 404, code: 5310, error: "Logiciel introuvable." } };
  }
  const { rows } = await client.query(
    `SELECT id, label, id_editeur, id_produit_parent FROM produit_client WHERE id = $1`, [id]);
  if (rows.length) return { produit: rows[0] };

  const { rowCount } = await commonPool.query(
    `SELECT 1 FROM produit_referentiel WHERE id = $1`, [id]);
  if (rowCount) {
    return { erreur: { status: 409, code: 5316,
      error: "Le catalogue commun n'est pas modifiable depuis un espace client." } };
  }
  return { erreur: { status: 404, code: 5310, error: "Logiciel introuvable." } };
}

// ---- Lecture ----------------------------------------------------------------

router.get("/logiciels", async (req, res) => {
  try {
    const [editeurs, licences] = await Promise.all([editeursParId(), licencesParProduit(tenantPool)]);
    const [catalogue, client] = await Promise.all([
      chargerCatalogue(editeurs, licences),
      chargerProduitsClient(editeurs, licences),
    ]);
    // Tri unique sur le libelle : les deux origines se melent dans la liste et
    // dans l'arborescence, la source n'est qu'une colonne.
    const tous = [...catalogue, ...client].sort((a, b) =>
      a.label.localeCompare(b.label, "fr", { numeric: true }));
    succes(res, 5300, tous);
  } catch (err) {
    console.error("GET /logiciels error", err);
    erreur(res, 5399, { status: 500, message: "Erreur serveur" });
  }
});

router.get("/logiciels/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (!UUID_RE.test(id)) return erreur(res, 5310, { status: 404, message: "Logiciel introuvable." });

    const [editeurs, licences] = await Promise.all([editeursParId(), licencesParProduit(tenantPool)]);
    const [catalogue, client] = await Promise.all([
      chargerCatalogue(editeurs, licences),
      chargerProduitsClient(editeurs, licences),
    ]);
    const tous = [...catalogue, ...client];
    const produit = tous.find((p) => p.id === id);
    if (!produit) return erreur(res, 5310, { status: 404, message: "Logiciel introuvable." });

    const enfants = tous
      .filter((p) => p.id_produit_parent === id)
      .map((p) => ({ id: p.id, label: p.label, source: p.source }));
    const parent = produit.id_produit_parent
      ? tous.find((p) => p.id === produit.id_produit_parent) ?? null
      : null;

    succes(res, 5301, {
      ...produit,
      enfants,
      parent_label: parent?.label ?? null,
      // Un produit du catalogue n'est jamais supprimable depuis un espace
      // client, quels que soient ses rattachements.
      supprimable: produit.modifiable && produit.nb_licences === 0 && enfants.length === 0,
    });
  } catch (err) {
    console.error("GET /logiciels/:id error", err);
    erreur(res, 5399, { status: 500, message: "Erreur serveur" });
  }
});

// ---- Ecriture ---------------------------------------------------------------

router.post("/logiciels", async (req, res) => {
  const corps = normaliserCorps(req.body);
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const invalide = await validerProduit(client, corps, null);
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    const label = corps.label.trim();
    const { rows: [cree] } = await client.query(
      `INSERT INTO produit_client (${CHAMPS.join(", ")}) VALUES ($1, $2, $3) RETURNING id`,
      [label, corps.id_editeur, corps.id_produit_parent]);

    await soumettre(client, "produit_client", cree.id, req.user?.id);

    await log(client, req, "CREATE", "produit_client", cree.id,
      `Creation du logiciel "${label}"`, corps);
    // code_retour: 5330
    await auditer(client, req, {
      action: "PRODUIT_CLIENT_CREE", entiteType: "produit_client", entiteId: cree.id,
      apres: { ...corps, label },
    });

    const { rows } = await client.query(`${SELECT_PRODUIT_CLIENT} WHERE p.id = $1`, [cree.id]);
    await client.query("COMMIT");

    const editeurs = await editeursParId();
    succes(res, 5302,
      habiller({ ...rows[0], sku: null }, "client", editeurs, new Map(), new Map(), new Map()),
      { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /logiciels error", err);
    erreur(res, 5399, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/logiciels/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const cible = await chargerProduitClientEcrivable(client, id);
    if (cible.erreur) {
      await client.query("ROLLBACK");
      return erreurPivot(res, cible.erreur);
    }

    // Fusion avant validation : un PATCH partiel ne doit pas echouer sur un
    // champ obligatoire qui n'a simplement pas ete transmis.
    const patch = normaliserCorps(req.body);
    const avant = { label: cible.produit.label, id_editeur: cible.produit.id_editeur,
                    id_produit_parent: cible.produit.id_produit_parent };
    const corps = { ...avant };
    for (const champ of CHAMPS) {
      if (Object.prototype.hasOwnProperty.call(req.body, champ)) corps[champ] = patch[champ];
    }

    const invalide = await validerProduit(client, corps, id);
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    const label = corps.label.trim();
    await client.query(
      `UPDATE produit_client SET label = $1, id_editeur = $2, id_produit_parent = $3 WHERE id = $4`,
      [label, corps.id_editeur, corps.id_produit_parent, id]);

    await soumettre(client, "produit_client", id, req.user?.id);

    await log(client, req, "UPDATE", "produit_client", id,
      `Modification du logiciel "${label}"`, patch);
    // code_retour: 5331
    const d = diff(avant, { ...corps, label });
    await auditer(client, req, {
      action: "PRODUIT_CLIENT_MODIFIE", entiteType: "produit_client", entiteId: id,
      avant: d.avant, apres: d.apres,
    });

    const { rows } = await client.query(`${SELECT_PRODUIT_CLIENT} WHERE p.id = $1`, [id]);
    await client.query("COMMIT");

    const [editeurs, licences] = await Promise.all([editeursParId(), licencesParProduit(tenantPool)]);
    const [versions, editions] = await Promise.all([
      declinaisons(tenantPool, "version_client"),
      declinaisons(tenantPool, "edition_client"),
    ]);
    succes(res, 5303,
      habiller({ ...rows[0], sku: null }, "client", editeurs, versions, editions, licences));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /logiciels/:id error", err);
    erreur(res, 5399, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/logiciels/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const cible = await chargerProduitClientEcrivable(client, id);
    if (cible.erreur) {
      await client.query("ROLLBACK");
      return erreurPivot(res, cible.erreur);
    }

    // Les declinaisons partent en cascade avec le produit (FK ON DELETE
    // CASCADE, migration 040). Licences et sous-produits, eux, bloquent : rien
    // ne doit disparaitre sous les pieds du module 3.
    const { rows: [liens] } = await client.query(
      `SELECT (SELECT count(*) FROM licence        WHERE id_produit = $1)::int        AS licences,
              (SELECT count(*) FROM produit_client WHERE id_produit_parent = $1)::int AS sous_produits`,
      [id]);

    const bloquants = [];
    if (liens.licences) bloquants.push(`${liens.licences} licence(s)`);
    if (liens.sous_produits) bloquants.push(`${liens.sous_produits} sous-produit(s)`);

    if (bloquants.length) {
      await client.query("ROLLBACK");
      return erreur(res, 5317, {
        status: 409,
        message: `Suppression impossible : ce logiciel porte ${bloquants.join(", ")}.`,
        details: liens,
      });
    }

    await purgerValidations(client, "produit_client", id);
    await client.query(`DELETE FROM produit_client WHERE id = $1`, [id]);

    await log(client, req, "DELETE", "produit_client", id,
      `Suppression du logiciel "${cible.produit.label}"`, null);
    // code_retour: 5332
    await auditer(client, req, {
      action: "PRODUIT_CLIENT_SUPPRIME", entiteType: "produit_client", entiteId: id,
      avant: cible.produit,
    });

    await client.query("COMMIT");
    succes(res, 5304, null);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /logiciels/:id error", err);
    erreur(res, 5399, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// ---- Declinaisons des produits client ---------------------------------------

// version_client et edition_client se manipulent a l'identique : meme forme,
// meme unicite, memes controles. Un seul couple de handlers, parametre par le
// vocabulaire de chacune. Les noms de table sortent de ce catalogue et jamais
// d'un parametre de route.
const DECLINAISONS = {
  versions: {
    table: "version_client", singulier: "version", accord: "la version",
    codeAjout: 5305, codeRetrait: 5306,
    codeLabelManquant: 5318, codeDoublon: 5319, codeIntrouvable: 5322,
  },
  editions: {
    table: "edition_client", singulier: "edition", accord: "l'edition",
    codeAjout: 5307, codeRetrait: 5308,
    codeLabelManquant: 5320, codeDoublon: 5321, codeIntrouvable: 5323,
  },
};

function ajouterDeclinaison(type) {
  const d = DECLINAISONS[type];
  return async (req, res) => {
    const { id } = req.params;
    const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
    const client = await tenantPool.connect();
    try {
      await client.query("BEGIN");

      const cible = await chargerProduitClientEcrivable(client, id);
      if (cible.erreur) {
        await client.query("ROLLBACK");
        return erreurPivot(res, cible.erreur);
      }
      if (!label) {
        await client.query("ROLLBACK");
        return erreur(res, d.codeLabelManquant, { status: 400,
          message: `Le libelle de ${d.accord} est obligatoire.` });
      }

      const { rowCount: pris } = await client.query(
        `SELECT 1 FROM ${d.table} WHERE id_produit = $1 AND lower(label) = lower($2)`, [id, label]);
      if (pris) {
        await client.query("ROLLBACK");
        return erreur(res, d.codeDoublon, { status: 409,
          message: `Cette ${d.singulier} existe deja pour ce logiciel.` });
      }

      const { rows: [creee] } = await client.query(
        `INSERT INTO ${d.table} (id_produit, label) VALUES ($1, $2) RETURNING id, label`, [id, label]);

      await log(client, req, "CREATE", d.table, creee.id,
        `Ajout de ${d.accord} "${label}" au logiciel "${cible.produit.label}"`, { id_produit: id, label });

      await client.query("COMMIT");
      succes(res, d.codeAjout, creee, { status: 201 });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`POST /logiciels/:id/${type} error`, err);
      erreur(res, 5399, { status: 500, message: "Erreur serveur" });
    } finally {
      client.release();
    }
  };
}

function retirerDeclinaison(type) {
  const d = DECLINAISONS[type];
  return async (req, res) => {
    const { id, idDeclinaison } = req.params;
    const client = await tenantPool.connect();
    try {
      await client.query("BEGIN");

      const cible = await chargerProduitClientEcrivable(client, id);
      if (cible.erreur) {
        await client.query("ROLLBACK");
        return erreurPivot(res, cible.erreur);
      }
      if (!UUID_RE.test(idDeclinaison)) {
        await client.query("ROLLBACK");
        return erreur(res, d.codeIntrouvable, { status: 404,
          message: `${d.singulier.charAt(0).toUpperCase()}${d.singulier.slice(1)} introuvable.` });
      }

      // Le produit est dans la clause : une declinaison d'un autre produit ne
      // se supprime pas par cette route.
      const { rows } = await client.query(
        `DELETE FROM ${d.table} WHERE id = $1 AND id_produit = $2 RETURNING label`,
        [idDeclinaison, id]);
      if (!rows.length) {
        await client.query("ROLLBACK");
        return erreur(res, d.codeIntrouvable, { status: 404,
          message: `${d.singulier.charAt(0).toUpperCase()}${d.singulier.slice(1)} introuvable.` });
      }

      await log(client, req, "DELETE", d.table, idDeclinaison,
        `Suppression de ${d.accord} "${rows[0].label}" du logiciel "${cible.produit.label}"`, null);

      await client.query("COMMIT");
      succes(res, d.codeRetrait, null);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`DELETE /logiciels/:id/${type}/:idDeclinaison error`, err);
      erreur(res, 5399, { status: 500, message: "Erreur serveur" });
    } finally {
      client.release();
    }
  };
}

router.post("/logiciels/:id/versions", ajouterDeclinaison("versions"));
router.delete("/logiciels/:id/versions/:idDeclinaison", retirerDeclinaison("versions"));
router.post("/logiciels/:id/editions", ajouterDeclinaison("editions"));
router.delete("/logiciels/:id/editions/:idDeclinaison", retirerDeclinaison("editions"));

export default router;
