-- ============================================================================
-- SamSecure - BDD Commune - Migration 029
-- Fichier   : 029_commune_permission_importer_inventaire.sql
-- Objet     : permission importer_inventaire (module deploiement, US #111)
--             dans les defauts SamSecure : default_permission et matrice
--             default_profil_permission pour admin_sam et manager_dsi.
--             Motif : l'import manuel d'un releve introduit des donnees dans
--             le parc ; consulter_inventaire et rapprocher_inventaire ne
--             separent pas Manager DSI (import autorise) d'IT Ops (lecture et
--             rapprochement seulement). Regle 021 respectee : le droit
--             d'import implique consulter_inventaire, deja detenu.
--             Aucun DDL : migration de donnees uniquement. Pendant Tenant : 030.
-- Cible     : PostgreSQL 16 - base Commune, apres 027
-- Rejouable : ON CONFLICT DO NOTHING / DO UPDATE, meme motif que 027.
-- ============================================================================

BEGIN;

INSERT INTO default_permission (code, label, module) VALUES
  ('importer_inventaire', 'Importer un releve d''inventaire', 'deploiement')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, module = EXCLUDED.module;

INSERT INTO default_profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM default_profil p
JOIN default_permission perm ON perm.code = 'importer_inventaire'
WHERE p.code IN ('admin_sam', 'manager_dsi')
ON CONFLICT (id_profil, id_permission) DO NOTHING;

COMMIT;
