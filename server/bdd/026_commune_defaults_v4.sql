-- ============================================================================
-- SamSecure - BDD Commune - Migration 026
-- Fichier   : 026_commune_defaults_v4.sql
-- Objet     : les 10 tables default_* du referentiel v4 (D7 du 29/07,
--             "reintegrees"), source SamSecure des defauts diffuses vers les
--             referentiels personnalisables du Tenant par rapprochement sur
--             code (motif copy-on-write code / personnalise / valeurs_defaut
--             de la modif 22, deja en place cote Tenant depuis 002 et 003).
--             Correspondance un pour un :
--               default_profil            -> profil
--               default_permission        -> permission
--               default_profil_permission -> profil_permission
--               default_profil_widget     -> profil_widget
--               default_seuil_dashboard   -> seuil_dashboard
--               default_fonction          -> fonction
--               default_type_contrat      -> type_contrat
--               default_type_preuve       -> type_preuve
--               default_mode_commande     -> mode_commande
--               default_unite_mesure      -> unite_mesure
--             Ce sont des referentiels techniques de l'application, identiques
--             pour tous les clients, lecture seule pour les tenants. Aucune
--             FK inter-bases (isolation physique) : la diffusion vers le
--             Tenant reste assuree par l'API ou par les seeds Tenant (003,
--             007, 010, 011, 018, 021), qui restent la voie executee a ce jour.
-- Cible     : PostgreSQL 16 - base Commune
-- Exécution : npm run migrate:dev / migrate:staging
-- Note      : colonnes strictement celles du referentiel v4. Les contraintes
--             d'unicite reprennent celles des tables Tenant miroir (cle
--             naturelle widget_code + echelle, id_profil + widget_code,
--             id_profil + id_permission).
-- Rejouable : IF NOT EXISTS, sans effet sur une base deja conforme.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Referentiels simples (code, label)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS default_fonction (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(50) NOT NULL UNIQUE,
  label      VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE default_fonction IS 'Defauts SamSecure des fonctions de contact (D7 du 29/07), diffuses vers fonction par rapprochement sur code.';

CREATE TABLE IF NOT EXISTS default_type_contrat (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(50) NOT NULL UNIQUE,
  label      VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE default_type_contrat IS 'Defauts SamSecure des types de contrat (D7), diffuses vers type_contrat par rapprochement sur code.';

CREATE TABLE IF NOT EXISTS default_type_preuve (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(50) NOT NULL UNIQUE,
  label      VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE default_type_preuve IS 'Defauts SamSecure des types de preuve (D7), diffuses vers type_preuve par rapprochement sur code.';

CREATE TABLE IF NOT EXISTS default_mode_commande (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(50) NOT NULL UNIQUE,
  label      VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE default_mode_commande IS 'Defauts SamSecure des modes de commande (D7), diffuses vers mode_commande par rapprochement sur code.';

CREATE TABLE IF NOT EXISTS default_unite_mesure (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) NOT NULL UNIQUE,
  label       VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE default_unite_mesure IS 'Defauts SamSecure des unites de mesure (D7), diffuses vers unite_mesure par rapprochement sur code.';

-- ----------------------------------------------------------------------------
-- RBAC par defaut
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS default_profil (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) NOT NULL UNIQUE,
  label       VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE default_profil IS 'Defauts SamSecure des groupes (D7), correspondance un pour un avec profil, rapprochement sur code.';

CREATE TABLE IF NOT EXISTS default_permission (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(100) NOT NULL UNIQUE,
  label      VARCHAR(255) NOT NULL,
  module     VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE default_permission IS 'Defauts SamSecure des permissions (D7), rapprochement sur code. Les codes sont le contrat d''API et ne changent jamais.';

CREATE TABLE IF NOT EXISTS default_profil_permission (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_profil     UUID NOT NULL REFERENCES default_profil(id) ON DELETE CASCADE,
  id_permission UUID NOT NULL REFERENCES default_permission(id) ON DELETE CASCADE,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_default_profil_permission UNIQUE (id_profil, id_permission)
);
COMMENT ON TABLE default_profil_permission IS 'Matrice de droits par defaut (D7), FK internes a la Commune. Diffusee vers profil_permission par rapprochement des codes profil et permission.';

CREATE TABLE IF NOT EXISTS default_profil_widget (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_profil      UUID NOT NULL REFERENCES default_profil(id) ON DELETE CASCADE,
  widget_code    VARCHAR(50) NOT NULL,
  visible_defaut BOOLEAN NOT NULL DEFAULT false,
  acces_autorise BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_default_profil_widget UNIQUE (id_profil, widget_code)
);
COMMENT ON TABLE default_profil_widget IS 'Visibilite des widgets par defaut par groupe (D7). Cle naturelle id_profil + widget_code, comme profil_widget.';

CREATE TABLE IF NOT EXISTS default_seuil_dashboard (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_code VARCHAR(50) NOT NULL,
  echelle     INTEGER NOT NULL CHECK (echelle BETWEEN 1 AND 4),
  valeur      DECIMAL(12,2) NOT NULL,
  unite       VARCHAR(20),
  direction   VARCHAR(10),
  created_at  TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_default_seuil_widget_echelle UNIQUE (widget_code, echelle)
);
COMMENT ON TABLE default_seuil_dashboard IS 'Seuils par defaut par widget et echelle (D7), modifiables par le client cote tenant (D10). Cle naturelle widget_code + echelle, comme seuil_dashboard.';

-- ----------------------------------------------------------------------------
-- Index sur les FK (PostgreSQL n'indexe pas les FK automatiquement)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_default_pp_profil     ON default_profil_permission (id_profil);
CREATE INDEX IF NOT EXISTS idx_default_pp_permission ON default_profil_permission (id_permission);
CREATE INDEX IF NOT EXISTS idx_default_pw_profil     ON default_profil_widget (id_profil);

-- ----------------------------------------------------------------------------
-- Droits : lecture seule pour samsecure_api_ro
-- ----------------------------------------------------------------------------
GRANT SELECT ON default_profil, default_permission, default_profil_permission,
                default_profil_widget, default_seuil_dashboard, default_fonction,
                default_type_contrat, default_type_preuve, default_mode_commande,
                default_unite_mesure
  TO samsecure_api_ro;

COMMIT;
