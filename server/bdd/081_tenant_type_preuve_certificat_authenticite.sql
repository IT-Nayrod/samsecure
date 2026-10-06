-- ============================================================================
-- SamSecure - BDD Tenant - Migration 081
-- Fichier   : 081_tenant_type_preuve_certificat_authenticite.sql
-- Objet     : pendant Tenant de la 080 (D57) : seed du type de preuve
--             "certificat d'authenticite" dans type_preuve, selon le motif
--             copy-on-write des referentiels (003, 018, 053) : une ligne
--             marquee personnalise garde son libelle, valeurs_defaut porte la
--             copie du defaut pour un retablissement.
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 002 (type_preuve), 053 (liste fermee #208, motif protege).
-- Rejouable : ON CONFLICT (code) selon le motif protege, sans effet au
--             second passage.
-- Numero    : plage 080-090 reservee au chantier droits, 081 absent de
--             server/bdd et de toutes les branches au 06/10/2026.
-- ============================================================================

BEGIN;

INSERT INTO type_preuve (code, label, valeurs_defaut) VALUES
  ('certificat_authenticite', 'Certificat d''authenticité',
   '{"label": "Certificat d''authenticité"}')
ON CONFLICT (code) DO UPDATE SET
  label          = CASE WHEN type_preuve.personnalise THEN type_preuve.label ELSE EXCLUDED.label END,
  valeurs_defaut = EXCLUDED.valeurs_defaut;

COMMIT;
