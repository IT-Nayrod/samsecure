// Balance de conformite droits contre usages.
//
// Ce module ne fait qu'une chose : porter la definition du calcul, pour qu'il
// n'en existe qu'une. Elle est nee inline dans licences.js (#102) ; le
// referentiel editeurs en a besoin a son tour, et deux copies auraient
// diverge a la premiere evolution des seuils.
//
// Depuis la migration 046 (#116), precalcul_conformite est alimentee par
// triggers sur licence et affectation : GET /conformite la lit. Les fragments
// de ce module restent la definition du calcul a la lecture, employee par
// licences.js, editeurs.js et le chemin filtre par societe de conformite.js
// (le precalcul est par produit, sans axe societe).
//
// Les fragments SQL attendent l'alias l sur licence. Ce sont des constantes du
// code, jamais des valeurs de requete : leur interpolation est sure.
import { tenantPool, commonPool } from "../db.js";

// Souscription echue : le jour meme de sa date de fin, sans tolerance
// (hypothese v0.5 assumee). Une perpetuelle n'expire jamais. Une souscription
// sans date de fin (donnee anterieure a la validation) reste active.
export const LICENCE_EXPIREE = `(l.type = 'souscription' AND l.date_fin_souscription IS NOT NULL
                  AND l.date_fin_souscription < CURRENT_DATE)`;

// Droits = quantites des licences non expirees. Usage declare = affectations de
// toutes les licences du produit, y compris celles portees par une licence
// echue : un usage declare sur une licence echue reste un usage, et c'est
// precisement le cas qu'un rapport de conformite doit faire ressortir.
//
// A coller derriere un WITH. Expose les CTE usage_licence et balance, cette
// derniere portant (id_produit, droits, usage_declare).
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

// Seuils repris de l'ancien mock, conserves a la reprise du module 3 :
// depassement au-dela des droits, attention a partir de 90 pour cent.
// Un produit sans aucun droit acquis mais sans usage declare est conforme :
// il n'y a rien a rapprocher.
export const NIVEAU_CONFORMITE_SQL = `
  CASE
    WHEN b.usage_declare > b.droits                           THEN 'depassement'
    WHEN b.droits > 0 AND b.usage_declare >= b.droits * 0.9   THEN 'attention'
    ELSE 'conforme'
  END`;

// Pendant JS des memes seuils, pour les agregations que le SQL ne peut pas
// faire : l'editeur d'un produit vit en BDD Commune pour le catalogue global,
// aucune jointure ne traverse les deux bases.
export function niveauConformite(droits, usageDeclare) {
  if (usageDeclare > droits) return "depassement";
  if (droits > 0 && usageDeclare >= droits * 0.9) return "attention";
  return "conforme";
}

// Balance par produit, tous produits confondus. Le client peut etre un pool ou
// une connexion : les deux exposent query().
export async function balanceParProduit(client) {
  const { rows } = await client.query(
    `WITH ${CTE_BALANCE_PRODUIT}
     SELECT id_produit, droits, usage_declare FROM balance WHERE id_produit IS NOT NULL`);
  return rows;
}

// ---------------------------------------------------------------------------
// Seuils de conformite (#116)
// ---------------------------------------------------------------------------

// Valeurs de repli, identiques aux defauts seedes par les migrations 046
// (seuil_dashboard, Tenant) et 047 (default_seuil_dashboard, Commune) : elles
// ne servent que si les deux tables sont muettes.
export const SEUIL_TAUX_DEFAUT = 90;
export const SEUIL_MONTANT_DEFAUT = 10000;

// Seuils effectifs : tenant (seuil_dashboard) puis defaut Commune
// (default_seuil_dashboard) puis constante. Deux requetes bornees par appel,
// jamais une par ligne. Le pendant SQL est conformite_seuil() (046), employe
// par les triggers, qui ne peut lire que le tenant : la chaine est fermee par
// le seed 046 qui diffuse les defauts Commune dans seuil_dashboard.
export async function seuilsConformite() {
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

// Statut d'une balance, seuils parametres. Pendant JS de conformite_statut()
// (046) : depassement prime, puis attention au taux ou a l'ecart valorise
// negatif au-dela du seuil en montant, conforme sinon. La branche montant est
// aujourd'hui couverte par le depassement (un ecart valorise negatif suppose
// usages > droits) : conservee telle que la regle #116 l'enonce.
export function statutConformite(droits, usages, ecartValorise, { seuilTaux, seuilMontant }) {
  if (usages > droits) return "depassement";
  if (droits > 0 && usages >= (droits * seuilTaux) / 100) return "attention";
  if (ecartValorise != null && ecartValorise < 0 && Math.abs(ecartValorise) >= seuilMontant) {
    return "attention";
  }
  return "conforme";
}
