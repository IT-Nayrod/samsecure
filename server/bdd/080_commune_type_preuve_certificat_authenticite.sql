-- ============================================================================
-- SamSecure - BDD Commune - Migration 080
-- Fichier   : 080_commune_type_preuve_certificat_authenticite.sql
-- Objet     : nouveau type de preuve "certificat d'authenticite" (D57,
--             decision client du 11/09/2026) : piece propre a la licence,
--             facultative, distincte du type generique "certificat" (053).
--             Seed du defaut SamSecure (default_type_preuve) ; le pendant
--             Tenant (type_preuve, motif copy-on-write) est la 081. Aucun
--             champ additionnel (default_type_preuve_champ) : le formulaire
--             commun suffit. Le front ne propose ce type que sur le
--             rattachement licence (TYPES_PAR_RATTACHEMENT, PreuveFormModal).
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom :
--             migrate.js route sur commonPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 026 (default_type_preuve), 054 (liste fermee #208).
-- Rejouable : ON CONFLICT (code) DO UPDATE, sans effet au second passage.
-- Numero    : plage 080-090 reservee au chantier droits, 080 absent de
--             server/bdd et de toutes les branches au 06/10/2026.
-- ============================================================================

BEGIN;

INSERT INTO default_type_preuve (code, label) VALUES
  ('certificat_authenticite', 'Certificat d''authenticité')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label;

COMMIT;
