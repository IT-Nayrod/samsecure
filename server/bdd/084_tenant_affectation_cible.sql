-- ============================================================================
-- SamSecure - BDD Tenant - Migration 084
-- Fichier   : 084_tenant_affectation_cible.sql
-- Objet     : cible de l'affectation (chantier droits, 06/10/2026) : un usage
--             declare vise un utilisateur nomme OU un poste / une machine.
--             reference_client restait un texte libre sans distinction typee ;
--             type_cible la porte : 'utilisateur' (defaut, valeur des lignes
--             existantes) ou 'poste' (poste de travail ou machine). Aucune
--             incidence sur la balance de conformite : les triggers du
--             precalcul (046, 058, 065, 068) comptent les quantites sans lire
--             cette colonne. La matrice d'acces IT Ops (D45) reste au
--             chantier RBAC : aucune permission nouvelle.
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 002 (affectation).
-- Rejouable : IF NOT EXISTS sur la colonne, contrainte sous garde
--             pg_constraint, sans effet au second passage.
-- Numero    : plage 080-090 reservee au chantier droits, 084 absent de
--             server/bdd et de toutes les branches au 06/10/2026.
-- ============================================================================

BEGIN;

ALTER TABLE affectation
  ADD COLUMN IF NOT EXISTS type_cible VARCHAR(15) NOT NULL DEFAULT 'utilisateur';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_affectation_type_cible') THEN
    ALTER TABLE affectation
      ADD CONSTRAINT ck_affectation_type_cible CHECK (type_cible IN ('utilisateur', 'poste'));
  END IF;
END $$;

COMMENT ON COLUMN affectation.type_cible IS
  'Cible de l''usage declare : utilisateur (nomme) ou poste (poste de travail ou machine). Les lignes anterieures valent utilisateur par defaut. reference_client reste la reference libre de la cible.';

COMMIT;
