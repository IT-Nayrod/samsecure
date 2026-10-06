-- ============================================================================
-- SamSecure - BDD Commune - Migration 085
-- Fichier   : 085_commune_code_retour_affectation_cible.sql
-- Objet     : code retour de la cible d'affectation (084) : 4133, type de
--             cible invalide (valeurs admises : utilisateur, poste).
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom :
--             migrate.js route sur commonPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 024 (code_retour), 084 (affectation.type_cible).
-- Rejouable : ON CONFLICT DO UPDATE, sans effet au second passage.
-- Numero    : plage 080-090 reservee au chantier droits, 085 absent de
--             server/bdd et de toutes les branches au 06/10/2026.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  (4133, 'erreur', 'Le type de cible est invalide')  -- POST, PATCH /api/affectations
ON CONFLICT (code) DO UPDATE SET
  type    = EXCLUDED.type,
  libelle = EXCLUDED.libelle;

COMMIT;
