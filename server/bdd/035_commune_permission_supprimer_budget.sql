-- ============================================================================
-- SamSecure - BDD Commune - Migration 035
-- Fichier   : 035_commune_permission_supprimer_budget.sql
-- Objet     : acces au module budget selon la US #146 dans les defauts
--             SamSecure (default_permission, default_profil_permission).
--             La US fixe : Financier, Manager DSI et Admin en lecture et
--             ecriture ; suppression Manager DSI et Financier ; IT Ops en
--             lecture seule.
--             Nouvelle permission supprimer_budget (module budget, 29e code
--                du referentiel) : aucune permission existante ne separe la
--                suppression de la saisie, et coder l'exclusion par profil
--                dans l'API est contraire a la doctrine "aucun routeur ne
--                nomme de profil". Accordee a manager_dsi et financier (US),
--                et a admin_sam par la doctrine 011 ("toutes les permissions
--                du catalogue") suivie par la 031 : retirer admin_sam tient
--                en une ligne si la lecture litterale de la US est retenue.
--                Regle 021 respectee : le droit de supprimer implique
--                saisir_budget et consulter_budget, deja detenus.
--             AUCUN retrait sur it_ops : la matrice 011 validee (it_ops porte
--             consulter_budget et saisir_budget) reste la reference tant que
--             Samuel n'a pas tranche la question "IT Ops et le financier"
--             (avec saisir_licence, saisir_affectation et la visibilite des
--             montants via consulter_budget). La US place IT Ops en lecture :
--             ecart consigne, a valider. Pendant Tenant : 036.
--             Aucun DDL : migration de donnees uniquement.
-- Cible     : PostgreSQL 16 - base Commune, apres 034
-- Rejouable : ON CONFLICT DO NOTHING / DO UPDATE, meme motif que 031.
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

COMMIT;
