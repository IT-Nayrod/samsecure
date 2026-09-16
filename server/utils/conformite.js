// Balance de conformité droits contre usages.
//
// Ce module ne fait qu'une chose : porter la définition du calcul, pour qu'il
// n'en existe qu'une. Elle est née inline dans licences.js (#102) ; le
// référentiel éditeurs en a besoin à son tour, et deux copies auraient
// divergé à la première évolution des seuils.
//
// Depuis la migration 046 (#116), precalcul_conformite est alimentée par
// triggers sur licence et affectation : GET /conformite la lit. Les fragments
// de ce module restent la définition du calcul à la lecture, employée par
// licences.js, editeurs.js et le chemin filtré par société de conformite.js
// (le précalcul est par produit, sans axe société).
//
// Décisions du 10/09/2026, appliquées ici et par la migration 058 :
//   D52, prix unitaire : le prix d'un produit est celui de sa dernière
//       commande (ligne de licence la plus récente par date de commande, à
//       défaut par date de création), jamais une moyenne ;
//   D53, droits à zéro : avec des usages et aucun droit, le taux n'est pas
//       calculé (aucun pourcentage sans sens), le statut est dépassement et
//       une anomalie qualité usage_sans_droit est ouverte par produit.
//
// Les fragments SQL attendent l'alias l sur licence. Ce sont des constantes du
// code, jamais des valeurs de requête : leur interpolation est sûre.
//
// Aucun import de db.js au chargement : les pools ne sont résolus qu'à
// l'appel de seuilsConformite(), pour que les fonctions pures de ce module se
// testent au node:test sans configuration de base (conformite.test.js).

const arrondi2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

// Types de licence bornés par une date de fin : ils sortent des droits à
// leur date de fin, sans tolérance (hypothèse v0.5 assumée). D44 étendu
// (10/09/2026) : la version d'essai suit la même règle que la souscription.
// Son code est celui du référentiel type_licence à sept valeurs seedé par la
// migration 055 (`essai`), aligné le 16/09/2026 : la constante initiale
// (`version_essai`) avait été posée avant la 055. Côté SQL, la fonction de
// recalcul du précalcul porte le même code (058, rejouée par la 065). C'est
// ici, et seulement ici côté API, que vit ce code : la règle compare le code
// porté par licence.type, sans lire d'autre table.
export const TYPE_VERSION_ESSAI = "essai";
export const TYPES_A_ECHEANCE = ["souscription", TYPE_VERSION_ESSAI];
const SQL_TYPES_A_ECHEANCE = TYPES_A_ECHEANCE.map((t) => `'${t}'`).join(", ");

// Licence échue : type à échéance et date de fin passée. Une perpétuelle
// n'expire jamais. Une licence à échéance sans date de fin (donnée antérieure
// à la validation) reste active. Le jour de la date de fin, la licence est
// encore active ; elle sort des droits le lendemain (borne stricte).
export const LICENCE_EXPIREE = `(l.type IN (${SQL_TYPES_A_ECHEANCE}) AND l.date_fin_souscription IS NOT NULL
                  AND l.date_fin_souscription < CURRENT_DATE)`;

// Pendant JS de LICENCE_EXPIREE, pour les tests et les traitements hors SQL.
// aujourdhui : Date ou chaîne ISO (AAAA-MM-JJ) ; la comparaison se fait sur
// le jour calendaire, jamais sur l'heure.
export function licenceExpiree({ type, date_fin_souscription }, aujourdhui = new Date()) {
  if (!TYPES_A_ECHEANCE.includes(type)) return false;
  if (!date_fin_souscription) return false;
  const jour = (v) => (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);
  return jour(date_fin_souscription) < jour(aujourdhui);
}

// Droits = quantités des licences non expirées. Usage déclaré = affectations de
// toutes les licences du produit, y compris celles portées par une licence
// échue : un usage déclaré sur une licence échue reste un usage, et c'est
// précisément le cas qu'un rapport de conformité doit faire ressortir.
//
// À coller derrière un WITH. Expose les CTE usage_licence et balance, cette
// dernière portant (id_produit, droits, usage_declare).
export const CTE_BALANCE_PRODUIT = `
  usage_licence AS (
    SELECT a.id_licence, sum(a.quantite)::int AS quantite
      FROM affectation a
     GROUP BY a.id_licence
  ), balance AS (
    SELECT l.id_produit,
           coalesce(sum(l.quantite) FILTER (WHERE NOT ${LICENCE_EXPIREE}), 0)::int AS droits,
           coalesce(sum(u.quantite), 0)::int AS usage_declare
      FROM licence l
      LEFT JOIN usage_licence u ON u.id_licence = l.id
     GROUP BY l.id_produit
  )`;

// Seuils repris de l'ancien mock, conservés à la reprise du module 3 :
// dépassement au-delà des droits, attention à partir de 90 pour cent.
// Un produit sans aucun droit acquis mais sans usage déclaré est conforme :
// il n'y a rien à rapprocher.
export const NIVEAU_CONFORMITE_SQL = `
  CASE
    WHEN b.usage_declare > b.droits                           THEN 'depassement'
    WHEN b.droits > 0 AND b.usage_declare >= b.droits * 0.9   THEN 'attention'
    ELSE 'conforme'
  END`;

// Pendant JS des mêmes seuils, pour les agrégations que le SQL ne peut pas
// faire : l'éditeur d'un produit vit en BDD Commune pour le catalogue global,
// aucune jointure ne traverse les deux bases.
export function niveauConformite(droits, usageDeclare) {
  if (usageDeclare > droits) return "depassement";
  if (droits > 0 && usageDeclare >= droits * 0.9) return "attention";
  return "conforme";
}

// Balance par produit, tous produits confondus. Le client peut être un pool ou
// une connexion : les deux exposent query().
export async function balanceParProduit(client) {
  const { rows } = await client.query(
    `WITH ${CTE_BALANCE_PRODUIT}
     SELECT id_produit, droits, usage_declare FROM balance WHERE id_produit IS NOT NULL`);
  return rows;
}

// ---------------------------------------------------------------------------
// Seuils de conformité (#116)
// ---------------------------------------------------------------------------

// Valeurs de repli, identiques aux défauts seedés par les migrations 046
// (seuil_dashboard, Tenant) et 047 (default_seuil_dashboard, Commune) : elles
// ne servent que si les deux tables sont muettes.
export const SEUIL_TAUX_DEFAUT = 90;
export const SEUIL_MONTANT_DEFAUT = 10000;

// Seuils effectifs : tenant (seuil_dashboard) puis défaut Commune
// (default_seuil_dashboard) puis constante. Deux requêtes bornées par appel,
// jamais une par ligne. Le pendant SQL est conformite_seuil() (046), employé
// par les triggers, qui ne peut lire que le tenant : la chaîne est fermée par
// le seed 046 qui diffuse les défauts Commune dans seuil_dashboard.
export async function seuilsConformite() {
  const { tenantPool, commonPool } = await import("../db.js");
  const lire = async (pool, table) => {
    const { rows } = await pool.query(
      `SELECT widget_code, valeur::float8 AS valeur FROM ${table}
        WHERE widget_code IN ('conformite_taux', 'conformite_ecart_valorise')
          AND echelle = 1`);
    return new Map(rows.map((r) => [r.widget_code, r.valeur]));
  };
  const tenant = await lire(tenantPool, "seuil_dashboard");
  const commun = tenant.size < 2 ? await lire(commonPool, "default_seuil_dashboard") : new Map();
  return {
    seuilTaux: tenant.get("conformite_taux")
      ?? commun.get("conformite_taux") ?? SEUIL_TAUX_DEFAUT,
    seuilMontant: tenant.get("conformite_ecart_valorise")
      ?? commun.get("conformite_ecart_valorise") ?? SEUIL_MONTANT_DEFAUT,
  };
}

// Statut d'une balance, seuils paramétrés. Pendant JS de conformite_statut()
// (046) : dépassement prime, puis attention au taux ou à l'écart valorisé
// négatif au-delà du seuil en montant, conforme sinon. La branche montant est
// aujourd'hui couverte par le dépassement (un écart valorisé négatif supposé
// usages > droits) : conservée telle que la règle #116 l'énonce.
export function statutConformite(droits, usages, ecartValorise, { seuilTaux, seuilMontant }) {
  if (usages > droits) return "depassement";
  if (droits > 0 && usages >= (droits * seuilTaux) / 100) return "attention";
  if (ecartValorise != null && ecartValorise < 0 && Math.abs(ecartValorise) >= seuilMontant) {
    return "attention";
  }
  return "conforme";
}

// ---------------------------------------------------------------------------
// Prix unitaire de la dernière commande (D52)
// ---------------------------------------------------------------------------

// Ordre de la dernière commande, pendant SQL de prixUnitaireDerniereCommande.
// Attend l'alias l sur licence et c sur commande (jointure LEFT : une licence
// sans commande n'a pas de date de commande et se classe par sa création).
export const ORDRE_DERNIERE_COMMANDE =
  "c.date_commande DESC NULLS LAST, l.created_at DESC, l.id DESC";

// Lignes de licence d'un produit sur le périmètre observé :
// [{ id, cout_licence, quantite, date_commande, created_at }]. Renvoie le
// prix unitaire (coût / quantité, arrondi au centime) de la ligne la plus
// récente porteuse d'un prix calculable (coût renseigné, quantité > 0), null
// sans ligne exploitable. Jamais une moyenne : c'est le dernier prix payé.
export function prixUnitaireDerniereCommande(lignes = []) {
  const cle = (v) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
  const exploitables = lignes.filter(
    (l) => l && l.cout_licence != null && Number(l.quantite) > 0 && Number.isFinite(Number(l.cout_licence)),
  );
  if (!exploitables.length) return null;
  exploitables.sort((a, b) => {
    const da = cle(a.date_commande), db = cle(b.date_commande);
    if (da !== db) {
      if (da == null) return 1;   // NULLS LAST
      if (db == null) return -1;
      return da < db ? 1 : -1;    // DESC
    }
    const ca = cle(a.created_at) ?? "", cb = cle(b.created_at) ?? "";
    if (ca !== cb) return ca < cb ? 1 : -1;
    return String(b.id ?? "").localeCompare(String(a.id ?? ""));
  });
  const derniere = exploitables[0];
  return arrondi2(Number(derniere.cout_licence) / Number(derniere.quantite));
}

// ---------------------------------------------------------------------------
// Taux et valorisation d'une balance (D53)
// ---------------------------------------------------------------------------

// Taux d'usage en pourcent des droits, borné à 999.99 (colonne DECIMAL(5,2)
// du précalcul, 999.99 se lit "999,99 ou plus"). Sans droit, aucun taux :
// un pourcentage de zéro n'a pas de sens (D53), la valeur est null.
export function tauxConformite(droits, usages) {
  if (!(droits > 0)) return null;
  return Math.min(arrondi2((usages / droits) * 100), 999.99);
}

// Balance complète d'un produit à partir des droits, des usages et du prix
// unitaire de la dernière commande : mêmes formules que
// recalculer_precalcul_conformite (046, révisée par 058). Le prix vient
// toujours de l'appelant (prixUnitaireDerniereCommande ou précalcul), jamais
// d'un rapport coût / droits.
export function valoriserBalance({ droits_total, usages_total, prix_unitaire }, seuils) {
  const droits = Number(droits_total) || 0;
  const usages = Number(usages_total) || 0;
  const prix = prix_unitaire == null ? null : Number(prix_unitaire);
  const ecart = droits - usages;
  const val = prix == null ? null : arrondi2(ecart * prix);
  return {
    droits_total: droits,
    usages_total: usages,
    ecart,
    ecart_pct: tauxConformite(droits, usages),
    prix_unitaire: prix,
    ecart_valorise: val,
    usage_sans_droit: droits === 0 && usages > 0,
    statut_conformite: statutConformite(droits, usages, val, seuils),
  };
}
