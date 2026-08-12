-- ============================================================================
-- SamSecure - BDD Tenant - Migration 011
-- Fichier   : 011_tenant_groupes_matrice.sql
-- Objet     : attribue à Manager DSI / Financier / IT Ops (déjà seedés en 003)
--             la matrice de permissions cohérente avec le comportement
--             historique du front (Sidebar/useRbac) : organisation,
--             droits_usage, deploiement, budget, rapports — jamais de
--             permission administration pour ces 3 groupes — plus leur
--             permission dashboard dédiée (migration 010).
--             Fait de admin_sam (rôle interne SamSecure, seedé en 003) le
--             groupe d'administration complète du tenant : diffusion tenant
--             + toutes les permissions du catalogue (administration et
--             dashboards compris). Décision actée avec Dorian : on réutilise
--             le groupe d'Antonin plutôt que d'en créer un nouveau
--             ("administrateur", créé par erreur dans une version antérieure
--             de cette migration, n'est plus créé ici).
-- Cible     : PostgreSQL - base Tenant
-- Exécution : rejouable (ON CONFLICT DO NOTHING)
-- ============================================================================

BEGIN;

-- Diffusion à l'échelle du tenant (NULL) pour les 4 groupes concernés.
INSERT INTO profil_societe (id_profil, id_societe)
SELECT p.id, NULL FROM profil p
WHERE p.code IN ('manager_dsi', 'financier', 'it_ops', 'admin_sam')
ON CONFLICT ON CONSTRAINT uq_profil_societe DO NOTHING;

-- ----------------------------------------------------------------------------
-- Manager DSI : plein accès organisation / droits d'usage / déploiement
-- (validation des saisies comprise) / budget / rapports + dashboard dédié.
-- ----------------------------------------------------------------------------
INSERT INTO profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM profil p
JOIN permission perm ON perm.code IN (
  'consulter_referentiels', 'gerer_referentiels', 'gerer_contacts',
  'consulter_contrats', 'saisir_contrat', 'saisir_commande', 'consulter_factures', 'deposer_facture_preuve',
  'consulter_licences', 'saisir_licence', 'saisir_affectation', 'valider_saisie', 'consulter_inventaire', 'rapprocher_inventaire',
  'consulter_budget', 'saisir_budget', 'consulter_kpi_financiers',
  'generer_rapport_conformite', 'generer_rapport_optimisation', 'creer_rapport_personnalise',
  'acceder_dashboard_manager_dsi'
)
WHERE p.code = 'manager_dsi'
ON CONFLICT (id_profil, id_permission) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Financier : suivi budgétaire et financier ; lecture des référentiels,
-- contrats et factures ; pas de saisie opérationnelle (contrats/commandes/
-- licences/affectations restent à Manager DSI et IT Ops) + dashboard dédié.
-- ----------------------------------------------------------------------------
INSERT INTO profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM profil p
JOIN permission perm ON perm.code IN (
  'consulter_referentiels',
  'consulter_contrats', 'consulter_factures', 'deposer_facture_preuve',
  'consulter_licences', 'consulter_inventaire',
  'consulter_budget', 'saisir_budget', 'consulter_kpi_financiers',
  'generer_rapport_conformite', 'generer_rapport_optimisation', 'creer_rapport_personnalise',
  'acceder_dashboard_financier'
)
WHERE p.code = 'financier'
ON CONFLICT (id_profil, id_permission) DO NOTHING;

-- ----------------------------------------------------------------------------
-- IT Ops : saisie et gestion opérationnelle des déploiements ; pas de
-- validation (rôle de Manager DSI) ni de rapports + dashboard dédié.
-- ----------------------------------------------------------------------------
INSERT INTO profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM profil p
JOIN permission perm ON perm.code IN (
  'consulter_referentiels', 'gerer_referentiels', 'gerer_contacts',
  'consulter_contrats', 'saisir_contrat', 'saisir_commande', 'consulter_factures', 'deposer_facture_preuve',
  'consulter_licences', 'saisir_licence', 'saisir_affectation', 'consulter_inventaire', 'rapprocher_inventaire',
  'consulter_budget', 'saisir_budget',
  'acceder_dashboard_it_ops'
)
WHERE p.code = 'it_ops'
ON CONFLICT (id_profil, id_permission) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Admin SAM : toutes les permissions du catalogue, dashboards et
-- administration inclus (groupe d'administration complète du tenant).
-- ----------------------------------------------------------------------------
INSERT INTO profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM profil p
CROSS JOIN permission perm
WHERE p.code = 'admin_sam'
ON CONFLICT (id_profil, id_permission) DO NOTHING;

COMMIT;
