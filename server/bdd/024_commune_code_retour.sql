-- ============================================================================
-- SamSecure - BDD Commune - Migration 024
-- Fichier   : 024_commune_code_retour.sql
-- Objet     : table code_retour, catalogue des codes numeriques de retour API
--             (referentiel v4 du 05/08, US #71). Enveloppe JSON unique : chaque
--             reponse de l'API porte un code de ce catalogue, distinct du
--             statut HTTP gere route par route.
--             Plages (referentiel v4 + pre-catalogue server/docs/codes_retour.md) :
--               1000-1499 succes transverses, 1500-1999 erreurs transverses,
--               2000-2999 module 1 (administration), 3000-3999 module 2
--               (contrats 3000, commandes 3100, documents 3200, validation
--               3300, droits 3400), 4000 et plus modules 3 et 4.
--               Jamais de chevauchement avec les statuts HTTP (100-599).
--             Referentiel technique applicatif, meme famille que
--             validation_status : lecture seule, non surchargeable, aucun
--             motif personnalise / valeurs_defaut, aucune copie en Tenant.
--             Doctrine : Commune = referentiels techniques de l'application,
--             identiques pour tous les clients ; Tenant = referentiels metier
--             personnalisables.
-- Cible     : PostgreSQL 16 - base Commune (fichier route vers commonPool par
--             migrate.js grace au mot "commune" dans son nom)
-- Exécution : npm run migrate:dev / migrate:staging, ou
--             psql -U samsecure_app -d samsecure_common_dev -f 024_commune_code_retour.sql
-- Depend    : story #68 (helper d'enveloppe et resolution des codes).
-- Note      : le referentiel v4 note type ENUM ; convention 002 du projet,
--             les valeurs sont portees par un CHECK (plus simple a faire
--             evoluer par migration qu'un type ENUM natif).
-- Rejouable : IF NOT EXISTS, sans effet sur une base deja conforme.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS code_retour (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       INTEGER NOT NULL,
  type       VARCHAR(20) NOT NULL,
  libelle    VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_code_retour_code UNIQUE (code),
  -- Hors des statuts HTTP : la plage applicative commence a 1000.
  CONSTRAINT ck_code_retour_plage CHECK (code >= 1000),
  -- succes / erreur : reponses ; trace : evenement ecrit dans audit_log, la
  -- route repondant son propre code ; avertissement : accepte avec reserve
  -- (ex. 3021) ; reserve : code catalogue mais non emis (route inexistante ou
  -- arbitrage en attente).
  CONSTRAINT ck_code_retour_type CHECK (type IN ('succes', 'erreur', 'trace', 'avertissement', 'reserve'))
);

COMMENT ON TABLE  code_retour IS 'Catalogue des codes numeriques de retour API (referentiel v4). Lecture seule, identique pour tous les tenants, non surchargeable. Plages : 1000-1499 succes transverses, 1500-1999 erreurs transverses, 2000-2999 administration, 3000-3999 module 2, 4000+ modules 3 et 4.';
COMMENT ON COLUMN code_retour.code    IS 'Code numerique unique, >= 1000, jamais un statut HTTP. Contrat d''API : un code ne change jamais de sens.';
COMMENT ON COLUMN code_retour.type    IS 'succes, erreur, trace (evenement audit_log), avertissement (accepte avec reserve), reserve (catalogue, non emis).';
COMMENT ON COLUMN code_retour.libelle IS 'Libelle par defaut en francais. A terme, la traduction par la cle api.<code> (table traduction) primera sur ce libelle.';

-- Index de resolution par plage (liste des codes d'un module).
CREATE INDEX IF NOT EXISTS idx_code_retour_type ON code_retour (type);

-- Droits : lecture seule pour samsecure_api_ro (les ALTER DEFAULT PRIVILEGES
-- du 001 couvrent le cas ou la migration est jouee par samsecure_app, le
-- GRANT explicite securise les autres cas).
GRANT SELECT ON code_retour TO samsecure_api_ro;

COMMIT;
