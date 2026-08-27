// Balance de conformite droits contre usages.
//
// Ce module ne fait qu'une chose : porter la definition du calcul, pour qu'il
// n'en existe qu'une. Elle est nee inline dans licences.js (#102) ; le
// referentiel editeurs en a besoin a son tour, et deux copies auraient
// diverge a la premiere evolution des seuils.
//
// La table precalcul_conformite n'est pas utilisee : elle existe depuis la
// migration 002 mais aucun trigger, aucune route et aucun script ne l'ecrit.
// Le calcul est donc fait a la lecture, comme pour les licences.
//
// Les fragments SQL attendent l'alias l sur licence. Ce sont des constantes du
// code, jamais des valeurs de requete : leur interpolation est sure.

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
