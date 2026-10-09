-- ============================================================================
-- SamSecure - BDD Commune - Migration 109
-- Fichier   : 109_commune_code_retour_societes_archivage.sql
-- Objet     : renommage des libelles des codes retour 2092 et 2093. Decision
--             client du 08/10/2026 (story #281, tache "Renommer la
--             desactivation en archivage") : une societe ne se desactive pas,
--             elle s'archive, le vocabulaire des contrats (issue #96). Les
--             codes 2090 et 2091 de la meme plage gardent leur libelle (aucun
--             vocabulaire de desactivation a renommer). UPDATE borne aux codes
--             du chantier, aucun DDL, aucune migration tenant (les colonnes
--             actif et date_fin_activite portent deja l'etat archive).
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom)
-- Execution : npm run migrate:dev / migrate:staging, puis redemarrage de l'API
--             (catalogue code_retour charge au demarrage)
-- Depend    : 103 (seed des codes 2090 a 2093)
-- Rejouable : UPDATE idempotents bornes par code, aucune suppression.
-- Numero    : 109 reserve par le chantier societes-archivage, libre dans
--             server/bdd et sur les branches au 09/10/2026
-- ============================================================================

BEGIN;

UPDATE code_retour SET libelle = 'Société archivée'  WHERE code = 2092;
UPDATE code_retour SET libelle = 'Société restaurée' WHERE code = 2093;

COMMIT;
