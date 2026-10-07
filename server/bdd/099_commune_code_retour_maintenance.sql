-- ============================================================================
-- SamSecure - BDD Commune - Migration 099
-- Fichier   : 099_commune_code_retour_maintenance.sql
-- Objet     : seed du code 4039 (plage 4030-4039 historique de maintenance,
--             decoupage prevu par l'en-tete de la 028) : refus d'une periode
--             de maintenance sans date de fin (decision client du 06/10/2026,
--             #280). Emis par validerMaintenance (server/routes/licences.js),
--             contrainte Tenant 102 en garde-fou. Libelle reporte dans
--             server/docs/codes_retour.md.
-- Cible     : PostgreSQL 16 - base Commune, apres 028
-- Exécution : npm run migrate:dev / migrate:staging (puis redemarrer l'API :
--             le catalogue code_retour est charge au demarrage).
-- Depend    : 024 (table code_retour), 028 (plage licences 4000-4099).
-- Rejouable : ON CONFLICT (code) DO UPDATE sur type et libelle, meme motif
--             que 025 et 028.
-- Numero    : 099 (Commune) attribue par arbitrage du 07/10/2026 (le 103
--             est pris par le chantier societes), verifie libre sur toutes
--             les branches locales au 07/10/2026.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  (4039, 'erreur', 'La date de fin de la maintenance est obligatoire')  -- POST, PATCH /api/licences/:id/maintenance
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type,
  libelle = EXCLUDED.libelle;

COMMIT;
