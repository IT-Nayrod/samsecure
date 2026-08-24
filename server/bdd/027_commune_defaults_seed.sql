-- ============================================================================
-- SamSecure - BDD Commune - Migration 027
-- Fichier   : 027_commune_defaults_seed.sql
-- Objet     : seed des tables default_* (026) avec les defauts SamSecure deja
--             livres cote Tenant, pour que la Commune devienne la source de
--             verite des defauts sans changer une seule valeur :
--               default_profil            <- 003
--               default_permission        <- 007 (24 codes) + 010 (3 dashboards)
--               default_profil_permission <- 011 puis 021 (etat final de la
--                                            matrice : retrait de
--                                            gerer_utilisateurs et
--                                            consulter_audit_log sur
--                                            manager_dsi, ajout de
--                                            it_data_input)
--               default_fonction          <- 003
--               default_type_contrat      <- 003
--               default_type_preuve       <- 018 (liste alignee interface,
--                                            remplace celle du 003)
--               default_mode_commande     <- 018 (idem)
--               default_unite_mesure      <- 003
--             default_profil_widget et default_seuil_dashboard : AUCUNE source
--             dans le depot (le 003 renvoie a Dashboard_Spec_v2, absent) ;
--             tables laissees vides, rien n'est invente.
-- Cible     : PostgreSQL 16 - base Commune, apres 026
-- Exécution : npm run migrate:dev / migrate:staging
-- Rejouable : ON CONFLICT (code) DO UPDATE : en Commune il n'y a pas de motif
--             protege (personnalise), la derniere livraison de defauts fait
--             foi. Les lignes de matrice sont ajoutees ON CONFLICT DO NOTHING
--             et les retraits de la 021 sont appliques par DELETE cible.
-- ============================================================================

BEGIN;

-- Groupes par defaut (003)
INSERT INTO default_profil (code, label, description) VALUES
  ('admin_sam',     'Admin SAM',     'Administration technique et fonctionnelle de l''espace'),
  ('manager_dsi',   'Manager DSI',   'Validation des saisies, pilotage de la conformité'),
  ('financier',     'Financier',     'Suivi budgétaire et financier du parc logiciel'),
  ('it_ops',        'IT Ops',        'Saisie et gestion opérationnelle des déploiements'),
  ('it_data_input', 'IT Data input', 'Saisie de données, périmètre restreint')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description;

-- Permissions par defaut (007 + 010)
INSERT INTO default_permission (code, label, module) VALUES
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
  ('gerer_connecteurs',            'Gérer les connecteurs d''inventaire',                                    'administration'),
  -- Dashboards (010)
  ('acceder_dashboard_manager_dsi', 'Accéder au dashboard Manager DSI', 'dashboards'),
  ('acceder_dashboard_financier',   'Accéder au dashboard Financier',   'dashboards'),
  ('acceder_dashboard_it_ops',      'Accéder au dashboard IT Ops',      'dashboards')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, module = EXCLUDED.module;

-- Matrice par defaut, etat final 011 + 021.
-- Manager DSI : 011 moins les deux permissions d'administration retirees en 021.
INSERT INTO default_profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM default_profil p
JOIN default_permission perm ON perm.code IN (
  'consulter_referentiels', 'gerer_referentiels', 'gerer_contacts',
  'consulter_contrats', 'saisir_contrat', 'saisir_commande', 'consulter_factures', 'deposer_facture_preuve',
  'consulter_licences', 'saisir_licence', 'saisir_affectation', 'valider_saisie', 'consulter_inventaire', 'rapprocher_inventaire',
  'consulter_budget', 'saisir_budget', 'consulter_kpi_financiers',
  'generer_rapport_conformite', 'generer_rapport_optimisation', 'creer_rapport_personnalise',
  'acceder_dashboard_manager_dsi'
)
WHERE p.code = 'manager_dsi'
ON CONFLICT (id_profil, id_permission) DO NOTHING;

-- Financier (011)
INSERT INTO default_profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM default_profil p
JOIN default_permission perm ON perm.code IN (
  'consulter_referentiels',
  'consulter_contrats', 'consulter_factures', 'deposer_facture_preuve',
  'consulter_licences', 'consulter_inventaire',
  'consulter_budget', 'saisir_budget', 'consulter_kpi_financiers',
  'generer_rapport_conformite', 'generer_rapport_optimisation', 'creer_rapport_personnalise',
  'acceder_dashboard_financier'
)
WHERE p.code = 'financier'
ON CONFLICT (id_profil, id_permission) DO NOTHING;

-- IT Ops (011)
INSERT INTO default_profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM default_profil p
JOIN default_permission perm ON perm.code IN (
  'consulter_referentiels', 'gerer_referentiels', 'gerer_contacts',
  'consulter_contrats', 'saisir_contrat', 'saisir_commande', 'consulter_factures', 'deposer_facture_preuve',
  'consulter_licences', 'saisir_licence', 'saisir_affectation', 'consulter_inventaire', 'rapprocher_inventaire',
  'consulter_budget', 'saisir_budget',
  'acceder_dashboard_it_ops'
)
WHERE p.code = 'it_ops'
ON CONFLICT (id_profil, id_permission) DO NOTHING;

-- IT Data input (021) : 5 permissions de reference + 3 consultations impliquees
INSERT INTO default_profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM default_profil p
JOIN default_permission perm ON perm.code IN (
  'consulter_referentiels',
  'saisir_contrat', 'saisir_commande', 'deposer_facture_preuve', 'saisir_affectation',
  'consulter_contrats', 'consulter_factures', 'consulter_inventaire'
)
WHERE p.code = 'it_data_input'
ON CONFLICT (id_profil, id_permission) DO NOTHING;

-- Admin SAM (011) : toutes les permissions du catalogue
INSERT INTO default_profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM default_profil p
CROSS JOIN default_permission perm
WHERE p.code = 'admin_sam'
ON CONFLICT (id_profil, id_permission) DO NOTHING;

-- Retrait 021 sur Manager DSI, applique aussi au rejeu (la Commune n'a pas de
-- soft delete : DELETE physique, la trace du retrait est la migration 021).
DELETE FROM default_profil_permission dpp
 USING default_profil p, default_permission perm
 WHERE dpp.id_profil = p.id
   AND dpp.id_permission = perm.id
   AND p.code = 'manager_dsi'
   AND perm.code IN ('gerer_utilisateurs', 'consulter_audit_log');

-- Fonctions des contacts (003)
INSERT INTO default_fonction (code, label) VALUES
  ('dsi',            'DSI'),
  ('daf',            'DAF'),
  ('acheteur',       'Acheteur'),
  ('resp_technique', 'Responsable technique')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label;

-- Types de contrat (003)
INSERT INTO default_type_contrat (code, label) VALUES
  ('cgu_cgv', 'CGU/CGV'),
  ('simple',  'Simple'),
  ('cadre',   'Cadre')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label;

-- Types de preuve (018, liste alignee sur l'interface)
INSERT INTO default_type_preuve (code, label) VALUES
  ('bon_livraison',       'Bon de livraison'),
  ('capture_portail',     'Capture écran portail éditeur'),
  ('attestation_editeur', 'Attestation éditeur'),
  ('contrat_scanne',      'Contrat signé scanné'),
  ('autre',               'Autre')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label;

-- Modes de commande (018, nature du document d'achat)
INSERT INTO default_mode_commande (code, label) VALUES
  ('bon_commande',     'Bon de commande'),
  ('devis_signe',      'Devis signé'),
  ('bon_commande_edi', 'Bon de commande EDI'),
  ('verbal_email',     'Verbal confirmé par email')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label;

-- Unites de mesure (003)
INSERT INTO default_unite_mesure (code, label, description) VALUES
  ('utilisateur_nomme', 'Utilisateur nommé', 'Décompte par utilisateur identifié'),
  ('device',            'Device',            'Décompte par poste ou équipement'),
  ('cpu',               'CPU',               'Décompte par processeur physique'),
  ('core',              'Core',              'Décompte par coeur de processeur'),
  ('serveur',           'Serveur',           'Décompte par serveur')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description;

-- default_profil_widget et default_seuil_dashboard : pas de seed (aucune
-- source dans le depot, cf. 003 "SEEDS RESTANT A PRODUIRE").

COMMIT;
