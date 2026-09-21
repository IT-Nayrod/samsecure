-- ============================================================================
-- SamSecure - BDD Commune - Migration 071
-- Fichier   : 071_commune_type_contrat_standard_interne.sql
-- Objet     : pendant Commune de la 070 (chantier contrats-types).
--             #218 : le defaut SamSecure du type de contrat de code 'simple'
--             (default_type_contrat, rapproche du Tenant par code) prend le
--             libelle "Standard", le code ne change pas. Sans cet alignement,
--             un tenant provisionne depuis les defauts retrouverait "Simple".
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom),
--             apres 067.
-- Exécution : manuelle sur dev puis staging.
-- Depend    : 026 (default_type_contrat), 027 (seed des defauts).
-- Rejouable : ON CONFLICT (code) DO UPDATE (meme motif que 027). Aucun DDL,
--             aucune suppression.
-- Numero    : 071 reserve par le protocole du chantier, absent de server/bdd,
--             de toutes les branches et de tous les worktrees au 21/09/2026.
-- ============================================================================

BEGIN;

-- Defauts des types de contrat : meme motif que 027, le libelle du defaut suit.
INSERT INTO default_type_contrat (code, label) VALUES
  ('simple',  'Standard')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label;

COMMIT;
