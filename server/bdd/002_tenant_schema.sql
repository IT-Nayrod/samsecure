-- ============================================================================
-- SamSecure - BDD Tenant - Schéma v3
-- Fichier   : 002_tenant_schema.sql
-- Aligné sur: Nayrod_SamSecure_uml_complet_v3.html (28/07/2026)
-- Cible     : PostgreSQL 16 - une base dédiée par client
-- Exécution : psql -U samsecure_app -d samsecure_tenant_client01_dev -f 002_tenant_schema.sql
--             (puis idem sur samsecure_tenant_client01_staging)
--
-- Conventions :
--   - Identifiants en minuscules (PostgreSQL replie les identifiants non
--     cités) : montant_CAPEX du doc fonctionnel devient montant_capex,
--     la correspondance est portée par l'API.
--   - Les colonnes id_produit, id_edition, id_version, version_figee_id et
--     id_produit_parent qui visent le catalogue sont des références logiques
--     vers la BDD Commune : aucune FK SQL possible entre deux bases,
--     résolution par l'API uniquement.
--   - Les référentiels (profil, permission, validation_status, type_*, ...)
--     vivent en Tenant et sont alimentés par le seed 003.
--   - Les valeurs ENUM sont portées par des contraintes CHECK (plus simples
--     à faire évoluer par migration que les types ENUM natifs).
--   - Modifs BDD appliquées : 1, 3, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17, 21,
--     22 (diffusion des défauts : code / personnalise / valeurs_defaut sur les
--     référentiels personnalisables, version_referentiels sur tenant_config)
--     + table budget. Points 9, 18, 19, 20 hors périmètre (non spécifiés),
--     point 7 en réserve.
--   - langue et traduction : arbitrage v4 en cours (Commune ou fichiers i18n).
--     La personnalisation des libellés par tenant est retirée (purge 28/07),
--     ces deux tables ne portent donc pas le pattern de la modif 22.
--   - validation_status et abonnement_samsecure : référentiels non
--     personnalisables, miroir pur du seed, pas de pattern modif 22.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. RÉFÉRENTIELS SEEDÉS
-- ============================================================================

CREATE TABLE abonnement_samsecure (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE abonnement_samsecure IS 'Niveaux de service SamSecure (Base, Silver, Gold). Seedé.';

CREATE TABLE fonction (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50) UNIQUE,              -- modif 22 : cle de rapprochement du seed, NULL = creation client
  label          VARCHAR(100) NOT NULL,
  personnalise   BOOLEAN NOT NULL DEFAULT false,  -- modif 22 : ligne modifiee par le client, protegee des synchros
  valeurs_defaut JSONB,                           -- modif 22 : copie locale du defaut, sert au bouton retablir
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE fonction IS 'Fonctions des contacts (DSI, DAF, Acheteur...). Seedé, complétable par le client (modif 16).';

CREATE TABLE type_contrat (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50) UNIQUE,              -- modif 22 : cle de rapprochement du seed, NULL = creation client
  label          VARCHAR(100) NOT NULL,
  personnalise   BOOLEAN NOT NULL DEFAULT false,  -- modif 22 : ligne modifiee par le client, protegee des synchros
  valeurs_defaut JSONB,                           -- modif 22 : copie locale du defaut, sert au bouton retablir
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE type_contrat IS 'Types contractuels (CGU/CGV, Simple, Cadre). Seedé.';

CREATE TABLE type_preuve (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50) UNIQUE,              -- modif 22 : cle de rapprochement du seed, NULL = creation client
  label          VARCHAR(100) NOT NULL,
  personnalise   BOOLEAN NOT NULL DEFAULT false,  -- modif 22 : ligne modifiee par le client, protegee des synchros
  valeurs_defaut JSONB,                           -- modif 22 : copie locale du defaut, sert au bouton retablir
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE type_preuve IS 'Nature de la pièce justificative (bon de livraison, capture portail, attestation, contrat scanné, autre). Seedé, personnalisable par le client.';

CREATE TABLE mode_commande (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50) UNIQUE,              -- modif 22 : cle de rapprochement du seed, NULL = creation client
  label          VARCHAR(100) NOT NULL,
  personnalise   BOOLEAN NOT NULL DEFAULT false,  -- modif 22 : ligne modifiee par le client, protegee des synchros
  valeurs_defaut JSONB,                           -- modif 22 : copie locale du defaut, sert au bouton retablir
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE mode_commande IS 'Nature du document d''achat sur lequel repose la commande (bon de commande, devis signé, EDI, verbal). Seedé, personnalisable par le client.';

CREATE TABLE validation_status (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(50) NOT NULL UNIQUE,
  label      VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE validation_status IS 'Les 4 statuts du workflow de validation (en_attente, valide, refuse, a_revalider). Seedé.';

CREATE TABLE unite_mesure (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50) UNIQUE,              -- modif 22
  label          VARCHAR(100) NOT NULL,
  description    TEXT,
  personnalise   BOOLEAN NOT NULL DEFAULT false,  -- modif 22
  valeurs_defaut JSONB,                           -- modif 22
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE unite_mesure IS 'Métriques de licensing (utilisateur nommé, device, CPU, core...). Seedé, complétable par le client.';

CREATE TABLE langue (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(10) NOT NULL UNIQUE,
  label      VARCHAR(100) NOT NULL,
  actif      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE traduction (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_langue  UUID NOT NULL REFERENCES langue(id) ON DELETE CASCADE,
  cle        VARCHAR(255) NOT NULL,
  valeur     TEXT NOT NULL,
  module     VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_traduction_langue_cle UNIQUE (id_langue, cle)
);

CREATE TABLE profil (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50) NOT NULL UNIQUE,     -- genere par l'application pour les creations client
  label          VARCHAR(100) NOT NULL,
  description    TEXT,
  personnalise   BOOLEAN NOT NULL DEFAULT false,  -- modif 22
  valeurs_defaut JSONB,                           -- modif 22
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE profil IS 'Rôles de la plateforme (admin_sam, manager_dsi, financier, it_ops, it_data_input). Seedé, complétable.';

CREATE TABLE permission (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(100) NOT NULL UNIQUE,    -- contrat API : les codes ne changent jamais
  label          VARCHAR(255) NOT NULL,
  module         VARCHAR(100),
  personnalise   BOOLEAN NOT NULL DEFAULT false,  -- modif 22
  valeurs_defaut JSONB,                           -- modif 22
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE permission IS 'Actions atomiques par module. La restructuration ressource x action (modif 7) reste en réserve.';

CREATE TABLE profil_permission (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_profil     UUID NOT NULL REFERENCES profil(id) ON DELETE CASCADE,
  id_permission UUID NOT NULL REFERENCES permission(id) ON DELETE CASCADE,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_profil_permission UNIQUE (id_profil, id_permission)
);

CREATE TABLE seuil_dashboard (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_code VARCHAR(50) NOT NULL,
  echelle     INTEGER NOT NULL CHECK (echelle BETWEEN 1 AND 4),
  valeur      DECIMAL(12,2) NOT NULL,
  unite       VARCHAR(20),
  direction   VARCHAR(10),
  personnalise   BOOLEAN NOT NULL DEFAULT false,  -- modif 22
  valeurs_defaut JSONB,                            -- modif 22
  created_at  TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_seuil_widget_echelle UNIQUE (widget_code, echelle)
);
COMMENT ON TABLE seuil_dashboard IS 'Seuils de colorimétrie des widgets, gérés côté client (modif 17). Le type en montant d''écart valorisé passe par unite = euros. Cohérence seuil N <= seuil N+1 vérifiée par l''API.';

CREATE TABLE profil_widget (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_profil      UUID NOT NULL REFERENCES profil(id) ON DELETE CASCADE,
  widget_code    VARCHAR(50) NOT NULL,
  visible_defaut BOOLEAN NOT NULL DEFAULT false,
  acces_autorise BOOLEAN NOT NULL DEFAULT true,
  personnalise   BOOLEAN NOT NULL DEFAULT false,  -- modif 22
  valeurs_defaut JSONB,                            -- modif 22
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_profil_widget UNIQUE (id_profil, widget_code)
);

-- ============================================================================
-- 2. ORGANISATION
-- ============================================================================

CREATE TABLE client (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raison_sociale  VARCHAR(255) NOT NULL,
  siret           VARCHAR(14),
  adresse         VARCHAR(255),
  code_postal     VARCHAR(10),
  ville           VARCHAR(100),
  pays            VARCHAR(100),
  telephone       VARCHAR(20),
  id_abonnement   UUID REFERENCES abonnement_samsecure(id),
  id_admin_client UUID,  -- FK ajoutée après création de utilisateur (dépendance croisée)
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE client IS 'Groupe client, racine du tenant.';

CREATE TABLE societe (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_client               UUID NOT NULL REFERENCES client(id),
  id_societe_parent       UUID REFERENCES societe(id),
  raison_sociale          VARCHAR(255) NOT NULL,
  siret                   VARCHAR(14),
  email                   VARCHAR(255),
  telephone               VARCHAR(20),
  duree_amortissement     INTEGER CHECK (duree_amortissement BETWEEN 1 AND 48),
  revalorisation_annuelle DECIMAL(5,2),
  delai_revalidation      INTEGER CHECK (delai_revalidation BETWEEN 1 AND 366),
  debut_exercice_fiscal   DATE,     -- modif 14 : seuls jour et mois significatifs ; NULL = défaut tenant
  actif                   BOOLEAN NOT NULL DEFAULT true,  -- modif 13 : aucune suppression physique
  date_fin_activite       DATE,     -- modif 13
  created_at              TIMESTAMP NOT NULL DEFAULT now(),
  updated_at              TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE societe IS 'Entité juridique du groupe, hiérarchisable. Modifs 13 et 14 : cycle de vie actif/inactif, début d''exercice fiscal.';

CREATE TABLE tenant_config (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_client                    UUID NOT NULL UNIQUE REFERENCES client(id),
  langue_defaut                VARCHAR(10) NOT NULL DEFAULT 'fr',
  cle_chiffrement_hash         VARCHAR(255),
  options_actives              JSONB NOT NULL DEFAULT '{}'::jsonb,
  debut_exercice_fiscal_defaut DATE NOT NULL DEFAULT DATE '2000-01-01',  -- modif 14 : défaut 01/01, seuls jour et mois significatifs
  taux_hausse_annuelle_defaut  DECIMAL(5,2) NOT NULL DEFAULT 3.50,       -- modif 15 : 3,50 = valeur du front, 3,00 actée en réunion, à harmoniser
  version_referentiels         INTEGER NOT NULL DEFAULT 0,               -- modif 22 : derniere passe de synchronisation appliquee
  created_at                   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE utilisateur (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_client         UUID NOT NULL REFERENCES client(id),
  nom               VARCHAR(100) NOT NULL,
  prenom            VARCHAR(100),
  email             VARCHAR(255) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  actif             BOOLEAN NOT NULL DEFAULT true,
  langue            VARCHAR(10),
  created_at        TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE client
  ADD CONSTRAINT fk_client_admin FOREIGN KEY (id_admin_client) REFERENCES utilisateur(id);

-- ============================================================================
-- 3. TIERS
-- ============================================================================

CREATE TABLE editeur (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raison_sociale       VARCHAR(255) NOT NULL,
  taux_hausse_annuelle DECIMAL(5,2),        -- modif 15 : NULL = défaut tenant
  url_logo_defaut      VARCHAR(500),        -- modif 21 : seedé (top 20), pointeur filesystem
  url_logo_custom      VARCHAR(500),        -- modif 21 : upload client, prime sur le défaut
  created_at           TIMESTAMP NOT NULL DEFAULT now(),
  updated_at           TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE revendeur (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raison_sociale VARCHAR(255) NOT NULL,
  siret          VARCHAR(14),
  iban           VARCHAR(34),
  email          VARCHAR(255),
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE mainteneur (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raison_sociale VARCHAR(255) NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE contact (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         VARCHAR(100) NOT NULL,
  prenom      VARCHAR(100),
  email       VARCHAR(255),
  telephone   VARCHAR(20),
  id_fonction UUID REFERENCES fonction(id),
  photo_url   VARCHAR(500),  -- modif 3 : pointeur filesystem
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. PRODUITS ÉTENDUS
-- ============================================================================

CREATE TABLE produit_client (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_client         UUID NOT NULL REFERENCES client(id),
  label             VARCHAR(255) NOT NULL,
  id_editeur        UUID REFERENCES editeur(id),
  id_produit_parent UUID,  -- lien logique : parent en produit_client ou produit_referentiel (BDD Commune), résolu par l'API
  created_at        TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE produit_client IS 'Produits propres au client, absents du catalogue global.';

CREATE TABLE pre_parametre_licence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produit      UUID NOT NULL,  -- lien logique vers produit_referentiel (BDD Commune), résolu par l'API
  mode_decompte   VARCHAR(10) NOT NULL CHECK (mode_decompte IN ('user', 'device')),
  id_unite_mesure UUID REFERENCES unite_mesure(id),
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. GESTION CONTRACTUELLE
-- ============================================================================

CREATE TABLE contrat (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label             VARCHAR(255) NOT NULL,
  id_type_contrat   UUID REFERENCES type_contrat(id),
  id_editeur        UUID REFERENCES editeur(id),
  id_societe        UUID REFERENCES societe(id),  -- modif 8 : société signataire, réintégrée après la régression v3
  id_contrat_parent UUID REFERENCES contrat(id),
  date_debut        DATE,
  date_fin          DATE,
  a_renouveler      BOOLEAN NOT NULL DEFAULT false,
  duree_resiliation INTEGER,
  created_at        TIMESTAMP NOT NULL DEFAULT now(),
  updated_at        TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT ck_contrat_dates CHECK (date_fin IS NULL OR date_debut IS NULL OR date_fin >= date_debut)
);
COMMENT ON COLUMN contrat.id_societe IS 'Société signataire (modif 8). La société payeuse reste portée par commande.id_societe.';

CREATE TABLE commande (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label           VARCHAR(255) NOT NULL,
  id_contrat      UUID REFERENCES contrat(id),
  id_societe      UUID REFERENCES societe(id),
  id_revendeur    UUID REFERENCES revendeur(id),
  id_mode_commande UUID REFERENCES mode_commande(id),
  numero_devis    VARCHAR(100),
  montant         DECIMAL(12,2),
  date_fin        DATE,
  a_renouveler    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON COLUMN commande.id_societe IS 'Société payeuse : base de la chaîne budget licence -> commande -> société.';

CREATE TABLE preuve (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label          VARCHAR(255) NOT NULL,
  id_type_preuve UUID REFERENCES type_preuve(id),
  id_contrat     UUID REFERENCES contrat(id),
  id_commande    UUID REFERENCES commande(id),
  url_fichier    VARCHAR(500) NOT NULL,
  hash_sha256    VARCHAR(64),  -- modif 10 : intégrité du fichier, anticipation blockchain
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE preuve IS 'Table unique de stockage des fichiers (modifs 10 et 11) : url + hash, toutes les entités documentaires s''y rattachent.';

CREATE TABLE facture (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       VARCHAR(255) NOT NULL,
  id_commande UUID NOT NULL REFERENCES commande(id),
  id_preuve   UUID REFERENCES preuve(id),  -- modif 11 : le fichier vit dans preuve, url_fichier supprimé
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. LICENCES ET BUDGET
-- ============================================================================

CREATE TABLE licence (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label                  VARCHAR(255),
  id_contrat             UUID REFERENCES contrat(id),
  id_commande            UUID REFERENCES commande(id),
  id_produit             UUID,  -- lien logique vers produit_referentiel (BDD Commune), résolu par l'API
  id_edition             UUID,  -- lien logique vers edition (BDD Commune), résolu par l'API
  id_version             UUID,  -- lien logique vers version (BDD Commune), résolu par l'API
  id_revendeur           UUID REFERENCES revendeur(id),
  id_unite_mesure        UUID REFERENCES unite_mesure(id),
  quantite               INTEGER NOT NULL DEFAULT 0 CHECK (quantite >= 0),
  type                   VARCHAR(15) NOT NULL CHECK (type IN ('perpetuelle', 'souscription')),
  cout_licence           DECIMAL(12,2),
  date_fin_souscription  DATE,
  a_maintenance          BOOLEAN NOT NULL DEFAULT false,
  version_figee_id       UUID,  -- lien logique vers version (BDD Commune), figée à l'arrêt de la maintenance
  date_arret_maintenance DATE,
  id_mainteneur          UUID REFERENCES mainteneur(id),
  date_fin_maintenance   DATE,
  created_at             TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE licence IS 'Droits d''usage, coeur du SAM. Perpétuelle ou souscription, version figée à l''arrêt de la maintenance.';

CREATE TABLE maintenance_historique (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_licence   UUID NOT NULL REFERENCES licence(id) ON DELETE CASCADE,
  id_mainteneur UUID REFERENCES mainteneur(id),
  id_revendeur UUID REFERENCES revendeur(id),
  date_debut   DATE NOT NULL,
  date_fin     DATE,
  cout         DECIMAL(12,2),
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT ck_maintenance_dates CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

CREATE TABLE budget (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_licence     UUID NOT NULL REFERENCES licence(id),
  type           VARCHAR(15) NOT NULL CHECK (type IN ('previsionnel', 'alloue')),
  montant_capex  DECIMAL(12,2),
  quantite_capex DECIMAL(12,2),
  date_capex     DATE,
  montant_opex   DECIMAL(12,2),
  quantite_opex  DECIMAL(12,2),
  date_debut     DATE NOT NULL,
  date_fin       DATE NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT ck_budget_periode CHECK (date_fin >= date_debut)
);
COMMENT ON TABLE budget IS 'Ligne budgétaire par licence et période : prévisionnel/alloué, CAPEX/OPEX. L''organisation payeuse se déduit de licence -> commande -> société, jamais stockée ici. Colonnes à recouper avec le DDL de Samuel.';

-- ============================================================================
-- 7. DÉPLOIEMENT ET CONFORMITÉ
-- ============================================================================

CREATE TABLE affectation (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label                VARCHAR(255),
  id_licence           UUID NOT NULL REFERENCES licence(id),
  id_societe           UUID REFERENCES societe(id),
  quantite             INTEGER NOT NULL DEFAULT 1 CHECK (quantite > 0),
  reference_client     VARCHAR(255),
  date_revalidation    DATE,
  id_validation_status UUID REFERENCES validation_status(id),
  created_at           TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE affectation IS 'Usage déclaré d''une licence, soumis au cycle de revalidation 30 jours.';

CREATE TABLE revalidation (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_affectation              UUID NOT NULL REFERENCES affectation(id) ON DELETE CASCADE,
  date_derniere_validation    DATE,
  date_prochaine_revalidation DATE,
  statut                      VARCHAR(15) NOT NULL DEFAULT 'a_jour' CHECK (statut IN ('a_jour', 'a_revalider', 'depasse')),
  created_at                  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE precalcul_conformite (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produit        UUID,  -- lien logique vers produit_referentiel (BDD Commune), résolu par l'API
  id_editeur        UUID REFERENCES editeur(id),
  droits_total      INTEGER NOT NULL DEFAULT 0,
  usages_total      INTEGER NOT NULL DEFAULT 0,
  ecart             INTEGER,
  ecart_pct         DECIMAL(5,2),
  statut_conformite VARCHAR(15) CHECK (statut_conformite IN ('conforme', 'attention', 'non_conforme', 'depassement')),
  derniere_maj      TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE precalcul_conformite IS 'Balance droits/usages par produit. Triggers de recalcul livrés avec la phase API.';

CREATE TABLE precalcul_financier (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_editeur       UUID REFERENCES editeur(id),
  id_societe       UUID REFERENCES societe(id),
  periode          VARCHAR(20) NOT NULL,
  montant_commande DECIMAL(12,2) NOT NULL DEFAULT 0,
  montant_paye     DECIMAL(12,2) NOT NULL DEFAULT 0,
  derniere_maj     TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE precalcul_financier IS 'Agrégats financiers par éditeur, société et période. Articulation avec budget à cadrer.';

-- ============================================================================
-- 8. UTILISATEURS, ACCÈS ET DROITS
-- ============================================================================

CREATE TABLE utilisateur_profil_societe (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_utilisateur UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  id_profil      UUID NOT NULL REFERENCES profil(id),
  id_societe     UUID NOT NULL REFERENCES societe(id),
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_utilisateur_profil_societe UNIQUE (id_utilisateur, id_profil, id_societe)
);
COMMENT ON TABLE utilisateur_profil_societe IS 'Liaison ternaire utilisateur / profil / société, socle du RBAC.';

CREATE TABLE exception_droit (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_utilisateur UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  id_permission  UUID NOT NULL REFERENCES permission(id),
  id_societe     UUID REFERENCES societe(id),  -- NULL = toutes les sociétés
  type           VARCHAR(10) NOT NULL CHECK (type IN ('accorde', 'retire')),
  motif          TEXT,
  date_debut     DATE,
  date_fin       DATE,
  id_accorde_par UUID REFERENCES utilisateur(id),
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT ck_exception_dates CHECK (date_fin IS NULL OR date_fin > date_debut),
  CONSTRAINT uq_exception_droit UNIQUE NULLS NOT DISTINCT (id_utilisateur, id_permission, id_societe, type)
);
COMMENT ON TABLE exception_droit IS 'Modif 6 : accorde ou retire un droit par utilisateur et société, par dessus l''héritage du profil. Règle de résolution : le retrait prime sur l''ajout.';

CREATE TABLE session_token (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_utilisateur     UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  access_token_hash  VARCHAR(255) NOT NULL,
  refresh_token_hash VARCHAR(255),
  expires_at         TIMESTAMP NOT NULL,
  revoked            BOOLEAN NOT NULL DEFAULT false,
  ip_address         VARCHAR(45),
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE reset_password_token (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_utilisateur UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  token_hash     VARCHAR(255) NOT NULL,
  expires_at     TIMESTAMP NOT NULL,
  utilise        BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE two_factor_auth (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_utilisateur UUID NOT NULL UNIQUE REFERENCES utilisateur(id) ON DELETE CASCADE,
  secret_totp    VARCHAR(255) NOT NULL,
  actif          BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE preference_dashboard (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_utilisateur UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  widget_code    VARCHAR(50) NOT NULL,
  visible        BOOLEAN NOT NULL DEFAULT true,
  position       INTEGER,
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_preference_utilisateur_widget UNIQUE (id_utilisateur, widget_code)
);
COMMENT ON TABLE preference_dashboard IS 'Préférences individuelles de dashboard (position et visibilité des widgets).';

-- ============================================================================
-- 9. WORKFLOW, AUDIT ET QUALITÉ
-- ============================================================================

CREATE TABLE workflow_validation (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entite_type   VARCHAR(100) NOT NULL,
  entite_id     UUID NOT NULL,
  id_soumis_par UUID REFERENCES utilisateur(id),
  id_traite_par UUID REFERENCES utilisateur(id),
  id_statut     UUID REFERENCES validation_status(id),
  message_refus TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_utilisateur UUID REFERENCES utilisateur(id),
  action        VARCHAR(100) NOT NULL,
  entite_type   VARCHAR(100),
  entite_id     UUID,
  valeur_avant  JSONB,
  valeur_apres  JSONB,
  ip_address    VARCHAR(45),
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE audit_log IS 'Journal des actions utilisateur, archivage glissant 6 mois (purge côté back-office).';

CREATE TABLE historique_declaration (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_societe    UUID REFERENCES societe(id),
  id_utilisateur UUID REFERENCES utilisateur(id),
  action        VARCHAR(100),
  entite_type   VARCHAR(100),
  detail        JSONB,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE log_import (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_utilisateur UUID REFERENCES utilisateur(id),
  id_client      UUID REFERENCES client(id),
  type_import    VARCHAR(100),
  nb_lignes_total INTEGER,
  statut         VARCHAR(20) CHECK (statut IN ('en_cours', 'succes', 'succes_partiel', 'echec')),
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE anomalie_qualite (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entite_type   VARCHAR(100) NOT NULL,
  entite_id     UUID NOT NULL,
  type_anomalie VARCHAR(100),
  description   TEXT,
  gravite       VARCHAR(15) CHECK (gravite IN ('info', 'attention', 'critique')),
  resolu        BOOLEAN NOT NULL DEFAULT false,
  id_valide_par UUID REFERENCES utilisateur(id),
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================================
-- 10. CONNECTEURS ET INVENTAIRE
-- ============================================================================

CREATE TABLE connecteur (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_client              UUID NOT NULL REFERENCES client(id),
  label                  VARCHAR(255) NOT NULL,
  type                   VARCHAR(100),
  mode                   VARCHAR(10) CHECK (mode IN ('pull', 'push')),
  actif                  BOOLEAN NOT NULL DEFAULT false,
  statut                 VARCHAR(20) NOT NULL DEFAULT 'non_configure' CHECK (statut IN ('ok', 'defaillant', 'non_configure')),
  date_derniere_collecte TIMESTAMP,
  created_at             TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE connecteur IS 'Configuration des outils d''inventaire tiers. Prévu v2, placeholder en v0.5.';

CREATE TABLE connecteur_mapping (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_connecteur  UUID NOT NULL REFERENCES connecteur(id) ON DELETE CASCADE,
  champ_source   VARCHAR(255) NOT NULL,
  champ_cible    VARCHAR(255) NOT NULL,
  transformation VARCHAR(255),
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE inventaire_raw (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_connecteur        UUID REFERENCES connecteur(id),
  id_societe           UUID REFERENCES societe(id),
  url_fichier          VARCHAR(500) NOT NULL,
  format_source        VARCHAR(50),
  statut_rapprochement VARCHAR(20) NOT NULL DEFAULT 'en_attente' CHECK (statut_rapprochement IN ('en_attente', 'rapproche', 'ecart_detecte', 'rejete')),
  id_affectation       UUID REFERENCES affectation(id),
  created_at           TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE inventaire_raw IS 'Pointeur vers le fichier brut collecté (pas de blob en base, revue Samuel).';

CREATE TABLE collecte_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_connecteur      UUID NOT NULL REFERENCES connecteur(id) ON DELETE CASCADE,
  statut             VARCHAR(20) CHECK (statut IN ('succes', 'succes_partiel', 'echec')),
  nb_enregistrements INTEGER,
  duree_ms           INTEGER,
  message_erreur     TEXT,
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================================
-- 11. ALERTES ET NOTIFICATIONS
-- ============================================================================

CREATE TABLE alerte (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_alerte VARCHAR(100) NOT NULL,
  entite_type VARCHAR(100),
  entite_id   UUID,
  message     TEXT,
  niveau      VARCHAR(10) CHECK (niveau IN ('info', 'jaune', 'orange', 'rouge')),
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE alerte IS 'Modif 1 : type_alerte inclut les types du workflow de validation (saisie_a_valider, saisie_validee, saisie_refusee...), en plus des seuils et échéances.';

CREATE TABLE notification (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_alerte      UUID REFERENCES alerte(id),  -- modif 1 : devient optionnel
  id_utilisateur UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  entite_type    VARCHAR(100),  -- modif 1 : source générique, notification possible sans alerte
  entite_id      UUID,          -- modif 1
  statut         VARCHAR(10) NOT NULL DEFAULT 'non_lu' CHECK (statut IN ('non_lu', 'lu', 'archive')),
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  lu_at          TIMESTAMP
);

-- ============================================================================
-- 12. SYSTÈME ET BACK-OFFICE
-- ============================================================================

CREATE TABLE tache_asynchrone (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         VARCHAR(100) NOT NULL,
  statut       VARCHAR(15) NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'en_cours', 'succes', 'echec')),
  payload      JSONB,
  tentatives   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  completed_at TIMESTAMP
);

CREATE TABLE log_serveur (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niveau     VARCHAR(10) CHECK (niveau IN ('info', 'warn', 'error', 'critical')),
  source     VARCHAR(100),
  message    TEXT,
  context    JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================================
-- 13. TRIGGER updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_client_updated_at  BEFORE UPDATE ON client  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_societe_updated_at BEFORE UPDATE ON societe FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_editeur_updated_at BEFORE UPDATE ON editeur FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_contrat_updated_at BEFORE UPDATE ON contrat FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 14. INDEX (PostgreSQL n'indexe pas les FK automatiquement)
-- ============================================================================

-- Organisation
CREATE INDEX idx_societe_client            ON societe (id_client);
CREATE INDEX idx_societe_parent            ON societe (id_societe_parent);
CREATE INDEX idx_utilisateur_client        ON utilisateur (id_client);
CREATE INDEX idx_client_abonnement         ON client (id_abonnement);
CREATE INDEX idx_client_admin              ON client (id_admin_client);

-- Tiers et produits
CREATE INDEX idx_contact_fonction          ON contact (id_fonction);
CREATE INDEX idx_produit_client_client     ON produit_client (id_client);
CREATE INDEX idx_produit_client_editeur    ON produit_client (id_editeur);
CREATE INDEX idx_ppl_produit               ON pre_parametre_licence (id_produit);
CREATE INDEX idx_ppl_unite                 ON pre_parametre_licence (id_unite_mesure);

-- Contractuel
CREATE INDEX idx_contrat_type              ON contrat (id_type_contrat);
CREATE INDEX idx_contrat_editeur           ON contrat (id_editeur);
CREATE INDEX idx_contrat_societe           ON contrat (id_societe);
CREATE INDEX idx_contrat_parent            ON contrat (id_contrat_parent);
CREATE INDEX idx_contrat_date_fin          ON contrat (date_fin);
CREATE INDEX idx_commande_contrat          ON commande (id_contrat);
CREATE INDEX idx_commande_societe          ON commande (id_societe);
CREATE INDEX idx_commande_revendeur        ON commande (id_revendeur);
CREATE INDEX idx_commande_mode             ON commande (id_mode_commande);
CREATE INDEX idx_commande_date_fin         ON commande (date_fin);
CREATE INDEX idx_preuve_type               ON preuve (id_type_preuve);
CREATE INDEX idx_preuve_contrat            ON preuve (id_contrat);
CREATE INDEX idx_preuve_commande           ON preuve (id_commande);
CREATE INDEX idx_facture_commande          ON facture (id_commande);
CREATE INDEX idx_facture_preuve            ON facture (id_preuve);

-- Licences et budget
CREATE INDEX idx_licence_contrat           ON licence (id_contrat);
CREATE INDEX idx_licence_commande          ON licence (id_commande);
CREATE INDEX idx_licence_produit           ON licence (id_produit);
CREATE INDEX idx_licence_revendeur         ON licence (id_revendeur);
CREATE INDEX idx_licence_unite             ON licence (id_unite_mesure);
CREATE INDEX idx_licence_mainteneur        ON licence (id_mainteneur);
CREATE INDEX idx_maintenance_licence       ON maintenance_historique (id_licence);
CREATE INDEX idx_maintenance_mainteneur    ON maintenance_historique (id_mainteneur);
CREATE INDEX idx_maintenance_revendeur     ON maintenance_historique (id_revendeur);
CREATE INDEX idx_budget_licence            ON budget (id_licence);
CREATE INDEX idx_budget_periode            ON budget (date_debut, date_fin);

-- Déploiement
CREATE INDEX idx_affectation_licence       ON affectation (id_licence);
CREATE INDEX idx_affectation_societe       ON affectation (id_societe);
CREATE INDEX idx_affectation_statut        ON affectation (id_validation_status);
CREATE INDEX idx_affectation_revalidation  ON affectation (date_revalidation);
CREATE INDEX idx_revalidation_affectation  ON revalidation (id_affectation);
CREATE INDEX idx_precalc_conf_produit      ON precalcul_conformite (id_produit);
CREATE INDEX idx_precalc_conf_editeur      ON precalcul_conformite (id_editeur);
CREATE INDEX idx_precalc_fin_editeur       ON precalcul_financier (id_editeur);
CREATE INDEX idx_precalc_fin_societe       ON precalcul_financier (id_societe);
CREATE INDEX idx_precalc_fin_periode       ON precalcul_financier (periode);

-- Droits et accès
CREATE INDEX idx_ups_profil                ON utilisateur_profil_societe (id_profil);
CREATE INDEX idx_ups_societe               ON utilisateur_profil_societe (id_societe);
CREATE INDEX idx_exception_permission      ON exception_droit (id_permission);
CREATE INDEX idx_exception_societe         ON exception_droit (id_societe);
CREATE INDEX idx_session_utilisateur       ON session_token (id_utilisateur);
CREATE INDEX idx_reset_utilisateur         ON reset_password_token (id_utilisateur);

-- Workflow, audit, qualité
CREATE INDEX idx_workflow_statut           ON workflow_validation (id_statut);
CREATE INDEX idx_workflow_entite           ON workflow_validation (entite_type, entite_id);
CREATE INDEX idx_workflow_soumis_par       ON workflow_validation (id_soumis_par);
CREATE INDEX idx_audit_utilisateur         ON audit_log (id_utilisateur);
CREATE INDEX idx_audit_created             ON audit_log (created_at);
CREATE INDEX idx_audit_entite              ON audit_log (entite_type, entite_id);
CREATE INDEX idx_histo_decl_societe        ON historique_declaration (id_societe);
CREATE INDEX idx_histo_decl_utilisateur    ON historique_declaration (id_utilisateur);
CREATE INDEX idx_log_import_client         ON log_import (id_client);
CREATE INDEX idx_log_import_utilisateur    ON log_import (id_utilisateur);
CREATE INDEX idx_anomalie_entite           ON anomalie_qualite (entite_type, entite_id);
CREATE INDEX idx_anomalie_resolu           ON anomalie_qualite (resolu);
CREATE INDEX idx_anomalie_valide_par       ON anomalie_qualite (id_valide_par);

-- Connecteurs
CREATE INDEX idx_connecteur_client         ON connecteur (id_client);
CREATE INDEX idx_conn_mapping_connecteur   ON connecteur_mapping (id_connecteur);
CREATE INDEX idx_inventaire_connecteur     ON inventaire_raw (id_connecteur);
CREATE INDEX idx_inventaire_societe        ON inventaire_raw (id_societe);
CREATE INDEX idx_inventaire_affectation    ON inventaire_raw (id_affectation);
CREATE INDEX idx_inventaire_statut         ON inventaire_raw (statut_rapprochement);
CREATE INDEX idx_collecte_connecteur       ON collecte_log (id_connecteur);

-- Alertes et système
CREATE INDEX idx_notification_utilisateur  ON notification (id_utilisateur, statut);
CREATE INDEX idx_notification_alerte       ON notification (id_alerte);
CREATE INDEX idx_alerte_created            ON alerte (created_at);
CREATE INDEX idx_tache_statut              ON tache_asynchrone (statut);

COMMIT;
