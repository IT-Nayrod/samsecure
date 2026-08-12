-- ============================================================================
-- SamSecure - BDD Tenant - Migration 010
-- Fichier   : 010_tenant_dashboards_module.sql
-- Objet     : ajoute le module de permissions "dashboards" (accès aux 3
--             dashboards de rôle), qui pilote le menu de bascule front.
--             Indépendant de consulter_kpi_financiers (module budget), qui
--             reste un droit métier classique et ne pilote pas ce sélecteur.
-- Cible     : PostgreSQL - base Tenant
-- Exécution : rejouable (ON CONFLICT DO NOTHING)
-- ============================================================================

BEGIN;

INSERT INTO permission (code, label, module) VALUES
  ('acceder_dashboard_manager_dsi', 'Accéder au dashboard Manager DSI', 'dashboards'),
  ('acceder_dashboard_financier',   'Accéder au dashboard Financier',   'dashboards'),
  ('acceder_dashboard_it_ops',      'Accéder au dashboard IT Ops',      'dashboards')
ON CONFLICT (code) DO NOTHING;

COMMIT;
