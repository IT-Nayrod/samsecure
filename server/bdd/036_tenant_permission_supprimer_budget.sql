-- ============================================================================
-- SamSecure - BDD Tenant - Migration 036
-- Fichier   : 036_tenant_permission_supprimer_budget.sql
-- Objet     : acces au module budget selon la US #146 dans le referentiel du
--             tenant (permission) et la matrice des groupes (profil_permission).
--             1) Permission supprimer_budget (module budget) : admin_sam,
--                manager_dsi, financier. Voir 035 pour le motif et le point
--                d'attention sur admin_sam.
--             2) Retrait de saisir_budget a it_ops (US : IT Ops en lecture).
--                Soft delete et non DELETE, comme la 021 : la trace du retrait
--                reste lisible, et une ligne soft-supprimee resiste a un rejeu
--                de la 011, dont le ON CONFLICT DO NOTHING ne la ressuscite
--                pas. it_ops conserve consulter_budget.
--             Pendant Commune : 035. Aucun DDL : migration de donnees
--             uniquement. Le controle des permissions (routesPermissions.js)
--             exige supprimer_budget sur DELETE /api/budget/:id.
-- Cible     : PostgreSQL 16 - base Tenant, a jouer sur dev ET staging
-- Rejouable : ON CONFLICT DO NOTHING / DO UPDATE a l'ajout, garde sur
--             date_suppression au retrait, meme motif que 021 et 032.
-- ============================================================================

BEGIN;

INSERT INTO permission (code, label, module) VALUES
  ('supprimer_budget', 'Supprimer une ligne budgetaire', 'budget')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, module = EXCLUDED.module;

INSERT INTO profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM profil p
JOIN permission perm ON perm.code = 'supprimer_budget'
WHERE p.code IN ('admin_sam', 'manager_dsi', 'financier')
ON CONFLICT (id_profil, id_permission) DO NOTHING;

-- IT Ops : lecture seule du budget (US #146).
UPDATE profil_permission pp
   SET date_suppression = now()
  FROM profil p, permission perm
 WHERE pp.id_profil = p.id
   AND pp.id_permission = perm.id
   AND p.code = 'it_ops'
   AND perm.code = 'saisir_budget'
   AND pp.date_suppression IS NULL;

COMMIT;
