-- ============================================================================
-- SamSecure - BDD Tenant - Migration 040
-- Fichier   : 040_tenant_produit_client_v2.sql
-- Objet     : ouverture du referentiel produit client a la saisie (module 1).
--
--             Rappel de doctrine, pose en 001 et 002 : produit_referentiel
--             (BDD Commune) est le catalogue global maintenu par SamSecure,
--             partage entre tous les clients en lecture seule ; produit_client
--             (BDD Tenant) porte les produits propres au client, absents de ce
--             catalogue. L'ecran Logiciels affiche les deux et ne rend
--             modifiables que les seconds. Le CRUD ne touche donc jamais la
--             Commune, et cette migration ne concerne que le Tenant.
--
--             produit_client etait une coquille : creee en 002, amputee de
--             id_client en 006, jamais ecrite par aucune route ni aucun seed.
--             Trois ajouts pour la rendre exploitable :
--             - updated_at et son trigger, comme editeur et contrat, sans quoi
--               une fiche ne sait pas dire quand elle a change ;
--             - version_client et edition_client, jumelles Tenant de version et
--               edition (Commune). L'interface propose depuis toujours d'ajouter
--               une version a un produit client, sans qu'aucune table puisse la
--               recevoir : version.id_produit porte une FK vers
--               produit_referentiel, qu'un produit client ne satisfera jamais.
--               Memes colonnes et meme unicite (id_produit, label) que leurs
--               equivalents Commune, pour que l'API les serve sous une forme
--               unique.
--
--             Pas de sku : il identifie une reference du catalogue global et
--             porte une unicite globale, un produit maison n'en a pas.
--             Pas de a_maintenir : retire du modele par la modif 12, la
--             maintenance est un choix client porte par la licence.
--             Statut de validation : workflow_validation, entite produit_client.
--             Pendant Commune : 041 (codes retour).
-- Cible     : PostgreSQL 16 - base Tenant, apres 039
-- Rejouable : ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
--             DROP TRIGGER IF EXISTS avant CREATE TRIGGER (Postgres 16 ne
--             connait pas CREATE TRIGGER IF NOT EXISTS).
--             Aucune instruction destructrice sur des donnees.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. produit_client : horodatage de modification
-- ----------------------------------------------------------------------------

ALTER TABLE produit_client ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

-- set_updated_at() est definie en 002 et deja portee par editeur, contrat,
-- commande et licence.
DROP TRIGGER IF EXISTS trg_produit_client_updated_at ON produit_client;
CREATE TRIGGER trg_produit_client_updated_at
  BEFORE UPDATE ON produit_client
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Declinaisons des produits client
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS version_client (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produit UUID NOT NULL REFERENCES produit_client(id) ON DELETE CASCADE,
  label      VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_version_client_produit_label UNIQUE (id_produit, label)
);

CREATE TABLE IF NOT EXISTS edition_client (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produit UUID NOT NULL REFERENCES produit_client(id) ON DELETE CASCADE,
  label      VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_edition_client_produit_label UNIQUE (id_produit, label)
);

CREATE INDEX IF NOT EXISTS idx_version_client_produit ON version_client (id_produit);
CREATE INDEX IF NOT EXISTS idx_edition_client_produit ON edition_client (id_produit);

COMMENT ON TABLE version_client IS
  'Versions successives d''un produit client. Jumelle Tenant de version (Commune), qui ne peut porter que des produits du catalogue global.';
COMMENT ON TABLE edition_client IS
  'Declinaisons commerciales d''un produit client. Jumelle Tenant de edition (Commune).';
COMMENT ON COLUMN produit_client.updated_at IS
  'Horodatage de derniere modification, tenu par trg_produit_client_updated_at.';

COMMIT;
