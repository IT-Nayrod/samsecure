-- ============================================================================
-- SamSecure - BDD Tenant - Migration 072
-- Fichier   : 072_tenant_preuve_externe.sql
-- Objet     : ticket #220, regle client du 17/09/2026, preuve externe.
--             Une preuve peut etre declaree externe : le document vit dans un
--             autre systeme (GED, portail editeur, coffre-fort), designe soit
--             par une URL, soit par une reference libre.
--             - preuve.mode (VARCHAR(20), nullable, DEFAULT 'fichier') :
--               'fichier' (document depose dans SamSecure, comportement
--               d'origine), 'url' ou 'reference'. Le DEFAULT renseigne
--               'fichier' sur toutes les preuves existantes des l'ajout de la
--               colonne (aucun UPDATE de rattrapage) et sur les insertions qui
--               ne citent pas la colonne (depot de facture, factures.js,
--               inchange). Un mode NULL se lit comme 'fichier', dans la
--               contrainte comme dans l'API.
--             - preuve.url_externe (VARCHAR(2000), nullable) : adresse http ou
--               https du document externe (format controle par l'API, 3236).
--             - preuve.reference_externe (VARCHAR(500), nullable) : texte
--               identifiant le document dans son systeme d'origine (3237).
--             - preuve.url_fichier devient nullable : une preuve externe n'a
--               aucun fichier dans le stockage SamSecure, y poser une valeur
--               factice laisserait croire a un fichier servi. L'obligation
--               (NOT NULL de la 002) n'est pas levee pour autant : elle est
--               reprise par la contrainte de coherence pour le mode fichier,
--               qui garde donc exactement son comportement actuel.
--             - ck_preuve_mode : valeurs admises du mode.
--             - ck_preuve_mode_coherence : un seul support par preuve. Mode
--               fichier = url_fichier renseigne, sans URL ni reference ; mode
--               url = url_externe renseignee et non vide, sans fichier ni
--               reference ; mode reference = reference_externe renseignee et
--               non vide, sans fichier ni URL. Miroir applicatif :
--               server/utils/modePreuve.js (refus lisibles 3217, 3235 a 3237
--               plutot qu'une 23514 brute).
--             L'empreinte reutilise preuve.hash_sha256 (002) : calculee au
--             depot pour un fichier, saisie a la main et facultative pour une
--             preuve externe. Son format (64 caracteres hexadecimaux) reste
--             controle par l'API (3218) et non par une contrainte : des
--             valeurs anterieures non conformes feraient echouer la migration.
--             Validation, detection des manques et compteurs lisent la table
--             preuve sans regarder le support : une preuve externe y compte
--             comme une preuve deposee, sans autre changement de schema.
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool).
-- Exécution : npm run migrate:dev / migrate:staging, AVANT le deploiement de
--             l'API du ticket (la projection de GET /api/preuves lit les trois
--             colonnes).
-- Depend    : 002 (preuve, url_fichier, hash_sha256), 019 (nom_origine),
--             053 (id_licence), 066 (date_preuve).
-- Rejouable : ADD COLUMN IF NOT EXISTS, ALTER COLUMN ... DROP NOT NULL
--             (sans effet au second passage), contraintes ajoutees sous garde
--             pg_constraint, COMMENT idempotent. Aucune suppression de table,
--             de colonne ou de donnee, aucune modification de donnees. Le seul
--             mot DROP du fichier est le DROP NOT NULL de url_fichier, releve
--             de contrainte et non suppression de colonne.
-- Numero    : 072 reserve par le protocole du chantier, absent de server/bdd
--             et de toutes les branches locales et de suivi au 21/09/2026
--             (dernier numero present : 067).
-- ============================================================================

BEGIN;

ALTER TABLE preuve ADD COLUMN IF NOT EXISTS mode              VARCHAR(20) DEFAULT 'fichier';
ALTER TABLE preuve ADD COLUMN IF NOT EXISTS url_externe       VARCHAR(2000);
ALTER TABLE preuve ADD COLUMN IF NOT EXISTS reference_externe VARCHAR(500);

-- L'obligation de url_fichier passe du NOT NULL de colonne a la contrainte de
-- coherence ci-dessous, qui ne l'exige plus que pour le mode fichier.
ALTER TABLE preuve ALTER COLUMN url_fichier DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_preuve_mode') THEN
    ALTER TABLE preuve ADD CONSTRAINT ck_preuve_mode
      CHECK (mode IS NULL OR mode IN ('fichier', 'url', 'reference'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_preuve_mode_coherence') THEN
    ALTER TABLE preuve ADD CONSTRAINT ck_preuve_mode_coherence
      CHECK (
        CASE COALESCE(mode, 'fichier')
          WHEN 'fichier'   THEN url_fichier IS NOT NULL
                                AND url_externe IS NULL AND reference_externe IS NULL
          WHEN 'url'       THEN url_externe IS NOT NULL AND btrim(url_externe) <> ''
                                AND url_fichier IS NULL AND reference_externe IS NULL
          WHEN 'reference' THEN reference_externe IS NOT NULL AND btrim(reference_externe) <> ''
                                AND url_fichier IS NULL AND url_externe IS NULL
          ELSE false
        END
      );
  END IF;
END $$;

COMMENT ON COLUMN preuve.mode IS
  'Support de la preuve (#220) : fichier (document depose dans SamSecure, defaut), url (document externe designe par une adresse) ou reference (document externe designe par un texte libre). NULL se lit comme fichier.';
COMMENT ON COLUMN preuve.url_externe IS
  'Adresse http ou https du document externe, renseignee pour le seul mode url (#220).';
COMMENT ON COLUMN preuve.reference_externe IS
  'Reference libre identifiant le document dans un autre systeme, renseignee pour le seul mode reference (#220).';
COMMENT ON COLUMN preuve.url_fichier IS
  'Nom physique du fichier depose, obligatoire pour le mode fichier (ck_preuve_mode_coherence), NULL pour une preuve externe (#220).';
COMMENT ON COLUMN preuve.hash_sha256 IS
  'Empreinte SHA-256 du document : calculee au depot pour un fichier, saisie a la main et facultative pour une preuve externe (#220).';

COMMIT;
