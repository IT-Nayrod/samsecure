-- ============================================================================
-- SamSecure - BDD Tenant - Migration 070
-- Fichier   : 070_tenant_type_contrat_standard_interne.sql
-- Objet     : #218, Simple devient Standard : le libelle affiche du type de
--             contrat de code 'simple' passe a "Standard". Le code ne change
--             pas, contrat.id_type_contrat non plus : les contrats existants
--             ne bougent pas. UPDATE borne a la ligne de code 'simple', motif
--             protege du referentiel (003) : une ligne marquee personnalise
--             garde le libelle du client, seule sa copie du defaut
--             (valeurs_defaut, bouton retablir) suit.
--             Pendant Commune : 071 (default_type_contrat).
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool).
-- Exécution : npm run migrate:dev / migrate:staging.
-- Depend    : 002 (type_contrat), 003 (seed des types).
-- Rejouable : UPDATE borne idempotent, COMMENT idempotent. Aucun DDL
--             destructif, aucune suppression.
-- Numero    : 070 reserve par le protocole du chantier, absent de server/bdd,
--             de toutes les branches et de tous les worktrees au 21/09/2026.
-- ============================================================================

BEGIN;

UPDATE type_contrat
   SET label          = CASE WHEN personnalise THEN label ELSE 'Standard' END,
       valeurs_defaut = '{"label": "Standard"}'::jsonb
 WHERE code = 'simple';

COMMENT ON TABLE type_contrat IS 'Types contractuels (CGU/CGV, Standard, Cadre). Seedé. Le code du type Standard reste ''simple'' (#218).';

COMMIT;
