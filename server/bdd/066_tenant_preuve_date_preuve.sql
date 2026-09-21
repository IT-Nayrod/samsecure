-- ============================================================================
-- SamSecure - BDD Tenant - Migration 066
-- Fichier   : 066_tenant_preuve_date_preuve.sql
-- Objet     : ticket client #214 du 16/09/2026, date de la preuve.
--             preuve.date_preuve (DATE, nullable) : date metier du document
--             (date de la facture, du bon de commande, du certificat...),
--             distincte de la date de depot dans SamSecure (created_at, posee
--             par la base et jamais saisie). Saisissable dans la modale de
--             depot pour tous les types, affichee dans la liste des preuves,
--             triable et filtrable par periode (GET /api/preuves,
--             date_preuve_min et date_preuve_max). Les preuves existantes
--             restent sans date : aucune valeur n'est inventee, aucun
--             UPDATE de rattrapage.
--             Champ fixe du formulaire et non ligne de default_type_preuve_champ
--             (060) : la definition par type rattache chaque champ a un code de
--             type (PK et FK code_type_preuve), il n'existe pas de champ commun
--             a tous les types ; la colonne est commune, elle vit sur preuve.
--             Index sur la colonne pour le tri et le filtre par periode de la
--             liste, comme idx_preuve_type, idx_preuve_contrat et
--             idx_preuve_commande (002).
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool).
-- Exécution : npm run migrate:dev / migrate:staging.
-- Depend    : 002 (preuve), 019 (nom_origine), 053 (id_licence).
-- Rejouable : ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, COMMENT
--             idempotent. Aucun DDL destructif, aucune suppression, aucune
--             modification de donnees.
-- Numero    : 066 absent de server/bdd et de toutes les branches distantes
--             au 16/09/2026, numero reserve par le protocole du chantier.
-- ============================================================================

BEGIN;

ALTER TABLE preuve ADD COLUMN IF NOT EXISTS date_preuve DATE;

COMMENT ON COLUMN preuve.date_preuve IS
  'Date metier du document (date de la facture, du bon, du certificat), saisie au depot, distincte de la date de depot created_at (#214). Nullable : les preuves anterieures restent sans date.';

CREATE INDEX IF NOT EXISTS idx_preuve_date_preuve ON preuve (date_preuve);

COMMIT;
