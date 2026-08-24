-- ============================================================================
-- SamSecure - BDD Tenant - Migration 030
-- Fichier   : 030_tenant_permission_importer_inventaire.sql
-- Objet     : permission importer_inventaire (module deploiement, US #111)
--             dans le referentiel du tenant (permission) et la matrice des
--             groupes (profil_permission) : admin_sam et manager_dsi.
--             IT Ops conserve consulter_inventaire + rapprocher_inventaire,
--             Financier consulter_inventaire seule. Pendant Commune : 029.
--             Aucun DDL : migration de donnees uniquement.
-- Cible     : PostgreSQL 16 - base Tenant, a jouer sur dev ET staging
-- Rejouable : ON CONFLICT DO NOTHING / DO UPDATE, meme motif que 007 et 021.
-- ============================================================================

BEGIN;

INSERT INTO permission (code, label, module) VALUES
  ('importer_inventaire', 'Importer un releve d''inventaire', 'deploiement')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, module = EXCLUDED.module;

INSERT INTO profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM profil p
JOIN permission perm ON perm.code = 'importer_inventaire'
WHERE p.code IN ('admin_sam', 'manager_dsi')
ON CONFLICT (id_profil, id_permission) DO NOTHING;

COMMIT;
