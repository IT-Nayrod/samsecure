-- ============================================================================
-- SamSecure - BDD Tenant - Migration 102
-- Fichier   : 102_tenant_maintenance_date_fin_obligatoire.sql
-- Objet     : decision client du 06/10/2026 (#280) : une maintenance a
--             toujours une date de fin. Contrainte CHECK NOT VALID sur
--             maintenance_historique.date_fin : toute nouvelle ecriture
--             (INSERT comme UPDATE) doit poser une date ; les lignes
--             historiques sans date restent intactes (NOT VALID : jamais
--             validees retroactivement, aucune donnee modifiee) et sont
--             servies echues par l'API (maintenanceLicence.js, SELECT_MAINTENANCE).
--             L'API refuse en amont avec le code 4039 (400 lisible) ; la
--             contrainte est le garde-fou. ck_maintenance_dates (002, fin >=
--             debut) reste inchangee et complementaire.
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool).
-- Exécution : npm run migrate:dev / migrate:staging.
-- Depend    : 002 (table maintenance_historique, ck_maintenance_dates).
-- Rejouable : ADD CONSTRAINT sous garde pg_constraint, joue au plus une fois ;
--             aucune suppression, aucune modification de donnees.
-- Numero    : 102 (Tenant) reserve a ce chantier, verifie libre sur toutes
--             les branches locales au 07/10/2026.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname  = 'ck_maintenance_date_fin_obligatoire'
       AND conrelid = 'maintenance_historique'::regclass
  ) THEN
    ALTER TABLE maintenance_historique
      ADD CONSTRAINT ck_maintenance_date_fin_obligatoire
      CHECK (date_fin IS NOT NULL) NOT VALID;
  END IF;
END
$$;

COMMENT ON CONSTRAINT ck_maintenance_date_fin_obligatoire ON maintenance_historique IS
  'Une maintenance a toujours une date de fin (décision client du 06/10/2026, #280). NOT VALID : les périodes historiques sans date restent en base et sont servies échues ; toute nouvelle écriture doit poser la date (refus API 4039 en amont).';

COMMIT;
