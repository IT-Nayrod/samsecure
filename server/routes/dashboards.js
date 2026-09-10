// Routeur dashboards (M4-L, story #190, plage de codes 5450-5499).
//
// Doctrine : les widgets consomment d'abord les endpoints métier existants
// (contrats, commandes, budget, licences, affectations, inventaire). Ce
// routeur ne porte que ce qui manque ailleurs :
//   - la configuration des dashboards (widgets par profil et seuils, défauts
//     Commune surchargés par le tenant, préférences individuelles) ;
//   - une synthèse transverse du workflow de validation (compteurs et fil des
//     dernières saisies, qu'aucun routeur d'entité ne peut servir seul) ;
//   - deux agrégats financiers par éditeur, société ou produit que
//     /commandes/agregats ne sait pas grouper autrement que par période.
// Aucune écriture métier ici : la seule écriture est preference_dashboard,
// table de confort strictement personnelle à l'utilisateur connecté.
import express from "express";
import { tenantPool, commonPool } from "../db.js";
import { succes, erreur } from "../utils/reponse.js";
import { jointureStatut, ENTITES_VALIDABLES, colonneLabel } from "../utils/validationWorkflow.js";

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Les trois profils porteurs d'un dashboard, du plus élevé au moins élevé.
// L'ordre est la règle de sélection du profil actif en multi-groupes,
// en attendant la règle définitive (décision M4-L).
const PROFILS_DASHBOARD = ["manager_dsi", "financier", "it_ops"];

// ---------------------------------------------------------------------------
// Seuils effectifs d'un widget : surcharge tenant (seuil_dashboard) sinon
// défaut Commune (default_seuil_dashboard). La surcharge se fait ligne à
// ligne sur la clé naturelle widget_code + échelle.
// ---------------------------------------------------------------------------
async function seuilsEffectifs() {
  const [defauts, tenant] = await Promise.all([
    commonPool.query(
      `SELECT widget_code, echelle, valeur::float8 AS valeur, unite, direction
         FROM default_seuil_dashboard ORDER BY widget_code, echelle`),
    tenantPool.query(
      `SELECT widget_code, echelle, valeur::float8 AS valeur, unite, direction
         FROM seuil_dashboard ORDER BY widget_code, echelle`),
  ]);
  const parCle = new Map();
  for (const r of defauts.rows) parCle.set(`${r.widget_code}:${r.echelle}`, { ...r, source: "defaut" });
  for (const r of tenant.rows) parCle.set(`${r.widget_code}:${r.echelle}`, { ...r, source: "tenant" });

  const parWidget = {};
  for (const s of parCle.values()) {
    (parWidget[s.widget_code] ??= []).push(s);
  }
  for (const liste of Object.values(parWidget)) liste.sort((a, b) => a.echelle - b.echelle);
  return parWidget;
}

// ---------------------------------------------------------------------------
// GET /dashboards/configuration
// Configuration complété pour l'utilisateur connecté : widgets par profil
// (défaut Commune surchargé par le tenant), seuils effectifs, préférences
// individuelles et profil actif (le plus élevé des profils attribués).
// ---------------------------------------------------------------------------
router.get("/dashboards/configuration", async (req, res) => {
  try {
    const [profilsUtilisateur, defautsWidgets, tenantWidgets, seuils, prefs] = await Promise.all([
      tenantPool.query(
        `SELECT DISTINCT p.code
           FROM utilisateur_profil_societe ups
           JOIN profil p ON p.id = ups.id_profil
          WHERE ups.id_utilisateur = $1 AND ups.date_suppression IS NULL`,
        [req.user.id]),
      commonPool.query(
        `SELECT p.code AS profil_code, w.widget_code, w.visible_defaut, w.acces_autorise
           FROM default_profil_widget w
           JOIN default_profil p ON p.id = w.id_profil
          WHERE p.code = ANY($1)`,
        [PROFILS_DASHBOARD]),
      tenantPool.query(
        `SELECT p.code AS profil_code, w.widget_code, w.visible_defaut, w.acces_autorise
           FROM profil_widget w
           JOIN profil p ON p.id = w.id_profil
          WHERE p.code = ANY($1)`,
        [PROFILS_DASHBOARD]),
      seuilsEffectifs(),
      tenantPool.query(
        `SELECT widget_code, visible, position
           FROM preference_dashboard WHERE id_utilisateur = $1`,
        [req.user.id]),
    ]);

    // Surcharge tenant ligne à ligne sur la clé profil + widget.
    const parCle = new Map();
    for (const r of defautsWidgets.rows)
      parCle.set(`${r.profil_code}:${r.widget_code}`, { ...r, source: "defaut" });
    for (const r of tenantWidgets.rows)
      parCle.set(`${r.profil_code}:${r.widget_code}`, { ...r, source: "tenant" });

    const widgets = {};
    for (const code of PROFILS_DASHBOARD) widgets[code] = [];
    for (const w of parCle.values()) {
      widgets[w.profil_code].push({
        widget_code: w.widget_code,
        visible_defaut: w.visible_defaut,
        acces_autorise: w.acces_autorise,
        source: w.source,
      });
    }

    const codes = profilsUtilisateur.rows.map((r) => r.code);
    const profilActif = PROFILS_DASHBOARD.find((c) => codes.includes(c)) ?? null;

    succes(res, 5450, {
      profil_actif: profilActif,
      profils: codes,
      widgets,
      seuils,
      preferences: prefs.rows,
      derniere_maj: new Date().toISOString(),
    });
  } catch (err) {
    console.error("GET /dashboards/configuration error", err);
    erreur(res, 5499, { status: 500, message: "Erreur serveur" });
  }
});

// ---------------------------------------------------------------------------
// PUT /dashboards/preferences
// Masquage et ordre des widgets pour l'utilisateur connecté, et lui seul.
// Corps : { preferences: [{ widget_code, visible, position }] }. Upsert sur
// la clé naturelle utilisateur + widget, en transaction : un enregistrement
// partiel laisserait un dashboard incohérent.
// ---------------------------------------------------------------------------
router.put("/dashboards/preferences", async (req, res) => {
  const prefs = req.body?.preferences;
  if (!Array.isArray(prefs) || prefs.length > 100)
    return erreur(res, 5462, { status: 400, message: "Les preferences transmises sont invalides." });
  for (const p of prefs) {
    if (!p || typeof p.widget_code !== "string" || !p.widget_code || p.widget_code.length > 50
        || typeof p.visible !== "boolean"
        || (p.position !== null && p.position !== undefined
            && (!Number.isInteger(p.position) || p.position < 0 || p.position > 1000)))
      return erreur(res, 5462, { status: 400, message: "Les preferences transmises sont invalides." });
  }

  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    for (const p of prefs) {
      await client.query(
        `INSERT INTO preference_dashboard (id_utilisateur, widget_code, visible, position)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id_utilisateur, widget_code)
         DO UPDATE SET visible = EXCLUDED.visible, position = EXCLUDED.position`,
        [req.user.id, p.widget_code, p.visible, p.position ?? null]);
    }
    const { rows } = await client.query(
      `SELECT widget_code, visible, position
         FROM preference_dashboard WHERE id_utilisateur = $1`,
      [req.user.id]);
    await client.query("COMMIT");
    succes(res, 5451, { preferences: rows });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /dashboards/preferences error", err);
    erreur(res, 5499, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// GET /dashboards/synthese
// Synthèse transverse du workflow de validation et des revalidations :
//   - saisies en attente par type d'entité, dont celles de plus de 24 heures ;
//   - fil des dix dernières saisies, tous types confondus, avec libellé ;
//   - répartition des affectations validées par proximité de revalidation,
//     bornée par les seuils effectifs du widget revalidations.
// Le statut d'une entité est la dernière entrée de workflow_validation qui la
// désigne : les compteurs se calculent sur cette dernière entrée seulement.
// ---------------------------------------------------------------------------
router.get("/dashboards/synthese", async (req, res) => {
  try {
    const [attente, dernieres, revalidation, seuils] = await Promise.all([
      tenantPool.query(
        `WITH dernieres AS (
           SELECT DISTINCT ON (w.entite_type, w.entite_id)
                  w.entite_type, w.created_at, vs.code AS statut
             FROM workflow_validation w
             LEFT JOIN validation_status vs ON vs.id = w.id_statut
            ORDER BY w.entite_type, w.entite_id, w.created_at DESC, w.id DESC
         )
         SELECT entite_type,
                count(*) FILTER (WHERE statut = 'en_attente')::int AS en_attente,
                count(*) FILTER (WHERE statut = 'en_attente'
                                   AND created_at < now() - interval '24 hours')::int
                  AS en_attente_plus_24h
           FROM dernieres
          GROUP BY entite_type
          ORDER BY entite_type`),
      tenantPool.query(
        `SELECT w.entite_type, w.entite_id, w.created_at,
                vs.code AS statut, vs.label AS statut_label,
                TRIM(CONCAT(u.prenom, ' ', u.nom)) AS soumis_par
           FROM workflow_validation w
           LEFT JOIN validation_status vs ON vs.id = w.id_statut
           LEFT JOIN utilisateur u ON u.id = w.id_soumis_par
          ORDER BY w.created_at DESC, w.id DESC
          LIMIT 10`),
      tenantPool.query(
        `SELECT (a.date_revalidation - CURRENT_DATE)::int AS jours, count(*)::int AS nb
           FROM affectation a
           ${jointureStatut("affectation", "a")}
          WHERE wv.statut_validation = 'valide' AND a.date_revalidation IS NOT NULL
          GROUP BY 1`),
      seuilsEffectifs(),
    ]);

    // Libellés des entités du fil : une requête par type présent (sept types
    // au plus), jamais une par ligne. Les noms de table sortent du catalogue
    // ENTITES_VALIDABLES, jamais d'une entrée utilisateur.
    const parType = new Map();
    for (const s of dernieres.rows) {
      if (!ENTITES_VALIDABLES[s.entite_type]) continue;
      if (!parType.has(s.entite_type)) parType.set(s.entite_type, []);
      parType.get(s.entite_type).push(s.entite_id);
    }
    const libelles = new Map();
    await Promise.all([...parType.entries()].map(async ([type, ids]) => {
      const cible = ENTITES_VALIDABLES[type];
      const { rows } = await tenantPool.query(
        `SELECT id, ${colonneLabel(cible)} AS label FROM ${cible.table} WHERE id = ANY($1::uuid[])`,
        [ids]);
      for (const r of rows) libelles.set(`${type}:${r.id}`, r.label);
    }));
    const dernieres_saisies = dernieres.rows.map((s) => ({
      ...s,
      label: libelles.get(`${s.entite_type}:${s.entite_id}`) ?? null,
    }));

    // Affectations validées sans échéance de revalidation : niveau 1, il n'y a
    // rien à revalider. Les autres se répartissent par les seuils effectifs
    // (direction 'bas' : le niveau est la première échelle dont la valeur est
    // inférieure ou égale aux jours restants, la quatrième sinon).
    const { rows: sansEcheance } = await tenantPool.query(
      `SELECT count(*)::int AS nb
         FROM affectation a
         ${jointureStatut("affectation", "a")}
        WHERE wv.statut_validation = 'valide' AND a.date_revalidation IS NULL`);
    const bornes = (seuils["revalidations"] ?? []).map((s) => s.valeur);
    const niveaux = { 1: sansEcheance[0].nb, 2: 0, 3: 0, 4: 0 };
    for (const r of revalidation.rows) {
      const echelle = bornes.length === 4
        ? ((bornes.findIndex((v) => v <= r.jours) + 1) || 4)
        : (r.jours >= 30 ? 1 : r.jours >= 0 ? 2 : 4);
      niveaux[echelle] += r.nb;
    }

    const total_en_attente = attente.rows.reduce((t, r) => t + r.en_attente, 0);
    const en_attente_plus_24h = attente.rows.reduce((t, r) => t + r.en_attente_plus_24h, 0);

    succes(res, 5452, {
      validations: { total_en_attente, en_attente_plus_24h, par_type: attente.rows },
      dernieres_saisies,
      revalidations: {
        niveau_1: niveaux[1], niveau_2: niveaux[2], niveau_3: niveaux[3], niveau_4: niveaux[4],
        bornes_jours: bornes,
      },
      derniere_maj: new Date().toISOString(),
    });
  } catch (err) {
    console.error("GET /dashboards/synthese error", err);
    erreur(res, 5499, { status: 500, message: "Erreur serveur" });
  }
});

// ---------------------------------------------------------------------------
// Période optionnelle date_debut / date_fin, les deux ou aucune.
// ---------------------------------------------------------------------------
function lirePeriode(query) {
  const { date_debut, date_fin } = query;
  if (!date_debut && !date_fin) return { periode: null };
  if (!DATE_RE.test(date_debut || "") || !DATE_RE.test(date_fin || "") || date_fin < date_debut)
    return { pivot: true };
  return { periode: { date_debut, date_fin } };
}

// ---------------------------------------------------------------------------
// GET /dashboards/montants-totaux?axe=editeur|societe|produit
// Montants totaux du parc par axe, pour le widget du même nom.
//   - éditeur, société : somme des montants de commandes (source réelle des
//     engagements), période optionnelle sur date_commande ;
//   - produit : somme des coûts des licences non expirées (le montant d'une
//     commande ne se ventile pas par produit sans invention). La différence
//     de source est dite dans la bulle d'information du widget.
// ---------------------------------------------------------------------------
router.get("/dashboards/montants-totaux", async (req, res) => {
  try {
    const axe = req.query.axe || "editeur";
    if (!["editeur", "societe", "produit"].includes(axe))
      return erreur(res, 5460, { status: 400, message: "L'axe demande est invalide." });
    const r = lirePeriode(req.query);
    if (r.pivot)
      return erreur(res, 5461, { status: 400, message: "La periode demandee est invalide." });
    const { periode } = r;

    let lignes;
    if (axe === "produit") {
      const { rows } = await tenantPool.query(
        `SELECT l.id_produit AS id, sum(COALESCE(l.cout_licence, 0))::float8 AS montant
           FROM licence l
          WHERE NOT (l.type = 'souscription' AND l.date_fin_souscription IS NOT NULL
                     AND l.date_fin_souscription < CURRENT_DATE)
          GROUP BY l.id_produit
          ORDER BY montant DESC`);
      const ids = rows.map((x) => x.id).filter(Boolean);
      const labels = new Map();
      if (ids.length) {
        const { rows: prods } = await commonPool.query(
          `SELECT id, label FROM produit_referentiel WHERE id = ANY($1::uuid[])`, [ids]);
        for (const p of prods) labels.set(p.id, p.label);
      }
      lignes = rows.map((x) => ({ ...x, label: labels.get(x.id) ?? "Produit local" }));
    } else {
      const jointure = axe === "editeur"
        ? `LEFT JOIN contrat ct ON ct.id = c.id_contrat
           LEFT JOIN editeur e ON e.id = ct.id_editeur`
        : `LEFT JOIN societe e ON e.id = c.id_societe`;
      const cle = axe === "editeur" ? "ct.id_editeur" : "c.id_societe";
      const { rows } = await tenantPool.query(
        `SELECT ${cle} AS id, e.raison_sociale AS label,
                sum(COALESCE(c.montant, 0))::float8 AS montant
           FROM commande c
           ${jointure}
          WHERE ($1::date IS NULL OR c.date_commande >= $1::date)
            AND ($2::date IS NULL OR c.date_commande <= $2::date)
          GROUP BY 1, 2
          ORDER BY montant DESC`,
        [periode?.date_debut ?? null, periode?.date_fin ?? null]);
      lignes = rows;
    }

    const total = Math.round(lignes.reduce((t, l) => t + l.montant, 0) * 100) / 100;
    succes(res, 5453, { axe, filtres: periode ?? {}, lignes, total });
  } catch (err) {
    console.error("GET /dashboards/montants-totaux error", err);
    erreur(res, 5499, { status: 500, message: "Erreur serveur" });
  }
});

// ---------------------------------------------------------------------------
// GET /dashboards/engages-payes
// Montants commandes et payés par éditeur, lus dans precalcul_financier
// (même source que /commandes/agregats, qui ne sait grouper que par période).
// montant_paye reste à zéro tant qu'aucune table ne porte de montant de
// facture (note migration 016) : la donnée est servie telle quelle, jamais
// inventée. derniere_maj : la plus récente des lignes retenues.
// ---------------------------------------------------------------------------
router.get("/dashboards/engages-payes", async (req, res) => {
  try {
    const r = lirePeriode(req.query);
    if (r.pivot)
      return erreur(res, 5461, { status: 400, message: "La periode demandee est invalide." });
    const societe = req.query.id_societe || null;
    if (societe && !UUID_RE.test(societe))
      return erreur(res, 5461, { status: 400, message: "La periode demandee est invalide." });

    const annee = new Date().getFullYear();
    const moisDebut = r.periode ? r.periode.date_debut.slice(0, 7) : `${annee}-01`;
    const moisFin = r.periode ? r.periode.date_fin.slice(0, 7) : `${annee}-12`;

    const { rows } = await tenantPool.query(
      `SELECT p.id_editeur, e.raison_sociale AS editeur_label,
              sum(p.montant_commande)::float8 AS montant_commande,
              sum(p.montant_paye)::float8     AS montant_paye,
              max(p.derniere_maj)             AS derniere_maj
         FROM precalcul_financier p
         LEFT JOIN editeur e ON e.id = p.id_editeur
        WHERE p.periode BETWEEN $1 AND $2
          AND ($3::uuid IS NULL OR p.id_societe = $3::uuid)
        GROUP BY p.id_editeur, e.raison_sociale
        ORDER BY montant_commande DESC`,
      [moisDebut, moisFin, societe]);

    const totaux = {
      montant_commande: Math.round(rows.reduce((t, x) => t + x.montant_commande, 0) * 100) / 100,
      montant_paye: Math.round(rows.reduce((t, x) => t + x.montant_paye, 0) * 100) / 100,
    };
    const dernieres = rows.map((x) => x.derniere_maj).filter(Boolean).sort();
    succes(res, 5454, {
      periode_debut: moisDebut,
      periode_fin: moisFin,
      filtres: { id_societe: societe },
      lignes: rows,
      totaux,
      derniere_maj: dernieres.length ? dernieres[dernieres.length - 1] : null,
    });
  } catch (err) {
    console.error("GET /dashboards/engages-payes error", err);
    erreur(res, 5499, { status: 500, message: "Erreur serveur" });
  }
});

export default router;
