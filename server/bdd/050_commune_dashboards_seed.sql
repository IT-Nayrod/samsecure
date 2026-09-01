-- ============================================================================
-- SamSecure - BDD Commune - Migration 050
-- Fichier   : 050_commune_dashboards_seed.sql
-- Objet     : seeds du module dashboards (M4-L, story #190).
--             1. default_profil_widget : inventaire des widgets par profil,
--                repris de la maquette validee (V2). visible_defaut pilote
--                l'affichage initial, acces_autorise ferme l'acces : les
--                widgets porteurs de montants sont explicitement refuses au
--                profil it_ops (doctrine : IT Ops ne voit jamais de montant).
--             2. default_seuil_dashboard : 4 niveaux par widget porteur de
--                colorimetrie. Convention : echelle N = valeur d'entree du
--                niveau N (1 vert, 2 jaune, 3 orange, 4 rouge). direction
--                'haut' = une valeur croissante degrade le niveau, 'bas' =
--                une valeur decroissante degrade. Le widget
--                cout-licences-manquantes porte ses seuils en euros :
--                c'est le seuil en montant sur l'ecart valorise.
--             3. code_retour 5450-5499 : plage reservee au routeur
--                dashboards (x50-x59 succes, x60-x69 erreurs de validation,
--                x99 erreur serveur). Seed place ici et non dans une
--                migration dediee : meme module, meme livraison.
--             Aucun DDL : migration de donnees uniquement. La diffusion vers
--             les tables tenant (profil_widget, seuil_dashboard) suivra le
--             mecanisme des defauts (026) ; en attendant, l'API lit le
--             defaut Commune quand la surcharge tenant est absente.
-- Cible     : PostgreSQL 16 - base Commune, apres 042 (mot "commune" dans le
--             nom : migrate.js route sur commonPool). Numero 050 : la plage
--             043 a 049 est reservee aux chantiers paralleles du module 4
--             (numerotation arbitree par Dorian, 045 pris par ailleurs).
-- Exécution : npm run migrate:dev / migrate:staging
-- Rejouable : ON CONFLICT DO UPDATE sur les cles naturelles, meme motif que
--             027 et 041.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Widgets par profil (cle naturelle id_profil + widget_code)
-- ----------------------------------------------------------------------------
INSERT INTO default_profil_widget (id_profil, widget_code, visible_defaut, acces_autorise)
SELECT p.id, w.widget_code, w.visible_defaut, w.acces_autorise
FROM (VALUES
  -- Manager DSI : pilotage global
  ('manager_dsi', 'alertes',                  true,  true),
  ('manager_dsi', 'indice-confiance',         true,  true),
  ('manager_dsi', 'validations-attente',      true,  true),
  ('manager_dsi', 'qualite-saisies',          true,  true),
  ('manager_dsi', 'revalidations',            true,  true),
  ('manager_dsi', 'ecart-usage-droits',       true,  true),
  ('manager_dsi', 'indice-conformite',        true,  true),
  ('manager_dsi', 'echeances-contrats',       true,  true),
  ('manager_dsi', 'echeances-commandes',      true,  true),
  ('manager_dsi', 'prevision-budgetaire',     true,  true),
  ('manager_dsi', 'montants-totaux',          true,  true),
  -- Financier : suivi budgetaire et financier
  ('financier',   'alertes',                  true,  true),
  ('financier',   'periode-budgetaire',       true,  true),
  ('financier',   'conformite-reel-previ',    true,  true),
  ('financier',   'echeances-contrats-kpi',   true,  true),
  ('financier',   'montants-engages-payes',   true,  true),
  ('financier',   'echeances-tresorerie',     true,  true),
  ('financier',   'valorisation-licences',    true,  true),
  ('financier',   'cout-licences-manquantes', true,  true),
  ('financier',   'cout-par-logiciel',        true,  true),
  -- IT Ops : operationnel, sans aucun montant
  ('it_ops',      'alertes',                  true,  true),
  ('it_ops',      'balance-usages-droits',    true,  true),
  ('it_ops',      'revalidations',            true,  true),
  ('it_ops',      'qualite-saisies',          true,  true),
  ('it_ops',      'ecart-usage-droits',       true,  true),
  ('it_ops',      'usage-12-mois',            true,  true),
  ('it_ops',      'echeances-contrats',       true,  true),
  ('it_ops',      'echeances-commandes',      true,  true),
  ('it_ops',      'collecteurs',              true,  true),
  ('it_ops',      'ecarts-inventaire',        true,  true),
  ('it_ops',      'dernieres-saisies',        true,  true),
  -- IT Ops : widgets porteurs de montants, refus explicite
  ('it_ops',      'periode-budgetaire',       false, false),
  ('it_ops',      'conformite-reel-previ',    false, false),
  ('it_ops',      'echeances-contrats-kpi',   false, false),
  ('it_ops',      'montants-engages-payes',   false, false),
  ('it_ops',      'echeances-tresorerie',     false, false),
  ('it_ops',      'valorisation-licences',    false, false),
  ('it_ops',      'cout-licences-manquantes', false, false),
  ('it_ops',      'cout-par-logiciel',        false, false),
  ('it_ops',      'montants-totaux',          false, false),
  ('it_ops',      'prevision-budgetaire',     false, false)
) AS w(profil_code, widget_code, visible_defaut, acces_autorise)
JOIN default_profil p ON p.code = w.profil_code
ON CONFLICT (id_profil, widget_code) DO UPDATE SET
  visible_defaut = EXCLUDED.visible_defaut,
  acces_autorise = EXCLUDED.acces_autorise;

-- ----------------------------------------------------------------------------
-- 2. Seuils par widget (cle naturelle widget_code + echelle)
--    echelle N = valeur d'entree du niveau N (1 vert, 2 jaune, 3 orange,
--    4 rouge), direction 'haut' ou 'bas'.
-- ----------------------------------------------------------------------------
INSERT INTO default_seuil_dashboard (widget_code, echelle, valeur, unite, direction) VALUES
  -- Ecart entre droits detenus et usage declare, en pourcentage des droits
  ('ecart-usage-droits',       1,     0, 'pct',    'haut'),
  ('ecart-usage-droits',       2,    10, 'pct',    'haut'),
  ('ecart-usage-droits',       3,    20, 'pct',    'haut'),
  ('ecart-usage-droits',       4,    30, 'pct',    'haut'),
  -- Echeances de contrats, en mois restants avant la date de fin
  ('echeances-contrats',       1,     3, 'mois',   'bas'),
  ('echeances-contrats',       2,     2, 'mois',   'bas'),
  ('echeances-contrats',       3,     1, 'mois',   'bas'),
  ('echeances-contrats',       4,     0, 'mois',   'bas'),
  -- Echeances de commandes, memes bornes
  ('echeances-commandes',      1,     3, 'mois',   'bas'),
  ('echeances-commandes',      2,     2, 'mois',   'bas'),
  ('echeances-commandes',      3,     1, 'mois',   'bas'),
  ('echeances-commandes',      4,     0, 'mois',   'bas'),
  -- KPI echeances des contrats du dashboard Financier, memes bornes
  ('echeances-contrats-kpi',   1,     3, 'mois',   'bas'),
  ('echeances-contrats-kpi',   2,     2, 'mois',   'bas'),
  ('echeances-contrats-kpi',   3,     1, 'mois',   'bas'),
  ('echeances-contrats-kpi',   4,     0, 'mois',   'bas'),
  -- Valorisation des licences non utilisees, en pourcentage du parc detenu
  ('valorisation-licences',    1,     0, 'pct',    'haut'),
  ('valorisation-licences',    2,     5, 'pct',    'haut'),
  ('valorisation-licences',    3,    10, 'pct',    'haut'),
  ('valorisation-licences',    4,    15, 'pct',    'haut'),
  -- Conformite budget reel contre previsionnel, en pourcentage de conformite
  ('conformite-reel-previ',    1,    95, 'pct',    'bas'),
  ('conformite-reel-previ',    2,    90, 'pct',    'bas'),
  ('conformite-reel-previ',    3,    80, 'pct',    'bas'),
  ('conformite-reel-previ',    4,     0, 'pct',    'bas'),
  -- Ecart valorise negatif (cout des licences manquantes), seuils en euros
  ('cout-licences-manquantes', 1,     0, 'euros',  'haut'),
  ('cout-licences-manquantes', 2, 10000, 'euros',  'haut'),
  ('cout-licences-manquantes', 3, 25000, 'euros',  'haut'),
  ('cout-licences-manquantes', 4, 50000, 'euros',  'haut'),
  -- Revalidations d'affectations, en jours restants avant echeance
  ('revalidations',            1,    30, 'jours',  'bas'),
  ('revalidations',            2,    15, 'jours',  'bas'),
  ('revalidations',            3,     7, 'jours',  'bas'),
  ('revalidations',            4,     0, 'jours',  'bas'),
  -- Validations en attente depuis plus de 24 heures, en nombre de saisies
  ('validations-attente',      1,     0, 'nombre', 'haut'),
  ('validations-attente',      2,     1, 'nombre', 'haut'),
  ('validations-attente',      3,     3, 'nombre', 'haut'),
  ('validations-attente',      4,     5, 'nombre', 'haut'),
  -- Anomalies de qualite des saisies, en nombre
  ('qualite-saisies',          1,     0, 'nombre', 'haut'),
  ('qualite-saisies',          2,     1, 'nombre', 'haut'),
  ('qualite-saisies',          3,     3, 'nombre', 'haut'),
  ('qualite-saisies',          4,     5, 'nombre', 'haut'),
  -- Indice de confiance des donnees, en points sur 100
  ('indice-confiance',         1,    70, 'points', 'bas'),
  ('indice-confiance',         2,    40, 'points', 'bas'),
  ('indice-confiance',         3,    20, 'points', 'bas'),
  ('indice-confiance',         4,     0, 'points', 'bas'),
  -- Indice de conformite global, en pourcentage de produits conformes
  ('indice-conformite',        1,    95, 'pct',    'bas'),
  ('indice-conformite',        2,    85, 'pct',    'bas'),
  ('indice-conformite',        3,    70, 'pct',    'bas'),
  ('indice-conformite',        4,     0, 'pct',    'bas'),
  -- Balance usages contre droits, en pourcentage de marge disponible
  ('balance-usages-droits',    1,    10, 'pct',    'bas'),
  ('balance-usages-droits',    2,     5, 'pct',    'bas'),
  ('balance-usages-droits',    3,     1, 'pct',    'bas'),
  ('balance-usages-droits',    4,     0, 'pct',    'bas'),
  -- Ecarts d'inventaire non rapproches, en nombre
  ('ecarts-inventaire',        1,     0, 'nombre', 'haut'),
  ('ecarts-inventaire',        2,     1, 'nombre', 'haut'),
  ('ecarts-inventaire',        3,     5, 'nombre', 'haut'),
  ('ecarts-inventaire',        4,    10, 'nombre', 'haut')
ON CONFLICT (widget_code, echelle) DO UPDATE SET
  valeur    = EXCLUDED.valeur,
  unite     = EXCLUDED.unite,
  direction = EXCLUDED.direction;

-- ----------------------------------------------------------------------------
-- 3. Codes retour du routeur dashboards (plage 5450-5499)
-- ----------------------------------------------------------------------------
INSERT INTO code_retour (code, type, libelle) VALUES
  -- Succes
  (5450, 'succes', 'Configuration des dashboards'),          -- GET /api/dashboards/configuration
  (5451, 'succes', 'Preferences de dashboard enregistrees'), -- PUT /api/dashboards/preferences
  (5452, 'succes', 'Synthese des saisies et revalidations'), -- GET /api/dashboards/synthese
  (5453, 'succes', 'Montants totaux par axe'),               -- GET /api/dashboards/montants-totaux
  (5454, 'succes', 'Montants engages et payes par editeur'), -- GET /api/dashboards/engages-payes
  -- Erreurs de validation
  (5460, 'erreur', 'L''axe demande est invalide'),           -- GET /api/dashboards/montants-totaux
  (5461, 'erreur', 'La periode demandee est invalide'),      -- GET montants-totaux, engages-payes
  (5462, 'erreur', 'Les preferences transmises sont invalides'), -- PUT /api/dashboards/preferences
  -- Erreur serveur du module
  (5499, 'erreur', 'Erreur serveur inattendue (dashboards)') -- toutes
ON CONFLICT (code) DO UPDATE SET
  type    = EXCLUDED.type,
  libelle = EXCLUDED.libelle;

COMMIT;
