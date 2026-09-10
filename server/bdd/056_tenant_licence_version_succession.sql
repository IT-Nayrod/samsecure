-- ============================================================================
-- SamSecure - BDD Tenant - Migration 056
-- Fichier   : 056_tenant_licence_version_succession.sql
-- Objet     : story #209, logique version / edition / maintenance (D58 a D60)
--             et continuite des renouvellements (D35).
--             Existant inventorie avant ecriture : licence.id_version (version
--             courante), licence.version_figee_id et date_arret_maintenance
--             (version figee a l'arret de la maintenance, 002), table
--             maintenance_historique (periodes de maintenance, sans version).
--             La regle "version figee a l'arret" est donc deja portee par le
--             schema ; manquent la version portee par chaque periode de
--             maintenance et l'historique des changements de version, qui ne
--             doit jamais etre reconstitue depuis les logs. Ajouts, tous
--             NULLables ou nouvelle table :
--             1) maintenance_historique.id_version : version apportee par la
--                periode (lien logique vers version, BDD Commune). Sur une
--                licence dont le type gere la version, la version courante
--                suit la periode la plus recente tant que la maintenance n'est
--                pas arretee (D59) ;
--             2) table licence_version_historique : un enregistrement par
--                changement de version d'une licence (avant, apres, evenement,
--                periode de maintenance a l'origine, date d'effet, auteur),
--                ecrit par l'API dans la meme transaction que le changement ;
--             3) lien de succession (D35) : contrat.id_contrat_predecesseur et
--                licence.id_licence_predecesseur. Le successeur pointe vers ce
--                qu'il renouvelle ; le planificateur des notifications ne
--                cree plus d'alerte d'echeance (echeance_contrat,
--                echeance_souscription) pour une entite qui a un successeur.
--                Aucun lien de succession n'existait dans le schema avant
--                cette migration (id_contrat_parent est un rattachement a un
--                contrat cadre, pas une succession).
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 002 (licence, maintenance_historique, contrat, utilisateur), 055.
-- Rejouable : ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS, CREATE
--             INDEX IF NOT EXISTS, contraintes sous garde pg_constraint.
--             Aucune suppression, aucune donnee modifiee.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Version portee par la periode de maintenance (D59)
-- ----------------------------------------------------------------------------
ALTER TABLE maintenance_historique ADD COLUMN IF NOT EXISTS id_version UUID;
COMMENT ON COLUMN maintenance_historique.id_version IS 'Version apportee par la periode de maintenance (lien logique vers version, BDD Commune, resolu par l''API). La version courante de la licence suit la periode la plus recente tant que la maintenance n''est pas arretee (D59).';

-- ----------------------------------------------------------------------------
-- 2. Historique des changements de version d'une licence (D60)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS licence_version_historique (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_licence       UUID NOT NULL REFERENCES licence(id) ON DELETE CASCADE,
  id_version_avant UUID,  -- lien logique vers version (BDD Commune)
  id_version_apres UUID,  -- lien logique vers version (BDD Commune)
  evenement        VARCHAR(30) NOT NULL,
  id_maintenance   UUID REFERENCES maintenance_historique(id) ON DELETE SET NULL,
  date_effet       DATE NOT NULL DEFAULT CURRENT_DATE,
  id_auteur        UUID REFERENCES utilisateur(id),
  created_at       TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT ck_lvh_evenement CHECK (evenement IN ('modification', 'maintenance', 'arret_maintenance', 'reprise_maintenance'))
);
COMMENT ON TABLE  licence_version_historique IS 'Historique des changements de version d''une licence (D60) : ecrit par l''API dans la transaction du changement, jamais reconstitue depuis les logs.';
COMMENT ON COLUMN licence_version_historique.evenement IS 'modification (saisie directe), maintenance (version apportee par une periode), arret_maintenance (version figee), reprise_maintenance (version liberee).';
COMMENT ON COLUMN licence_version_historique.date_effet IS 'Date metier du changement : debut de la periode de maintenance, date d''arret, sinon jour de la saisie.';

CREATE INDEX IF NOT EXISTS idx_lvh_licence ON licence_version_historique (id_licence, created_at);

-- ----------------------------------------------------------------------------
-- 3. Liens de succession (D35) : le successeur pointe vers son predecesseur
-- ----------------------------------------------------------------------------
ALTER TABLE contrat ADD COLUMN IF NOT EXISTS id_contrat_predecesseur UUID REFERENCES contrat(id);
COMMENT ON COLUMN contrat.id_contrat_predecesseur IS 'Contrat renouvele par celui-ci (D35). Un contrat qui a un successeur ne declenche plus d''alerte d''echeance.';

ALTER TABLE licence ADD COLUMN IF NOT EXISTS id_licence_predecesseur UUID REFERENCES licence(id);
COMMENT ON COLUMN licence.id_licence_predecesseur IS 'Licence (souscription, maintenance) renouvelee par celle-ci (D35). Une licence qui a un successeur ne declenche plus d''alerte d''echeance de souscription.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_contrat_predecesseur_distinct') THEN
    ALTER TABLE contrat ADD CONSTRAINT ck_contrat_predecesseur_distinct
      CHECK (id_contrat_predecesseur IS NULL OR id_contrat_predecesseur <> id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_licence_predecesseur_distinct') THEN
    ALTER TABLE licence ADD CONSTRAINT ck_licence_predecesseur_distinct
      CHECK (id_licence_predecesseur IS NULL OR id_licence_predecesseur <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contrat_predecesseur ON contrat (id_contrat_predecesseur);
CREATE INDEX IF NOT EXISTS idx_licence_predecesseur ON licence (id_licence_predecesseur);

COMMIT;
