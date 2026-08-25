-- ============================================================================
-- SamSecure - BDD Tenant - Migration 036
-- Fichier   : 036_tenant_permission_supprimer_budget.sql
-- Objet     : acces au module budget selon la US #146 dans le referentiel du
--             tenant (permission) et la matrice des groupes (profil_permission).
--             Permission supprimer_budget (module budget) : admin_sam,
--             manager_dsi, financier. Voir 035 pour le motif et le point
--             d'attention sur admin_sam.
--             AUCUN retrait sur it_ops : la matrice 011 validee (it_ops porte
--             consulter_budget et saisir_budget) reste la reference tant que
--             Samuel n'a pas tranche la question "IT Ops et le financier". La
--             US place IT Ops en lecture : ecart consigne, a valider. Le jour
--             ou le retrait est acte, meme geste que la 021 (UPDATE
--             profil_permission SET date_suppression = now()).
--             Pendant Commune : 035. Aucun DDL : migration de donnees
--             uniquement. Le controle des permissions (routesPermissions.js)
--             exige supprimer_budget sur DELETE /api/budget/:id.
-- Cible     : PostgreSQL 16 - base Tenant, a jouer sur dev ET staging
-- Rejouable : ON CONFLICT DO NOTHING / DO UPDATE, meme motif que 032.
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

COMMIT;
