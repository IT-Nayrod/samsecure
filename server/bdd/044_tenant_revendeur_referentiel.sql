-- ============================================================================
-- SamSecure - BDD Tenant - Migration 044
-- Fichier   : 044_tenant_revendeur_referentiel.sql
-- Objet     : ouverture du referentiel revendeur a la saisie (module 1).
--
--             1) actif : un revendeur ne se supprime pas. Quatre tables le
--                referencent (contrat, commande, licence,
--                maintenance_historique) et ces lignes doivent continuer de le
--                nommer. Le retrait est donc une desactivation, reversible,
--                sur le modele acte par la migration 022 pour utilisateur.
--                date_suppression n'est volontairement pas reprise : la 022 l'a
--                justement abandonnee.
--
--             2) updated_at et son trigger, comme editeur et contrat.
--
--             3) normaliser_texte() et cle_rapprochement(), qui portent la
--                recherche insensible aux accents et la detection de doublon.
--                Aucune extension : unaccent et pg_trgm ne sont pas installes
--                et leur pose demande des droits que le role applicatif n'a
--                pas. translate() suffit, et reste IMMUTABLE donc indexable.
--
--             Unicite du SIRET : garde-fou de derniere ligne. La detection de
--             doublon est applicative et rend l'existant en proposition ; cet
--             index n'attrape que la course entre deux creations simultanees.
--             Partiel, le SIRET etant facultatif.
--             Pendant Commune : 045 (codes retour).
-- Cible     : PostgreSQL 16 - base Tenant, apres 043
-- Rejouable : ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--             CREATE INDEX IF NOT EXISTS, DROP TRIGGER avant CREATE.
-- Attention : la creation de l'index unique echoue si deux revendeurs portent
--             deja le meme SIRET. C'est voulu : mieux vaut un echec bruyant
--             qu'un dedoublonnage automatique qui choisirait a la place de
--             l'equipe. Diagnostic :
--               SELECT siret, count(*) FROM revendeur
--                WHERE siret IS NOT NULL GROUP BY siret HAVING count(*) > 1;
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Etat et horodatage
-- ----------------------------------------------------------------------------

ALTER TABLE revendeur ADD COLUMN IF NOT EXISTS actif      BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE revendeur ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_revendeur_updated_at ON revendeur;
CREATE TRIGGER trg_revendeur_updated_at
  BEFORE UPDATE ON revendeur
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN revendeur.actif IS
  'false = revendeur desactive : absent des selecteurs de saisie, mais toujours nomme par les contrats, commandes et licences qui le portent. Reversible.';

-- ----------------------------------------------------------------------------
-- 2. Normalisation du texte
-- ----------------------------------------------------------------------------

-- Minuscules et accents retires en une passe. Sert la recherche : le client qui
-- tape "econocom" doit trouver "Econocom", et celui qui tape "systemes" doit
-- trouver "Systèmes". Sans cette fonction il faudrait que la saisie porte les
-- memes accents que la fiche, ce qu'aucun utilisateur ne fera.
CREATE OR REPLACE FUNCTION normaliser_texte(txt text) RETURNS text AS $$
  SELECT lower(translate($1,
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
    'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'));
$$ LANGUAGE sql IMMUTABLE STRICT;

-- Cle de rapprochement : ce qui reste d'une raison sociale une fois retires les
-- accents, la casse, la forme juridique et toute ponctuation. Deux raisons
-- sociales de meme cle designent la meme entreprise ecrite autrement.
--   "SCC France"      -> sccfrance
--   "S.C.C. FRANCE"   -> sccfrance
--   "Bechtle France SAS" et "Bechtle France" -> bechtlefrance
--
-- L'ordre compte : les formes juridiques se retirent tant que les espaces
-- existent encore, les frontieres de mot etant ce qui evite de mutiler
-- "Sage" ou "Insight".
-- Le COALESCE couvre le cas limite d'une raison sociale qui ne serait faite que
-- d'une forme juridique : la cle vide rapprocherait alors tous ces cas entre
-- eux, on retombe donc sur le texte normalise.
CREATE OR REPLACE FUNCTION cle_rapprochement(txt text) RETURNS text AS $$
  SELECT COALESCE(
    NULLIF(
      regexp_replace(
        regexp_replace(
          normaliser_texte($1),
          '\m(sas|sasu|sarl|eurl|snc|sa|se|inc|corp|corporation|company|ltd|limited|gmbh|ag|bv|nv|plc|llc|group|groupe)\M',
          '', 'g'),
        '[^a-z0-9]', '', 'g'),
      ''),
    regexp_replace(normaliser_texte($1), '[^a-z0-9]', '', 'g'));
$$ LANGUAGE sql IMMUTABLE STRICT;

-- ----------------------------------------------------------------------------
-- 3. Index
-- ----------------------------------------------------------------------------

-- Egalite et prefixe sur le nom normalise, et rapprochement des doublons.
-- La recherche par fragment garde un joker en tete et reste un parcours
-- sequentiel : quelques millisecondes sur un referentiel de cette taille.
CREATE INDEX IF NOT EXISTS idx_revendeur_nom_norm
  ON revendeur (normaliser_texte(raison_sociale));
CREATE INDEX IF NOT EXISTS idx_revendeur_cle_rapprochement
  ON revendeur (cle_rapprochement(raison_sociale));
CREATE INDEX IF NOT EXISTS idx_revendeur_actif
  ON revendeur (actif) WHERE actif = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_revendeur_siret
  ON revendeur (siret) WHERE siret IS NOT NULL;

COMMIT;