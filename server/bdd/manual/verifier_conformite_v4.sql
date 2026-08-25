-- ============================================================================
-- SamSecure - Verification de conformite au schema v4
-- Fichier   : server/bdd/manual/verifier_conformite_v4.sql
-- Objet     : controle, par information_schema, qu'une base est conforme a la
--             cible v4 (US #71) : referentiel docs/bdd/index.html du 05/08
--             + extensions migrees (008 a 023) + BDD Commune 024 a 027
--             + module 3 (028 a 032) + module 4 budget (033 Tenant, 034 et
--             035 Commune, 036 Tenant, US #146). La table budget et
--             societe.debut_exercice_fiscal sont deja dans la cible v4 ;
--             la 033 ne change ni nom ni type de colonne.
--             Cible generee depuis le bloc DATA de docs/bdd/index.html
--             (70 tables : 16 Commune, 54 Tenant) : la doc /bdd et ce
--             script decrivent la meme structure, par construction.
-- Cible     : PostgreSQL 16, base Commune OU base Tenant (detection
--             automatique : tenant_config present = Tenant,
--             produit_referentiel present = Commune).
-- Exécution : psql -U samsecure_app -d <base> -f server/bdd/manual/verifier_conformite_v4.sql
--             Lecture seule : tables temporaires uniquement, aucune ecriture
--             dans le schema public. Hors migrate.js (sous-dossier manual/).
-- Sortie    : sections numerotees. Les sections 2, 3, 4, 6 et 7 sont
--             bloquantes (base NON conforme si une ligne apparait), les
--             sections 5, 8 et 9 sont informatives. La section 10 rend le
--             verdict.
-- Limites   : compare noms, types de base (uuid, character varying, numeric,
--             timestamp without time zone...), PK sur id et UNIQUE mono
--             colonne declares dans le referentiel. Ne compare ni les
--             longueurs VARCHAR, ni NOT NULL, ni les DEFAULT, ni les CHECK,
--             ni les FK, ni les index : ces elements ne sont pas portes par
--             le referentiel v4.
-- ============================================================================

\set ON_ERROR_STOP on
\pset footer off

-- ----------------------------------------------------------------------------
-- 0. Cible attendue
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE v4_attendu (
  base        text NOT NULL,   -- commune | tenant
  table_name  text NOT NULL,
  column_name text NOT NULL,
  data_type   text NOT NULL,   -- information_schema.columns.data_type
  cle         text NOT NULL    -- PK | FK | UNIQUE | ''
);
INSERT INTO v4_attendu (base, table_name, column_name, data_type, cle) VALUES
  ('commune', 'produit_referentiel', 'id', 'uuid', 'PK'),
  ('commune', 'produit_referentiel', 'label', 'character varying', ''),
  ('commune', 'produit_referentiel', 'id_editeur', 'uuid', 'FK'),
  ('commune', 'produit_referentiel', 'sku', 'character varying', ''),
  ('commune', 'produit_referentiel', 'id_produit_parent', 'uuid', 'FK'),
  ('commune', 'produit_referentiel', 'created_at', 'timestamp without time zone', ''),
  ('commune', 'version', 'id', 'uuid', 'PK'),
  ('commune', 'version', 'id_produit', 'uuid', 'FK'),
  ('commune', 'version', 'label', 'character varying', ''),
  ('commune', 'version', 'created_at', 'timestamp without time zone', ''),
  ('commune', 'edition', 'id', 'uuid', 'PK'),
  ('commune', 'edition', 'id_produit', 'uuid', 'FK'),
  ('commune', 'edition', 'label', 'character varying', ''),
  ('commune', 'edition', 'created_at', 'timestamp without time zone', ''),
  ('commune', 'default_profil', 'id', 'uuid', 'PK'),
  ('commune', 'default_profil', 'code', 'character varying', 'UNIQUE'),
  ('commune', 'default_profil', 'label', 'character varying', ''),
  ('commune', 'default_profil', 'description', 'text', ''),
  ('commune', 'default_profil', 'created_at', 'timestamp without time zone', ''),
  ('commune', 'default_permission', 'id', 'uuid', 'PK'),
  ('commune', 'default_permission', 'code', 'character varying', 'UNIQUE'),
  ('commune', 'default_permission', 'label', 'character varying', ''),
  ('commune', 'default_permission', 'module', 'character varying', ''),
  ('commune', 'default_permission', 'created_at', 'timestamp without time zone', ''),
  ('commune', 'default_profil_permission', 'id', 'uuid', 'PK'),
  ('commune', 'default_profil_permission', 'id_profil', 'uuid', 'FK'),
  ('commune', 'default_profil_permission', 'id_permission', 'uuid', 'FK'),
  ('commune', 'default_profil_permission', 'created_at', 'timestamp without time zone', ''),
  ('commune', 'default_profil_widget', 'id', 'uuid', 'PK'),
  ('commune', 'default_profil_widget', 'id_profil', 'uuid', 'FK'),
  ('commune', 'default_profil_widget', 'widget_code', 'character varying', ''),
  ('commune', 'default_profil_widget', 'visible_defaut', 'boolean', ''),
  ('commune', 'default_profil_widget', 'acces_autorise', 'boolean', ''),
  ('commune', 'default_profil_widget', 'created_at', 'timestamp without time zone', ''),
  ('commune', 'default_seuil_dashboard', 'id', 'uuid', 'PK'),
  ('commune', 'default_seuil_dashboard', 'widget_code', 'character varying', ''),
  ('commune', 'default_seuil_dashboard', 'echelle', 'integer', ''),
  ('commune', 'default_seuil_dashboard', 'valeur', 'numeric', ''),
  ('commune', 'default_seuil_dashboard', 'unite', 'character varying', ''),
  ('commune', 'default_seuil_dashboard', 'direction', 'character varying', ''),
  ('commune', 'default_seuil_dashboard', 'created_at', 'timestamp without time zone', ''),
  ('commune', 'default_fonction', 'id', 'uuid', 'PK'),
  ('commune', 'default_fonction', 'code', 'character varying', 'UNIQUE'),
  ('commune', 'default_fonction', 'label', 'character varying', ''),
  ('commune', 'default_fonction', 'created_at', 'timestamp without time zone', ''),
  ('commune', 'default_type_contrat', 'id', 'uuid', 'PK'),
  ('commune', 'default_type_contrat', 'code', 'character varying', 'UNIQUE'),
  ('commune', 'default_type_contrat', 'label', 'character varying', ''),
  ('commune', 'default_type_contrat', 'created_at', 'timestamp without time zone', ''),
  ('commune', 'default_type_preuve', 'id', 'uuid', 'PK'),
  ('commune', 'default_type_preuve', 'code', 'character varying', 'UNIQUE'),
  ('commune', 'default_type_preuve', 'label', 'character varying', ''),
  ('commune', 'default_type_preuve', 'created_at', 'timestamp without time zone', ''),
  ('commune', 'default_mode_commande', 'id', 'uuid', 'PK'),
  ('commune', 'default_mode_commande', 'code', 'character varying', 'UNIQUE'),
  ('commune', 'default_mode_commande', 'label', 'character varying', ''),
  ('commune', 'default_mode_commande', 'created_at', 'timestamp without time zone', ''),
  ('commune', 'default_unite_mesure', 'id', 'uuid', 'PK'),
  ('commune', 'default_unite_mesure', 'code', 'character varying', 'UNIQUE'),
  ('commune', 'default_unite_mesure', 'label', 'character varying', ''),
  ('commune', 'default_unite_mesure', 'description', 'text', ''),
  ('commune', 'default_unite_mesure', 'created_at', 'timestamp without time zone', ''),
  ('commune', 'code_retour', 'id', 'uuid', 'PK'),
  ('commune', 'code_retour', 'code', 'integer', 'UNIQUE'),
  ('commune', 'code_retour', 'type', 'character varying', ''),
  ('commune', 'code_retour', 'libelle', 'character varying', ''),
  ('commune', 'code_retour', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'societe', 'id', 'uuid', 'PK'),
  ('tenant', 'societe', 'id_societe_parent', 'uuid', 'FK'),
  ('tenant', 'societe', 'raison_sociale', 'character varying', ''),
  ('tenant', 'societe', 'siret', 'character varying', ''),
  ('tenant', 'societe', 'email', 'character varying', ''),
  ('tenant', 'societe', 'telephone', 'character varying', ''),
  ('tenant', 'societe', 'duree_amortissement', 'integer', ''),
  ('tenant', 'societe', 'revalorisation_annuelle', 'numeric', ''),
  ('tenant', 'societe', 'delai_revalidation', 'integer', ''),
  ('tenant', 'societe', 'debut_exercice_fiscal', 'date', ''),
  ('tenant', 'societe', 'actif', 'boolean', ''),
  ('tenant', 'societe', 'date_fin_activite', 'date', ''),
  ('tenant', 'societe', 'date_suppression', 'timestamp without time zone', ''),
  ('tenant', 'societe', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'societe', 'updated_at', 'timestamp without time zone', ''),
  ('tenant', 'abonnement_samsecure', 'id', 'uuid', 'PK'),
  ('tenant', 'abonnement_samsecure', 'label', 'character varying', ''),
  ('tenant', 'abonnement_samsecure', 'description', 'text', ''),
  ('tenant', 'abonnement_samsecure', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'tenant_config', 'id', 'uuid', 'PK'),
  ('tenant', 'tenant_config', 'raison_sociale', 'character varying', ''),
  ('tenant', 'tenant_config', 'id_abonnement', 'uuid', 'FK'),
  ('tenant', 'tenant_config', 'id_administrateur', 'uuid', 'FK'),
  ('tenant', 'tenant_config', 'langue_defaut', 'character varying', ''),
  ('tenant', 'tenant_config', 'cle_chiffrement_hash', 'character varying', ''),
  ('tenant', 'tenant_config', 'options_actives', 'jsonb', ''),
  ('tenant', 'tenant_config', 'debut_exercice_fiscal_defaut', 'date', ''),
  ('tenant', 'tenant_config', 'taux_hausse_annuelle_defaut', 'numeric', ''),
  ('tenant', 'tenant_config', 'version_referentiels', 'integer', ''),
  ('tenant', 'tenant_config', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'tenant_config', 'updated_at', 'timestamp without time zone', ''),
  ('tenant', 'editeur', 'id', 'uuid', 'PK'),
  ('tenant', 'editeur', 'raison_sociale', 'character varying', ''),
  ('tenant', 'editeur', 'taux_hausse_annuelle', 'numeric', ''),
  ('tenant', 'editeur', 'url_logo_defaut', 'character varying', ''),
  ('tenant', 'editeur', 'url_logo_custom', 'character varying', ''),
  ('tenant', 'editeur', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'editeur', 'updated_at', 'timestamp without time zone', ''),
  ('tenant', 'revendeur', 'id', 'uuid', 'PK'),
  ('tenant', 'revendeur', 'raison_sociale', 'character varying', ''),
  ('tenant', 'revendeur', 'siret', 'character varying', ''),
  ('tenant', 'revendeur', 'iban', 'character varying', ''),
  ('tenant', 'revendeur', 'email', 'character varying', ''),
  ('tenant', 'revendeur', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'mainteneur', 'id', 'uuid', 'PK'),
  ('tenant', 'mainteneur', 'raison_sociale', 'character varying', ''),
  ('tenant', 'mainteneur', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'contact', 'id', 'uuid', 'PK'),
  ('tenant', 'contact', 'nom', 'character varying', ''),
  ('tenant', 'contact', 'prenom', 'character varying', ''),
  ('tenant', 'contact', 'email', 'character varying', ''),
  ('tenant', 'contact', 'telephone', 'character varying', ''),
  ('tenant', 'contact', 'id_fonction', 'uuid', 'FK'),
  ('tenant', 'contact', 'photo_url', 'character varying', ''),
  ('tenant', 'contact', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'fonction', 'id', 'uuid', 'PK'),
  ('tenant', 'fonction', 'code', 'character varying', 'UNIQUE'),
  ('tenant', 'fonction', 'label', 'character varying', ''),
  ('tenant', 'fonction', 'personnalise', 'boolean', ''),
  ('tenant', 'fonction', 'valeurs_defaut', 'jsonb', ''),
  ('tenant', 'fonction', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'type_contrat', 'id', 'uuid', 'PK'),
  ('tenant', 'type_contrat', 'code', 'character varying', 'UNIQUE'),
  ('tenant', 'type_contrat', 'label', 'character varying', ''),
  ('tenant', 'type_contrat', 'personnalise', 'boolean', ''),
  ('tenant', 'type_contrat', 'valeurs_defaut', 'jsonb', ''),
  ('tenant', 'type_contrat', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'type_preuve', 'id', 'uuid', 'PK'),
  ('tenant', 'type_preuve', 'code', 'character varying', 'UNIQUE'),
  ('tenant', 'type_preuve', 'label', 'character varying', ''),
  ('tenant', 'type_preuve', 'personnalise', 'boolean', ''),
  ('tenant', 'type_preuve', 'valeurs_defaut', 'jsonb', ''),
  ('tenant', 'type_preuve', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'mode_commande', 'id', 'uuid', 'PK'),
  ('tenant', 'mode_commande', 'code', 'character varying', 'UNIQUE'),
  ('tenant', 'mode_commande', 'label', 'character varying', ''),
  ('tenant', 'mode_commande', 'personnalise', 'boolean', ''),
  ('tenant', 'mode_commande', 'valeurs_defaut', 'jsonb', ''),
  ('tenant', 'mode_commande', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'validation_status', 'id', 'uuid', 'PK'),
  ('tenant', 'validation_status', 'code', 'character varying', 'UNIQUE'),
  ('tenant', 'validation_status', 'label', 'character varying', ''),
  ('tenant', 'validation_status', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'unite_mesure', 'id', 'uuid', 'PK'),
  ('tenant', 'unite_mesure', 'code', 'character varying', 'UNIQUE'),
  ('tenant', 'unite_mesure', 'label', 'character varying', ''),
  ('tenant', 'unite_mesure', 'description', 'text', ''),
  ('tenant', 'unite_mesure', 'personnalise', 'boolean', ''),
  ('tenant', 'unite_mesure', 'valeurs_defaut', 'jsonb', ''),
  ('tenant', 'unite_mesure', 'created_at', 'timestamp without time zone', ''),
  ('commune', 'langue', 'id', 'uuid', 'PK'),
  ('commune', 'langue', 'code', 'character varying', 'UNIQUE'),
  ('commune', 'langue', 'label', 'character varying', ''),
  ('commune', 'langue', 'actif', 'boolean', ''),
  ('commune', 'langue', 'created_at', 'timestamp without time zone', ''),
  ('commune', 'traduction', 'id', 'uuid', 'PK'),
  ('commune', 'traduction', 'id_langue', 'uuid', 'FK'),
  ('commune', 'traduction', 'cle', 'character varying', ''),
  ('commune', 'traduction', 'valeur', 'text', ''),
  ('commune', 'traduction', 'module', 'character varying', ''),
  ('commune', 'traduction', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'profil', 'id', 'uuid', 'PK'),
  ('tenant', 'profil', 'code', 'character varying', 'UNIQUE'),
  ('tenant', 'profil', 'label', 'character varying', ''),
  ('tenant', 'profil', 'description', 'text', ''),
  ('tenant', 'profil', 'personnalise', 'boolean', ''),
  ('tenant', 'profil', 'valeurs_defaut', 'jsonb', ''),
  ('tenant', 'profil', 'date_suppression', 'timestamp without time zone', ''),
  ('tenant', 'profil', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'permission', 'id', 'uuid', 'PK'),
  ('tenant', 'permission', 'code', 'character varying', 'UNIQUE'),
  ('tenant', 'permission', 'label', 'character varying', ''),
  ('tenant', 'permission', 'module', 'character varying', ''),
  ('tenant', 'permission', 'personnalise', 'boolean', ''),
  ('tenant', 'permission', 'valeurs_defaut', 'jsonb', ''),
  ('tenant', 'permission', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'profil_permission', 'id', 'uuid', 'PK'),
  ('tenant', 'profil_permission', 'id_profil', 'uuid', 'FK'),
  ('tenant', 'profil_permission', 'id_permission', 'uuid', 'FK'),
  ('tenant', 'profil_permission', 'date_suppression', 'timestamp without time zone', ''),
  ('tenant', 'profil_permission', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'exception_droit', 'id', 'uuid', 'PK'),
  ('tenant', 'exception_droit', 'id_utilisateur', 'uuid', 'FK'),
  ('tenant', 'exception_droit', 'id_permission', 'uuid', 'FK'),
  ('tenant', 'exception_droit', 'id_societe', 'uuid', 'FK'),
  ('tenant', 'exception_droit', 'type', 'character varying', ''),
  ('tenant', 'exception_droit', 'motif', 'text', ''),
  ('tenant', 'exception_droit', 'date_debut', 'date', ''),
  ('tenant', 'exception_droit', 'date_fin', 'date', ''),
  ('tenant', 'exception_droit', 'id_accorde_par', 'uuid', 'FK'),
  ('tenant', 'exception_droit', 'motif_modification', 'text', ''),
  ('tenant', 'exception_droit', 'date_suppression', 'timestamp without time zone', ''),
  ('tenant', 'exception_droit', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'seuil_dashboard', 'id', 'uuid', 'PK'),
  ('tenant', 'seuil_dashboard', 'widget_code', 'character varying', ''),
  ('tenant', 'seuil_dashboard', 'echelle', 'integer', ''),
  ('tenant', 'seuil_dashboard', 'valeur', 'numeric', ''),
  ('tenant', 'seuil_dashboard', 'unite', 'character varying', ''),
  ('tenant', 'seuil_dashboard', 'direction', 'character varying', ''),
  ('tenant', 'seuil_dashboard', 'personnalise', 'boolean', ''),
  ('tenant', 'seuil_dashboard', 'valeurs_defaut', 'jsonb', ''),
  ('tenant', 'seuil_dashboard', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'profil_widget', 'id', 'uuid', 'PK'),
  ('tenant', 'profil_widget', 'id_profil', 'uuid', 'FK'),
  ('tenant', 'profil_widget', 'widget_code', 'character varying', ''),
  ('tenant', 'profil_widget', 'visible_defaut', 'boolean', ''),
  ('tenant', 'profil_widget', 'acces_autorise', 'boolean', ''),
  ('tenant', 'profil_widget', 'personnalise', 'boolean', ''),
  ('tenant', 'profil_widget', 'valeurs_defaut', 'jsonb', ''),
  ('tenant', 'profil_widget', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'preference_dashboard', 'id', 'uuid', 'PK'),
  ('tenant', 'preference_dashboard', 'id_utilisateur', 'uuid', 'FK'),
  ('tenant', 'preference_dashboard', 'widget_code', 'character varying', ''),
  ('tenant', 'preference_dashboard', 'visible', 'boolean', ''),
  ('tenant', 'preference_dashboard', 'position', 'integer', ''),
  ('tenant', 'preference_dashboard', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'produit_client', 'id', 'uuid', 'PK'),
  ('tenant', 'produit_client', 'label', 'character varying', ''),
  ('tenant', 'produit_client', 'id_editeur', 'uuid', 'FK'),
  ('tenant', 'produit_client', 'id_produit_parent', 'uuid', 'FK'),
  ('tenant', 'produit_client', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'pre_parametre_licence', 'id', 'uuid', 'PK'),
  ('tenant', 'pre_parametre_licence', 'id_produit', 'uuid', 'FK'),
  ('tenant', 'pre_parametre_licence', 'mode_decompte', 'character varying', ''),
  ('tenant', 'pre_parametre_licence', 'id_unite_mesure', 'uuid', 'FK'),
  ('tenant', 'pre_parametre_licence', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'contrat', 'id', 'uuid', 'PK'),
  ('tenant', 'contrat', 'label', 'character varying', ''),
  ('tenant', 'contrat', 'id_type_contrat', 'uuid', 'FK'),
  ('tenant', 'contrat', 'id_editeur', 'uuid', 'FK'),
  ('tenant', 'contrat', 'id_societe', 'uuid', 'FK'),
  ('tenant', 'contrat', 'id_revendeur', 'uuid', 'FK'),
  ('tenant', 'contrat', 'id_contrat_parent', 'uuid', 'FK'),
  ('tenant', 'contrat', 'date_debut', 'date', ''),
  ('tenant', 'contrat', 'date_fin', 'date', ''),
  ('tenant', 'contrat', 'a_renouveler', 'boolean', ''),
  ('tenant', 'contrat', 'duree_resiliation', 'integer', ''),
  ('tenant', 'contrat', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'contrat', 'updated_at', 'timestamp without time zone', ''),
  ('tenant', 'commande', 'id', 'uuid', 'PK'),
  ('tenant', 'commande', 'label', 'character varying', ''),
  ('tenant', 'commande', 'id_contrat', 'uuid', 'FK'),
  ('tenant', 'commande', 'id_societe', 'uuid', 'FK'),
  ('tenant', 'commande', 'id_revendeur', 'uuid', 'FK'),
  ('tenant', 'commande', 'id_mode_commande', 'uuid', 'FK'),
  ('tenant', 'commande', 'numero_devis', 'character varying', ''),
  ('tenant', 'commande', 'reference_interne', 'character varying', ''),
  ('tenant', 'commande', 'montant', 'numeric', ''),
  ('tenant', 'commande', 'date_commande', 'date', ''),
  ('tenant', 'commande', 'date_fin', 'date', ''),
  ('tenant', 'commande', 'a_renouveler', 'boolean', ''),
  ('tenant', 'commande', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'commande', 'updated_at', 'timestamp without time zone', ''),
  ('tenant', 'facture', 'id', 'uuid', 'PK'),
  ('tenant', 'facture', 'label', 'character varying', ''),
  ('tenant', 'facture', 'id_commande', 'uuid', 'FK'),
  ('tenant', 'facture', 'id_preuve', 'uuid', 'FK'),
  ('tenant', 'facture', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'preuve', 'id', 'uuid', 'PK'),
  ('tenant', 'preuve', 'label', 'character varying', ''),
  ('tenant', 'preuve', 'id_type_preuve', 'uuid', 'FK'),
  ('tenant', 'preuve', 'id_contrat', 'uuid', 'FK'),
  ('tenant', 'preuve', 'id_commande', 'uuid', 'FK'),
  ('tenant', 'preuve', 'url_fichier', 'character varying', ''),
  ('tenant', 'preuve', 'nom_origine', 'character varying', ''),
  ('tenant', 'preuve', 'hash_sha256', 'character varying', ''),
  ('tenant', 'preuve', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'licence', 'id', 'uuid', 'PK'),
  ('tenant', 'licence', 'label', 'character varying', ''),
  ('tenant', 'licence', 'id_commande', 'uuid', 'FK'),
  ('tenant', 'licence', 'id_produit', 'uuid', 'FK'),
  ('tenant', 'licence', 'id_edition', 'uuid', 'FK'),
  ('tenant', 'licence', 'id_version', 'uuid', 'FK'),
  ('tenant', 'licence', 'id_revendeur', 'uuid', 'FK'),
  ('tenant', 'licence', 'id_unite_mesure', 'uuid', 'FK'),
  ('tenant', 'licence', 'quantite', 'integer', ''),
  ('tenant', 'licence', 'type', 'character varying', ''),
  ('tenant', 'licence', 'cout_licence', 'numeric', ''),
  ('tenant', 'licence', 'date_fin_souscription', 'date', ''),
  ('tenant', 'licence', 'a_maintenance', 'boolean', ''),
  ('tenant', 'licence', 'version_figee_id', 'uuid', 'FK'),
  ('tenant', 'licence', 'date_arret_maintenance', 'date', ''),
  ('tenant', 'licence', 'id_mainteneur', 'uuid', 'FK'),
  ('tenant', 'licence', 'date_fin_maintenance', 'date', ''),
  ('tenant', 'licence', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'maintenance_historique', 'id', 'uuid', 'PK'),
  ('tenant', 'maintenance_historique', 'id_licence', 'uuid', 'FK'),
  ('tenant', 'maintenance_historique', 'id_mainteneur', 'uuid', 'FK'),
  ('tenant', 'maintenance_historique', 'id_revendeur', 'uuid', 'FK'),
  ('tenant', 'maintenance_historique', 'date_debut', 'date', ''),
  ('tenant', 'maintenance_historique', 'date_fin', 'date', ''),
  ('tenant', 'maintenance_historique', 'cout', 'numeric', ''),
  ('tenant', 'maintenance_historique', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'budget', 'id', 'uuid', 'PK'),
  ('tenant', 'budget', 'id_licence', 'uuid', 'FK'),
  ('tenant', 'budget', 'type', 'character varying', ''),
  ('tenant', 'budget', 'montant_capex', 'numeric', ''),
  ('tenant', 'budget', 'quantite_capex', 'numeric', ''),
  ('tenant', 'budget', 'date_capex', 'date', ''),
  ('tenant', 'budget', 'montant_opex', 'numeric', ''),
  ('tenant', 'budget', 'quantite_opex', 'numeric', ''),
  ('tenant', 'budget', 'date_debut', 'date', ''),
  ('tenant', 'budget', 'date_fin', 'date', ''),
  ('tenant', 'budget', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'affectation', 'id', 'uuid', 'PK'),
  ('tenant', 'affectation', 'label', 'character varying', ''),
  ('tenant', 'affectation', 'id_licence', 'uuid', 'FK'),
  ('tenant', 'affectation', 'id_societe', 'uuid', 'FK'),
  ('tenant', 'affectation', 'quantite', 'integer', ''),
  ('tenant', 'affectation', 'reference_client', 'character varying', ''),
  ('tenant', 'affectation', 'date_revalidation', 'date', ''),
  ('tenant', 'affectation', 'id_validation_status', 'uuid', 'FK'),
  ('tenant', 'affectation', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'revalidation', 'id', 'uuid', 'PK'),
  ('tenant', 'revalidation', 'id_affectation', 'uuid', 'FK'),
  ('tenant', 'revalidation', 'date_derniere_validation', 'date', ''),
  ('tenant', 'revalidation', 'date_prochaine_revalidation', 'date', ''),
  ('tenant', 'revalidation', 'statut', 'character varying', ''),
  ('tenant', 'revalidation', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'precalcul_conformite', 'id', 'uuid', 'PK'),
  ('tenant', 'precalcul_conformite', 'id_produit', 'uuid', 'FK'),
  ('tenant', 'precalcul_conformite', 'id_editeur', 'uuid', 'FK'),
  ('tenant', 'precalcul_conformite', 'droits_total', 'integer', ''),
  ('tenant', 'precalcul_conformite', 'usages_total', 'integer', ''),
  ('tenant', 'precalcul_conformite', 'ecart', 'integer', ''),
  ('tenant', 'precalcul_conformite', 'ecart_pct', 'numeric', ''),
  ('tenant', 'precalcul_conformite', 'statut_conformite', 'character varying', ''),
  ('tenant', 'precalcul_conformite', 'derniere_maj', 'timestamp without time zone', ''),
  ('tenant', 'precalcul_financier', 'id', 'uuid', 'PK'),
  ('tenant', 'precalcul_financier', 'id_editeur', 'uuid', 'FK'),
  ('tenant', 'precalcul_financier', 'id_societe', 'uuid', 'FK'),
  ('tenant', 'precalcul_financier', 'periode', 'character varying', ''),
  ('tenant', 'precalcul_financier', 'montant_commande', 'numeric', ''),
  ('tenant', 'precalcul_financier', 'montant_paye', 'numeric', ''),
  ('tenant', 'precalcul_financier', 'montant_a_renouveler', 'numeric', ''),
  ('tenant', 'precalcul_financier', 'nb_commandes', 'integer', ''),
  ('tenant', 'precalcul_financier', 'nb_a_renouveler', 'integer', ''),
  ('tenant', 'precalcul_financier', 'derniere_maj', 'timestamp without time zone', ''),
  ('tenant', 'utilisateur', 'id', 'uuid', 'PK'),
  ('tenant', 'utilisateur', 'nom', 'character varying', ''),
  ('tenant', 'utilisateur', 'prenom', 'character varying', ''),
  ('tenant', 'utilisateur', 'email', 'character varying', 'UNIQUE'),
  ('tenant', 'utilisateur', 'mot_de_passe_hash', 'character varying', ''),
  ('tenant', 'utilisateur', 'actif', 'boolean', ''),
  ('tenant', 'utilisateur', 'langue', 'character varying', ''),
  ('tenant', 'utilisateur', 'date_mise_en_fonction', 'date', ''),
  ('tenant', 'utilisateur', 'date_finale', 'date', ''),
  ('tenant', 'utilisateur', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'utilisateur_profil_societe', 'id', 'uuid', 'PK'),
  ('tenant', 'utilisateur_profil_societe', 'id_utilisateur', 'uuid', 'FK'),
  ('tenant', 'utilisateur_profil_societe', 'id_profil', 'uuid', 'FK'),
  ('tenant', 'utilisateur_profil_societe', 'id_societe', 'uuid', 'FK'),
  ('tenant', 'utilisateur_profil_societe', 'date_suppression', 'timestamp without time zone', ''),
  ('tenant', 'utilisateur_profil_societe', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'utilisateur_societe', 'id', 'uuid', 'PK'),
  ('tenant', 'utilisateur_societe', 'id_utilisateur', 'uuid', 'FK'),
  ('tenant', 'utilisateur_societe', 'id_societe', 'uuid', 'FK'),
  ('tenant', 'utilisateur_societe', 'date_suppression', 'timestamp without time zone', ''),
  ('tenant', 'utilisateur_societe', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'profil_societe', 'id', 'uuid', 'PK'),
  ('tenant', 'profil_societe', 'id_profil', 'uuid', 'FK'),
  ('tenant', 'profil_societe', 'id_societe', 'uuid', 'FK'),
  ('tenant', 'profil_societe', 'date_suppression', 'timestamp without time zone', ''),
  ('tenant', 'profil_societe', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'session_token', 'id', 'uuid', 'PK'),
  ('tenant', 'session_token', 'id_utilisateur', 'uuid', 'FK'),
  ('tenant', 'session_token', 'access_token_hash', 'character varying', ''),
  ('tenant', 'session_token', 'refresh_token_hash', 'character varying', ''),
  ('tenant', 'session_token', 'expires_at', 'timestamp without time zone', ''),
  ('tenant', 'session_token', 'revoked', 'boolean', ''),
  ('tenant', 'session_token', 'ip_address', 'character varying', ''),
  ('tenant', 'session_token', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'reset_password_token', 'id', 'uuid', 'PK'),
  ('tenant', 'reset_password_token', 'id_utilisateur', 'uuid', 'FK'),
  ('tenant', 'reset_password_token', 'token_hash', 'character varying', ''),
  ('tenant', 'reset_password_token', 'expires_at', 'timestamp without time zone', ''),
  ('tenant', 'reset_password_token', 'utilise', 'boolean', ''),
  ('tenant', 'reset_password_token', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'two_factor_auth', 'id', 'uuid', 'PK'),
  ('tenant', 'two_factor_auth', 'id_utilisateur', 'uuid', 'FK'),
  ('tenant', 'two_factor_auth', 'secret_totp', 'character varying', ''),
  ('tenant', 'two_factor_auth', 'actif', 'boolean', ''),
  ('tenant', 'two_factor_auth', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'workflow_validation', 'id', 'uuid', 'PK'),
  ('tenant', 'workflow_validation', 'entite_type', 'character varying', ''),
  ('tenant', 'workflow_validation', 'entite_id', 'uuid', ''),
  ('tenant', 'workflow_validation', 'id_soumis_par', 'uuid', 'FK'),
  ('tenant', 'workflow_validation', 'id_traite_par', 'uuid', 'FK'),
  ('tenant', 'workflow_validation', 'id_statut', 'uuid', 'FK'),
  ('tenant', 'workflow_validation', 'message_refus', 'text', ''),
  ('tenant', 'workflow_validation', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'audit_log', 'id', 'uuid', 'PK'),
  ('tenant', 'audit_log', 'id_utilisateur', 'uuid', 'FK'),
  ('tenant', 'audit_log', 'action', 'character varying', ''),
  ('tenant', 'audit_log', 'entite_type', 'character varying', ''),
  ('tenant', 'audit_log', 'entite_id', 'uuid', ''),
  ('tenant', 'audit_log', 'valeur_avant', 'jsonb', ''),
  ('tenant', 'audit_log', 'valeur_apres', 'jsonb', ''),
  ('tenant', 'audit_log', 'ip_address', 'character varying', ''),
  ('tenant', 'audit_log', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'historique_declaration', 'id', 'uuid', 'PK'),
  ('tenant', 'historique_declaration', 'id_societe', 'uuid', 'FK'),
  ('tenant', 'historique_declaration', 'id_utilisateur', 'uuid', 'FK'),
  ('tenant', 'historique_declaration', 'action', 'character varying', ''),
  ('tenant', 'historique_declaration', 'entite_type', 'character varying', ''),
  ('tenant', 'historique_declaration', 'detail', 'jsonb', ''),
  ('tenant', 'historique_declaration', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'log_import', 'id', 'uuid', 'PK'),
  ('tenant', 'log_import', 'id_utilisateur', 'uuid', 'FK'),
  ('tenant', 'log_import', 'type_import', 'character varying', ''),
  ('tenant', 'log_import', 'nb_lignes_total', 'integer', ''),
  ('tenant', 'log_import', 'statut', 'character varying', ''),
  ('tenant', 'log_import', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'anomalie_qualite', 'id', 'uuid', 'PK'),
  ('tenant', 'anomalie_qualite', 'entite_type', 'character varying', ''),
  ('tenant', 'anomalie_qualite', 'entite_id', 'uuid', ''),
  ('tenant', 'anomalie_qualite', 'type_anomalie', 'character varying', ''),
  ('tenant', 'anomalie_qualite', 'description', 'text', ''),
  ('tenant', 'anomalie_qualite', 'gravite', 'character varying', ''),
  ('tenant', 'anomalie_qualite', 'resolu', 'boolean', ''),
  ('tenant', 'anomalie_qualite', 'id_valide_par', 'uuid', 'FK'),
  ('tenant', 'anomalie_qualite', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'journal_ecriture', 'id', 'uuid', 'PK'),
  ('tenant', 'journal_ecriture', 'action', 'character varying', ''),
  ('tenant', 'journal_ecriture', 'entite_type', 'character varying', ''),
  ('tenant', 'journal_ecriture', 'entite_id', 'uuid', ''),
  ('tenant', 'journal_ecriture', 'description', 'text', ''),
  ('tenant', 'journal_ecriture', 'id_auteur', 'uuid', 'FK'),
  ('tenant', 'journal_ecriture', 'payload', 'jsonb', ''),
  ('tenant', 'journal_ecriture', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'connecteur', 'id', 'uuid', 'PK'),
  ('tenant', 'connecteur', 'label', 'character varying', ''),
  ('tenant', 'connecteur', 'type', 'character varying', ''),
  ('tenant', 'connecteur', 'mode', 'character varying', ''),
  ('tenant', 'connecteur', 'actif', 'boolean', ''),
  ('tenant', 'connecteur', 'statut', 'character varying', ''),
  ('tenant', 'connecteur', 'date_derniere_collecte', 'timestamp without time zone', ''),
  ('tenant', 'connecteur', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'connecteur_mapping', 'id', 'uuid', 'PK'),
  ('tenant', 'connecteur_mapping', 'id_connecteur', 'uuid', 'FK'),
  ('tenant', 'connecteur_mapping', 'champ_source', 'character varying', ''),
  ('tenant', 'connecteur_mapping', 'champ_cible', 'character varying', ''),
  ('tenant', 'connecteur_mapping', 'transformation', 'character varying', ''),
  ('tenant', 'connecteur_mapping', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'inventaire_raw', 'id', 'uuid', 'PK'),
  ('tenant', 'inventaire_raw', 'id_connecteur', 'uuid', 'FK'),
  ('tenant', 'inventaire_raw', 'id_societe', 'uuid', 'FK'),
  ('tenant', 'inventaire_raw', 'url_fichier', 'character varying', ''),
  ('tenant', 'inventaire_raw', 'format_source', 'character varying', ''),
  ('tenant', 'inventaire_raw', 'statut_rapprochement', 'character varying', ''),
  ('tenant', 'inventaire_raw', 'id_affectation', 'uuid', 'FK'),
  ('tenant', 'inventaire_raw', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'collecte_log', 'id', 'uuid', 'PK'),
  ('tenant', 'collecte_log', 'id_connecteur', 'uuid', 'FK'),
  ('tenant', 'collecte_log', 'statut', 'character varying', ''),
  ('tenant', 'collecte_log', 'nb_enregistrements', 'integer', ''),
  ('tenant', 'collecte_log', 'duree_ms', 'integer', ''),
  ('tenant', 'collecte_log', 'message_erreur', 'text', ''),
  ('tenant', 'collecte_log', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'alerte', 'id', 'uuid', 'PK'),
  ('tenant', 'alerte', 'type_alerte', 'character varying', ''),
  ('tenant', 'alerte', 'entite_type', 'character varying', ''),
  ('tenant', 'alerte', 'entite_id', 'uuid', ''),
  ('tenant', 'alerte', 'message', 'text', ''),
  ('tenant', 'alerte', 'niveau', 'character varying', ''),
  ('tenant', 'alerte', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'notification', 'id', 'uuid', 'PK'),
  ('tenant', 'notification', 'id_alerte', 'uuid', 'FK'),
  ('tenant', 'notification', 'id_utilisateur', 'uuid', 'FK'),
  ('tenant', 'notification', 'entite_type', 'character varying', ''),
  ('tenant', 'notification', 'entite_id', 'uuid', ''),
  ('tenant', 'notification', 'statut', 'character varying', ''),
  ('tenant', 'notification', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'notification', 'lu_at', 'timestamp without time zone', ''),
  ('tenant', 'tache_asynchrone', 'id', 'uuid', 'PK'),
  ('tenant', 'tache_asynchrone', 'type', 'character varying', ''),
  ('tenant', 'tache_asynchrone', 'statut', 'character varying', ''),
  ('tenant', 'tache_asynchrone', 'payload', 'jsonb', ''),
  ('tenant', 'tache_asynchrone', 'tentatives', 'integer', ''),
  ('tenant', 'tache_asynchrone', 'created_at', 'timestamp without time zone', ''),
  ('tenant', 'tache_asynchrone', 'completed_at', 'timestamp without time zone', ''),
  ('tenant', 'log_serveur', 'id', 'uuid', 'PK'),
  ('tenant', 'log_serveur', 'niveau', 'character varying', ''),
  ('tenant', 'log_serveur', 'source', 'character varying', ''),
  ('tenant', 'log_serveur', 'message', 'text', ''),
  ('tenant', 'log_serveur', 'context', 'jsonb', ''),
  ('tenant', 'log_serveur', 'created_at', 'timestamp without time zone', '');

CREATE TEMP TABLE v4_migrations_attendues (base text NOT NULL, filename text NOT NULL);
INSERT INTO v4_migrations_attendues (base, filename) VALUES
  ('commune', '001_commune_schema.sql'),
  ('commune', '005_commune_migration.sql'),
  ('commune', '024_commune_code_retour.sql'),
  ('commune', '025_commune_code_retour_seed.sql'),
  ('commune', '026_commune_defaults_v4.sql'),
  ('commune', '027_commune_defaults_seed.sql'),
  ('commune', '028_commune_code_retour_licences.sql'),
  ('commune', '029_commune_code_retour_affectations.sql'),
  ('commune', '030_commune_code_retour_inventaire_seed.sql'),
  ('commune', '031_commune_permission_importer_inventaire.sql'),
  ('commune', '034_commune_code_retour_budget.sql'),
  ('commune', '035_commune_permission_supprimer_budget.sql'),
  ('tenant', '002_tenant_schema.sql'),
  ('tenant', '003_tenant_seed.sql'),
  ('tenant', '006_tenant_migration.sql'),
  ('tenant', '007_seed_permissions.sql'),
  ('tenant', '008_soft_delete_migration.sql'),
  ('tenant', '009_date_finale_mise_en_fonction.sql'),
  ('tenant', '010_tenant_dashboards_module.sql'),
  ('tenant', '011_tenant_groupes_matrice.sql'),
  ('tenant', '014_contrat_v4_bi_parti.sql'),
  ('tenant', '015_commande_date_metier.sql'),
  ('tenant', '016_precalcul_financier_triggers.sql'),
  ('tenant', '017_commande_front_alignement.sql'),
  ('tenant', '018_referentiels_alignement_front.sql'),
  ('tenant', '019_preuve_nom_origine.sql'),
  ('tenant', '020_workflow_validation_rattrapage.sql'),
  ('tenant', '021_matrice_groupes_alignement.sql'),
  ('tenant', '022_desactivation_remplace_suppression.sql'),
  ('tenant', '023_utilisateur_drop_date_suppression.sql'),
  ('tenant', '032_tenant_permission_importer_inventaire.sql'),
  ('tenant', '033_tenant_budget_socle.sql'),
  ('tenant', '036_tenant_permission_supprimer_budget.sql');

CREATE TEMP TABLE v4_ctx AS
SELECT CASE
         WHEN to_regclass('public.tenant_config')       IS NOT NULL THEN 'tenant'
         WHEN to_regclass('public.produit_referentiel') IS NOT NULL THEN 'commune'
         ELSE 'inconnue'
       END AS base;

\echo
\echo '=== 1. Base detectee ==='
SELECT current_database() AS base_courante,
       (SELECT base FROM v4_ctx) AS type_detecte,
       (SELECT count(DISTINCT table_name) FROM v4_attendu a, v4_ctx c WHERE a.base = c.base) AS tables_attendues;

\echo
\echo '=== 2. Tables attendues manquantes (BLOQUANT) ==='
SELECT DISTINCT a.table_name
  FROM v4_attendu a, v4_ctx c
 WHERE a.base = c.base
   AND NOT EXISTS (SELECT 1 FROM information_schema.tables t
                    WHERE t.table_schema = 'public' AND t.table_name = a.table_name)
 ORDER BY 1;

\echo
\echo '=== 3. Colonnes attendues manquantes (BLOQUANT, tables presentes seulement) ==='
SELECT a.table_name, a.column_name, a.data_type AS type_attendu
  FROM v4_attendu a, v4_ctx c
 WHERE a.base = c.base
   AND EXISTS (SELECT 1 FROM information_schema.tables t
                WHERE t.table_schema = 'public' AND t.table_name = a.table_name)
   AND NOT EXISTS (SELECT 1 FROM information_schema.columns col
                    WHERE col.table_schema = 'public'
                      AND col.table_name = a.table_name
                      AND col.column_name = a.column_name)
 ORDER BY 1, 2;

\echo
\echo '=== 4. Types divergents (BLOQUANT) ==='
SELECT a.table_name, a.column_name, a.data_type AS type_attendu, col.data_type AS type_constate
  FROM v4_attendu a
  JOIN v4_ctx c ON c.base = a.base
  JOIN information_schema.columns col
    ON col.table_schema = 'public'
   AND col.table_name = a.table_name
   AND col.column_name = a.column_name
 WHERE col.data_type <> a.data_type
 ORDER BY 1, 2;

\echo
\echo '=== 5. Colonnes presentes hors referentiel v4 (INFORMATIF) ==='
SELECT col.table_name, col.column_name, col.data_type
  FROM information_schema.columns col
  JOIN v4_ctx c ON true
 WHERE col.table_schema = 'public'
   AND col.table_name IN (SELECT table_name FROM v4_attendu a WHERE a.base = c.base)
   AND NOT EXISTS (SELECT 1 FROM v4_attendu a
                    WHERE a.base = c.base
                      AND a.table_name = col.table_name
                      AND a.column_name = col.column_name)
 ORDER BY 1, 2;

\echo
\echo '=== 6. Cles primaires attendues manquantes (BLOQUANT) ==='
SELECT a.table_name, a.column_name
  FROM v4_attendu a, v4_ctx c
 WHERE a.base = c.base AND a.cle = 'PK'
   AND EXISTS (SELECT 1 FROM information_schema.tables t
                WHERE t.table_schema = 'public' AND t.table_name = a.table_name)
   AND NOT EXISTS (
     SELECT 1
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_schema = tc.constraint_schema
        AND kcu.constraint_name = tc.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = a.table_name
        AND tc.constraint_type = 'PRIMARY KEY'
        AND kcu.column_name = a.column_name)
 ORDER BY 1;

\echo
\echo '=== 7. Unicites mono-colonne attendues manquantes (BLOQUANT) ==='
-- Contrainte UNIQUE ou index unique portant exactement cette colonne.
SELECT a.table_name, a.column_name
  FROM v4_attendu a, v4_ctx c
 WHERE a.base = c.base AND a.cle = 'UNIQUE'
   AND EXISTS (SELECT 1 FROM information_schema.tables t
                WHERE t.table_schema = 'public' AND t.table_name = a.table_name)
   AND NOT EXISTS (
     SELECT 1
       FROM pg_index i
       JOIN pg_class t ON t.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       JOIN pg_attribute att ON att.attrelid = t.oid AND att.attnum = ANY (i.indkey)
      WHERE n.nspname = 'public'
        AND t.relname = a.table_name
        AND i.indisunique
        AND i.indnatts = 1
        AND att.attname = a.column_name)
 ORDER BY 1, 2;

\echo
\echo '=== 8. Tables presentes hors referentiel v4 (INFORMATIF, _migrations exclue) ==='
SELECT t.table_name
  FROM information_schema.tables t
  JOIN v4_ctx c ON true
 WHERE t.table_schema = 'public'
   AND t.table_type = 'BASE TABLE'
   AND t.table_name <> '_migrations'
   AND t.table_name NOT IN (SELECT table_name FROM v4_attendu a WHERE a.base = c.base)
 ORDER BY 1;

\echo
\echo '=== 9. Migrations attendues absentes de _migrations (INFORMATIF) ==='
-- Informatif : une base construite autrement que par migrate.js peut etre
-- conforme sans porter ces lignes. Une base migree par migrate.js doit les
-- porter toutes.
SELECT m.filename
  FROM v4_migrations_attendues m, v4_ctx c
 WHERE m.base = c.base
   AND (to_regclass('public._migrations') IS NULL
        OR NOT EXISTS (SELECT 1 FROM _migrations x WHERE x.filename = m.filename))
 ORDER BY 1;

\echo
\echo '=== 9b. Socle budget 033, Tenant uniquement (INFORMATIF) ==='
-- Fonctions d'exercice fiscal et contraintes de budget ajoutees par la 033.
-- Informatif : la cible v4 ne porte ni fonction ni CHECK. Une ligne
-- 'ABSENT' signale une base Tenant sur laquelle la 033 n'a pas ete jouee.
SELECT objet,
       CASE WHEN present THEN 'present' ELSE 'ABSENT' END AS etat
  FROM (
    SELECT 'fonction exercice_fiscal_de(date, date)' AS objet,
           to_regprocedure('exercice_fiscal_de(date, date)') IS NOT NULL AS present
    UNION ALL
    SELECT 'fonction exercice_fiscal_debut(integer, date)',
           to_regprocedure('exercice_fiscal_debut(integer, date)') IS NOT NULL
    UNION ALL
    SELECT 'fonction exercice_fiscal_fin(integer, date)',
           to_regprocedure('exercice_fiscal_fin(integer, date)') IS NOT NULL
    UNION ALL
    SELECT 'contrainte budget.ck_budget_montants',
           EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_budget_montants' AND conrelid = to_regclass('public.budget'))
    UNION ALL
    SELECT 'contrainte budget.ck_budget_un_montant',
           EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_budget_un_montant' AND conrelid = to_regclass('public.budget'))
    UNION ALL
    SELECT 'defaut societe.debut_exercice_fiscal',
           EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'societe'
                      AND column_name = 'debut_exercice_fiscal' AND column_default IS NOT NULL)
  ) x, v4_ctx c
 WHERE c.base = 'tenant'
 ORDER BY objet;

\echo
\echo '=== 10. Verdict ==='
DO $$
DECLARE
  v_base    text;
  v_tables  integer;
  v_cols    integer;
  v_types   integer;
  v_pk      integer;
  v_uq      integer;
  v_total   integer;
BEGIN
  SELECT base INTO v_base FROM v4_ctx;
  IF v_base = 'inconnue' THEN
    RAISE EXCEPTION 'Base non reconnue : ni tenant_config ni produit_referentiel. Verdict impossible.';
  END IF;

  SELECT count(DISTINCT a.table_name) INTO v_tables
    FROM v4_attendu a WHERE a.base = v_base
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables t
                      WHERE t.table_schema = 'public' AND t.table_name = a.table_name);

  SELECT count(*) INTO v_cols
    FROM v4_attendu a WHERE a.base = v_base
     AND EXISTS (SELECT 1 FROM information_schema.tables t
                  WHERE t.table_schema = 'public' AND t.table_name = a.table_name)
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns col
                      WHERE col.table_schema = 'public' AND col.table_name = a.table_name
                        AND col.column_name = a.column_name);

  SELECT count(*) INTO v_types
    FROM v4_attendu a
    JOIN information_schema.columns col
      ON col.table_schema = 'public' AND col.table_name = a.table_name AND col.column_name = a.column_name
   WHERE a.base = v_base AND col.data_type <> a.data_type;

  SELECT count(*) INTO v_pk
    FROM v4_attendu a WHERE a.base = v_base AND a.cle = 'PK'
     AND EXISTS (SELECT 1 FROM information_schema.tables t
                  WHERE t.table_schema = 'public' AND t.table_name = a.table_name)
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_schema = tc.constraint_schema AND kcu.constraint_name = tc.constraint_name
       WHERE tc.table_schema = 'public' AND tc.table_name = a.table_name
         AND tc.constraint_type = 'PRIMARY KEY' AND kcu.column_name = a.column_name);

  SELECT count(*) INTO v_uq
    FROM v4_attendu a WHERE a.base = v_base AND a.cle = 'UNIQUE'
     AND EXISTS (SELECT 1 FROM information_schema.tables t
                  WHERE t.table_schema = 'public' AND t.table_name = a.table_name)
     AND NOT EXISTS (
       SELECT 1 FROM pg_index i
       JOIN pg_class t ON t.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       JOIN pg_attribute att ON att.attrelid = t.oid AND att.attnum = ANY (i.indkey)
       WHERE n.nspname = 'public' AND t.relname = a.table_name
         AND i.indisunique AND i.indnatts = 1 AND att.attname = a.column_name);

  v_total := v_tables + v_cols + v_types + v_pk + v_uq;

  RAISE NOTICE 'Base % (%): tables manquantes=%, colonnes manquantes=%, types divergents=%, PK manquantes=%, UNIQUE manquants=%',
    current_database(), v_base, v_tables, v_cols, v_types, v_pk, v_uq;
  IF v_total = 0 THEN
    RAISE NOTICE 'VERDICT : base CONFORME v4';
  ELSE
    RAISE NOTICE 'VERDICT : base NON CONFORME v4 (% anomalie(s) bloquante(s)), voir sections 2, 3, 4, 6, 7', v_total;
  END IF;
END $$;

DROP TABLE v4_attendu;
DROP TABLE v4_migrations_attendues;
DROP TABLE v4_ctx;
