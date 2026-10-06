-- ============================================================================
-- SamSecure - BDD Tenant - Migration 082
-- Fichier   : 082_tenant_facture_montant.sql
-- Objet     : montant de la facture (depot unifie, decision client du
--             10/09/2026 : le type facture exige montant et date). La date de
--             la facture est deja portee par la preuve support
--             (preuve.date_preuve, 066) ; le montant manquait. Colonne
--             nullable : les factures anterieures restent sans montant,
--             l'obligation est portee par le depot (POST /factures/depot,
--             code 3257) et par la definition des champs (083). Montant
--             financier : servi a null avec montants_masques sans la
--             permission consulter_kpi_financiers, comme licence.cout_licence.
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 002 (facture), 066 (preuve.date_preuve).
-- Rejouable : IF NOT EXISTS sur la colonne, contrainte sous garde
--             pg_constraint, sans effet au second passage.
-- Numero    : plage 080-090 reservee au chantier droits, 082 absent de
--             server/bdd et de toutes les branches au 06/10/2026.
-- ============================================================================

BEGIN;

ALTER TABLE facture ADD COLUMN IF NOT EXISTS montant NUMERIC(14, 2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_facture_montant') THEN
    ALTER TABLE facture
      ADD CONSTRAINT ck_facture_montant CHECK (montant IS NULL OR montant >= 0);
  END IF;
END $$;

COMMENT ON COLUMN facture.montant IS
  'Montant de la facture (decision du 10/09/2026, depot unifie). Obligatoire au depot (3257), nullable pour les factures anterieures. Masque sans consulter_kpi_financiers.';

COMMIT;
