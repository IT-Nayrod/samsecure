// Notifications de l'utilisateur connecte (story #121).
//
// Routes personnelles : chaque requete est bornee a req.user.id, un
// utilisateur ne lit, ne marque et ne regle que les siennes. Le controle
// central (routesPermissions.js) les declare PUBLIC_AUTHENTIFIE, a
// l'exception du declenchement manuel du traitement planifie et de la
// relance volontaire des courriers, reserves au profil administrateur par
// gerer_connecteurs (meme convention que /mails/test) et traces dans
// audit_log.
//
// Codes 5500-5549 (migration Commune 052), enveloppe normalisee
// (utils/reponse.js).
import express from "express";
import { tenantPool } from "../db.js";
import { succes, erreur } from "../utils/reponse.js";
import {
  TYPES, TYPES_CODES, typeConnu, MODES_COURRIER, courrierDefaut, LIBELLES_MODES, destinatairesDefaut,
} from "../utils/notifications/catalogue.js";
import { executerManuellement } from "../utils/notifications/planificateur.js";
import { relancerCourriers } from "../utils/notifications/courriers.js";
import { traducteurPour } from "../utils/notifications/traductions.js";
import { auditer } from "../utils/audit.js";

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_DEFAUT = 50;
const LIMITE_MAX = 200;

const COLONNES = `
  n.id, n.type, n.titre, n.message, n.lien, n.gravite,
  n.statut, (n.statut = 'lu') AS lu,
  n.entite_type, n.entite_id, n.id_societe,
  n.created_at, n.lu_at,
  n.courrier_mode, n.courrier_statut, n.courrier_date`;

// ---------------------------------------------------------------------------
// GET /notifications?lu=true|false&page=1&limite=50
// Les notifications archivees (statut du schema 002, non employe par le
// module) ne sont jamais servies.
// ---------------------------------------------------------------------------
router.get("/notifications", async (req, res) => {
  try {
    const { lu, page: pageBrut, limite: limiteBrut } = req.query;
    let filtreLu = null;
    if (lu !== undefined && lu !== "") {
      if (lu === "true" || lu === "1") filtreLu = true;
      else if (lu === "false" || lu === "0") filtreLu = false;
      else return erreur(res, 5512, { status: 400 });
    }
    const page = pageBrut === undefined || pageBrut === "" ? 1 : Number(pageBrut);
    const limite = limiteBrut === undefined || limiteBrut === "" ? LIMITE_DEFAUT : Number(limiteBrut);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAX) {
      return erreur(res, 5513, { status: 400 });
    }

    const params = [req.user.id];
    let where = `n.id_utilisateur = $1 AND n.statut <> 'archive'`;
    if (filtreLu !== null) {
      params.push(filtreLu ? "lu" : "non_lu");
      where += ` AND n.statut = $${params.length}`;
    }
    const { rows: [compte] } = await tenantPool.query(
      `SELECT count(*)::int AS total,
              (count(*) FILTER (WHERE n.statut = 'non_lu'))::int AS non_lues
         FROM notification n WHERE n.id_utilisateur = $1 AND n.statut <> 'archive'`,
      [req.user.id]);
    params.push(limite, (page - 1) * limite);
    const { rows } = await tenantPool.query(
      `SELECT ${COLONNES} FROM notification n
        WHERE ${where}
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params);

    succes(res, 5500, {
      notifications: rows,
      page, limite,
      total: compte.total,
      non_lues: compte.non_lues,
      total_page: rows.length,
    });
  } catch (err) {
    console.error("GET /notifications error", err);
    erreur(res, 5549, { status: 500, message: "Erreur serveur" });
  }
});

// ---------------------------------------------------------------------------
// GET /notifications/compteur : non lues de l'utilisateur (cloche, 60 s)
// ---------------------------------------------------------------------------
router.get("/notifications/compteur", async (req, res) => {
  try {
    const { rows: [r] } = await tenantPool.query(
      `SELECT count(*)::int AS non_lues FROM notification
        WHERE id_utilisateur = $1 AND statut = 'non_lu'`, [req.user.id]);
    succes(res, 5501, { non_lues: r.non_lues });
  } catch (err) {
    console.error("GET /notifications/compteur error", err);
    erreur(res, 5549, { status: 500, message: "Erreur serveur" });
  }
});

// ---------------------------------------------------------------------------
// Preferences : tableau types x reglage du courrier. Absence de ligne =
// defaut du catalogue, renvoye avec source "defaut".
// ---------------------------------------------------------------------------
// Libelles servis dans la langue de l'utilisateur (referentiel
// langue/traduction, multilingue v1.1), repli sur le francais du catalogue.
async function traducteurUtilisateur(idUtilisateur) {
  const { rows } = await tenantPool.query(
    `SELECT langue FROM utilisateur WHERE id = $1`, [idUtilisateur]);
  const traduire = await traducteurPour(rows[0]?.langue);
  return (cle, defaut) => (traduire && traduire(cle)) || defaut;
}

function modesTraduits(tr) {
  return MODES_COURRIER.map((m) => ({ code: m, libelle: tr(`mode.${m}`, LIBELLES_MODES[m]) }));
}

async function lirePreferences(idUtilisateur, tr) {
  const { rows } = await tenantPool.query(
    `SELECT type, courrier FROM preference_notification WHERE id_utilisateur = $1`, [idUtilisateur]);
  const perso = new Map(rows.map((r) => [r.type, r.courrier]));
  return TYPES_CODES.map((type) => ({
    type,
    libelle: tr(`type.${type}.libelle`, TYPES[type].libelle),
    description: tr(`type.${type}.description`, TYPES[type].description),
    // Destinataires par defaut du catalogue (profils), pour l'ecran des
    // preferences : qui recoit ce type en l'absence de reglage.
    destinataires_defaut: destinatairesDefaut(type),
    courrier: perso.get(type) || courrierDefaut(type),
    courrier_defaut: courrierDefaut(type),
    source: perso.has(type) ? "utilisateur" : "defaut",
  }));
}

router.get("/notifications/preferences", async (req, res) => {
  try {
    const tr = await traducteurUtilisateur(req.user.id);
    succes(res, 5504, {
      modes: modesTraduits(tr),
      preferences: await lirePreferences(req.user.id, tr),
    });
  } catch (err) {
    console.error("GET /notifications/preferences error", err);
    erreur(res, 5549, { status: 500, message: "Erreur serveur" });
  }
});

// PUT /notifications/preferences { preferences: [{ type, courrier }] }
// Un type absent du corps garde son reglage. Un reglage egal au defaut du
// catalogue retire la ligne : la table ne porte que les choix explicites.
router.put("/notifications/preferences", async (req, res) => {
  const liste = req.body?.preferences;
  if (!Array.isArray(liste)) return erreur(res, 5517, { status: 400 });
  for (const p of liste) {
    if (!p || typeof p.type !== "string" || !typeConnu(p.type)) {
      return erreur(res, 5514, { status: 400, details: { type: p?.type ?? null } });
    }
    if (!MODES_COURRIER.includes(p.courrier)) {
      return erreur(res, 5515, { status: 400, details: { type: p.type, courrier: p.courrier ?? null } });
    }
  }
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    for (const p of liste) {
      if (p.courrier === courrierDefaut(p.type)) {
        await client.query(
          `DELETE FROM preference_notification WHERE id_utilisateur = $1 AND type = $2`,
          [req.user.id, p.type]);
      } else {
        await client.query(
          `INSERT INTO preference_notification (id_utilisateur, type, courrier)
           VALUES ($1, $2, $3)
           ON CONFLICT (id_utilisateur, type)
           DO UPDATE SET courrier = EXCLUDED.courrier, updated_at = now()`,
          [req.user.id, p.type, p.courrier]);
      }
    }
    await client.query("COMMIT");
    const tr = await traducteurUtilisateur(req.user.id);
    succes(res, 5505, {
      modes: modesTraduits(tr),
      preferences: await lirePreferences(req.user.id, tr),
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PUT /notifications/preferences error", err);
    erreur(res, 5549, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// POST /notifications/tout-lu
// ---------------------------------------------------------------------------
router.post("/notifications/tout-lu", async (req, res) => {
  try {
    const { rowCount } = await tenantPool.query(
      `UPDATE notification SET statut = 'lu', lu_at = now()
        WHERE id_utilisateur = $1 AND statut = 'non_lu'`, [req.user.id]);
    succes(res, 5503, { marquees: rowCount, non_lues: 0 });
  } catch (err) {
    console.error("POST /notifications/tout-lu error", err);
    erreur(res, 5549, { status: 500, message: "Erreur serveur" });
  }
});

// ---------------------------------------------------------------------------
// POST /notifications/executer-planification (Admin SAM) : traitement
// quotidien puis recapitulatif, a la suite, sans verrou journalier.
// ---------------------------------------------------------------------------
router.post("/notifications/executer-planification", async (req, res) => {
  try {
    const resultat = await executerManuellement();
    if (!resultat) return erreur(res, 5516, { status: 409 });
    await auditer(tenantPool, req, {
      action: "notifications_execution_planification",
      entiteType: "notification", entiteId: null,
      apres: resultat,
    });
    succes(res, 5506, resultat);
  } catch (err) {
    console.error("POST /notifications/executer-planification error", err);
    erreur(res, 5549, { status: 500, message: "Erreur serveur" });
  }
});

// ---------------------------------------------------------------------------
// POST /notifications/relancer-courriers (Admin SAM) : relance volontaire des
// courriers en echec (spec v1.1 : pas de file de retry applicative, un echec
// laisse la notification dans l'application ; la reprise est un acte
// volontaire). Sans doublon : seuls les statuts a_envoyer et echec sont
// repris, jamais envoye.
// ---------------------------------------------------------------------------
router.post("/notifications/relancer-courriers", async (req, res) => {
  try {
    const resultat = await relancerCourriers();
    if (!resultat) return erreur(res, 5518, { status: 409 });
    await auditer(tenantPool, req, {
      action: "notifications_relance_courriers",
      entiteType: "notification", entiteId: null,
      apres: resultat,
    });
    succes(res, 5507, resultat);
  } catch (err) {
    console.error("POST /notifications/relancer-courriers error", err);
    erreur(res, 5549, { status: 500, message: "Erreur serveur" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /notifications/:id/lu : marque lue (idempotent). Une notification
// d'un autre utilisateur est introuvable, jamais "interdite" : ne pas reveler
// l'existence d'un identifiant qui n'est pas le sien.
// ---------------------------------------------------------------------------
router.patch("/notifications/:id/lu", async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return erreur(res, 5511, { status: 400 });
  try {
    const { rows } = await tenantPool.query(
      `UPDATE notification n
          SET statut = 'lu', lu_at = COALESCE(lu_at, now())
        WHERE n.id = $1 AND n.id_utilisateur = $2 AND n.statut <> 'archive'
        RETURNING ${COLONNES}`,
      [id, req.user.id]);
    if (!rows.length) return erreur(res, 5510, { status: 404 });
    const { rows: [c] } = await tenantPool.query(
      `SELECT count(*)::int AS non_lues FROM notification WHERE id_utilisateur = $1 AND statut = 'non_lu'`,
      [req.user.id]);
    succes(res, 5502, { notification: rows[0], non_lues: c.non_lues });
  } catch (err) {
    console.error("PATCH /notifications/:id/lu error", err);
    erreur(res, 5549, { status: 500, message: "Erreur serveur" });
  }
});

export default router;
