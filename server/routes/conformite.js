// Conformité par produit : droits contre usages, valorisation, statut
// (US #116, module 3). Enveloppe normalisée, codes 4300-4399 (migration 047).
//
// Source nominale : precalcul_conformite, alimentée par les triggers de la
// migration 046 sur licence et affectation. Le précalcul est par produit,
// sans axe société : le filtre id_societe et la synthèse par société sont
// calculés à la volée avec les mêmes règles (droits = licences des commandes
// de la société payeuse, usages = affectations déclarées par la société).
//
// produit et éditeur du produit vivent en BDD Commune : aucune jointure SQL
// possible, les libellés sont résolus ici après lecture (une requête par
// réponse, jamais par ligne), comme dans licences.js.
//
// Montants (prix_unitaire, ecart_valorise et leurs agrégats) servis à null
// avec montants_masques: true sans consulter_kpi_financiers, même règle que
// les coûts du module licences. Le statut reste servi : il est calculé côté
// serveur, seuil en montant compris.
//
// Décisions du 10/09/2026 (#190) : D52, le prix unitaire est celui de la
// dernière commande du produit sur le périmètre observé (jamais une
// moyenne) ; D53, un produit à usages sans droit n'a pas de taux (ecart_pct
// null, usage_sans_droit true), il est en dépassement et porte une anomalie
// usage_sans_droit ouverte par la migration 058 ; D54, l'écart valorisé se
// lit en relatif à la valorisation du parc observé : chaque agrégat porte
// valorisation_parc (somme des coûts des licences actives du périmètre
// filtré) et ecart_valorise_pct (écart valorisé rapporté à ce parc), jamais
// un montant absolu seul. Les deux chemins (précalcul et calcul à la volée)
// appliquent les mêmes règles.
import express from "express";
import { tenantPool, commonPool } from "../db.js";
import { succes, erreur } from "../utils/reponse.js";
import { permissionsEffectives } from "../utils/droitsUtilisateur.js";
import {
  LICENCE_EXPIREE, seuilsConformite, prixUnitaireDerniereCommande, valoriserBalance,
} from "../utils/conformite.js";

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIVEAUX = ["global", "editeur", "societe"];

const arrondi2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

// Lignes de licence d'un groupe, au format attendu par
// prixUnitaireDerniereCommande : la sélection de la dernière commande est
// faite en JS, par la fonction pure testée, et non par un ORDER BY dupliqué.
// Constante du code, interpolation sûre.
const AGG_LIGNES_PRIX = `
  json_agg(json_build_object(
    'id', l.id, 'cout_licence', l.cout_licence, 'quantite', l.quantite,
    'date_commande', c.date_commande, 'created_at', l.created_at)) AS lignes_prix`;

// Dernière entrée du workflow d'une affectation, même source de vérité que
// les routes affectations. Constante du code, interpolation sûre.
const LATERAL_STATUT_AFFECTATION = `
  LEFT JOIN LATERAL (
    SELECT vs.code
      FROM workflow_validation w
      LEFT JOIN validation_status vs ON vs.id = w.id_statut
     WHERE w.entite_type = 'affectation' AND w.entite_id = a.id
     ORDER BY w.created_at DESC, w.id DESC
     LIMIT 1
  ) wv ON true`;

// Unité de mesure du produit : la plus fréquente parmi ses licences, l'unité
// étant portée par la licence et non par le produit (DDL v4). Un produit aux
// licences hétérogènes sort sur l'unité majoritaire, hypothèse v0.5.
const LATERAL_UNITE = (refProduit) => `
  LEFT JOIN LATERAL (
    SELECT um.label
      FROM licence lu
      JOIN unite_mesure um ON um.id = lu.id_unite_mesure
     WHERE lu.id_produit = ${refProduit}
     GROUP BY um.label
     ORDER BY count(*) DESC, um.label
     LIMIT 1
  ) un ON true`;

// ---------------------------------------------------------------------------
// Résolution Commune : libellés produit et éditeur du produit
// ---------------------------------------------------------------------------

// Pose produit_label, id_editeur et editeur_label sur chaque ligne. Une
// requête Commune pour les produits, une Tenant pour les éditeurs.
async function resoudreProduits(rows) {
  if (!rows.length) return rows;
  const idsProduits = [...new Set(rows.map((r) => r.id_produit).filter(Boolean))];

  const produits = new Map();
  if (idsProduits.length) {
    const { rows: p } = await commonPool.query(
      `SELECT id, label, id_editeur FROM produit_referentiel WHERE id = ANY($1)`, [idsProduits]);
    for (const x of p) produits.set(x.id, x);
  }
  const idsEditeurs = [...new Set([...produits.values()].map((p) => p.id_editeur).filter(Boolean))];
  const editeurs = new Map();
  if (idsEditeurs.length) {
    const { rows: e } = await tenantPool.query(
      `SELECT id, raison_sociale FROM editeur WHERE id = ANY($1)`, [idsEditeurs]);
    for (const x of e) editeurs.set(x.id, x.raison_sociale);
  }

  return rows.map((r) => {
    const p = produits.get(r.id_produit);
    return {
      ...r,
      produit_label: p?.label ?? null,
      id_editeur: p?.id_editeur ?? null,
      editeur_label: p?.id_editeur ? editeurs.get(p.id_editeur) ?? null : null,
    };
  });
}

// Identifiants des produits d'un éditeur (BDD Commune), pour le filtre
// id_editeur : le précalcul Tenant ne connaît pas l'éditeur du produit.
async function produitsDeLEditeur(idEditeur) {
  const { rows } = await commonPool.query(
    `SELECT id FROM produit_referentiel WHERE id_editeur = $1`, [idEditeur]);
  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Lignes de conformité : précalcul (nominal) ou calcul à la volée (société)
// ---------------------------------------------------------------------------

// Valorisation du produit sur le parc : coût des licences actives (D54). Le
// précalcul ne la porte pas (aucune évolution de schéma dans ce lot), elle
// est relue par produit. Constante du code, interpolation sûre.
const LATERAL_COUT_ACTIF = (refProduit) => `
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(l.cout_licence) FILTER (WHERE NOT ${LICENCE_EXPIREE}), 0)::float8 AS cout_actif
      FROM licence l
     WHERE l.id_produit = ${refProduit}
  ) ca ON true`;

// Lecture du précalcul. Un produit sans droit ni usage n'est pas compté
// (règle #116) : sa ligne à zéro est filtrée, jamais purgée.
async function lignesDepuisPrecalcul({ idProduit, idsProduits }) {
  const { rows } = await tenantPool.query(
    `SELECT pc.id_produit,
            pc.droits_total, pc.usages_total, pc.ecart,
            pc.ecart_pct::float8      AS ecart_pct,
            pc.prix_unitaire::float8  AS prix_unitaire,
            pc.ecart_valorise::float8 AS ecart_valorise,
            pc.statut_conformite,
            pc.derniere_maj,
            un.label AS unite,
            ca.cout_actif
       FROM precalcul_conformite pc
       ${LATERAL_UNITE("pc.id_produit")}
       ${LATERAL_COUT_ACTIF("pc.id_produit")}
      WHERE pc.id_produit IS NOT NULL
        AND NOT (pc.droits_total = 0 AND pc.usages_total = 0)
        AND ($1::uuid IS NULL OR pc.id_produit = $1::uuid)
        AND ($2::uuid[] IS NULL OR pc.id_produit = ANY($2::uuid[]))
      ORDER BY pc.derniere_maj DESC`,
    [idProduit || null, idsProduits || null]);
  // D53 : le précalcul sert ecart_pct null sans droit (058) ; le drapeau
  // explicite évite au front de déduire la règle du null.
  return rows.map((r) => ({ ...r, usage_sans_droit: r.droits_total === 0 && r.usages_total > 0 }));
}

// Calcul à la volée restreint à une société. Droits : licences payées par la
// société (chaîne licence -> commande -> société, doctrine budget). Usages :
// affectations déclarées par la société (affectation.id_societe), comme le
// décompte 4106. Les deux axes diffèrent par construction, hypothèse v0.5.
async function lignesPourSociete(idSociete, { idProduit, idsProduits }, seuils) {
  const { rows } = await tenantPool.query(
    `WITH droits AS (
       SELECT l.id_produit,
              coalesce(sum(l.quantite) FILTER (WHERE NOT ${LICENCE_EXPIREE}), 0)::int AS droits,
              coalesce(sum(l.cout_licence) FILTER (WHERE NOT ${LICENCE_EXPIREE}), 0)::float8 AS cout_actif,
              ${AGG_LIGNES_PRIX}
         FROM licence l
         JOIN commande c ON c.id = l.id_commande
        WHERE l.id_produit IS NOT NULL AND c.id_societe = $1
        GROUP BY l.id_produit
     ), usages AS (
       SELECT l.id_produit,
              coalesce(sum(a.quantite), 0)::int AS usages
         FROM affectation a
         JOIN licence l ON l.id = a.id_licence
         ${LATERAL_STATUT_AFFECTATION}
        WHERE l.id_produit IS NOT NULL AND a.id_societe = $1
          AND wv.code = 'valide'
        GROUP BY l.id_produit
     )
     SELECT coalesce(d.id_produit, u.id_produit) AS id_produit,
            coalesce(d.droits, 0)     AS droits_total,
            coalesce(u.usages, 0)     AS usages_total,
            coalesce(d.cout_actif, 0) AS cout_actif,
            d.lignes_prix,
            un.label AS unite
       FROM droits d
       FULL JOIN usages u ON u.id_produit = d.id_produit
       ${LATERAL_UNITE("coalesce(d.id_produit, u.id_produit)")}
      WHERE ($2::uuid IS NULL OR coalesce(d.id_produit, u.id_produit) = $2::uuid)
        AND ($3::uuid[] IS NULL OR coalesce(d.id_produit, u.id_produit) = ANY($3::uuid[]))`,
    [idSociete, idProduit || null, idsProduits || null]);

  const maintenant = new Date().toISOString();
  return rows
    .filter((r) => r.droits_total > 0 || r.usages_total > 0)
    .map((r) => valoriser(r, seuils, maintenant));
}

// Valorisation et statut d'une balance brute (droits, usages, lignes de
// licence du périmètre) : mêmes formules que recalculer_precalcul_conformite
// (046, révisée par 058). Le prix unitaire est celui de la dernière commande
// parmi les lignes du périmètre observé (D52) ; un produit dont la société
// n'a payé aucune licence n'a pas de prix, son écart valorisé est null.
function valoriser(r, seuils, derniereMaj) {
  const prix = prixUnitaireDerniereCommande(r.lignes_prix ?? []);
  return {
    id_produit: r.id_produit,
    unite: r.unite ?? null,
    ...valoriserBalance(
      { droits_total: r.droits_total, usages_total: r.usages_total, prix_unitaire: prix }, seuils),
    cout_actif: arrondi2(Number(r.cout_actif) || 0),
    derniere_maj: derniereMaj,
  };
}

// ---------------------------------------------------------------------------
// Agrégats et masquage
// ---------------------------------------------------------------------------

// ecart_valorise_negatif et _positif sont des sommes signées : la négative
// mesure l'exposition des dépassements, la positive la sous-utilisation ;
// ecart_valorise est leur somme (écart net du périmètre). D54 :
// valorisation_parc est la somme des coûts des licences actives des
// produits du périmètre, et chaque écart est aussi servi en pourcentage de
// ce parc (null sans parc valorisé). Un pourcentage n'est pas un montant :
// il reste servi quand les montants sont masqués.
function agregatsDe(lignes) {
  let negatif = 0, positif = 0, parc = 0, derniere = null;
  const nb = { depassement: 0, attention: 0, conforme: 0 };
  for (const l of lignes) {
    if (l.statut_conformite in nb) nb[l.statut_conformite] += 1;
    if (l.ecart_valorise != null) {
      if (l.ecart_valorise < 0) negatif += l.ecart_valorise;
      else positif += l.ecart_valorise;
    }
    parc += Number(l.cout_actif) || 0;
    if (l.derniere_maj && (!derniere || l.derniere_maj > derniere)) derniere = l.derniere_maj;
  }
  const pct = (montant) => (parc > 0 ? arrondi2((montant / parc) * 100) : null);
  return {
    nb_produits: lignes.length,
    nb_depassement: nb.depassement,
    nb_attention: nb.attention,
    nb_conforme: nb.conforme,
    valorisation_parc: arrondi2(parc),
    ecart_valorise: arrondi2(negatif + positif),
    ecart_valorise_pct: pct(negatif + positif),
    ecart_valorise_negatif: arrondi2(negatif),
    ecart_valorise_negatif_pct: pct(negatif),
    ecart_valorise_positif: arrondi2(positif),
    ecart_valorise_positif_pct: pct(positif),
    derniere_maj: derniere,
  };
}

// Même calcul que licences.js : les montants ne se lisent qu'avec
// consulter_kpi_financiers, servis à null et jamais caviardés en chaîne.
async function montantsVisibles(req) {
  const { permissions } = await permissionsEffectives(req.user.id);
  return permissions.has("consulter_kpi_financiers");
}

function masquerLigne(l, visibles) {
  return visibles ? l : { ...l, prix_unitaire: null, ecart_valorise: null, cout_actif: null };
}

function masquerAgregats(a, visibles) {
  return visibles ? a : {
    ...a,
    valorisation_parc: null, ecart_valorise: null,
    ecart_valorise_negatif: null, ecart_valorise_positif: null,
  };
}

// Filtres communs aux deux GET : id_societe, id_editeur, id_produit.
// Renvoie { erreur } ou { filtres }.
function lireFiltres(query) {
  const { id_societe, id_editeur, id_produit } = query;
  if (id_societe && !UUID_RE.test(id_societe)) {
    return { erreur: { code: 4310, message: "Identifiant de societe invalide." } };
  }
  if (id_editeur && !UUID_RE.test(id_editeur)) {
    return { erreur: { code: 4311, message: "Identifiant d'editeur invalide." } };
  }
  if (id_produit && !UUID_RE.test(id_produit)) {
    return { erreur: { code: 4312, message: "Identifiant de produit invalide." } };
  }
  return { filtres: {
    id_societe: id_societe || null,
    id_editeur: id_editeur || null,
    id_produit: id_produit || null,
  } };
}

// ---------------------------------------------------------------------------
// GET /conformite : lignes par produit + agrégats
// ---------------------------------------------------------------------------
router.get("/conformite", async (req, res) => {
  try {
    const { erreur: invalide, filtres } = lireFiltres(req.query);
    if (invalide) return erreur(res, invalide.code, { status: 400, message: invalide.message });

    // Filtre éditeur : résolu en liste de produits côté Commune. Un éditeur
    // sans produit donne une liste vide, donc aucune ligne, jamais un 404.
    const idsProduits = filtres.id_editeur
      ? await produitsDeLEditeur(filtres.id_editeur) : null;

    const seuils = await seuilsConformite();
    const brutes = filtres.id_societe
      ? await lignesPourSociete(filtres.id_societe,
          { idProduit: filtres.id_produit, idsProduits }, seuils)
      : await lignesDepuisPrecalcul({ idProduit: filtres.id_produit, idsProduits });

    const lignes = await resoudreProduits(brutes);
    const visibles = await montantsVisibles(req);
    succes(res, 4300, {
      filtres,
      lignes: lignes.map((l) => masquerLigne(l, visibles)),
      agregats: masquerAgregats(agregatsDe(lignes), visibles),
      montants_masques: !visibles,
    });
  } catch (err) {
    console.error("GET /conformite error", err);
    erreur(res, 4399, { status: 500, message: "Erreur serveur" });
  }
});

// ---------------------------------------------------------------------------
// GET /conformite/synthese?niveau=global|editeur|societe
// ---------------------------------------------------------------------------

// Synthèse par société : balance par (societe, produit) en une requête, puis
// agrégation par société. Mêmes axes que lignesPourSociete.
async function synthesesParSociete(seuils) {
  const { rows } = await tenantPool.query(
    `WITH droits AS (
       SELECT c.id_societe, l.id_produit,
              coalesce(sum(l.quantite) FILTER (WHERE NOT ${LICENCE_EXPIREE}), 0)::int AS droits,
              coalesce(sum(l.cout_licence) FILTER (WHERE NOT ${LICENCE_EXPIREE}), 0)::float8 AS cout_actif,
              ${AGG_LIGNES_PRIX}
         FROM licence l
         JOIN commande c ON c.id = l.id_commande
        WHERE l.id_produit IS NOT NULL AND c.id_societe IS NOT NULL
        GROUP BY c.id_societe, l.id_produit
     ), usages AS (
       SELECT a.id_societe, l.id_produit,
              coalesce(sum(a.quantite), 0)::int AS usages
         FROM affectation a
         JOIN licence l ON l.id = a.id_licence
         ${LATERAL_STATUT_AFFECTATION}
        WHERE l.id_produit IS NOT NULL AND a.id_societe IS NOT NULL
          AND wv.code = 'valide'
        GROUP BY a.id_societe, l.id_produit
     )
     SELECT coalesce(d.id_societe, u.id_societe) AS id_societe,
            s.raison_sociale AS societe_label,
            coalesce(d.id_produit, u.id_produit) AS id_produit,
            coalesce(d.droits, 0)     AS droits_total,
            coalesce(u.usages, 0)     AS usages_total,
            coalesce(d.cout_actif, 0) AS cout_actif,
            d.lignes_prix
       FROM droits d
       FULL JOIN usages u ON u.id_societe = d.id_societe AND u.id_produit = d.id_produit
       LEFT JOIN societe s ON s.id = coalesce(d.id_societe, u.id_societe)`);

  const maintenant = new Date().toISOString();
  const parSociete = new Map();
  for (const r of rows) {
    if (!(r.droits_total > 0 || r.usages_total > 0)) continue;
    const groupe = parSociete.get(r.id_societe)
      || { id_societe: r.id_societe, societe_label: r.societe_label, lignes: [] };
    groupe.lignes.push(valoriser(r, seuils, maintenant));
    parSociete.set(r.id_societe, groupe);
  }
  return [...parSociete.values()]
    .map((g) => ({ id_societe: g.id_societe, societe_label: g.societe_label, ...agregatsDe(g.lignes) }))
    .sort((a, b) => String(a.societe_label).localeCompare(String(b.societe_label), "fr"));
}

// Synthèse par éditeur : précalcul groupé par l'éditeur du produit, résolu en
// Commune. Les produits sans éditeur forment la ligne id_editeur null.
async function synthesesParEditeur() {
  const lignes = await resoudreProduits(await lignesDepuisPrecalcul({}));
  const parEditeur = new Map();
  for (const l of lignes) {
    const cle = l.id_editeur ?? null;
    const groupe = parEditeur.get(cle)
      || { id_editeur: cle, editeur_label: l.editeur_label ?? null, lignes: [] };
    groupe.lignes.push(l);
    parEditeur.set(cle, groupe);
  }
  return [...parEditeur.values()]
    .map((g) => ({ id_editeur: g.id_editeur, editeur_label: g.editeur_label, ...agregatsDe(g.lignes) }))
    .sort((a, b) => String(a.editeur_label ?? "").localeCompare(String(b.editeur_label ?? ""), "fr"));
}

router.get("/conformite/synthese", async (req, res) => {
  try {
    const niveau = req.query.niveau || "global";
    if (!NIVEAUX.includes(niveau)) {
      return erreur(res, 4313, {
        status: 400, message: "Le niveau demande doit etre global, editeur ou societe.",
      });
    }

    let lignes;
    if (niveau === "societe") {
      lignes = await synthesesParSociete(await seuilsConformite());
    } else if (niveau === "editeur") {
      lignes = await synthesesParEditeur();
    } else {
      lignes = [agregatsDe(await lignesDepuisPrecalcul({}))];
    }

    const visibles = await montantsVisibles(req);
    succes(res, 4301, {
      niveau,
      lignes: lignes.map((l) => masquerAgregats(l, visibles)),
      montants_masques: !visibles,
    });
  } catch (err) {
    console.error("GET /conformite/synthese error", err);
    erreur(res, 4399, { status: 500, message: "Erreur serveur" });
  }
});

export default router;
