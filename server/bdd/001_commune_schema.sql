-- ============================================================================
-- SamSecure - BDD Commune - Schéma v3
-- Fichier   : 001_commune_schema.sql
-- Aligné sur: Nayrod_SamSecure_uml_complet_v3.html (28/07/2026)
-- Cible     : PostgreSQL 16 - base partagée, lecture seule pour les tenants
-- Exécution : psql -U samsecure_app -d samsecure_common_dev -f 001_commune_schema.sql
--             (puis idem sur samsecure_common_staging)
-- Contenu   : 3 tables uniquement : produit_referentiel, version, edition.
--             Tout le reste vit en BDD Tenant. Aucune jointure SQL ne peut
--             traverser les deux bases : l'API est le seul pont.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- produit_referentiel : catalogue global des produits, maintenu par SamSecure
-- Modif 12 : a_maintenir retiré, la maintenance est un choix client (licence)
-- ----------------------------------------------------------------------------
CREATE TABLE produit_referentiel (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label             VARCHAR(255) NOT NULL,
  id_editeur        UUID,             -- lien logique vers editeur (BDD Tenant), résolu par l'API
  sku               VARCHAR(100),
  id_produit_parent UUID REFERENCES produit_referentiel(id),
  created_at        TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_produit_referentiel_sku UNIQUE (sku)
);

COMMENT ON TABLE  produit_referentiel IS 'Catalogue global des produits, partagé entre tous les clients en lecture seule.';
COMMENT ON COLUMN produit_referentiel.id_editeur IS 'Référence logique inter-bases (editeur en BDD Tenant), aucune FK SQL possible : résolution par l''API.';
COMMENT ON COLUMN produit_referentiel.id_produit_parent IS 'Hiérarchie suite / bundle / add-on.';

-- ----------------------------------------------------------------------------
-- version : versions successives d'un produit du catalogue
-- ----------------------------------------------------------------------------
CREATE TABLE version (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produit UUID NOT NULL REFERENCES produit_referentiel(id) ON DELETE CASCADE,
  label      VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_version_produit_label UNIQUE (id_produit, label)
);

COMMENT ON TABLE version IS 'Versions successives d''un produit (ex : 2019, 2021). Sert au suivi des droits de montée de version.';

-- ----------------------------------------------------------------------------
-- edition : déclinaisons commerciales d'un produit
-- ----------------------------------------------------------------------------
CREATE TABLE edition (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produit UUID NOT NULL REFERENCES produit_referentiel(id) ON DELETE CASCADE,
  label      VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_edition_produit_label UNIQUE (id_produit, label)
);

COMMENT ON TABLE edition IS 'Déclinaisons commerciales d''un produit (Standard, Professional, Enterprise).';

-- ----------------------------------------------------------------------------
-- Index
-- ----------------------------------------------------------------------------
CREATE INDEX idx_produit_referentiel_editeur ON produit_referentiel (id_editeur);
CREATE INDEX idx_produit_referentiel_parent  ON produit_referentiel (id_produit_parent);
CREATE INDEX idx_version_produit             ON version (id_produit);
CREATE INDEX idx_edition_produit             ON edition (id_produit);

-- ----------------------------------------------------------------------------
-- Droits : lecture seule pour samsecure_api_ro, y compris les tables futures
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO samsecure_api_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO samsecure_api_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO samsecure_api_ro;

COMMIT;
