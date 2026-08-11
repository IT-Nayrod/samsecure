-- ============================================================================
-- SamSecure - BDD Commune - Migration 005
-- Fichier   : 005_commune_migration.sql
-- Objet     : montée de langue et traduction en BDD Commune (arbitrage 29/07).
--             Le dictionnaire devient un actif SamSecure central, identique
--             pour tous les tenants, géré par le back-office sans redéploiement.
-- Cible     : PostgreSQL 16 - base Commune déjà au niveau 001
-- Exécution : psql -U samsecure_app -d samsecure_common_dev -f 005_commune_migration.sql
--             (puis idem sur samsecure_common_staging)
-- Note      : script rejouable sans effet de bord (IF NOT EXISTS, ON CONFLICT).
--             À exécuter avant la migration 006 côté Tenant.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- langue : langues disponibles (montée en Commune le 29/07)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS langue (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(10) NOT NULL UNIQUE,
  label      VARCHAR(100) NOT NULL,
  actif      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE langue IS 'Langues disponibles, référentiel SamSecure identique pour tous les tenants (montée en Commune le 29/07).';

-- ----------------------------------------------------------------------------
-- traduction : dictionnaire d'interface, géré par le back-office SamSecure
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS traduction (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_langue  UUID NOT NULL REFERENCES langue(id) ON DELETE CASCADE,
  cle        VARCHAR(255) NOT NULL,
  valeur     TEXT NOT NULL,
  module     VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_traduction_langue_cle UNIQUE (id_langue, cle)
);
COMMENT ON TABLE traduction IS 'Dictionnaire d''interface par clé et module, actif SamSecure identique pour tous (montée en Commune le 29/07). Personnalisation par tenant retirée (28/07).';

CREATE INDEX IF NOT EXISTS idx_traduction_langue ON traduction (id_langue);

-- ----------------------------------------------------------------------------
-- Droits : lecture seule explicite pour samsecure_api_ro
-- (les ALTER DEFAULT PRIVILEGES du 001 couvrent déjà le cas si la migration
-- est exécutée par samsecure_app, le GRANT explicite sécurise les autres cas)
-- ----------------------------------------------------------------------------
GRANT SELECT ON langue, traduction TO samsecure_api_ro;

-- ----------------------------------------------------------------------------
-- Seed des langues (repris de l'ex-seed Tenant)
-- ----------------------------------------------------------------------------
INSERT INTO langue (code, label, actif) VALUES
  ('fr', 'Français', true),
  ('en', 'English',  true)
ON CONFLICT (code) DO NOTHING;

COMMIT;
