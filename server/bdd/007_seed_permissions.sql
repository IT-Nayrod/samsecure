-- ============================================================================
-- SamSecure - BDD Tenant - Seed des permissions
-- Fichier   : 005_seed_permissions.sql
-- Cible     : PostgreSQL 16 - base Tenant
-- Exécution : psql -U samsecure_app -d samsecure_tenant_client01_dev -f 005_seed_permissions.sql
-- Note      : idempotent (ON CONFLICT sur code). Les codes techniques sont le
--             contrat d'API et ne doivent jamais changer.
-- ============================================================================

BEGIN;

INSERT INTO permission (code, label, module) VALUES
  -- Organisation
  ('consulter_referentiels',       'Consulter les référentiels (sociétés, éditeurs, revendeurs, logiciels)', 'organisation'),
  ('gerer_referentiels',           'Créer et modifier les fiches référentiels',                              'organisation'),
  ('gerer_contacts',               'Gérer les contacts',                                                     'organisation'),
  -- Droits d'usage
  ('consulter_contrats',           'Consulter les contrats et sous-contrats',                                'droits_usage'),
  ('saisir_contrat',               'Saisir et modifier un contrat',                                          'droits_usage'),
  ('saisir_commande',              'Saisir une commande',                                                    'droits_usage'),
  ('consulter_factures',           'Consulter les factures et preuves',                                      'droits_usage'),
  ('deposer_facture_preuve',       'Déposer une facture ou une preuve',                                      'droits_usage'),
  -- Déploiement
  ('consulter_licences',           'Consulter le patrimoine de licences',                                    'deploiement'),
  ('saisir_licence',               'Saisir une licence',                                                     'deploiement'),
  ('saisir_affectation',           'Déclarer une affectation',                                               'deploiement'),
  ('valider_saisie',               'Valider ou refuser les saisies (workflow)',                              'deploiement'),
  ('consulter_inventaire',         'Consulter les données d''inventaire',                                    'deploiement'),
  ('rapprocher_inventaire',        'Rapprocher inventaire et affectations',                                  'deploiement'),
  -- Budget
  ('consulter_budget',             'Consulter le budget et ses KPI',                                         'budget'),
  ('saisir_budget',                'Saisir les lignes budgétaires (prévisionnel, alloué)',                   'budget'),
  ('consulter_kpi_financiers',     'Accéder aux tableaux de bord financiers',                                'budget'),
  -- Rapports
  ('generer_rapport_conformite',   'Générer les rapports de conformité',                                     'rapports'),
  ('generer_rapport_optimisation', 'Générer les rapports d''optimisation',                                   'rapports'),
  ('creer_rapport_personnalise',   'Créer des rapports personnalisés',                                       'rapports'),
  -- Administration
  ('gerer_utilisateurs',           'Gérer les utilisateurs et leurs profils',                                'administration'),
  ('gerer_exceptions_droit',       'Gérer les exceptions de droits',                                         'administration'),
  ('consulter_audit_log',          'Consulter le journal d''audit',                                          'administration'),
  ('gerer_connecteurs',            'Gérer les connecteurs d''inventaire',                                    'administration')
ON CONFLICT (code) DO NOTHING;

COMMIT;
