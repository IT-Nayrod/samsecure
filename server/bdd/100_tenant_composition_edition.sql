-- ============================================================================
-- SamSecure - BDD Tenant - Migration 100
-- Fichier   : 100_tenant_composition_edition.sql
-- Objet     : composition d'un logiciel compose par edition (#279, decision
--             client du 06/10/2026). Exemple du client : Office Standard et
--             Office Pro different par la presence d'Access, impossible a
--             modeliser avec la seule composition par defaut (#216, 068).
--             La composition par defaut (produit_composition) reste la base ;
--             la composition effective d'une edition du compose vaut le
--             defaut plus ou moins ses exceptions :
--               - inclus = false : le composant du defaut est retire de
--                 cette edition ;
--               - inclus = true : un logiciel hors du defaut est ajoute a
--                 cette edition (couvert par les seules licences du compose
--                 portant cette edition).
--             Une licence du compose sans edition couvre la composition par
--             defaut. Un compose sans exception se comporte exactement
--             comme avant ce chantier. Seule l'edition conditionne la
--             composition, jamais la version (a valider par le client,
--             point 4 du cadrage).
--             1) Table produit_composition_exception : triplet (compose,
--                edition, composant) unique, porteur du sens inclus/exclu.
--                Compose, edition et composant sont des liens logiques sans
--                cle etrangere : l'edition vit en BDD Commune (edition), en
--                complement Tenant (edition_complement) ou en edition_client,
--                comme licence.id_edition. La coherence (edition du compose,
--                meme editeur, exclu sur un composant du defaut, inclus hors
--                du defaut) est portee par l'API ; la regle de lecture
--                tolere les lignes redondantes, sans effet par construction
--                de la formule (defaut - exclusions) + inclusions.
--             2) Un seul niveau, comme la 068 : une ligne inclus ne peut ni
--                viser un logiciel lui-meme compose (par defaut ou par
--                edition), ni faire d'un composant un compose. Garde par
--                trigger face a une ecriture SQL directe, en plus des refus
--                lisibles de l'API (code 4066).
--             3) Conformite : poser, retourner ou retirer une exception
--                deplace les droits herites du composant vise ; trigger
--                miroir de trg_produit_composition_conformite (068). La
--                regle de couverture par edition elle-meme est portee par la
--                migration 101 (CREATE OR REPLACE des fonctions d'heritage).
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool).
-- Exécution : npm run migrate:dev / migrate:staging.
-- Depend    : 068 (produit_composition, conformite_droits_propres,
--             recalculer_precalcul_conformite_ligne nee en 046 et revisee
--             058, 065, 068 puis 096), 002 (licence, utilisateur).
-- Rejouable : CREATE TABLE et CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE
--             (fonctions et triggers, PostgreSQL 14 et suivants). Aucune
--             suppression.
-- Numero    : 100 (Tenant) reserve pour ce chantier avec le 101, libre sur
--             toutes les branches locales et distantes connues au 07/10/2026.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Table des exceptions de composition par edition
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produit_composition_exception (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produit_compose    UUID NOT NULL,  -- lien logique : produit_referentiel (BDD Commune) ou produit_client
  id_edition            UUID NOT NULL,  -- lien logique : edition (BDD Commune), edition_complement ou edition_client
  id_produit_composant  UUID NOT NULL,  -- lien logique : produit_referentiel (BDD Commune) ou produit_client
  inclus                BOOLEAN NOT NULL,
  id_auteur             UUID REFERENCES utilisateur(id),
  created_at            TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_produit_composition_exception_triplet
    UNIQUE (id_produit_compose, id_edition, id_produit_composant),
  CONSTRAINT ck_produit_composition_exception_distincts
    CHECK (id_produit_compose <> id_produit_composant)
);

COMMENT ON TABLE produit_composition_exception IS
  'Exceptions de composition par édition d''un logiciel composé (#279, décision client du 06/10/2026). La composition par défaut (produit_composition) reste la base : la composition effective d''une édition vaut le défaut moins ses exclusions (inclus = false) plus ses inclusions (inclus = true). Une licence du composé sans édition couvre la composition par défaut. Seules les différences au défaut sont enregistrées.';
COMMENT ON COLUMN produit_composition_exception.id_produit_compose IS
  'Logiciel composé porteur de l''exception. Lien logique vers produit_referentiel (BDD Commune) ou produit_client, résolu par l''API.';
COMMENT ON COLUMN produit_composition_exception.id_edition IS
  'Édition du logiciel composé que l''exception conditionne. Lien logique vers edition (BDD Commune), edition_complement ou edition_client, comme licence.id_edition. Seule l''édition conditionne la composition, jamais la version.';
COMMENT ON COLUMN produit_composition_exception.id_produit_composant IS
  'Logiciel composant visé, du même éditeur que le composé (contrôle porté par l''API). Lien logique vers produit_referentiel (BDD Commune) ou produit_client.';
COMMENT ON COLUMN produit_composition_exception.inclus IS
  'true : le composant, hors de la composition par défaut, est ajouté à cette édition. false : le composant du défaut est retiré de cette édition.';

-- L'unicite du triplet sert la lecture par compose (grille de la fiche) ; la
-- lecture par composant (heritage des droits, 101) et la purge a la
-- suppression d'une edition client ont leurs propres index.
CREATE INDEX IF NOT EXISTS idx_produit_composition_exception_composant
  ON produit_composition_exception (id_produit_composant);
CREATE INDEX IF NOT EXISTS idx_produit_composition_exception_edition
  ON produit_composition_exception (id_edition);

-- ----------------------------------------------------------------------------
-- 2. Un seul niveau (v0.5), comme la 068 : une inclusion par edition ne cree
--    jamais un deuxieme etage de composition. L'API refuse avant d'ecrire
--    (4066) ; ce trigger tient la regle face a une ecriture SQL directe.
--    Une exclusion (inclus = false) ne cree aucun couple : pas de garde.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_produit_composition_exception_niveau() RETURNS trigger AS $$
BEGIN
  IF NEW.inclus THEN
    IF EXISTS (SELECT 1 FROM produit_composition pc
                WHERE pc.id_produit_compose = NEW.id_produit_composant)
       OR EXISTS (SELECT 1 FROM produit_composition_exception pe
                   WHERE pe.id_produit_compose = NEW.id_produit_composant
                     AND pe.inclus AND pe.id <> NEW.id) THEN
      RAISE EXCEPTION 'Un logiciel composé ne peut pas être composant d''un autre logiciel composé (composant %).', NEW.id_produit_composant
        USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM produit_composition pc
                WHERE pc.id_produit_composant = NEW.id_produit_compose)
       OR EXISTS (SELECT 1 FROM produit_composition_exception pe
                   WHERE pe.id_produit_composant = NEW.id_produit_compose
                     AND pe.inclus AND pe.id <> NEW.id) THEN
      RAISE EXCEPTION 'Un logiciel déjà composant d''un logiciel composé ne peut pas devenir composé (composé %).', NEW.id_produit_compose
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_produit_composition_exception_niveau_biu
  BEFORE INSERT OR UPDATE ON produit_composition_exception
  FOR EACH ROW EXECUTE FUNCTION trg_produit_composition_exception_niveau();

-- ----------------------------------------------------------------------------
-- 3. Conformite : une exception posee, retournee ou retiree deplace les
--    droits herites du composant vise. Miroir de la 068 (section 7) : seule
--    la ligne du composant bouge, celle du compose ne lit jamais ses
--    composants, et l'heritage ne cree pas de ligne (porteur de licence
--    seulement). Avant la 101, la fonction de ligne (096) ignore l'edition :
--    sans effet, la table nait vide dans la meme passe de migrations.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_produit_composition_exception_conformite() RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF EXISTS (SELECT 1 FROM licence l WHERE l.id_produit = OLD.id_produit_composant) THEN
      PERFORM recalculer_precalcul_conformite_ligne(OLD.id_produit_composant);
    END IF;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF EXISTS (SELECT 1 FROM licence l WHERE l.id_produit = NEW.id_produit_composant) THEN
      PERFORM recalculer_precalcul_conformite_ligne(NEW.id_produit_composant);
    END IF;
  END IF;
  RETURN NULL;  -- AFTER trigger, la valeur de retour est ignoree
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_produit_composition_exception_conformite_aiud
  AFTER INSERT OR UPDATE OR DELETE ON produit_composition_exception
  FOR EACH ROW EXECUTE FUNCTION trg_produit_composition_exception_conformite();

COMMIT;
