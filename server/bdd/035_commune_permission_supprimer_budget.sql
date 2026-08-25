-- ============================================================================
-- SamSecure - BDD Commune - Migration 035
-- Fichier   : 035_commune_permission_supprimer_budget.sql
-- Objet     : acces au module budget selon la US #146 dans les defauts
--             SamSecure (default_permission, default_profil_permission).
--             La US fixe : Financier, Manager DSI et Admin en lecture et
--             ecriture ; suppression Manager DSI et Financier ; IT Ops en
--             lecture seule.
--             1) Nouvelle permission supprimer_budget (module budget, 29e code
--                du referentiel) : aucune permission existante ne separe la
--                suppression de la saisie, et coder l'exclusion par profil
--                dans l'API est contraire a la doctrine "aucun routeur ne
--                nomme de profil". Accordee a manager_dsi et financier (US),
--                et a admin_sam par la doctrine 011 ("toutes les permissions
--                du catalogue") suivie par la 031 : retirer admin_sam tient
--                en une ligne si la lecture litterale de la US est retenue.
--                Regle 021 respectee : le droit de supprimer implique
--                saisir_budget et consulter_budget, deja detenus.
--             2) Retrait de saisir_budget a it_ops : la matrice 011 lui donnait
--                la saisie, la US le place en lecture. DELETE physique, la
--                Commune n'ayant pas de soft delete (meme geste que le retrait
--                021 rejoue par la 027). Pendant Tenant : 036.
--             Aucun DDL : migration de donnees uniquement.
-- Cible     : PostgreSQL 16 - base Commune, apres 034
-- Rejouable : ON CONFLICT DO NOTHING / DO UPDATE et DELETE cible, meme motif
--             que 027 et 031.
-- ============================================================================

BEGIN;

INSERT INTO default_permission (code, label, module) VALUES
  ('supprimer_budget', 'Supprimer une ligne budgetaire', 'budget')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, module = EXCLUDED.module;

INSERT INTO default_profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM default_profil p
JOIN default_permission perm ON perm.code = 'supprimer_budget'
WHERE p.code IN ('admin_sam', 'manager_dsi', 'financier')
ON CONFLICT (id_profil, id_permission) DO NOTHING;

-- IT Ops : lecture seule du budget (US #146).
DELETE FROM default_profil_permission dpp
 USING default_profil p, default_permission perm
 WHERE dpp.id_profil = p.id
   AND dpp.id_permission = perm.id
   AND p.code = 'it_ops'
   AND perm.code = 'saisir_budget';

COMMIT;
