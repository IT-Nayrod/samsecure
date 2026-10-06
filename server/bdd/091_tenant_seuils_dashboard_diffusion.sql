-- ============================================================================
-- SamSecure - BDD Tenant - Migration 091
-- Fichier   : 091_tenant_seuils_dashboard_diffusion.sql
-- Objet     : diffusion dans le tenant des seuils de colorimétrie des widgets
--             (chantier seuils). La migration 050 n'a seedé ces seuils qu'en
--             Commune (default_seuil_dashboard) ; le modèle validé veut le
--             tenant rempli au provisionnement et la lecture dans le tenant.
--             Les valeurs sont la copie exacte du seed 050 (une jointure
--             inter-bases est impossible, même motif que 046). Les trois
--             seuils métier déjà diffusés (conformite_taux,
--             conformite_ecart_valorise par 046, budget_taux_engagement par
--             051) sont laissés tels quels par l'ON CONFLICT.
--             Second temps : valeurs_defaut (copie du défaut, motif
--             copy-on-write de 026) est renseigné sur toute ligne non
--             personnalisée qui ne l'a pas encore, sa valeur courante étant
--             alors par construction la valeur par défaut.
-- Cible     : PostgreSQL 16 - base Tenant.
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 002 (table seuil_dashboard), 046, 051 (seuils métier).
-- Rejouable : oui, ON CONFLICT DO NOTHING (un seuil déjà présent, personnalisé
--             ou non, n'est jamais écrasé par une livraison) et UPDATE borné
--             à valeurs_defaut IS NULL.
-- Numero    : 091 (deux fichiers sous ce numéro, un par base : celui-ci et
--             091_commune_seuils_dashboard_codes.sql, chacun suivi dans la
--             table _migrations de sa base).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Diffusion des seuils de colorimétrie (copie du seed Commune 050).
--    Convention : echelle N = valeur d'entrée du niveau N (1 vert, 2 jaune,
--    3 orange, 4 rouge), direction 'haut' = une valeur croissante dégrade,
--    'bas' = une valeur décroissante dégrade.
-- ----------------------------------------------------------------------------
INSERT INTO seuil_dashboard (widget_code, echelle, valeur, unite, direction) VALUES
  -- Écart entre droits détenus et usage déclaré, en pourcentage des droits
  ('ecart-usage-droits',       1,     0, 'pct',    'haut'),
  ('ecart-usage-droits',       2,    10, 'pct',    'haut'),
  ('ecart-usage-droits',       3,    20, 'pct',    'haut'),
  ('ecart-usage-droits',       4,    30, 'pct',    'haut'),
  -- Échéances de contrats, en mois restants avant la date de fin
  ('echeances-contrats',       1,     3, 'mois',   'bas'),
  ('echeances-contrats',       2,     2, 'mois',   'bas'),
  ('echeances-contrats',       3,     1, 'mois',   'bas'),
  ('echeances-contrats',       4,     0, 'mois',   'bas'),
  -- Échéances de commandes, mêmes bornes
  ('echeances-commandes',      1,     3, 'mois',   'bas'),
  ('echeances-commandes',      2,     2, 'mois',   'bas'),
  ('echeances-commandes',      3,     1, 'mois',   'bas'),
  ('echeances-commandes',      4,     0, 'mois',   'bas'),
  -- KPI échéances des contrats du dashboard Financier, mêmes bornes
  ('echeances-contrats-kpi',   1,     3, 'mois',   'bas'),
  ('echeances-contrats-kpi',   2,     2, 'mois',   'bas'),
  ('echeances-contrats-kpi',   3,     1, 'mois',   'bas'),
  ('echeances-contrats-kpi',   4,     0, 'mois',   'bas'),
  -- Valorisation des licences non utilisées, en pourcentage du parc détenu
  ('valorisation-licences',    1,     0, 'pct',    'haut'),
  ('valorisation-licences',    2,     5, 'pct',    'haut'),
  ('valorisation-licences',    3,    10, 'pct',    'haut'),
  ('valorisation-licences',    4,    15, 'pct',    'haut'),
  -- Conformité budget réel contre prévisionnel, en pourcentage de conformité
  ('conformite-reel-previ',    1,    95, 'pct',    'bas'),
  ('conformite-reel-previ',    2,    90, 'pct',    'bas'),
  ('conformite-reel-previ',    3,    80, 'pct',    'bas'),
  ('conformite-reel-previ',    4,     0, 'pct',    'bas'),
  -- Écart valorisé négatif (coût des licences manquantes), seuils en euros
  ('cout-licences-manquantes', 1,     0, 'euros',  'haut'),
  ('cout-licences-manquantes', 2, 10000, 'euros',  'haut'),
  ('cout-licences-manquantes', 3, 25000, 'euros',  'haut'),
  ('cout-licences-manquantes', 4, 50000, 'euros',  'haut'),
  -- Revalidations d'affectations, en jours restants avant échéance
  ('revalidations',            1,    30, 'jours',  'bas'),
  ('revalidations',            2,    15, 'jours',  'bas'),
  ('revalidations',            3,     7, 'jours',  'bas'),
  ('revalidations',            4,     0, 'jours',  'bas'),
  -- Validations en attente depuis plus de 24 heures, en nombre de saisies
  ('validations-attente',      1,     0, 'nombre', 'haut'),
  ('validations-attente',      2,     1, 'nombre', 'haut'),
  ('validations-attente',      3,     3, 'nombre', 'haut'),
  ('validations-attente',      4,     5, 'nombre', 'haut'),
  -- Anomalies de qualité des saisies, en nombre
  ('qualite-saisies',          1,     0, 'nombre', 'haut'),
  ('qualite-saisies',          2,     1, 'nombre', 'haut'),
  ('qualite-saisies',          3,     3, 'nombre', 'haut'),
  ('qualite-saisies',          4,     5, 'nombre', 'haut'),
  -- Indice de confiance des données, en points sur 100
  ('indice-confiance',         1,    70, 'points', 'bas'),
  ('indice-confiance',         2,    40, 'points', 'bas'),
  ('indice-confiance',         3,    20, 'points', 'bas'),
  ('indice-confiance',         4,     0, 'points', 'bas'),
  -- Indice de conformité global, en pourcentage de produits conformes
  ('indice-conformite',        1,    95, 'pct',    'bas'),
  ('indice-conformite',        2,    85, 'pct',    'bas'),
  ('indice-conformite',        3,    70, 'pct',    'bas'),
  ('indice-conformite',        4,     0, 'pct',    'bas'),
  -- Balance usages contre droits, en pourcentage de marge disponible
  ('balance-usages-droits',    1,    10, 'pct',    'bas'),
  ('balance-usages-droits',    2,     5, 'pct',    'bas'),
  ('balance-usages-droits',    3,     1, 'pct',    'bas'),
  ('balance-usages-droits',    4,     0, 'pct',    'bas'),
  -- Écarts d'inventaire non rapprochés, en nombre
  ('ecarts-inventaire',        1,     0, 'nombre', 'haut'),
  ('ecarts-inventaire',        2,     1, 'nombre', 'haut'),
  ('ecarts-inventaire',        3,     5, 'nombre', 'haut'),
  ('ecarts-inventaire',        4,    10, 'nombre', 'haut')
ON CONFLICT (widget_code, echelle) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. valeurs_defaut sur les lignes non personnalisées qui ne l'ont pas :
--    leur valeur courante est par construction la valeur par défaut.
-- ----------------------------------------------------------------------------
UPDATE seuil_dashboard
   SET valeurs_defaut = jsonb_build_object(
         'valeur', valeur, 'unite', unite, 'direction', direction)
 WHERE valeurs_defaut IS NULL
   AND personnalise = false;

COMMIT;
