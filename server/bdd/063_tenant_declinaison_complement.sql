-- ============================================================================
-- SamSecure - BDD Tenant - Migration 063
-- Fichier   : 063_tenant_declinaison_complement.sql
-- Objet     : story #209, decision de la reunion client du 11/09/2026 :
--             versions et editions ajoutables depuis les formulaires de
--             licence et de maintenance.
--             Existant inventorie avant ecriture : les formulaires de licence
--             et de maintenance ne proposent que les produits du catalogue
--             global (produit_referentiel, BDD Commune, GET /produits) et
--             leurs declinaisons version et edition (BDD Commune, listes
--             fermees, aucune route d'ecriture : le catalogue global est en
--             lecture seule depuis un espace client, doctrine 001/002/040,
--             refus 5316 dans logiciels.js). Les tables version_client et
--             edition_client (040) ne recoivent que les declinaisons des
--             produits client (FK vers produit_client) : un produit du
--             catalogue ne peut pas y ecrire. Une licence sur un produit du
--             catalogue dont la version n'est pas au catalogue etait donc
--             bloquee : c'est l'ecart constate par le client.
--             Ajout : version_complement et edition_complement, declinaisons
--             ajoutees par le client a un produit du catalogue global, stockees
--             en Tenant (jamais en Commune : une ecriture Commune s'imposerait
--             a tous les clients). id_produit est un lien logique vers
--             produit_referentiel (BDD Commune, pas de FK possible), resolu par
--             l'API comme licence.id_produit. Unicite par produit sur un
--             libelle normalise (minuscules, sans accents ni espaces
--             superflus, calcule par l'API) : le controle des doublons est
--             insensible a la casse et aux accents sans dependre d'une
--             extension PostgreSQL. licence.id_version, licence.id_edition,
--             licence.version_figee_id, maintenance_historique.id_version et
--             licence_version_historique.id_version_* deviennent des liens
--             logiques vers version / edition (Commune) OU vers ces
--             complements : l'API resout les deux sources.
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 002 (utilisateur).
-- Rejouable : CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.
--             Aucune suppression, aucune donnee modifiee.
-- Numero    : 062 et 063 prevus par le protocole, libres sur origin/dev.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS version_complement (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produit       UUID NOT NULL,  -- lien logique vers produit_referentiel (BDD Commune)
  label            VARCHAR(100) NOT NULL,
  label_normalise  VARCHAR(100) NOT NULL,
  id_auteur        UUID REFERENCES utilisateur(id),
  created_at       TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_version_complement_produit_label UNIQUE (id_produit, label_normalise)
);
COMMENT ON TABLE  version_complement IS 'Versions ajoutees par le client a un produit du catalogue global (decision du 11/09/2026). Complement Tenant de version (BDD Commune), jamais ecrit en Commune. id_produit est un lien logique vers produit_referentiel.';
COMMENT ON COLUMN version_complement.label_normalise IS 'Libelle en minuscules, sans accents ni espaces superflus, calcule par l''API : porte l''unicite par produit, insensible a la casse et aux accents.';

CREATE TABLE IF NOT EXISTS edition_complement (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produit       UUID NOT NULL,  -- lien logique vers produit_referentiel (BDD Commune)
  label            VARCHAR(100) NOT NULL,
  label_normalise  VARCHAR(100) NOT NULL,
  id_auteur        UUID REFERENCES utilisateur(id),
  created_at       TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_edition_complement_produit_label UNIQUE (id_produit, label_normalise)
);
COMMENT ON TABLE  edition_complement IS 'Editions ajoutees par le client a un produit du catalogue global (decision du 11/09/2026). Complement Tenant de edition (BDD Commune), jamais ecrit en Commune. id_produit est un lien logique vers produit_referentiel.';
COMMENT ON COLUMN edition_complement.label_normalise IS 'Libelle en minuscules, sans accents ni espaces superflus, calcule par l''API : porte l''unicite par produit, insensible a la casse et aux accents.';

CREATE INDEX IF NOT EXISTS idx_version_complement_produit ON version_complement (id_produit);
CREATE INDEX IF NOT EXISTS idx_edition_complement_produit ON edition_complement (id_produit);

COMMIT;
