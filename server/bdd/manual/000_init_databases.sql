-- ============================================================================
-- SamSecure - Initialisation des rôles et des bases
-- Fichier   : 000_init_databases.sql
-- Cible     : PostgreSQL 16
-- Exécution : en tant que superutilisateur postgres, connecté à la base postgres
--             psql -U postgres -f 000_init_databases.sql
-- Note      : script d'initialisation, à exécuter une seule fois par serveur.
--             Remplacer les mots de passe CHANGEZ_MOI avant exécution.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Rôles
--   samsecure_app    : rôle applicatif (API), lecture/écriture
--   samsecure_api_ro : rôle lecture seule, réservé à la BDD Commune
-- ----------------------------------------------------------------------------
DO $$
\prompt 'Mot de passe pour samsecure_app     : ' app_pwd
\prompt 'Mot de passe pour samsecure_api_ro  : ' ro_pwd
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'samsecure_app') THEN
    CREATE ROLE samsecure_app LOGIN PASSWORD 'app_pwd';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'samsecure_api_ro') THEN
    CREATE ROLE samsecure_api_ro LOGIN PASSWORD 'ro_pwd';
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- Bases : 1 BDD Commune + 1 BDD Tenant par client, en dev et en staging
-- ----------------------------------------------------------------------------
CREATE DATABASE samsecure_common_dev             OWNER samsecure_app;
CREATE DATABASE samsecure_common_staging         OWNER samsecure_app;
CREATE DATABASE samsecure_tenant_client01_dev     OWNER samsecure_app;
CREATE DATABASE samsecure_tenant_client01_staging OWNER samsecure_app;

-- ----------------------------------------------------------------------------
-- Durcissement des accès
--   - personne ne se connecte par défaut (retrait du CONNECT public)
--   - samsecure_app se connecte partout
--   - samsecure_api_ro ne se connecte qu'aux bases Communes
-- ----------------------------------------------------------------------------
REVOKE CONNECT ON DATABASE samsecure_common_dev             FROM PUBLIC;
REVOKE CONNECT ON DATABASE samsecure_common_staging         FROM PUBLIC;
REVOKE CONNECT ON DATABASE samsecure_tenant_client01_dev     FROM PUBLIC;
REVOKE CONNECT ON DATABASE samsecure_tenant_client01_staging FROM PUBLIC;

GRANT CONNECT ON DATABASE samsecure_common_dev             TO samsecure_app, samsecure_api_ro;
GRANT CONNECT ON DATABASE samsecure_common_staging         TO samsecure_app, samsecure_api_ro;
GRANT CONNECT ON DATABASE samsecure_tenant_client01_dev     TO samsecure_app;
GRANT CONNECT ON DATABASE samsecure_tenant_client01_staging TO samsecure_app;
