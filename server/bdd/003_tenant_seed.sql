-- ============================================================================
-- SamSecure - BDD Tenant - Seed des référentiels
-- Fichier   : 003_tenant_seed.sql
-- Cible     : PostgreSQL 16 - à exécuter après 002_tenant_schema.sql
-- Exécution : psql -U samsecure_app -d samsecure_tenant_client01_dev -f 003_tenant_seed.sql
-- Note      : premier consommateur du mécanisme de diffusion (modif 22).
--             Chaque référentiel personnalisable est poussé par code de
--             rapprochement avec le motif protégé : une ligne dont
--             personnalise = true conserve ses valeurs actives, seule sa
--             copie locale du défaut (valeurs_defaut) est rafraîchie.
--             Script idempotent, rejouable à chaque livraison de défauts.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Statuts du workflow de validation (référentiel fermé, jamais personnalisé)
-- ----------------------------------------------------------------------------
INSERT INTO validation_status (code, label) VALUES
  ('en_attente',  'En attente'),
  ('valide',      'Validé'),
  ('refuse',      'Refusé'),
  ('a_revalider', 'À revalider')
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Profils standard (personnalisables : motif protégé)
-- ----------------------------------------------------------------------------
INSERT INTO profil (code, label, description, valeurs_defaut) VALUES
  ('admin_sam',     'Admin SAM',     'Administration technique et fonctionnelle de l''espace',  '{"label": "Admin SAM", "description": "Administration technique et fonctionnelle de l''espace"}'),
  ('manager_dsi',   'Manager DSI',   'Validation des saisies, pilotage de la conformité',       '{"label": "Manager DSI", "description": "Validation des saisies, pilotage de la conformité"}'),
  ('financier',     'Financier',     'Suivi budgétaire et financier du parc logiciel',          '{"label": "Financier", "description": "Suivi budgétaire et financier du parc logiciel"}'),
  ('it_ops',        'IT Ops',        'Saisie et gestion opérationnelle des déploiements',       '{"label": "IT Ops", "description": "Saisie et gestion opérationnelle des déploiements"}'),
  ('it_data_input', 'IT Data input', 'Saisie de données, périmètre restreint',                  '{"label": "IT Data input", "description": "Saisie de données, périmètre restreint"}')
ON CONFLICT (code) DO UPDATE SET
  label          = CASE WHEN profil.personnalise THEN profil.label       ELSE EXCLUDED.label       END,
  description    = CASE WHEN profil.personnalise THEN profil.description ELSE EXCLUDED.description END,
  valeurs_defaut = EXCLUDED.valeurs_defaut;

-- ----------------------------------------------------------------------------
-- Langues (arbitrage v4 en cours : Commune ou fichiers i18n, seed conservé en attendant)
-- ----------------------------------------------------------------------------
INSERT INTO langue (code, label, actif) VALUES
  ('fr', 'Français', true),
  ('en', 'English',  true)
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Abonnements SamSecure (catalogue commercial, jamais personnalisé)
-- ----------------------------------------------------------------------------
INSERT INTO abonnement_samsecure (label, description)
SELECT s.label, s.description FROM (VALUES
  ('Base',   'Niveau de service de base'),
  ('Silver', 'Niveau de service intermédiaire'),
  ('Gold',   'Niveau de service complet')
) AS s(label, description)
WHERE NOT EXISTS (SELECT 1 FROM abonnement_samsecure a WHERE a.label = s.label);

-- ----------------------------------------------------------------------------
-- Types de contrat (motif protégé)
-- ----------------------------------------------------------------------------
INSERT INTO type_contrat (code, label, valeurs_defaut) VALUES
  ('cgu_cgv', 'CGU/CGV', '{"label": "CGU/CGV"}'),
  ('simple',  'Simple',  '{"label": "Simple"}'),
  ('cadre',   'Cadre',   '{"label": "Cadre"}')
ON CONFLICT (code) DO UPDATE SET
  label          = CASE WHEN type_contrat.personnalise THEN type_contrat.label ELSE EXCLUDED.label END,
  valeurs_defaut = EXCLUDED.valeurs_defaut;

-- ----------------------------------------------------------------------------
-- Modes de commande (motif protégé)
-- ----------------------------------------------------------------------------
INSERT INTO mode_commande (code, label, valeurs_defaut) VALUES
  ('bon_commande',     'Bon de commande',            '{"label": "Bon de commande"}'),
  ('devis_signe',      'Devis signé',                '{"label": "Devis signé"}'),
  ('bon_commande_edi', 'Bon de commande EDI',        '{"label": "Bon de commande EDI"}'),
  ('verbal_email',     'Verbal confirmé par email',  '{"label": "Verbal confirmé par email"}')
ON CONFLICT (code) DO UPDATE SET
  label          = CASE WHEN mode_commande.personnalise THEN mode_commande.label ELSE EXCLUDED.label END,
  valeurs_defaut = EXCLUDED.valeurs_defaut;

-- ----------------------------------------------------------------------------
-- Types de preuve (motif protégé)
-- ----------------------------------------------------------------------------
INSERT INTO type_preuve (code, label, valeurs_defaut) VALUES
  ('bon_livraison',       'Bon de livraison',              '{"label": "Bon de livraison"}'),
  ('capture_portail',     'Capture écran portail éditeur', '{"label": "Capture écran portail éditeur"}'),
  ('attestation_editeur', 'Attestation éditeur',           '{"label": "Attestation éditeur"}'),
  ('contrat_scanne',      'Contrat signé scanné',          '{"label": "Contrat signé scanné"}'),
  ('autre',               'Autre',                         '{"label": "Autre"}')
ON CONFLICT (code) DO UPDATE SET
  label          = CASE WHEN type_preuve.personnalise THEN type_preuve.label ELSE EXCLUDED.label END,
  valeurs_defaut = EXCLUDED.valeurs_defaut;

-- ----------------------------------------------------------------------------
-- Unités de mesure (motif protégé)
-- ----------------------------------------------------------------------------
INSERT INTO unite_mesure (code, label, description, valeurs_defaut) VALUES
  ('utilisateur_nomme', 'Utilisateur nommé', 'Décompte par utilisateur identifié',   '{"label": "Utilisateur nommé", "description": "Décompte par utilisateur identifié"}'),
  ('device',            'Device',            'Décompte par poste ou équipement',     '{"label": "Device", "description": "Décompte par poste ou équipement"}'),
  ('cpu',               'CPU',               'Décompte par processeur physique',     '{"label": "CPU", "description": "Décompte par processeur physique"}'),
  ('core',              'Core',              'Décompte par coeur de processeur',     '{"label": "Core", "description": "Décompte par coeur de processeur"}'),
  ('serveur',           'Serveur',           'Décompte par serveur',                 '{"label": "Serveur", "description": "Décompte par serveur"}')
ON CONFLICT (code) DO UPDATE SET
  label          = CASE WHEN unite_mesure.personnalise THEN unite_mesure.label       ELSE EXCLUDED.label       END,
  description    = CASE WHEN unite_mesure.personnalise THEN unite_mesure.description ELSE EXCLUDED.description END,
  valeurs_defaut = EXCLUDED.valeurs_defaut;

-- ----------------------------------------------------------------------------
-- Fonctions des contacts (motif protégé)
-- ----------------------------------------------------------------------------
INSERT INTO fonction (code, label, valeurs_defaut) VALUES
  ('dsi',            'DSI',                   '{"label": "DSI"}'),
  ('daf',            'DAF',                   '{"label": "DAF"}'),
  ('acheteur',       'Acheteur',              '{"label": "Acheteur"}'),
  ('resp_technique', 'Responsable technique', '{"label": "Responsable technique"}')
ON CONFLICT (code) DO UPDATE SET
  label          = CASE WHEN fonction.personnalise THEN fonction.label ELSE EXCLUDED.label END,
  valeurs_defaut = EXCLUDED.valeurs_defaut;

-- ----------------------------------------------------------------------------
-- Version de référentiels appliquée (modif 22)
-- Sans effet tant que tenant_config n'est pas provisionné, se cale ensuite.
-- ----------------------------------------------------------------------------
UPDATE tenant_config SET version_referentiels = GREATEST(version_referentiels, 1);

COMMIT;

-- ============================================================================
-- SEEDS RESTANT À PRODUIRE (sources applicatives, hors de ce script) :
--   - permission          : reprendre les 24 codes du simulateur de droits
--                           (Nayrod_SamSec_Simulateur_Droits_v1.html)
--   - profil_permission   : matrice profils x permissions du simulateur
--                           (suit le statut personnalise de son profil, pas de
--                           colonnes propres)
--   - seuil_dashboard     : seuils par défaut par widget (Dashboard_Spec_v2)
--   - profil_widget       : visibilité des widgets par profil (Dashboard_Spec_v2)
--   - editeur.url_logo_defaut : top 20 des logos éditeurs (modif 21)
--   - traduction          : arbitrage v4 en cours (BDD Commune ou fichiers
--                           i18n côté front), personnalisation tenant retirée,
--                           rien à seeder ici dans les deux cas
-- Les codes techniques introduits ici (dsi, cgu_cgv, automatise...) sont des
-- propositions à valider en revue, ils deviennent le contrat de rapprochement.
-- ============================================================================
