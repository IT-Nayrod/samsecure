// Affectations, usage declare et revalidation (#106, M3-B).
//
// Une affectation est l'usage declare d'une licence par une societe, pour une
// quantite et une reference client (asset ou utilisateur nomme). Chaque
// saisie passe par le circuit de validation UNIQUE du module 2 : soumettre()
// insere l'entree en_attente, validation.js la traite, et le hook
// apresTraitement du catalogue ouvre le cycle de revalidation. Rien n'est
// duplique ici : ce routeur ne valide ni ne refuse.
import express from "express";
import { tenantPool, commonPool } from "../db.js";
import { succes, erreur, erreurPivot } from "../utils/reponse.js";
import { auditer, diff } from "../utils/audit.js";
import {
  jointureStatut, soumettre, purgerValidations, lireStatutCourant,
} from "../utils/validationWorkflow.js";
import {
  jointureRevalidation, COLONNES_REVALIDATION, ouvrirCycle, refleterStatut,
  historiser, lireAffectation,
} from "../utils/revalidation.js";

const router = express.Router();

// Convention du projet : helper de journalisation local a chaque routeur,
// id_auteur lu dans req.user (#68).
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

// Les produits vivent en BDD Commune : aucune jointure possible, l'API fait
// le pont. Une requete par reponse, jamais une par ligne.
async function libellesProduits(ids) {
  const uniques = [...new Set(ids.filter(Boolean))];
  if (!uniques.length) return new Map();
  const { rows } = await commonPool.query(
    `SELECT id, label, sku FROM produit_referentiel WHERE id = ANY($1::uuid[])`, [uniques]);
  return new Map(rows.map((r) => [r.id, r]));
}

function joindreProduits(rows, produits) {
  return rows.map((r) => ({
    ...r,
    produit_label: produits.get(r.id_produit)?.label ?? null,
    produit_sku: produits.get(r.id_produit)?.sku ?? null,
  }));
}

// jointureStatut() expose statut_validation brut sous l'alias wv ; les
// colonnes de sortie viennent de COLONNES_REVALIDATION, qui reecrivent le
// statut a la lecture (valide + echeance depassee = a_revalider).
const SELECT_AFFECTATION = `
  SELECT a.id, a.label, a.reference_client, a.quantite,
         a.id_licence,  l.label AS licence_label, l.id_produit, l.quantite AS licence_quantite,
         a.id_societe,  s.raison_sociale AS societe_label,
         COALESCE(s.delai_revalidation, 30) AS delai_revalidation,
         a.date_revalidation::text AS date_revalidation,
         a.created_at,
         ${COLONNES_REVALIDATION},
         ws.id_soumis_par, concat_ws(' ', us.prenom, us.nom) AS soumis_par,
         ws.id_traite_par, concat_ws(' ', ut.prenom, ut.nom) AS traite_par,
         ws.created_at AS date_soumission
  FROM affectation a
  LEFT JOIN licence l ON l.id = a.id_licence
  LEFT JOIN societe s ON s.id = a.id_societe
  ${jointureStatut("affectation", "a")}
  ${jointureRevalidation("a")}
  LEFT JOIN LATERAL (
    SELECT w.id_soumis_par, w.id_traite_par, w.created_at
      FROM workflow_validation w
     WHERE w.entite_type = 'affectation' AND w.entite_id = a.id
     ORDER BY w.created_at DESC, w.id DESC
     LIMIT 1
  ) ws ON true
  LEFT JOIN utilisateur us ON us.id = ws.id_soumis_par
  LEFT JOIN utilisateur ut ON ut.id = ws.id_traite_par`;

const ORDRE = `ORDER BY a.created_at DESC, a.reference_client`;

const CHAMPS = ["id_licence", "id_societe", "quantite", "reference_client"];

async function existe(client, table, id) {
  if (!id) return true;
  const { rowCount } = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return rowCount > 0;
}

// Un <select> vide envoie "" et non null : normalisation avant Postgres.
function normaliserCorps(body = {}) {
  const vide = (v) => (v === "" || v === undefined ? null : v);
  const quantite = vide(body.quantite);
  return {
    id_licence: vide(body.id_licence),
    id_societe: vide(body.id_societe),
    quantite: quantite === null ? null : Number(quantite),
    reference_client: typeof body.reference_client === "string" ? body.reference_client.trim() : vide(body.reference_client),
  };
}

async function validerAffectation(client, corps) {
  const { id_licence, id_societe, quantite, reference_client } = corps;
  if (!id_licence)
    return { status: 400, code: 4011, error: "La licence est obligatoire." };
  if (!UUID_RE.test(id_licence) || !(await existe(client, "licence", id_licence)))
    return { status: 400, code: 4012, error: "Licence introuvable." };
  if (!id_societe)
    return { status: 400, code: 4013, error: "La societe est obligatoire." };
  if (!UUID_RE.test(id_societe) || !(await existe(client, "societe", id_societe)))
    return { status: 400, code: 4014, error: "Societe introuvable." };
  // Doublon volontaire du CHECK quantite > 0 : un 400 lisible plutot qu'une
  // 23514 en 500.
  if (!Number.isInteger(quantite) || quantite <= 0)
    return { status: 400, code: 4015, error: "La quantite doit etre un entier strictement positif." };
  if (!reference_client)
    return { status: 400, code: 4016, error: "La reference client est obligatoire." };
  return null;
}

async function chargerUne(id) {
  const { rows } = await tenantPool.query(`${SELECT_AFFECTATION} WHERE a.id = $1`, [id]);
  if (!rows.length) return null;
  const produits = await libellesProduits([rows[0].id_produit]);
  return joindreProduits(rows, produits)[0];
}

// ---- Licences (lecture seule) ----------------------------------------------
// affectation.id_licence est NOT NULL et aucune route ne servait les licences :
// projection minimale pour le selecteur du formulaire et les libelles.
router.get("/licences", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(
      `SELECT l.id, l.label, l.id_produit, l.quantite, l.type,
              l.date_fin_souscription::text AS date_fin_souscription,
              l.id_commande, c.label AS commande_label,
              c.id_societe, s.raison_sociale AS societe_label,
              um.label AS unite_mesure_label
         FROM licence l
         LEFT JOIN commande c ON c.id = l.id_commande
         LEFT JOIN societe s ON s.id = c.id_societe
         LEFT JOIN unite_mesure um ON um.id = l.id_unite_mesure
        ORDER BY l.label, l.created_at`);
    const produits = await libellesProduits(rows.map((r) => r.id_produit));
    succes(res, 4008, joindreProduits(rows, produits));
  } catch (err) {
    console.error("GET /licences error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

// ---- Liste --------------------------------------------------------------------
// Filtres : societe, produit, licence, statut (en_attente, valide, refuse,
// a_revalider) et cycle (a_jour, a_revalider, depasse). Les deux derniers sont
// des statuts evalues a la lecture : ils se filtrent apres projection.
router.get("/affectations", async (req, res) => {
  try {
    const societe = req.query.id_societe || null;
    if (societe && !UUID_RE.test(societe))
      return erreur(res, 4017, { status: 400, message: "Identifiant de societe invalide." });
    const produit = req.query.id_produit || null;
    if (produit && !UUID_RE.test(produit))
      return erreur(res, 4018, { status: 400, message: "Identifiant de produit invalide." });
    const licence = req.query.id_licence || null;
    if (licence && !UUID_RE.test(licence))
      return erreur(res, 4019, { status: 400, message: "Identifiant de licence invalide." });

    const { rows } = await tenantPool.query(
      `${SELECT_AFFECTATION}
        WHERE ($1::uuid IS NULL OR a.id_societe = $1::uuid)
          AND ($2::uuid IS NULL OR l.id_produit = $2::uuid)
          AND ($3::uuid IS NULL OR a.id_licence = $3::uuid)
        ${ORDRE}`,
      [societe, produit, licence]);

    const statut = req.query.statut_validation || null;
    const cycle = req.query.statut_revalidation || null;
    const filtrees = rows.filter((r) =>
      (!statut || r.statut_validation === statut) &&
      (!cycle || r.statut_revalidation === cycle));

    const produits = await libellesProduits(filtrees.map((r) => r.id_produit));
    succes(res, 4000, joindreProduits(filtrees, produits));
  } catch (err) {
    console.error("GET /affectations error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

// ---- Decompte pour la conformite ---------------------------------------------
// Somme BRUTE des quantites des affectations dont la derniere entree du
// workflow est valide (ce qui inclut a_revalider, statut de lecture), par
// produit et societe, SANS deduplication par reference (hypothese v0.5).
// droits_total : somme des quantites de licence du produit, tous perimetres.
// Declaree avant /affectations/:id, sinon "decompte" serait pris pour un id.
router.get("/affectations/decompte", async (req, res) => {
  try {
    const societe = req.query.id_societe || null;
    if (societe && !UUID_RE.test(societe))
      return erreur(res, 4017, { status: 400, message: "Identifiant de societe invalide." });
    const produit = req.query.id_produit || null;
    if (produit && !UUID_RE.test(produit))
      return erreur(res, 4018, { status: 400, message: "Identifiant de produit invalide." });

    const { rows } = await tenantPool.query(
      `SELECT l.id_produit, a.id_societe, s.raison_sociale AS societe_label,
              sum(a.quantite)::int AS quantite_declaree,
              count(*)::int        AS nb_affectations,
              sum(CASE WHEN a.date_revalidation < CURRENT_DATE THEN a.quantite ELSE 0 END)::int
                AS quantite_a_revalider,
              (SELECT coalesce(sum(lx.quantite), 0)::int FROM licence lx WHERE lx.id_produit = l.id_produit)
                AS droits_total
         FROM affectation a
         JOIN licence l ON l.id = a.id_licence
         LEFT JOIN societe s ON s.id = a.id_societe
         ${jointureStatut("affectation", "a")}
        WHERE wv.statut_validation = 'valide'
          AND ($1::uuid IS NULL OR a.id_societe = $1::uuid)
          AND ($2::uuid IS NULL OR l.id_produit = $2::uuid)
        GROUP BY l.id_produit, a.id_societe, s.raison_sociale
        ORDER BY s.raison_sociale NULLS LAST, l.id_produit`,
      [societe, produit]);

    const produits = await libellesProduits(rows.map((r) => r.id_produit));
    const lignes = joindreProduits(rows, produits);

    // Total par produit toutes societes confondues : c'est la balance que le
    // front oppose aux droits acquis.
    const parProduit = new Map();
    for (const r of lignes) {
      const p = parProduit.get(r.id_produit) || {
        id_produit: r.id_produit, produit_label: r.produit_label, droits_total: r.droits_total,
        quantite_declaree: 0, quantite_a_revalider: 0, nb_affectations: 0,
      };
      p.quantite_declaree += r.quantite_declaree;
      p.quantite_a_revalider += r.quantite_a_revalider;
      p.nb_affectations += r.nb_affectations;
      parProduit.set(r.id_produit, p);
    }

    succes(res, 4006, {
      filtres: { id_societe: societe, id_produit: produit },
      regle: "somme brute des quantites, statuts valide et a_revalider, sans deduplication par reference",
      lignes,
      par_produit: [...parProduit.values()],
    });
  } catch (err) {
    console.error("GET /affectations/decompte error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

// ---- Historique des declarations par societe ---------------------------------
router.get("/affectations/historique", async (req, res) => {
  try {
    const societe = req.query.id_societe || null;
    if (societe && !UUID_RE.test(societe))
      return erreur(res, 4017, { status: 400, message: "Identifiant de societe invalide." });
    const affectation = req.query.id_affectation || null;
    if (affectation && !UUID_RE.test(affectation))
      return erreur(res, 4010, { status: 404, message: "Affectation introuvable." });

    const { rows } = await tenantPool.query(
      `SELECT h.id, h.id_societe, s.raison_sociale AS societe_label,
              h.id_utilisateur, concat_ws(' ', u.prenom, u.nom) AS utilisateur,
              h.action, h.entite_type, h.detail, h.created_at
         FROM historique_declaration h
         LEFT JOIN societe s ON s.id = h.id_societe
         LEFT JOIN utilisateur u ON u.id = h.id_utilisateur
        WHERE h.entite_type = 'affectation'
          AND ($1::uuid IS NULL OR h.id_societe = $1::uuid)
          AND ($2::uuid IS NULL OR (h.detail->>'id_affectation')::uuid = $2::uuid)
        ORDER BY h.created_at DESC
        LIMIT 500`,
      [societe, affectation]);
    succes(res, 4007, rows);
  } catch (err) {
    console.error("GET /affectations/historique error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

router.get("/affectations/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (!UUID_RE.test(id)) return erreur(res, 4010, { status: 404, message: "Affectation introuvable." });
    const aff = await chargerUne(id);
    if (!aff) return erreur(res, 4010, { status: 404, message: "Affectation introuvable." });

    const { rows: cycles } = await tenantPool.query(
      `SELECT date_derniere_validation::text AS date_derniere_validation,
              date_prochaine_revalidation::text AS date_prochaine_revalidation,
              created_at
         FROM revalidation WHERE id_affectation = $1
        ORDER BY created_at DESC, id DESC`, [id]);

    const { rows: soumissions } = await tenantPool.query(
      `SELECT w.id, vs.code AS statut, vs.label AS statut_label, w.message_refus, w.created_at,
              concat_ws(' ', us.prenom, us.nom) AS soumis_par, concat_ws(' ', ut.prenom, ut.nom) AS traite_par
         FROM workflow_validation w
         LEFT JOIN validation_status vs ON vs.id = w.id_statut
         LEFT JOIN utilisateur us ON us.id = w.id_soumis_par
         LEFT JOIN utilisateur ut ON ut.id = w.id_traite_par
        WHERE w.entite_type = 'affectation' AND w.entite_id = $1
        ORDER BY w.created_at DESC, w.id DESC`, [id]);

    succes(res, 4001, { ...aff, cycles, soumissions });
  } catch (err) {
    console.error("GET /affectations/:id error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

router.post("/affectations", async (req, res) => {
  const corps = normaliserCorps(req.body);
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const invalide = await validerAffectation(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    // label = reference client : c'est ce que validation.js lit pour ses
    // traces, et ce que la file du Manager DSI affiche.
    const { rows: [creee] } = await client.query(
      `INSERT INTO affectation (label, id_licence, id_societe, quantite, reference_client)
       VALUES ($1, $2, $3, $4, $1)
       RETURNING id`,
      [corps.reference_client, corps.id_licence, corps.id_societe, corps.quantite]);

    await soumettre(client, "affectation", creee.id, req.user?.id);
    await refleterStatut(client, creee.id, "en_attente");

    await historiser(client, {
      idSociete: corps.id_societe, idUtilisateur: req.user?.id, action: "CREATE",
      detail: { id_affectation: creee.id, ...corps },
    });
    await auditer(client, req, {
      action: "CREATE_AFFECTATION", entiteType: "affectation", entiteId: creee.id,
      avant: null, apres: corps,
    });
    await log(client, req, "CREATE", "affectation", creee.id,
      `Declaration de l'affectation "${corps.reference_client}"`, corps);
    await client.query("COMMIT");

    succes(res, 4002, await chargerUne(creee.id), { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /affectations error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/affectations/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return erreur(res, 4010, { status: 404, message: "Affectation introuvable." });
    }
    const avant = await lireAffectation(client, id);
    if (!avant) {
      await client.query("ROLLBACK");
      return erreur(res, 4010, { status: 404, message: "Affectation introuvable." });
    }

    const patch = normaliserCorps(req.body);
    const corps = {
      id_licence: avant.id_licence, id_societe: avant.id_societe,
      quantite: avant.quantite, reference_client: avant.reference_client,
    };
    for (const champ of CHAMPS) {
      if (Object.prototype.hasOwnProperty.call(req.body, champ)) corps[champ] = patch[champ];
    }

    const invalide = await validerAffectation(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    await client.query(
      `UPDATE affectation
          SET label = $1, reference_client = $1, id_licence = $2, id_societe = $3, quantite = $4
        WHERE id = $5`,
      [corps.reference_client, corps.id_licence, corps.id_societe, corps.quantite, id]);

    // Toute modification resoumet, comme le module 2 : l'echeance en cours
    // cesse d'etre opposable jusqu'a la nouvelle validation.
    await soumettre(client, "affectation", id, req.user?.id);
    await refleterStatut(client, id, "en_attente");

    const delta = diff(
      { id_licence: avant.id_licence, id_societe: avant.id_societe, quantite: avant.quantite, reference_client: avant.reference_client },
      corps);
    await historiser(client, {
      idSociete: corps.id_societe, idUtilisateur: req.user?.id, action: "UPDATE",
      detail: { id_affectation: id, reference_client: corps.reference_client, quantite: corps.quantite,
                id_licence: corps.id_licence, modifications: delta.apres },
    });
    // Changement de societe : la societe quittee garde aussi la trace.
    if (avant.id_societe && avant.id_societe !== corps.id_societe) {
      await historiser(client, {
        idSociete: avant.id_societe, idUtilisateur: req.user?.id, action: "UPDATE",
        detail: { id_affectation: id, reference_client: corps.reference_client,
                  transfert_vers: corps.id_societe },
      });
    }
    await auditer(client, req, {
      action: "UPDATE_AFFECTATION", entiteType: "affectation", entiteId: id,
      avant: delta.avant, apres: delta.apres,
    });
    await log(client, req, "UPDATE", "affectation", id,
      `Modification de l'affectation "${corps.reference_client}"`, delta.apres);
    await client.query("COMMIT");

    succes(res, 4003, await chargerUne(id));
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PATCH /affectations/:id error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/affectations/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return erreur(res, 4010, { status: 404, message: "Affectation introuvable." });
    }
    const avant = await lireAffectation(client, id);
    if (!avant) {
      await client.query("ROLLBACK");
      return erreur(res, 4010, { status: 404, message: "Affectation introuvable." });
    }

    // inventaire_raw.id_affectation est une FK sans cascade : un rapprochement
    // existant bloque, en 409 lisible plutot qu'en 23503.
    const { rows: [{ inventaires }] } = await client.query(
      `SELECT count(*)::int AS inventaires FROM inventaire_raw WHERE id_affectation = $1`, [id]);
    if (inventaires) {
      await client.query("ROLLBACK");
      return erreur(res, 4032, {
        status: 409,
        message: `Suppression impossible : cette affectation est rapprochee de ${inventaires} ligne(s) d'inventaire.`,
        details: { inventaires },
      });
    }

    await purgerValidations(client, "affectation", id);
    // revalidation suit par ON DELETE CASCADE.
    await client.query(`DELETE FROM affectation WHERE id = $1`, [id]);

    await historiser(client, {
      idSociete: avant.id_societe, idUtilisateur: req.user?.id, action: "DELETE",
      detail: { id_affectation: id, reference_client: avant.reference_client,
                quantite: avant.quantite, id_licence: avant.id_licence },
    });
    await auditer(client, req, {
      action: "DELETE_AFFECTATION", entiteType: "affectation", entiteId: id,
      avant: { id_licence: avant.id_licence, id_societe: avant.id_societe,
               quantite: avant.quantite, reference_client: avant.reference_client },
      apres: null,
    });
    await log(client, req, "DELETE", "affectation", id,
      `Suppression de l'affectation "${avant.reference_client}"`, null);
    await client.query("COMMIT");
    succes(res, 4004, null);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DELETE /affectations/:id error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// ---- Revalidation en un clic (Manager DSI) -----------------------------------
// Reconfirme un usage valide : nouveau cycle, nouvelle echeance. N'ecrit rien
// dans workflow_validation, dont la derniere entree reste valide : le circuit
// unique n'est pas alimente d'une entree fabriquee.
router.post("/affectations/:id/revalider", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return erreur(res, 4010, { status: 404, message: "Affectation introuvable." });
    }
    const aff = await lireAffectation(client, id);
    if (!aff) {
      await client.query("ROLLBACK");
      return erreur(res, 4010, { status: 404, message: "Affectation introuvable." });
    }

    const courant = await lireStatutCourant(client, "affectation", id, true);
    if (!courant || courant.statut !== "valide") {
      await client.query("ROLLBACK");
      return erreur(res, 4030, {
        status: 409,
        message: "Seule une affectation validee peut etre revalidee. Statut courant : " +
                 `${courant?.statut_label || courant?.statut || "aucune demande"}.`,
        details: { statut_validation: courant?.statut ?? null },
      });
    }

    const cycle = await ouvrirCycle(client, id);
    await historiser(client, {
      idSociete: aff.id_societe, idUtilisateur: req.user?.id, action: "REVALIDATION",
      detail: { id_affectation: id, reference_client: aff.reference_client, quantite: aff.quantite,
                id_licence: aff.id_licence, ...cycle },
    });
    await auditer(client, req, {
      action: "REVALIDATION_AFFECTATION", entiteType: "affectation", entiteId: id,
      avant: { date_revalidation: aff.date_revalidation },
      apres: { date_revalidation: cycle.date_prochaine_revalidation },
    });
    await log(client, req, "REVALIDATION", "affectation", id,
      `Revalidation de l'affectation "${aff.reference_client}"`, cycle);
    await client.query("COMMIT");

    succes(res, 4005, await chargerUne(id));
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /affectations/:id/revalider error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
