-- ============================================================================
-- SamSecure - BDD Tenant - Migration 049
-- Fichier   : 049_tenant_contact_referentiel.sql
-- Objet     : ouverture du referentiel contact a la saisie (module 4, #181).
--             La table existait depuis 002 mais n'etait lue ni ecrite par
--             aucune route : l'ecran Contacts vivait sur des donnees de
--             demonstration.
--
--             Evolution v4.1, justifiee au journal de la story : le schema v4
--             ne portait ni le rattachement du contact a son entite (societe
--             du groupe, editeur ou revendeur) ni sa periode d'activite, que
--             l'ecran affiche depuis toujours. Ajouts, tous nullables :
--             - id_societe, id_editeur, id_revendeur : trois FK optionnelles,
--               au plus une renseignee (ck_contact_rattachement_unique).
--               Forme choisie plutot qu'un couple type/id polymorphe pour
--               garder de vraies cles etrangeres ;
--             - date_debut et date_fin : periode d'activite, la fin echue vaut
--               contact inactif (pas de colonne actif : un contact parti est
--               un contact dont la mission est terminee, l'etat se deduit) ;
--             - updated_at et son trigger, comme revendeur (044).
--
--             Les fonctions normaliser_texte() et cle_rapprochement() de la
--             044 portent la recherche insensible aux accents et le
--             rapprochement des noms ("Lemoine Henri" / "henri lemoine").
--
--             Unicite de l'adresse email : garde-fou de derniere ligne, comme
--             uq_revendeur_siret. La detection de doublon est applicative et
--             rend l'existant en proposition ; cet index n'attrape que la
--             course entre deux creations simultanees. Partiel, l'email etant
--             facultatif.
--             Pendant Commune : 048 (codes retour 5240-5259).
-- Cible     : PostgreSQL 16 - base Tenant, apres 044
-- Rejouable : ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--             DROP TRIGGER avant CREATE, contraintes sous garde pg_constraint.
-- Attention : la creation de l'index unique echoue si deux contacts portent
--             deja la meme adresse email. C'est voulu : mieux vaut un echec
--             bruyant qu'un dedoublonnage automatique. Diagnostic :
--               SELECT lower(email), count(*) FROM contact
--                WHERE email IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Rattachement, periode d'activite, horodatage
-- ----------------------------------------------------------------------------

ALTER TABLE contact ADD COLUMN IF NOT EXISTS id_societe   UUID REFERENCES societe(id);
ALTER TABLE contact ADD COLUMN IF NOT EXISTS id_editeur   UUID REFERENCES editeur(id);
ALTER TABLE contact ADD COLUMN IF NOT EXISTS id_revendeur UUID REFERENCES revendeur(id);
ALTER TABLE contact ADD COLUMN IF NOT EXISTS date_debut   DATE;
ALTER TABLE contact ADD COLUMN IF NOT EXISTS date_fin     DATE;
ALTER TABLE contact ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMP NOT NULL DEFAULT now();

-- set_updated_at() est definie en 002 et deja portee par editeur, contrat,
-- commande, licence, produit_client et revendeur.
DROP TRIGGER IF EXISTS trg_contact_updated_at ON contact;
CREATE TRIGGER trg_contact_updated_at
  BEFORE UPDATE ON contact
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ADD CONSTRAINT n'a pas de IF NOT EXISTS : garde applicative pour rester
-- rejouable.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_contact_dates') THEN
    ALTER TABLE contact ADD CONSTRAINT ck_contact_dates
      CHECK (date_fin IS NULL OR date_debut IS NULL OR date_fin >= date_debut);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_contact_rattachement_unique') THEN
    ALTER TABLE contact ADD CONSTRAINT ck_contact_rattachement_unique
      CHECK ((id_societe IS NOT NULL)::int + (id_editeur IS NOT NULL)::int
             + (id_revendeur IS NOT NULL)::int <= 1);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Index
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_contact_societe   ON contact (id_societe);
CREATE INDEX IF NOT EXISTS idx_contact_editeur   ON contact (id_editeur);
CREATE INDEX IF NOT EXISTS idx_contact_revendeur ON contact (id_revendeur);

-- Egalite et prefixe sur le nom complet normalise, et rapprochement des
-- doublons. L'expression (coalesce || ' ' ||) est immutable, contrairement a
-- CONCAT : c'est elle que le routeur emploie, a l'identique, pour que l'index
-- serve. La recherche par fragment garde un joker en tete et reste un parcours
-- sequentiel, comme pour les revendeurs.
CREATE INDEX IF NOT EXISTS idx_contact_nom_norm
  ON contact (normaliser_texte(coalesce(prenom, '') || ' ' || nom));
CREATE INDEX IF NOT EXISTS idx_contact_cle_rapprochement
  ON contact (cle_rapprochement(coalesce(prenom, '') || ' ' || nom));

CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_email
  ON contact (lower(email)) WHERE email IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Commentaires
-- ----------------------------------------------------------------------------

COMMENT ON COLUMN contact.id_societe IS
  'Rattachement optionnel a une societe du groupe. Au plus un rattachement par contact (ck_contact_rattachement_unique). Evolution v4.1 (#181).';
COMMENT ON COLUMN contact.id_editeur IS
  'Rattachement optionnel a un editeur. Au plus un rattachement par contact. Evolution v4.1 (#181).';
COMMENT ON COLUMN contact.id_revendeur IS
  'Rattachement optionnel a un revendeur. Au plus un rattachement par contact. Evolution v4.1 (#181).';
COMMENT ON COLUMN contact.date_debut IS
  'Debut de la periode d''activite du contact, optionnel. Evolution v4.1 (#181).';
COMMENT ON COLUMN contact.date_fin IS
  'Fin de la periode d''activite. Une date echue vaut contact inactif : il n''y a pas de colonne actif. Evolution v4.1 (#181).';
COMMENT ON COLUMN contact.updated_at IS
  'Horodatage de derniere modification, tenu par trg_contact_updated_at.';

COMMIT;
