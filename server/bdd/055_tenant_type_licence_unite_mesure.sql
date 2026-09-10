-- ============================================================================
-- SamSecure - BDD Tenant - Migration 055
-- Fichier   : 055_tenant_type_licence_unite_mesure.sql
-- Objet     : stories #209 (types de licences) et #210 (metriques).
--             1) referentiel type_licence : sept valeurs decidees par le client
--                (perpetuelle, souscription, essai, open_source, gratuiciel,
--                education, gouvernement) avec, pour chacune, la regle de la
--                date de debut et de la date de fin (obligatoire, facultative
--                ou masquee) et la gestion ou non de la version (D58 : pas de
--                version sur les souscriptions). Jusqu'ici le type etait un
--                CHECK (perpetuelle | souscription) sur licence.type : la
--                colonne est elargie a VARCHAR(30), le CHECK est remplace par
--                une cle etrangere vers type_licence(code). Les deux valeurs
--                existantes sont seedees en premier : aucune licence ne change
--                de type ;
--             2) licence.date_debut (DATE, NULLable) : la date de debut n'etait
--                pas modelisee, la date de fin reste date_fin_souscription
--                (colonne conservee telle quelle, lue par la conformite 046,
--                le planificateur des notifications et le front) ;
--             3) unite_mesure : passage a huit valeurs (utilisateur nomme,
--                utilisateur concurrent ou flottant, serveur ou poste, core,
--                processeur ou socket, consommation, transaction ou volume,
--                gratuit). Les codes existants utilisateur_nomme et core
--                portent deja le libelle attendu et sont conserves ; device,
--                cpu et serveur sont conserves sans remappage (libelles
--                differents, remappage non trivial) et ne sont plus proposes
--                par le formulaire licence (liste fermee cote front) ; les six
--                autres valeurs sont ajoutees. Motif protege de la 003 : une
--                ligne personnalisee par le client n'est jamais reecrite.
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 002 (licence, unite_mesure), 003 (seed unite_mesure).
-- Rejouable : CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, ON
--             CONFLICT (code) DO UPDATE, contraintes sous garde pg_constraint.
--             Aucune suppression de table, de colonne ni de donnee : le seul
--             DROP est celui du CHECK licence_type_check, remplace dans la
--             meme transaction par la cle etrangere (impossible d'elargir un
--             CHECK autrement).
-- Numero    : 053 et 054 sont absents de server/bdd et de origin/dev
--             (reserves aux chantiers paralleles preuves et conformite) ; 055
--             et 056 sont les numeros prevus par le protocole et sont libres.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Referentiel type_licence
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS type_licence (
  code             VARCHAR(30)  PRIMARY KEY,
  label            VARCHAR(100) NOT NULL,
  regle_date_debut VARCHAR(12)  NOT NULL DEFAULT 'facultative',
  regle_date_fin   VARCHAR(12)  NOT NULL DEFAULT 'masquee',
  version_geree    BOOLEAN      NOT NULL DEFAULT true,
  ordre            SMALLINT     NOT NULL DEFAULT 0,
  actif            BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMP    NOT NULL DEFAULT now(),
  CONSTRAINT ck_type_licence_regle_debut CHECK (regle_date_debut IN ('obligatoire', 'facultative', 'masquee')),
  CONSTRAINT ck_type_licence_regle_fin   CHECK (regle_date_fin   IN ('obligatoire', 'facultative', 'masquee'))
);
COMMENT ON TABLE  type_licence IS 'Types de licences (#209) : sept valeurs decidees par le client, chacune avec sa regle de dates. Referentiel technique, la derniere livraison fait foi.';
COMMENT ON COLUMN type_licence.regle_date_debut IS 'Regle de la date de debut de la licence : obligatoire, facultative (affichee, optionnelle) ou masquee (jamais stockee).';
COMMENT ON COLUMN type_licence.regle_date_fin   IS 'Regle de la date de fin (licence.date_fin_souscription) : obligatoire, facultative ou masquee.';
COMMENT ON COLUMN type_licence.version_geree    IS 'false : la licence ne porte pas de version (D58, souscriptions). true : version portee par la maintenance et figee a son arret (D59).';
COMMENT ON COLUMN type_licence.actif            IS 'false : valeur conservee pour les licences existantes mais plus proposee a la saisie.';

-- Les deux valeurs historiques d'abord (les licences existantes les portent),
-- puis les cinq nouvelles. Regles de dates decidees par le client :
--   perpetuelle          : date de debut, pas de fin
--   souscription         : debut et fin
--   essai                : debut et fin
--   open_source          : ni debut ni fin
--   gratuiciel           : ni debut ni fin
--   education            : regles de la perpetuelle par defaut
--   gouvernement         : regles de la perpetuelle par defaut
-- La date de debut est "facultative" (affichee, non bloquante) pour ne pas
-- rendre non modifiables les licences anterieures a cette migration, qui n'en
-- ont pas ; la date de fin des souscriptions et des essais reste obligatoire
-- (elle l'etait deja pour les souscriptions). Durcir la regle est une simple
-- mise a jour de cette table, sans code.
INSERT INTO type_licence (code, label, regle_date_debut, regle_date_fin, version_geree, ordre) VALUES
  ('perpetuelle',  'Licence perpétuelle',        'facultative', 'masquee',     true,  10),
  ('souscription', 'Souscription ou abonnement', 'facultative', 'obligatoire', false, 20),
  ('essai',        'Version d''essai',           'facultative', 'obligatoire', true,  30),
  ('open_source',  'Open source',                'masquee',     'masquee',     true,  40),
  ('gratuiciel',   'Gratuiciel',                 'masquee',     'masquee',     true,  50),
  ('education',    'Éducation',                  'facultative', 'masquee',     true,  60),
  ('gouvernement', 'Gouvernement',               'facultative', 'masquee',     true,  70)
ON CONFLICT (code) DO UPDATE SET
  label            = EXCLUDED.label,
  regle_date_debut = EXCLUDED.regle_date_debut,
  regle_date_fin   = EXCLUDED.regle_date_fin,
  version_geree    = EXCLUDED.version_geree,
  ordre            = EXCLUDED.ordre;

-- ----------------------------------------------------------------------------
-- 2. licence.type : VARCHAR(30), cle etrangere vers type_licence a la place du
--    CHECK (perpetuelle | souscription). Les valeurs presentes sont toutes
--    seedees ci-dessus : la contrainte passe sans toucher aux lignes.
-- ----------------------------------------------------------------------------
ALTER TABLE licence ALTER COLUMN type TYPE VARCHAR(30);

DO $$
DECLARE
  nom_check TEXT;
BEGIN
  -- Le CHECK de la 002 n'est pas nomme : on retrouve son nom par sa definition.
  SELECT conname INTO nom_check
    FROM pg_constraint
   WHERE conrelid = 'licence'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%perpetuelle%souscription%';
  IF nom_check IS NOT NULL THEN
    EXECUTE format('ALTER TABLE licence DROP CONSTRAINT %I', nom_check);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_licence_type') THEN
    ALTER TABLE licence ADD CONSTRAINT fk_licence_type
      FOREIGN KEY (type) REFERENCES type_licence(code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_licence_type ON licence (type);

-- ----------------------------------------------------------------------------
-- 3. licence.date_debut (NULLable : les licences existantes n'en ont pas)
-- ----------------------------------------------------------------------------
ALTER TABLE licence ADD COLUMN IF NOT EXISTS date_debut DATE;
COMMENT ON COLUMN licence.date_debut IS 'Date de debut des droits (#209), selon la regle du type (type_licence.regle_date_debut). La date de fin reste date_fin_souscription.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_licence_dates') THEN
    ALTER TABLE licence ADD CONSTRAINT ck_licence_dates
      CHECK (date_debut IS NULL OR date_fin_souscription IS NULL OR date_fin_souscription >= date_debut);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Unites de mesure : huit valeurs (#210), motif protege de la 003
-- ----------------------------------------------------------------------------
INSERT INTO unite_mesure (code, label, description, valeurs_defaut) VALUES
  ('utilisateur_nomme',      'Utilisateur nommé',                  'Décompte par utilisateur identifié',                  '{"label": "Utilisateur nommé", "description": "Décompte par utilisateur identifié"}'),
  ('utilisateur_concurrent', 'Utilisateur concurrent ou flottant', 'Décompte par utilisateur simultané',                  '{"label": "Utilisateur concurrent ou flottant", "description": "Décompte par utilisateur simultané"}'),
  ('serveur_poste',          'Serveur ou poste',                   'Décompte par serveur, poste ou équipement',           '{"label": "Serveur ou poste", "description": "Décompte par serveur, poste ou équipement"}'),
  ('core',                   'Core',                               'Décompte par coeur de processeur',                    '{"label": "Core", "description": "Décompte par coeur de processeur"}'),
  ('processeur_socket',      'Processeur ou socket',               'Décompte par processeur physique ou socket',          '{"label": "Processeur ou socket", "description": "Décompte par processeur physique ou socket"}'),
  ('consommation',           'Consommation',                       'Décompte à la consommation (usage mesuré)',           '{"label": "Consommation", "description": "Décompte à la consommation (usage mesuré)"}'),
  ('transaction_volume',     'Transaction ou volume',              'Décompte par transaction ou par volume traité',       '{"label": "Transaction ou volume", "description": "Décompte par transaction ou par volume traité"}'),
  ('gratuit',                'Gratuit',                            'Sans décompte : licence gratuite',                    '{"label": "Gratuit", "description": "Sans décompte : licence gratuite"}')
ON CONFLICT (code) DO UPDATE SET
  label          = CASE WHEN unite_mesure.personnalise THEN unite_mesure.label       ELSE EXCLUDED.label       END,
  description    = CASE WHEN unite_mesure.personnalise THEN unite_mesure.description ELSE EXCLUDED.description END,
  valeurs_defaut = EXCLUDED.valeurs_defaut;

COMMENT ON TABLE unite_mesure IS 'Métriques de licensing (#210) : huit valeurs proposées (utilisateur nommé, utilisateur concurrent ou flottant, serveur ou poste, core, processeur ou socket, consommation, transaction ou volume, gratuit). device, cpu et serveur sont conservés pour les licences existantes, plus proposés à la saisie.';

COMMIT;
