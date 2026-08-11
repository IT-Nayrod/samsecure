-- ============================================================================
-- SamSecure - BDD Tenant - Migration 006
-- Fichier   : 006_tenant_migration.sql
-- Objet     : fait passer la structure déployée (état du 28/07, migrations 002
--             + 003) vers la structure cible du 29/07 :
--               1. Portées RBAC : tables utilisateur_societe (rattachement) et
--                  profil_societe (diffusion), attribution à portée nullable,
--                  reprise des données à l'échelle du tenant (spec 2.3).
--               2. Dissolution de client dans tenant_config : une base = un
--                  client, les FK id_client (colonnes constantes) disparaissent.
--               3. langue et traduction quittent le Tenant, montées en BDD
--                  Commune (migration 005, à exécuter avant celle-ci).
-- Cible     : PostgreSQL 16 - base Tenant déjà au niveau 002 + 003 du 28/07
-- Exécution : psql -U samsecure_app -d samsecure_tenant_client01_dev -f 006_tenant_migration.sql
--             (puis idem sur samsecure_tenant_client01_staging)
-- Note      : script rejouable sans effet de bord. Les données existantes sont
--             reprises : identité du client transférée dans tenant_config,
--             chaque utilisateur et chaque groupe reçoit une portée NULL
--             (échelle du tenant), comportement identique à l'existant.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PORTÉES RBAC (29/07)
-- ============================================================================

-- Rattachement des utilisateurs aux sociétés
CREATE TABLE IF NOT EXISTS utilisateur_societe (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_utilisateur UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  id_societe     UUID REFERENCES societe(id),  -- NULL = échelle du tenant
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_utilisateur_societe UNIQUE NULLS NOT DISTINCT (id_utilisateur, id_societe)
);
COMMENT ON TABLE utilisateur_societe IS 'Rattachement d''un utilisateur aux sociétés (portées 29/07), NULL = échelle du tenant.';

-- Diffusion des groupes sur les sociétés
CREATE TABLE IF NOT EXISTS profil_societe (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_profil  UUID NOT NULL REFERENCES profil(id) ON DELETE CASCADE,
  id_societe UUID REFERENCES societe(id),  -- NULL = échelle du tenant
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_profil_societe UNIQUE NULLS NOT DISTINCT (id_profil, id_societe)
);
COMMENT ON TABLE profil_societe IS 'Diffusion d''un groupe sur les sociétés (portées 29/07), NULL = échelle du tenant.';

CREATE INDEX IF NOT EXISTS idx_us_utilisateur ON utilisateur_societe (id_utilisateur);
CREATE INDEX IF NOT EXISTS idx_us_societe     ON utilisateur_societe (id_societe);
CREATE INDEX IF NOT EXISTS idx_ps_profil      ON profil_societe (id_profil);
CREATE INDEX IF NOT EXISTS idx_ps_societe     ON profil_societe (id_societe);

-- Attribution : portée nullable + unicité tenant comprise
ALTER TABLE utilisateur_profil_societe ALTER COLUMN id_societe DROP NOT NULL;
ALTER TABLE utilisateur_profil_societe DROP CONSTRAINT IF EXISTS uq_utilisateur_profil_societe;
ALTER TABLE utilisateur_profil_societe
  ADD CONSTRAINT uq_utilisateur_profil_societe UNIQUE NULLS NOT DISTINCT (id_utilisateur, id_profil, id_societe);
COMMENT ON COLUMN utilisateur_profil_societe.id_societe IS 'Portées 29/07 : NULL = attribution à l''échelle du tenant.';
COMMENT ON TABLE utilisateur_profil_societe IS 'Attribution d''un groupe à un utilisateur avec portée (NULL = tenant). Valide uniquement sur l''intersection rattachement x diffusion (portées 29/07).';

-- Reprise des données (spec portées, section 2.3) : chaque utilisateur et
-- chaque groupe existant reçoit une portée à l'échelle du tenant.
-- Comportement identique à l'existant, aucune régression.
INSERT INTO utilisateur_societe (id_utilisateur, id_societe)
SELECT id, NULL FROM utilisateur
ON CONFLICT ON CONSTRAINT uq_utilisateur_societe DO NOTHING;

INSERT INTO profil_societe (id_profil, id_societe)
SELECT id, NULL FROM profil
ON CONFLICT ON CONSTRAINT uq_profil_societe DO NOTHING;

-- ============================================================================
-- 2. DISSOLUTION DE CLIENT DANS TENANT_CONFIG (29/07)
-- ============================================================================

ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS raison_sociale    VARCHAR(255);
ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS id_abonnement     UUID REFERENCES abonnement_samsecure(id);
ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS id_administrateur UUID REFERENCES utilisateur(id);
ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMP NOT NULL DEFAULT now();

-- Transfert de l'identité depuis client (uniquement si la table existe encore)
DO $$
DECLARE
  v_traductions boolean;
BEGIN
  IF to_regclass('public.client') IS NOT NULL THEN
    -- ligne de config existante : on la complète
    EXECUTE 'UPDATE tenant_config tc
               SET raison_sociale    = c.raison_sociale,
                   id_abonnement     = c.id_abonnement,
                   id_administrateur = c.id_admin_client
              FROM client c
             WHERE tc.id_client = c.id';
    -- pas de ligne de config : on la crée depuis client
    EXECUTE 'INSERT INTO tenant_config (raison_sociale, id_abonnement, id_administrateur)
             SELECT c.raison_sociale, c.id_abonnement, c.id_admin_client
               FROM client c
              WHERE NOT EXISTS (SELECT 1 FROM tenant_config)';
  END IF;
END $$;

ALTER TABLE tenant_config ALTER COLUMN raison_sociale SET NOT NULL;
ALTER TABLE tenant_config DROP COLUMN IF EXISTS id_client;

DROP TRIGGER IF EXISTS trg_tenant_config_updated_at ON tenant_config;
CREATE TRIGGER trg_tenant_config_updated_at BEFORE UPDATE ON tenant_config FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE tenant_config IS 'Identité et configuration du tenant, ligne unique. Absorbe l''ex-table client (29/07).';

-- Suppression des FK constantes id_client (les index associés tombent avec)
ALTER TABLE societe        DROP COLUMN IF EXISTS id_client;
ALTER TABLE utilisateur    DROP COLUMN IF EXISTS id_client;
ALTER TABLE produit_client DROP COLUMN IF EXISTS id_client;
ALTER TABLE connecteur     DROP COLUMN IF EXISTS id_client;
ALTER TABLE log_import     DROP COLUMN IF EXISTS id_client;

-- Suppression de la table client (trigger, index et FK internes tombent avec)
DROP TABLE IF EXISTS client;

-- ============================================================================
-- 3. LANGUE ET TRADUCTION QUITTENT LE TENANT (montées en Commune, migration 005)
-- ============================================================================

-- Garde-fou : aucune traduction résiduelle ne doit être perdue
DO $$
DECLARE
  v_reste boolean;
BEGIN
  IF to_regclass('public.traduction') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM traduction)' INTO v_reste;
    IF v_reste THEN
      RAISE EXCEPTION 'traduction du tenant non vide : transférer le contenu vers la BDD Commune avant de rejouer la migration 006';
    END IF;
  END IF;
END $$;

DROP TABLE IF EXISTS traduction;
DROP TABLE IF EXISTS langue;

COMMIT;
