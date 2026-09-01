-- ============================================================================
-- SamSecure - BDD Commune - Migration 047
-- Fichier   : 047_commune_code_retour_conformite.sql
-- Objet     : module 3, conformite, qualite des saisies et indice de
--             confiance (US #116).
--             1) seed de code_retour : plage 4300-4399 (conformite, module 3)
--                et plage 5400-5449 (qualite des saisies et confiance).
--                Decoupage habituel : x00-x09 succes, x10-x29 erreurs de
--                filtre et de validation, x99 (ou 5449) erreur serveur.
--                Libelles reportes dans server/docs/codes_retour.md.
--             2) seuils de conformite par defaut dans default_seuil_dashboard
--                (pendant Commune du seed Tenant de la 046) : taux
--                d'attention en pourcent et seuil en montant sur l'ecart
--                valorise negatif. La structure existante suffit, la colonne
--                unite portant le type du seuil (commentaire du DDL 002 :
--                "le type en montant d'ecart valorise passe par unite =
--                euros") : aucune colonne ajoutee.
--             Note : les libelles de cette migration sont accentues, suivant
--             la consigne de la story (textes destines a l'ecran en francais
--             accentue). Les migrations 025 a 042 sont en ASCII : ecart de
--             style signale dans le journal, homogeneisation a arbitrer.
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom :
--             migrate.js route sur commonPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 024 (table code_retour), 026 (default_seuil_dashboard).
-- Rejouable : ON CONFLICT (code) DO UPDATE sur les codes (referentiel
--             technique non personnalisable, la derniere livraison fait foi,
--             meme motif que 025 et 034) ; ON CONFLICT DO NOTHING sur les
--             seuils par defaut (valeurs de reference, jamais reecrites).
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  -- Conformite (#116) : succes
  (4300, 'succes', 'État de conformité par produit'),  -- GET /api/conformite
  (4301, 'succes', 'Synthèse de conformité'),  -- GET /api/conformite/synthese
  -- Conformite (#116) : erreurs de filtre
  (4310, 'erreur', 'Identifiant de société invalide'),  -- GET /api/conformite
  (4311, 'erreur', 'Identifiant d''éditeur invalide'),  -- GET /api/conformite
  (4312, 'erreur', 'Identifiant de produit invalide'),  -- GET /api/conformite
  (4313, 'erreur', 'Le niveau demandé doit être global, editeur ou societe'),  -- GET /api/conformite/synthese
  (4399, 'erreur', 'Erreur serveur inattendue (module conformité)'),  -- toutes
  -- Qualite des saisies et confiance (#116) : succes
  (5400, 'succes', 'État de la qualité des saisies'),  -- GET /api/qualite
  (5401, 'succes', 'Indice de confiance'),  -- GET /api/confiance
  -- Qualite des saisies et confiance (#116) : erreurs de filtre
  (5410, 'erreur', 'Identifiant de société invalide'),  -- GET /api/confiance
  (5449, 'erreur', 'Erreur serveur inattendue (module qualité et confiance)')  -- les deux
ON CONFLICT (code) DO UPDATE
  SET type = EXCLUDED.type, libelle = EXCLUDED.libelle;

-- ----------------------------------------------------------------------------
-- Seuils de conformite par defaut (echelle 1). Diffusion vers seuil_dashboard
-- par rapprochement widget_code + echelle (voie seedee en direct par la 046
-- cote Tenant, comme les referentiels 003/007/010).
-- ----------------------------------------------------------------------------
INSERT INTO default_seuil_dashboard (widget_code, echelle, valeur, unite, direction) VALUES
  ('conformite_taux',           1,    90.00, 'pourcent', 'max'),
  ('conformite_ecart_valorise', 1, 10000.00, 'euros',    'max')
ON CONFLICT (widget_code, echelle) DO NOTHING;

COMMIT;
