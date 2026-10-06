-- ============================================================================
-- SamSecure - Recette fonctionnelle - 01_jeu_recette.sql
-- Objet     : jeu de données complet de la recette fonctionnelle. Se joue sur
--             un tenant préalablement remis à zéro par 00_reset_tenant.sql.
--             Chaque cas est identifié par un code (SOC-, USR-, DRT-, GRP-,
--             LOG-, CTR-, CMD-, LIC-, AFF-, PRV-, BUD-, SEU-, NTF-) repris
--             dans server/docs/attendus_recette.md, la check-list de recette.
-- Cible     : base TENANT uniquement (aucun nom de base dans ce fichier, la
--             base est choisie par l'option -d de psql). La BDD Commune n'est
--             JAMAIS touchée.
-- Exécution : psql -v ON_ERROR_STOP=1 -d <base_tenant> -f 01_jeu_recette.sql
-- Rejouable : oui, après un passage de 00_reset_tenant.sql (les données que le
--             reset conserve - sociétés, utilisateurs, éditeurs, tiers,
--             tenant_config, seuil personnalisé - sont écrites en upsert ; le
--             reste en INSERT simple sur des tables vides).
-- Dates     : toutes relatives à CURRENT_DATE pour que les cas restent vrais
--             dans le temps. Les dates sensibles à l'exercice fiscal (cas
--             budget) sont bornées par GREATEST(début d'exercice, date
--             relative) pour tenir aussi en début d'année civile.
-- Mot de passe des utilisateurs de recette : Recette#2026 (bcryptjs, 10
--             rounds, la bibliothèque de l'application).
--
-- LOGICIEL DU CATALOGUE COMMUN (cas LOG-01) : licence.id_produit est un lien
-- logique sans clé étrangère vers produit_referentiel (BDD Commune). La
-- variable ci-dessous porte l'identifiant du produit « Adobe Photoshop »
-- (SKU ADB-PS-TEST) de la Commune de dev. Si la Commune de l'environnement
-- cible porte un autre identifiant, le récupérer AVANT de jouer ce script :
--   psql -d <base_commune> -Atc "SELECT id FROM produit_referentiel
--                                 WHERE sku = 'ADB-PS-TEST'"
-- puis remplacer la valeur ci-dessous (une seule ligne à changer).
-- ============================================================================

\set id_produit_catalogue '0f8a87d7-f331-4575-a96e-c24f8a77c248'

-- Hachage bcrypt du mot de passe de recette Recette#2026 (bcryptjs, 10 rounds).
\set mdp_hash '$2b$10$/B3U.HDBN4DU0wG6QC06BeWekl9KpoLJrs8NtgaUkVaa7JlwoIGNG'

BEGIN;

-- ============================================================================
-- 0. Configuration du tenant
-- Le début d'exercice fiscal par défaut est posé au 1er janvier : toute la
-- check-list budget (BUD-*) raisonne sur l'année civile.
-- ============================================================================
INSERT INTO tenant_config (raison_sociale, langue_defaut, debut_exercice_fiscal_defaut)
SELECT 'REC Client Recette', 'fr', DATE '2000-01-01'
 WHERE NOT EXISTS (SELECT 1 FROM tenant_config);
UPDATE tenant_config SET debut_exercice_fiscal_defaut = DATE '2000-01-01';

-- ============================================================================
-- SOC - Sociétés : une mère, deux filiales. Exercice fiscal : défaut tenant.
-- ============================================================================
INSERT INTO societe (id, id_societe_parent, raison_sociale, siret, actif)
VALUES
  ('10000000-0000-4000-8000-000000000001', NULL,
   'REC Groupe Horizon (mère)',  '00000000000001', true),
  ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   'REC Filiale Nord',           '00000000000002', true),
  ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
   'REC Filiale Sud',            '00000000000003', true)
ON CONFLICT (id) DO UPDATE
   SET id_societe_parent = EXCLUDED.id_societe_parent,
       raison_sociale = EXCLUDED.raison_sociale,
       actif = true, date_suppression = NULL, debut_exercice_fiscal = NULL;

-- ============================================================================
-- USR - Utilisateurs de recette (mot de passe commun Recette#2026)
-- USR-01 admin (Admin SAM)          USR-02 dsi (Manager DSI)
-- USR-03 financier (Financier)      USR-04 itops (IT Ops)
-- USR-05 saisie (IT Data input)     USR-06 dsi.en (Manager DSI, anglais)
-- USR-07 cumul (IT Data input + groupe GRP-01, droits en union)
-- USR-08 financier.retire (Financier - exception retire consulter_kpi_financiers)
-- USR-09 saisie.accorde (IT Data input + exception accorde consulter_licences)
-- USR-10 dsi.nord (Manager DSI rattaché à la seule Filiale Nord)
-- ============================================================================
INSERT INTO utilisateur (id, nom, prenom, email, mot_de_passe_hash, actif, langue)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'RECETTE', 'Admin',          'admin.recette@samsecure.test',            :'mdp_hash', true, 'fr'),
  ('20000000-0000-4000-8000-000000000002', 'RECETTE', 'Dsi',            'dsi.recette@samsecure.test',              :'mdp_hash', true, 'fr'),
  ('20000000-0000-4000-8000-000000000003', 'RECETTE', 'Financier',      'financier.recette@samsecure.test',        :'mdp_hash', true, 'fr'),
  ('20000000-0000-4000-8000-000000000004', 'RECETTE', 'Itops',          'itops.recette@samsecure.test',            :'mdp_hash', true, 'fr'),
  ('20000000-0000-4000-8000-000000000005', 'RECETTE', 'Saisie',         'saisie.recette@samsecure.test',           :'mdp_hash', true, 'fr'),
  ('20000000-0000-4000-8000-000000000006', 'RECETTE', 'Dsi-Anglais',    'dsi.en.recette@samsecure.test',           :'mdp_hash', true, 'en'),
  ('20000000-0000-4000-8000-000000000007', 'RECETTE', 'Cumul',          'cumul.recette@samsecure.test',            :'mdp_hash', true, 'fr'),
  ('20000000-0000-4000-8000-000000000008', 'RECETTE', 'Financier-Retire','financier.retire.recette@samsecure.test',:'mdp_hash', true, 'fr'),
  ('20000000-0000-4000-8000-000000000009', 'RECETTE', 'Saisie-Accorde', 'saisie.accorde.recette@samsecure.test',   :'mdp_hash', true, 'fr'),
  ('20000000-0000-4000-8000-000000000010', 'RECETTE', 'Dsi-Nord',       'dsi.nord.recette@samsecure.test',         :'mdp_hash', true, 'fr')
ON CONFLICT (id) DO UPDATE
   SET nom = EXCLUDED.nom, prenom = EXCLUDED.prenom, email = EXCLUDED.email,
       mot_de_passe_hash = EXCLUDED.mot_de_passe_hash, actif = true,
       langue = EXCLUDED.langue, date_finale = NULL, date_mise_en_fonction = NULL;

-- Rattachements et attributions des utilisateurs de recette : repartis de zéro
-- à chaque passage (le reset ne touche pas ces tables).
DELETE FROM utilisateur_profil_societe WHERE id_utilisateur::text LIKE '20000000-%';
DELETE FROM utilisateur_societe        WHERE id_utilisateur::text LIKE '20000000-%';

-- Rattachement : NULL = portée tenant ; USR-10 est borné à la Filiale Nord.
INSERT INTO utilisateur_societe (id_utilisateur, id_societe)
SELECT u.id, NULL::uuid
  FROM utilisateur u
 WHERE u.id::text LIKE '20000000-%'
   AND u.id <> '20000000-0000-4000-8000-000000000010';
INSERT INTO utilisateur_societe (id_utilisateur, id_societe)
VALUES ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000002');

-- Attributions de profils par défaut (diffusion NULL = tenant).
INSERT INTO utilisateur_profil_societe (id_utilisateur, id_profil, id_societe)
SELECT v.id_utilisateur::uuid, p.id, v.id_societe::uuid
  FROM (VALUES
    ('20000000-0000-4000-8000-000000000001', 'admin_sam',     NULL),
    ('20000000-0000-4000-8000-000000000002', 'manager_dsi',   NULL),
    ('20000000-0000-4000-8000-000000000003', 'financier',     NULL),
    ('20000000-0000-4000-8000-000000000004', 'it_ops',        NULL),
    ('20000000-0000-4000-8000-000000000005', 'it_data_input', NULL),
    ('20000000-0000-4000-8000-000000000006', 'manager_dsi',   NULL),
    ('20000000-0000-4000-8000-000000000007', 'it_data_input', NULL),
    ('20000000-0000-4000-8000-000000000008', 'financier',     NULL),
    ('20000000-0000-4000-8000-000000000009', 'it_data_input', NULL),
    ('20000000-0000-4000-8000-000000000010', 'manager_dsi',   '10000000-0000-4000-8000-000000000002')
  ) AS v(id_utilisateur, code_profil, id_societe)
  JOIN profil p ON p.code = v.code_profil;

-- ============================================================================
-- GRP - Groupes personnalisés (profil.type = 'groupe')
-- GRP-01 actif (lecture licences + budget), attribué à USR-07 (union de droits)
-- GRP-02 en corbeille depuis 10 jours (restaurable, 80 jours restants)
-- GRP-03 en corbeille depuis 100 jours (purgeable, rétention 90 jours)
-- ============================================================================
INSERT INTO profil (id, code, label, description, personnalise, type, date_suppression)
VALUES
  ('25000000-0000-4000-8000-000000000001', 'rec_groupe_lecture',
   'REC Groupe lecture transverse', 'Groupe de recette : lecture licences et budget.',
   true, 'groupe', NULL),
  ('25000000-0000-4000-8000-000000000002', 'rec_groupe_corbeille_10j',
   'REC Groupe corbeille 10 jours', 'Groupe de recette supprimé il y a 10 jours.',
   true, 'groupe', now() - interval '10 days'),
  ('25000000-0000-4000-8000-000000000003', 'rec_groupe_corbeille_100j',
   'REC Groupe corbeille 100 jours', 'Groupe de recette supprimé il y a 100 jours.',
   true, 'groupe', now() - interval '100 days');

INSERT INTO profil_permission (id_profil, id_permission)
SELECT '25000000-0000-4000-8000-000000000001', p.id
  FROM permission p WHERE p.code IN ('consulter_licences', 'consulter_budget');
-- Le groupe en corbeille récente garde sa matrice (restaurable à l'identique).
INSERT INTO profil_permission (id_profil, id_permission)
SELECT '25000000-0000-4000-8000-000000000002', p.id
  FROM permission p WHERE p.code IN ('consulter_referentiels');

INSERT INTO profil_societe (id_profil, id_societe)
VALUES ('25000000-0000-4000-8000-000000000001', NULL);

-- USR-07 cumule it_data_input (attribué plus haut) et le groupe GRP-01.
INSERT INTO utilisateur_profil_societe (id_utilisateur, id_profil, id_societe)
VALUES ('20000000-0000-4000-8000-000000000007', '25000000-0000-4000-8000-000000000001', NULL);

-- ============================================================================
-- DRT - Exceptions de droit
-- DRT-01 retire  : USR-08 (Financier) privé de consulter_kpi_financiers
-- DRT-02 accorde : USR-09 (IT Data input) reçoit consulter_licences
-- ============================================================================
INSERT INTO exception_droit (id, id_utilisateur, id_permission, id_societe, type, motif, id_accorde_par)
SELECT '75000000-0000-4000-8000-000000000001',
       '20000000-0000-4000-8000-000000000008', p.id, NULL, 'retire',
       'REC Recette : retrait des montants financiers.',
       '20000000-0000-4000-8000-000000000001'
  FROM permission p WHERE p.code = 'consulter_kpi_financiers'
ON CONFLICT (id_utilisateur, id_permission, id_societe, type) DO NOTHING;
INSERT INTO exception_droit (id, id_utilisateur, id_permission, id_societe, type, motif, id_accorde_par)
SELECT '75000000-0000-4000-8000-000000000002',
       '20000000-0000-4000-8000-000000000009', p.id, NULL, 'accorde',
       'REC Recette : lecture des licences accordée.',
       '20000000-0000-4000-8000-000000000001'
  FROM permission p WHERE p.code = 'consulter_licences'
ON CONFLICT (id_utilisateur, id_permission, id_societe, type) DO NOTHING;

-- ============================================================================
-- Tiers conservés par le reset : éditeurs, mainteneur, revendeur (upsert).
-- ============================================================================
INSERT INTO editeur (id, raison_sociale, pays)
VALUES
  ('30000000-0000-4000-8000-000000000001', 'REC Éditions Soleil', 'France'),
  ('30000000-0000-4000-8000-000000000002', 'REC Logiciels Lune',  'France')
ON CONFLICT (id) DO UPDATE SET raison_sociale = EXCLUDED.raison_sociale;

INSERT INTO mainteneur (id, raison_sociale)
VALUES ('32000000-0000-4000-8000-000000000001', 'REC Maintenance Services')
ON CONFLICT (id) DO UPDATE SET raison_sociale = EXCLUDED.raison_sociale;

INSERT INTO revendeur (id, raison_sociale, actif)
VALUES ('33000000-0000-4000-8000-000000000001', 'REC Revendeur Central', true)
ON CONFLICT (id) DO UPDATE SET raison_sociale = EXCLUDED.raison_sociale, actif = true;

-- ============================================================================
-- LOG - Logiciels
-- LOG-01 : logiciel du catalogue commun (:id_produit_catalogue) enrichi côté
--          client de 3 versions et 2 éditions (compléments Tenant, 063).
-- LOG-02 : logiciel créé côté client avec version et édition client (040).
-- LOG-03 : logiciel composé de deux logiciels du même éditeur (068).
-- LOG-04 : logiciel sans aucune licence (présent au référentiel, absent de la
--          conformité).
-- LOG-05 à LOG-xx : un logiciel client par cas de conformité, pour des
--          balances lisibles produit par produit.
-- ============================================================================
INSERT INTO version_complement (id, id_produit, label, label_normalise)
VALUES
  ('36000000-0000-4000-8000-000000000001', :'id_produit_catalogue', 'REC v1', 'rec v1'),
  ('36000000-0000-4000-8000-000000000002', :'id_produit_catalogue', 'REC v2', 'rec v2'),
  ('36000000-0000-4000-8000-000000000003', :'id_produit_catalogue', 'REC v3', 'rec v3');
INSERT INTO edition_complement (id, id_produit, label, label_normalise)
VALUES
  ('36000000-0000-4000-8000-000000000011', :'id_produit_catalogue', 'REC Standard', 'rec standard'),
  ('36000000-0000-4000-8000-000000000012', :'id_produit_catalogue', 'REC Pro', 'rec pro');

INSERT INTO produit_client (id, label, id_editeur) VALUES
  ('35000000-0000-4000-8000-000000000001', 'REC Logiciel RH interne',            '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000002', 'REC Suite Bureau (composé)',         '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000003', 'REC Compo Texte (composant)',        '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000004', 'REC Compo Tableur (composant)',      '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000005', 'REC Logiciel sans licence',          '30000000-0000-4000-8000-000000000002'),
  ('35000000-0000-4000-8000-000000000010', 'REC Logiciel Surplus 10-8',          '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000011', 'REC Logiciel Dépassement 5-7',       '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000012', 'REC Logiciel Équilibre 10-10',       '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000013', 'REC Logiciel Souscription échue',    '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000014', 'REC Logiciel Échéance 20 jours',     '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000015', 'REC Logiciel Perpétuel nu',          '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000017', 'REC Logiciel Maintenance fin 20j',   '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000018', 'REC Logiciel Maintenance arrêtée',   '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000019', 'REC Logiciel Droits nuls',           '30000000-0000-4000-8000-000000000002'),
  ('35000000-0000-4000-8000-000000000020', 'REC Logiciel Prolongé',              '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000021', 'REC Logiciel Renouvelé (contrat à suivre)', '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000022', 'REC Logiciel Essai',                 '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000023', 'REC Logiciel Par poste',             '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000024', 'REC Logiciel Sans preuve',           '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000025', 'REC Logiciel Certificat',            '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000026', 'REC Logiciel Prix dernière commande','30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000027', 'REC Logiciel Taux 86',               '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000028', 'REC Logiciel Taux 84',               '30000000-0000-4000-8000-000000000001'),
  ('35000000-0000-4000-8000-000000000029', 'REC Logiciel Budget Sud',            '30000000-0000-4000-8000-000000000001');

-- Déclinaisons propres aux logiciels client.
INSERT INTO version_client (id, id_produit, label) VALUES
  ('36000000-0000-4000-8000-000000000021', '35000000-0000-4000-8000-000000000001', 'RH v10'),
  ('36000000-0000-4000-8000-000000000022', '35000000-0000-4000-8000-000000000018', 'v2024 (figée)'),
  ('36000000-0000-4000-8000-000000000024', '35000000-0000-4000-8000-000000000015', 'v1.0');
INSERT INTO edition_client (id, id_produit, label) VALUES
  ('36000000-0000-4000-8000-000000000031', '35000000-0000-4000-8000-000000000001', 'RH Entreprise');

-- LOG-03 : composition (le composé couvre ses composants, jamais l'inverse).
INSERT INTO produit_composition (id, id_produit_compose, id_produit_composant, id_auteur) VALUES
  ('37000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000002',
   '35000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001'),
  ('37000000-0000-4000-8000-000000000002', '35000000-0000-4000-8000-000000000002',
   '35000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001');

-- ============================================================================
-- CTR - Contrats (société signataire obligatoire, affichée partout)
-- CTR-01 cadre + CTR-02 enfant rattaché   CTR-03 interne (société prêteuse)
-- CTR-04 échéance dans 15 jours (alerte)  CTR-05/06 renouvelé dans la
-- continuité (aucune alerte)              CTR-07 échu, à faire suivre
-- ============================================================================
INSERT INTO contrat (id, label, id_type_contrat, id_societe, id_societe_preteuse,
                     id_contrat_parent, id_contrat_predecesseur, id_revendeur,
                     date_debut, date_fin, a_renouveler)
VALUES
  ('40000000-0000-4000-8000-000000000001', 'REC Contrat cadre groupe',
   (SELECT id FROM type_contrat WHERE code = 'cadre'),
   '10000000-0000-4000-8000-000000000001', NULL, NULL, NULL,
   '33000000-0000-4000-8000-000000000001',
   CURRENT_DATE - interval '2 years', CURRENT_DATE + interval '2 years', false),
  ('40000000-0000-4000-8000-000000000002', 'REC Contrat applicatif Nord',
   (SELECT id FROM type_contrat WHERE code = 'simple'),
   '10000000-0000-4000-8000-000000000002', NULL,
   '40000000-0000-4000-8000-000000000001', NULL,
   '33000000-0000-4000-8000-000000000001',
   CURRENT_DATE - interval '1 year', CURRENT_DATE + interval '1 year', false),
  ('40000000-0000-4000-8000-000000000003', 'REC Contrat interne Sud',
   (SELECT id FROM type_contrat WHERE code = 'interne'),
   '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
   NULL, NULL, NULL,
   CURRENT_DATE - interval '1 year', CURRENT_DATE + interval '1 year', false),
  ('40000000-0000-4000-8000-000000000004', 'REC Contrat échéance 15 jours',
   (SELECT id FROM type_contrat WHERE code = 'simple'),
   '10000000-0000-4000-8000-000000000001', NULL, NULL, NULL,
   '33000000-0000-4000-8000-000000000001',
   CURRENT_DATE - interval '1 year', CURRENT_DATE + 15, false),
  ('40000000-0000-4000-8000-000000000005', 'REC Contrat renouvelé (ancien)',
   (SELECT id FROM type_contrat WHERE code = 'simple'),
   '10000000-0000-4000-8000-000000000001', NULL, NULL, NULL,
   '33000000-0000-4000-8000-000000000001',
   CURRENT_DATE - interval '1 year', CURRENT_DATE + 10, false),
  ('40000000-0000-4000-8000-000000000006', 'REC Contrat renouvelé (nouveau)',
   (SELECT id FROM type_contrat WHERE code = 'simple'),
   '10000000-0000-4000-8000-000000000001', NULL, NULL,
   '40000000-0000-4000-8000-000000000005',
   '33000000-0000-4000-8000-000000000001',
   CURRENT_DATE, CURRENT_DATE + interval '1 year', false),
  ('40000000-0000-4000-8000-000000000007', 'REC Contrat à faire suivre',
   (SELECT id FROM type_contrat WHERE code = 'simple'),
   '10000000-0000-4000-8000-000000000002', NULL, NULL, NULL,
   '33000000-0000-4000-8000-000000000001',
   CURRENT_DATE - interval '400 days', CURRENT_DATE - 30, false);

-- ============================================================================
-- CMD - Commandes (la société payeuse est TOUJOURS commande.id_societe,
-- dérivée ensuite par la chaîne licence -> commande -> société).
-- CMD-02 : société acheteuse (mère) différente des bénéficiaires (Filiale Sud
-- sur les affectations de la licence LIC-23).
-- CMD-03/04 : deux commandes du même logiciel à prix unitaires différents (D52).
-- CMD-07 : commande sans preuve ni facture (manque documentaire).
-- CMD-08 : commande qui porte l'engagé budget de la Filiale Sud (BUD-03).
-- CMD-09 : commande de la facture déposée (PRV-04 / BUD façade financière).
-- Les dates bornées par GREATEST(...) restent dans l'exercice courant.
-- ============================================================================
INSERT INTO commande (id, label, id_contrat, id_societe, id_revendeur, id_mode_commande,
                      montant, date_commande, a_renouveler)
VALUES
  ('45000000-0000-4000-8000-000000000001', 'REC Commande socle Nord',
   '40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   '33000000-0000-4000-8000-000000000001', (SELECT id FROM mode_commande WHERE code = 'devis_signe'),
   15000.00, GREATEST(date_trunc('year', CURRENT_DATE)::date, CURRENT_DATE - 120), false),
  ('45000000-0000-4000-8000-000000000002', 'REC Commande acheteuse mère',
   '40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '33000000-0000-4000-8000-000000000001', (SELECT id FROM mode_commande WHERE code = 'bon_commande'),
   3000.00, GREATEST(date_trunc('year', CURRENT_DATE)::date, CURRENT_DATE - 100), false),
  ('45000000-0000-4000-8000-000000000003', 'REC Commande prix 1 (ancienne)',
   '40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   '33000000-0000-4000-8000-000000000001', (SELECT id FROM mode_commande WHERE code = 'devis_signe'),
   1000.00, GREATEST(date_trunc('year', CURRENT_DATE)::date, CURRENT_DATE - 90), false),
  ('45000000-0000-4000-8000-000000000004', 'REC Commande prix 2 (dernière)',
   '40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   '33000000-0000-4000-8000-000000000001', (SELECT id FROM mode_commande WHERE code = 'devis_signe'),
   600.00, GREATEST(date_trunc('year', CURRENT_DATE)::date, CURRENT_DATE - 10), false),
  ('45000000-0000-4000-8000-000000000005', 'REC Commande à suivre (ancienne)',
   '40000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000002',
   '33000000-0000-4000-8000-000000000001', (SELECT id FROM mode_commande WHERE code = 'devis_signe'),
   5000.00, CURRENT_DATE - 400, false),
  ('45000000-0000-4000-8000-000000000006', 'REC Commande à suivre (renouvellement)',
   '40000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000002',
   '33000000-0000-4000-8000-000000000001', (SELECT id FROM mode_commande WHERE code = 'devis_signe'),
   2000.00, GREATEST(date_trunc('year', CURRENT_DATE)::date, CURRENT_DATE - 20), false),
  ('45000000-0000-4000-8000-000000000007', 'REC Commande sans preuve',
   '40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   '33000000-0000-4000-8000-000000000001', (SELECT id FROM mode_commande WHERE code = 'verbal_email'),
   800.00, GREATEST(date_trunc('year', CURRENT_DATE)::date, CURRENT_DATE - 45), false),
  ('45000000-0000-4000-8000-000000000008', 'REC Commande budget Sud',
   '40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003',
   NULL, (SELECT id FROM mode_commande WHERE code = 'bon_commande'),
   9500.00, GREATEST(date_trunc('year', CURRENT_DATE)::date, CURRENT_DATE - 5), false),
  ('45000000-0000-4000-8000-000000000009', 'REC Commande facturée',
   '40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   '33000000-0000-4000-8000-000000000001', (SELECT id FROM mode_commande WHERE code = 'devis_signe'),
   1234.56, GREATEST(date_trunc('year', CURRENT_DATE)::date, CURRENT_DATE - 30), false);

-- ============================================================================
-- LIC - Licences. Un cas par règle, un logiciel par cas (balances lisibles).
-- Les usages (affectations) arrivent au bloc AFF ; les attendus chiffrés sont
-- dans server/docs/attendus_recette.md.
-- ============================================================================
INSERT INTO licence (id, label, id_commande, id_produit, id_version, id_edition,
                     id_unite_mesure, quantite, type, cout_licence,
                     date_debut, date_fin_souscription, id_licence_predecesseur,
                     version_figee_id, date_arret_maintenance)
VALUES
  -- LIC-01 souscription sur-licenciée : 10 droits, 8 usages (80 %).
  ('50000000-0000-4000-8000-000000000010', 'REC Souscription sur-licenciée 10-8',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000010',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   10, 'souscription', 5000.00, CURRENT_DATE - 165, CURRENT_DATE + 200, NULL, NULL, NULL),
  -- LIC-02 souscription en dépassement : 5 droits, 7 usages ; écart valorisé
  -- -12 000 euros (prix unitaire 6 000), au-delà du seuil en euros (10 000).
  ('50000000-0000-4000-8000-000000000011', 'REC Souscription dépassement 5-7',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000011',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   5, 'souscription', 30000.00, CURRENT_DATE - 185, CURRENT_DATE + 180, NULL, NULL, NULL),
  -- LIC-03 souscription à l'équilibre : 10 droits, 10 usages (100 %).
  ('50000000-0000-4000-8000-000000000012', 'REC Souscription équilibre 10-10',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000012',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   10, 'souscription', 4000.00, CURRENT_DATE - 185, CURRENT_DATE + 180, NULL, NULL, NULL),
  -- LIC-04 souscription échue HIER (D44 : sortie des droits le jour même),
  -- 3 usages validés qui deviennent sans droit.
  ('50000000-0000-4000-8000-000000000013', 'REC Souscription échue hier 5-3',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000013',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   5, 'souscription', 2000.00, CURRENT_DATE - 366, CURRENT_DATE - 1, NULL, NULL, NULL),
  -- LIC-05 souscription qui échoit dans 20 jours (alerte échéance, palier 30).
  ('50000000-0000-4000-8000-000000000014', 'REC Souscription échéance 20 jours',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000014',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   5, 'souscription', 1500.00, CURRENT_DATE - 345, CURRENT_DATE + 20, NULL, NULL, NULL),
  -- LIC-06 perpétuelle sans maintenance : version figée à l'achat (v1.0).
  ('50000000-0000-4000-8000-000000000015', 'REC Perpétuelle sans maintenance',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000015',
   '36000000-0000-4000-8000-000000000024', NULL,
   (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   5, 'perpetuelle', 1000.00, CURRENT_DATE - interval '1 year', NULL, NULL, NULL, NULL),
  -- LIC-07 perpétuelle, trois maintenances enchaînées sans trou, version
  -- montée à chaque période (REC v1 -> v2 -> v3), dernière en cours (fin dans
  -- 6 mois : aucune alerte), sur le logiciel du catalogue commun (LOG-01).
  ('50000000-0000-4000-8000-000000000016', 'REC Perpétuelle maintenance continue',
   '45000000-0000-4000-8000-000000000001', :'id_produit_catalogue',
   '36000000-0000-4000-8000-000000000003', '36000000-0000-4000-8000-000000000011',
   (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   10, 'perpetuelle', 8000.00, CURRENT_DATE - interval '30 months', NULL, NULL, NULL, NULL),
  -- LIC-08 perpétuelle dont la maintenance finit dans 20 jours sans suite
  -- (alerte fin de maintenance).
  ('50000000-0000-4000-8000-000000000017', 'REC Perpétuelle maintenance fin 20 jours',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000017',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   4, 'perpetuelle', 1200.00, CURRENT_DATE - interval '1 year', NULL, NULL, NULL, NULL),
  -- LIC-09 perpétuelle dont la maintenance est arrêtée depuis 6 mois : version
  -- figée à l'arrêt (v2024), aucune alerte.
  ('50000000-0000-4000-8000-000000000018', 'REC Perpétuelle maintenance arrêtée',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000018',
   '36000000-0000-4000-8000-000000000022', NULL,
   (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   4, 'perpetuelle', 1600.00, CURRENT_DATE - interval '2 years', NULL, NULL,
   '36000000-0000-4000-8000-000000000022', CURRENT_DATE - interval '6 months'),
  -- LIC-10 licence à droits nuls (quantité 0) avec 2 usages : anomalie
  -- usage_sans_droit immédiate, aucun taux (D53).
  ('50000000-0000-4000-8000-000000000019', 'REC Licence droits nuls 0-2',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000019',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   0, 'perpetuelle', NULL, CURRENT_DATE - interval '1 year', NULL, NULL, NULL, NULL),
  -- LIC-11 souscription prolongée par extension de période (date de fin
  -- étendue de +30 à +300 jours, trace au journal).
  ('50000000-0000-4000-8000-000000000020', 'REC Souscription prolongée',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000020',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   5, 'souscription', 2500.00, CURRENT_DATE - 65, CURRENT_DATE + 300, NULL, NULL, NULL),
  -- LIC-12 succession : ancienne période échue il y a 30 jours...
  ('50000000-0000-4000-8000-000000000021', 'REC Souscription renouvelée (ancienne période)',
   '45000000-0000-4000-8000-000000000005', '35000000-0000-4000-8000-000000000021',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   5, 'souscription', 2000.00, CURRENT_DATE - 395, CURRENT_DATE - 30, NULL, NULL, NULL),
  -- ... renouvelée par une période supplémentaire sur le MÊME contrat échu
  -- (CTR-07) : signal « contrat à faire suivre », rien de modifié.
  ('50000000-0000-4000-8000-000000000022', 'REC Souscription nouvelle période',
   '45000000-0000-4000-8000-000000000006', '35000000-0000-4000-8000-000000000021',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   5, 'souscription', 2500.00, CURRENT_DATE - 30, CURRENT_DATE + 335,
   '50000000-0000-4000-8000-000000000021', NULL, NULL),
  -- LIC-13 licence sur le logiciel client (LOG-02), acheteuse mère (CMD-02).
  ('50000000-0000-4000-8000-000000000023', 'REC Licence logiciel client RH',
   '45000000-0000-4000-8000-000000000002', '35000000-0000-4000-8000-000000000001',
   '36000000-0000-4000-8000-000000000021', '36000000-0000-4000-8000-000000000031',
   (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   3, 'perpetuelle', 900.00, CURRENT_DATE - interval '1 year', NULL, NULL, NULL, NULL),
  -- LIC-14 licence du composé (LOG-03) : ses droits couvrent les composants.
  ('50000000-0000-4000-8000-000000000024', 'REC Licence suite composée',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000002',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'serveur'),
   10, 'perpetuelle', 12000.00, CURRENT_DATE - interval '1 year', NULL, NULL, NULL, NULL),
  -- LIC-15 licence propre d'un composant : droits effectifs = 2 propres + 10
  -- hérités du composé ; 5 usages restent les siens.
  ('50000000-0000-4000-8000-000000000025', 'REC Licence composant Texte',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000003',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   2, 'perpetuelle', 300.00, CURRENT_DATE - interval '1 year', NULL, NULL, NULL, NULL),
  -- LIC-16 licence en version d'essai (type essai, date de fin obligatoire).
  ('50000000-0000-4000-8000-000000000026', 'REC Licence essai 45 jours',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000022',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_concurrent'),
   5, 'essai', 500.00, CURRENT_DATE - 45, CURRENT_DATE + 45, NULL, NULL, NULL),
  -- LIC-17 licence en métrique PAR POSTE (device), affectations à des postes.
  ('50000000-0000-4000-8000-000000000027', 'REC Licence par poste',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000023',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'device'),
   5, 'perpetuelle', 1000.00, CURRENT_DATE - interval '1 year', NULL, NULL, NULL, NULL),
  -- LIC-18 licence sans aucune preuve, sur la commande sans preuve (CMD-07) :
  -- manque documentaire détecté.
  ('50000000-0000-4000-8000-000000000028', 'REC Licence sans preuve',
   '45000000-0000-4000-8000-000000000007', '35000000-0000-4000-8000-000000000024',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   2, 'perpetuelle', 600.00, CURRENT_DATE - 45, NULL, NULL, NULL, NULL),
  -- LIC-19 licence avec certificat d'authenticité rattaché (PRV-06).
  ('50000000-0000-4000-8000-000000000029', 'REC Licence avec certificat',
   '45000000-0000-4000-8000-000000000009', '35000000-0000-4000-8000-000000000025',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   2, 'perpetuelle', 800.00, CURRENT_DATE - 30, NULL, NULL, NULL, NULL),
  -- LIC-20/21 : D52, le prix unitaire est celui de la DERNIÈRE commande
  -- (100 euros puis 150 euros : 150 fait foi).
  ('50000000-0000-4000-8000-000000000030', 'REC Licence prix 1 (100)',
   '45000000-0000-4000-8000-000000000003', '35000000-0000-4000-8000-000000000026',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   10, 'perpetuelle', 1000.00, CURRENT_DATE - 90, NULL, NULL, NULL, NULL),
  ('50000000-0000-4000-8000-000000000031', 'REC Licence prix 2 (150)',
   '45000000-0000-4000-8000-000000000004', '35000000-0000-4000-8000-000000000026',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   4, 'perpetuelle', 600.00, CURRENT_DATE - 10, NULL, NULL, NULL, NULL),
  -- LIC-22/23 : seuil de taux personnalisé à 85 % (SEU-01) : 86 % = attention
  -- (juste sur le seuil), 84 % = conforme (juste sous).
  ('50000000-0000-4000-8000-000000000032', 'REC Licence taux 86',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000027',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   50, 'perpetuelle', 500.00, CURRENT_DATE - interval '1 year', NULL, NULL, NULL, NULL),
  ('50000000-0000-4000-8000-000000000033', 'REC Licence taux 84',
   '45000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000028',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'utilisateur_nomme'),
   50, 'perpetuelle', 500.00, CURRENT_DATE - interval '1 year', NULL, NULL, NULL, NULL),
  -- LIC-24 licence du cas budget Sud (BUD-01/03).
  ('50000000-0000-4000-8000-000000000034', 'REC Licence budget Sud',
   '45000000-0000-4000-8000-000000000008', '35000000-0000-4000-8000-000000000029',
   NULL, NULL, (SELECT id FROM unite_mesure WHERE code = 'core'),
   10, 'perpetuelle', 9500.00, GREATEST(date_trunc('year', CURRENT_DATE)::date, CURRENT_DATE - 5), NULL, NULL, NULL, NULL);

-- ============================================================================
-- Maintenances (maintenance_historique) et historique des versions (D59-D60)
-- ============================================================================
INSERT INTO maintenance_historique (id, id_licence, id_mainteneur, id_commande,
                                    date_debut, date_fin, cout, id_version)
VALUES
  -- LIC-07 : trois périodes enchaînées sans trou, version montée à chaque fois.
  ('55000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000016',
   '32000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000001',
   CURRENT_DATE - interval '30 months', CURRENT_DATE - interval '18 months', 1800.00,
   '36000000-0000-4000-8000-000000000001'),
  ('55000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000016',
   '32000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000001',
   CURRENT_DATE - interval '18 months', CURRENT_DATE - interval '6 months', 1900.00,
   '36000000-0000-4000-8000-000000000002'),
  ('55000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000016',
   '32000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000001',
   CURRENT_DATE - interval '6 months', CURRENT_DATE + interval '6 months', 2000.00,
   '36000000-0000-4000-8000-000000000003'),
  -- LIC-08 : une période qui se termine dans 20 jours, sans suite.
  ('55000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000017',
   '32000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000001',
   CURRENT_DATE - 345, CURRENT_DATE + 20, 800.00, NULL),
  -- LIC-09 : période close à la date d'arrêt (il y a 6 mois).
  ('55000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000018',
   '32000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000001',
   CURRENT_DATE - interval '18 months', CURRENT_DATE - interval '6 months', 700.00,
   '36000000-0000-4000-8000-000000000022');

INSERT INTO licence_version_historique (id_licence, id_version_avant, id_version_apres,
                                        evenement, id_maintenance, date_effet, id_auteur, created_at)
VALUES
  -- LIC-07 : version d'achat, puis montée par les maintenances 2 et 3.
  ('50000000-0000-4000-8000-000000000016', NULL,
   '36000000-0000-4000-8000-000000000001', 'modification', NULL,
   (CURRENT_DATE - interval '30 months')::date, '20000000-0000-4000-8000-000000000002',
   now() - interval '30 months'),
  ('50000000-0000-4000-8000-000000000016', '36000000-0000-4000-8000-000000000001',
   '36000000-0000-4000-8000-000000000002', 'maintenance',
   '55000000-0000-4000-8000-000000000002',
   (CURRENT_DATE - interval '18 months')::date, '20000000-0000-4000-8000-000000000002',
   now() - interval '18 months'),
  ('50000000-0000-4000-8000-000000000016', '36000000-0000-4000-8000-000000000002',
   '36000000-0000-4000-8000-000000000003', 'maintenance',
   '55000000-0000-4000-8000-000000000003',
   (CURRENT_DATE - interval '6 months')::date, '20000000-0000-4000-8000-000000000002',
   now() - interval '6 months'),
  -- LIC-09 : arrêt de maintenance, version figée v2024.
  ('50000000-0000-4000-8000-000000000018', '36000000-0000-4000-8000-000000000022',
   '36000000-0000-4000-8000-000000000022', 'arret_maintenance', NULL,
   (CURRENT_DATE - interval '6 months')::date, '20000000-0000-4000-8000-000000000002',
   now() - interval '6 months');

-- ============================================================================
-- AFF - Affectations (usages déclarés). Bénéficiaire = affectation.id_societe.
-- Validées (comptent), en attente (ne comptent pas), refusée avec motif.
-- AFF-27a/b : même utilisateur (marie.durand) sur DEUX postes = 2 usages (D51).
-- ============================================================================
INSERT INTO affectation (id, label, id_licence, id_societe, quantite, reference_client, type_cible)
VALUES
  ('60000000-0000-4000-8000-000000000010', 'REC Usage sur-licencié',
   '50000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000002', 8,  'REC-EQUIPE-A',  'utilisateur'),
  ('60000000-0000-4000-8000-000000000011', 'REC Usage dépassement',
   '50000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000002', 7,  'REC-EQUIPE-B',  'utilisateur'),
  ('60000000-0000-4000-8000-000000000012', 'REC Usage équilibre',
   '50000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000002', 10, 'REC-EQUIPE-C',  'utilisateur'),
  ('60000000-0000-4000-8000-000000000013', 'REC Usage sur souscription échue',
   '50000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000002', 3,  'REC-EQUIPE-D',  'utilisateur'),
  ('60000000-0000-4000-8000-000000000014', 'REC Usage échéance 20 jours',
   '50000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000002', 2,  'REC-EQUIPE-E',  'utilisateur'),
  ('60000000-0000-4000-8000-000000000015', 'REC Usage perpétuelle nue',
   '50000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000002', 1,  'REC-EQUIPE-F',  'utilisateur'),
  ('60000000-0000-4000-8000-000000000016', 'REC Usage maintenance continue',
   '50000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000002', 6,  'REC-EQUIPE-G',  'utilisateur'),
  ('60000000-0000-4000-8000-000000000019', 'REC Usage sans droit',
   '50000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000002', 2,  'REC-EQUIPE-H',  'utilisateur'),
  ('60000000-0000-4000-8000-000000000023', 'REC Usage bénéficiaire Sud',
   '50000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000003', 2,  'REC-SUD-RH',    'utilisateur'),
  ('60000000-0000-4000-8000-000000000024', 'REC Usage suite composée',
   '50000000-0000-4000-8000-000000000024', '10000000-0000-4000-8000-000000000002', 1,  'REC-SRV-01',    'poste'),
  ('60000000-0000-4000-8000-000000000025', 'REC Usage composant Texte',
   '50000000-0000-4000-8000-000000000025', '10000000-0000-4000-8000-000000000002', 5,  'REC-EQUIPE-I',  'utilisateur'),
  ('60000000-0000-4000-8000-000000000026', 'REC Usage essai',
   '50000000-0000-4000-8000-000000000026', '10000000-0000-4000-8000-000000000002', 1,  'REC-EQUIPE-J',  'utilisateur'),
  ('60000000-0000-4000-8000-000000000027', 'REC Poste PC-0042 (marie.durand)',
   '50000000-0000-4000-8000-000000000027', '10000000-0000-4000-8000-000000000002', 1,  'REC-PC-0042',   'poste'),
  ('60000000-0000-4000-8000-000000000028', 'REC Poste PC-0043 (marie.durand)',
   '50000000-0000-4000-8000-000000000027', '10000000-0000-4000-8000-000000000002', 1,  'REC-PC-0043',   'poste'),
  ('60000000-0000-4000-8000-000000000030', 'REC Usage prix dernière commande',
   '50000000-0000-4000-8000-000000000030', '10000000-0000-4000-8000-000000000002', 3,  'REC-EQUIPE-K',  'utilisateur'),
  ('60000000-0000-4000-8000-000000000032', 'REC Usage taux 86',
   '50000000-0000-4000-8000-000000000032', '10000000-0000-4000-8000-000000000002', 43, 'REC-SITE-86',   'utilisateur'),
  ('60000000-0000-4000-8000-000000000033', 'REC Usage taux 84',
   '50000000-0000-4000-8000-000000000033', '10000000-0000-4000-8000-000000000002', 42, 'REC-SITE-84',   'utilisateur'),
  -- AFF-REVAL : validée, revalidation échue depuis 5 jours (notification).
  ('60000000-0000-4000-8000-000000000040', 'REC Usage à revalider (échu)',
   '50000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000002', 1,  'REC-REVAL-01',  'utilisateur'),
  -- AFF-ATTENTE : en attente de validation, NE COMPTE PAS dans la balance.
  ('60000000-0000-4000-8000-000000000041', 'REC Usage en attente de validation',
   '50000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000002', 5,  'REC-ATTENTE-01','utilisateur'),
  -- AFF-REFUS : refusée avec motif (motif visible via le lien de la saisie).
  ('60000000-0000-4000-8000-000000000042', 'REC Usage refusé (doublon)',
   '50000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000002', 2,  'REC-REFUS-01',  'utilisateur');

-- ============================================================================
-- Workflow de validation : la DERNIÈRE entrée par entité fait foi.
-- Entités validées : contrats, commandes, facture, preuves, éditeurs,
-- logiciels client, et les affectations qui comptent. Soumis par USR-05
-- (saisie), traité par USR-02 (Manager DSI).
-- ============================================================================
-- Affectations validées.
INSERT INTO workflow_validation (entite_type, entite_id, id_soumis_par, id_traite_par, id_statut, created_at)
SELECT 'affectation', a.id,
       '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002',
       (SELECT id FROM validation_status WHERE code = 'valide'),
       now() - interval '10 days'
  FROM affectation a
 WHERE a.id::text LIKE '60000000-%'
   AND a.id NOT IN ('60000000-0000-4000-8000-000000000041',
                    '60000000-0000-4000-8000-000000000042');
-- Affectation en attente.
INSERT INTO workflow_validation (entite_type, entite_id, id_soumis_par, id_statut, created_at)
VALUES ('affectation', '60000000-0000-4000-8000-000000000041',
        '20000000-0000-4000-8000-000000000005',
        (SELECT id FROM validation_status WHERE code = 'en_attente'),
        now() - interval '2 days');
-- Affectation refusée, avec motif.
INSERT INTO workflow_validation (entite_type, entite_id, id_soumis_par, id_traite_par, id_statut, message_refus, created_at)
VALUES ('affectation', '60000000-0000-4000-8000-000000000042',
        '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002',
        (SELECT id FROM validation_status WHERE code = 'refuse'),
        'REC Doublon de saisie : cet usage est déjà déclaré sur REC-EQUIPE-F.',
        now() - interval '3 days');

-- Miroir v4 du statut sur la colonne affectation.id_validation_status.
UPDATE affectation a
   SET id_validation_status = (SELECT id FROM validation_status WHERE code = 'valide')
 WHERE a.id::text LIKE '60000000-%'
   AND a.id NOT IN ('60000000-0000-4000-8000-000000000041',
                    '60000000-0000-4000-8000-000000000042');
UPDATE affectation SET id_validation_status = (SELECT id FROM validation_status WHERE code = 'en_attente')
 WHERE id = '60000000-0000-4000-8000-000000000041';
UPDATE affectation SET id_validation_status = (SELECT id FROM validation_status WHERE code = 'refuse')
 WHERE id = '60000000-0000-4000-8000-000000000042';

-- Cycles de revalidation des affectations validées : à jour (+20 jours),
-- sauf AFF-REVAL, échue depuis 5 jours (délai société 30 jours).
INSERT INTO revalidation (id_affectation, date_derniere_validation, date_prochaine_revalidation, statut)
SELECT a.id, CURRENT_DATE - 10, CURRENT_DATE + 20, 'a_jour'
  FROM affectation a
 WHERE a.id::text LIKE '60000000-%'
   AND a.id NOT IN ('60000000-0000-4000-8000-000000000040',
                    '60000000-0000-4000-8000-000000000041',
                    '60000000-0000-4000-8000-000000000042');
INSERT INTO revalidation (id_affectation, date_derniere_validation, date_prochaine_revalidation, statut)
VALUES ('60000000-0000-4000-8000-000000000040', CURRENT_DATE - 35, CURRENT_DATE - 5, 'a_jour');
UPDATE affectation a
   SET date_revalidation = r.date_prochaine_revalidation
  FROM revalidation r
 WHERE r.id_affectation = a.id;

-- Contrats, commandes, éditeurs et logiciels client : tous validés.
INSERT INTO workflow_validation (entite_type, entite_id, id_soumis_par, id_traite_par, id_statut, created_at)
SELECT 'contrat', c.id,
       '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002',
       (SELECT id FROM validation_status WHERE code = 'valide'), now() - interval '12 days'
  FROM contrat c WHERE c.id::text LIKE '40000000-%';
INSERT INTO workflow_validation (entite_type, entite_id, id_soumis_par, id_traite_par, id_statut, created_at)
SELECT 'commande', c.id,
       '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002',
       (SELECT id FROM validation_status WHERE code = 'valide'), now() - interval '11 days'
  FROM commande c WHERE c.id::text LIKE '45000000-%';
INSERT INTO workflow_validation (entite_type, entite_id, id_soumis_par, id_traite_par, id_statut, created_at)
SELECT 'editeur', e.id,
       '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002',
       (SELECT id FROM validation_status WHERE code = 'valide'), now() - interval '15 days'
  FROM editeur e WHERE e.id::text LIKE '30000000-%';
INSERT INTO workflow_validation (entite_type, entite_id, id_soumis_par, id_traite_par, id_statut, created_at)
SELECT 'produit_client', p.id,
       '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002',
       (SELECT id FROM validation_status WHERE code = 'valide'), now() - interval '14 days'
  FROM produit_client p WHERE p.id::text LIKE '35000000-%';

-- ============================================================================
-- PRV - Preuves (une par type du référentiel) et facture
-- Les preuves sont portées en mode « référence » ou « URL » (aucun fichier
-- physique à déployer) ; PRV-10 est la preuve externe (URL).
-- PRV-04 est la preuve support de la facture FAC-01 (montant 1234,56, datée).
-- PRV-06 est le certificat d'authenticité rattaché à la licence LIC-19.
-- ============================================================================
INSERT INTO preuve (id, label, id_type_preuve, id_contrat, id_commande, id_licence,
                    mode, url_externe, reference_externe, date_preuve)
VALUES
  ('65000000-0000-4000-8000-000000000001', 'REC Preuve contrat signé scanné',
   (SELECT id FROM type_preuve WHERE code = 'contrat_scanne'),
   '40000000-0000-4000-8000-000000000001', NULL, NULL,
   'reference', NULL, 'REC-GED-CTR-001', CURRENT_DATE - 60),
  ('65000000-0000-4000-8000-000000000002', 'REC Preuve bon de commande',
   (SELECT id FROM type_preuve WHERE code = 'bon_commande'),
   NULL, '45000000-0000-4000-8000-000000000001', NULL,
   'reference', NULL, 'REC-GED-BC-001', CURRENT_DATE - 50),
  ('65000000-0000-4000-8000-000000000003', 'REC Preuve bon de livraison',
   (SELECT id FROM type_preuve WHERE code = 'bon_livraison'),
   NULL, '45000000-0000-4000-8000-000000000001', NULL,
   'reference', NULL, 'REC-GED-BL-001', CURRENT_DATE - 49),
  ('65000000-0000-4000-8000-000000000004', 'REC Preuve facture',
   (SELECT id FROM type_preuve WHERE code = 'facture'),
   NULL, '45000000-0000-4000-8000-000000000009', NULL,
   'reference', NULL, 'REC-GED-FAC-001', CURRENT_DATE - 30),
  ('65000000-0000-4000-8000-000000000005', 'REC Preuve certificat',
   (SELECT id FROM type_preuve WHERE code = 'certificat'),
   NULL, '45000000-0000-4000-8000-000000000001', NULL,
   'reference', NULL, 'REC-GED-CERT-001', CURRENT_DATE - 48),
  ('65000000-0000-4000-8000-000000000006', 'REC Certificat d''authenticité licence',
   (SELECT id FROM type_preuve WHERE code = 'certificat_authenticite'),
   NULL, NULL, '50000000-0000-4000-8000-000000000029',
   'reference', NULL, 'REC-CERT-AUTH-001', CURRENT_DATE - 29),
  ('65000000-0000-4000-8000-000000000007', 'REC Preuve clefs de licence',
   (SELECT id FROM type_preuve WHERE code = 'clefs_licence'),
   NULL, NULL, '50000000-0000-4000-8000-000000000016',
   'reference', NULL, 'REC-CLEFS-001', CURRENT_DATE - 45),
  ('65000000-0000-4000-8000-000000000008', 'REC Preuve contrat et annexes',
   (SELECT id FROM type_preuve WHERE code = 'contrat_annexes'),
   '40000000-0000-4000-8000-000000000002', NULL, NULL,
   'reference', NULL, 'REC-GED-ANNEXES-001', CURRENT_DATE - 44),
  ('65000000-0000-4000-8000-000000000009', 'REC Preuve attestation éditeur',
   (SELECT id FROM type_preuve WHERE code = 'attestation_editeur'),
   NULL, '45000000-0000-4000-8000-000000000002', NULL,
   'reference', NULL, 'REC-ATTEST-001', CURRENT_DATE - 40),
  ('65000000-0000-4000-8000-000000000010', 'REC Preuve externe portail éditeur',
   (SELECT id FROM type_preuve WHERE code = 'capture_portail'),
   NULL, '45000000-0000-4000-8000-000000000002', NULL,
   'url', 'https://portail-editeur.exemple/REC/licences', NULL, CURRENT_DATE - 20),
  ('65000000-0000-4000-8000-000000000011', 'REC Preuve autre',
   (SELECT id FROM type_preuve WHERE code = 'autre'),
   NULL, '45000000-0000-4000-8000-000000000002', NULL,
   'reference', NULL, 'REC-AUTRE-001', CURRENT_DATE - 15);

INSERT INTO facture (id, label, id_commande, id_preuve, montant)
VALUES ('66000000-0000-4000-8000-000000000001', 'REC Facture commande Nord',
        '45000000-0000-4000-8000-000000000009',
        '65000000-0000-4000-8000-000000000004', 1234.56);

-- Preuves et facture : validées (seule la facture du dépôt unifié est soumise,
-- les preuves restent des entités validables).
INSERT INTO workflow_validation (entite_type, entite_id, id_soumis_par, id_traite_par, id_statut, created_at)
SELECT 'preuve', p.id,
       '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002',
       (SELECT id FROM validation_status WHERE code = 'valide'), now() - interval '9 days'
  FROM preuve p WHERE p.id::text LIKE '65000000-%';
INSERT INTO workflow_validation (entite_type, entite_id, id_soumis_par, id_traite_par, id_statut, created_at)
VALUES ('facture', '66000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002',
        (SELECT id FROM validation_status WHERE code = 'valide'), now() - interval '9 days');

-- ============================================================================
-- BUD - Budget (l'organisation payeuse se déduit licence -> commande ->
-- société, jamais stockée sur la ligne).
-- BUD-01 : alloué 10 000 Filiale Sud sur l'exercice courant ; engagé 9 500
--          (CMD-08) : taux 95 %, seuil 90 % franchi -> notification.
-- BUD-02 : prévisionnel SAISI 2 500 sur l'exercice suivant pour LIC-07, alors
--          que le calculé (maintenance en cours 2 000 x 1,035) vaut 2 070 :
--          le saisi est retenu, le calculé reste une proposition (D43).
-- BUD-03 : alloué 8 000 Filiale Sud sur l'exercice PRÉCÉDENT (sélecteur).
-- BUD-04 : alloué 23 200 Filiale Nord, engagé 20 634,56 : taux ~88,9 %,
--          juste sous le seuil -> aucune notification pour Nord.
-- ============================================================================
INSERT INTO budget (id, id_licence, type, montant_opex, quantite_opex, date_debut, date_fin)
VALUES
  ('70000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000034',
   'alloue', 10000.00, 10,
   date_trunc('year', CURRENT_DATE)::date,
   (date_trunc('year', CURRENT_DATE) + interval '1 year - 1 day')::date),
  ('70000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000016',
   'previsionnel', 2500.00, 10,
   (date_trunc('year', CURRENT_DATE) + interval '1 year')::date,
   (date_trunc('year', CURRENT_DATE) + interval '2 years - 1 day')::date),
  ('70000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000034',
   'alloue', 8000.00, 10,
   (date_trunc('year', CURRENT_DATE) - interval '1 year')::date,
   (date_trunc('year', CURRENT_DATE) - interval '1 day')::date),
  ('70000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000010',
   'alloue', 23200.00, 10,
   date_trunc('year', CURRENT_DATE)::date,
   (date_trunc('year', CURRENT_DATE) + interval '1 year - 1 day')::date);

-- ============================================================================
-- SEU - Seuil personnalisé du tenant : conformite_taux passe de 90 à 85
-- (personnalise = true, le défaut Commune reste 90 dans valeurs_defaut).
-- Prouve que la lecture tenant fait foi : 86 % = attention, 84 % = conforme.
-- ============================================================================
INSERT INTO seuil_dashboard (widget_code, echelle, valeur, unite, direction, personnalise, valeurs_defaut)
VALUES ('conformite_taux', 1, 85, 'pourcent', 'max', true,
        '{"valeur": 90, "unite": "pourcent", "direction": "max"}'::jsonb)
ON CONFLICT (widget_code, echelle) DO UPDATE
   SET valeur = 85, personnalise = true,
       valeurs_defaut = COALESCE(seuil_dashboard.valeurs_defaut, EXCLUDED.valeurs_defaut);

-- ============================================================================
-- NTF - Préférences de notification : USR-04 (IT Ops) désactive le courrier
-- des dépassements de conformité (courrier immédiat par défaut) : la
-- notification en application reste servie, le courrier part en sans_objet.
-- ============================================================================
INSERT INTO preference_notification (id_utilisateur, type, courrier)
VALUES ('20000000-0000-4000-8000-000000000004', 'depassement_conformite', 'desactive')
ON CONFLICT (id_utilisateur, type) DO UPDATE SET courrier = 'desactive';

-- ============================================================================
-- Traces : la prolongation de LIC-11 est journalisée (le journal est vidé par
-- le reset, cette ligne rend le cas lisible à l'écran Journal).
-- ============================================================================
INSERT INTO journal_ecriture (action, entite_type, entite_id, description, id_auteur, payload)
VALUES ('PROLONGATION', 'licence', '50000000-0000-4000-8000-000000000020',
        'REC Prolongation de la période en cours : date de fin étendue au '
        || to_char(CURRENT_DATE + 300, 'DD/MM/YYYY') || '.',
        '20000000-0000-4000-8000-000000000002',
        jsonb_build_object('date_fin_avant', to_char(CURRENT_DATE + 30, 'YYYY-MM-DD'),
                           'date_fin_apres', to_char(CURRENT_DATE + 300, 'YYYY-MM-DD')));

-- ============================================================================
-- Précalcul de conformité : recalcul complet en fin de transaction. Les
-- triggers des licences et affectations ont tiré AVANT l'insertion des entrées
-- de workflow : sans ce recalcul, les usages validés seraient comptés à zéro.
-- ============================================================================
SELECT recalculer_conformite_complete();

COMMIT;
