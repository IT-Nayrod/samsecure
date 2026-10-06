-- ============================================================================
-- SamSecure - BDD Commune - Migration 091
-- Fichier   : 091_commune_seuils_dashboard_codes.sql
-- Objet     : codes retour de l'édition des seuils de dashboard par
--             l'administrateur du tenant (chantier seuils) : GET et PUT
--             /api/dashboards/seuils, POST /api/dashboards/seuils/retablir.
--             Plage 5450-5499 du routeur dashboards (convention 050 :
--             x50-x59 succès, x60-x69 erreurs de validation).
--             Pré-catalogue : server/docs/codes_retour.md.
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom :
--             migrate.js route sur commonPool).
-- Exécution : npm run migrate:dev / migrate:staging, puis redémarrage de
--             l'API (le catalogue code_retour est chargé au démarrage).
-- Depend    : 024 (table code_retour), 050 (plage 5450-5499).
-- Rejouable : oui, ON CONFLICT DO UPDATE sur le code.
-- Numero    : 091 (deux fichiers sous ce numéro, un par base : celui-ci et
--             091_tenant_seuils_dashboard_diffusion.sql, chacun suivi dans la
--             table _migrations de sa base).
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  (5455, 'succes', 'Seuils des dashboards du tenant'),
  (5456, 'succes', 'Seuil de dashboard enregistré'),
  (5457, 'succes', 'Seuils de dashboard rétablis aux valeurs par défaut'),
  (5463, 'erreur', 'Le seuil transmis est invalide'),
  (5464, 'erreur', 'Le seuil demandé est inconnu')
ON CONFLICT (code) DO UPDATE SET
  type    = EXCLUDED.type,
  libelle = EXCLUDED.libelle;

COMMIT;
