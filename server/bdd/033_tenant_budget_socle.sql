-- ============================================================================
-- SamSecure - BDD Tenant - Migration 033
-- Fichier   : 033_tenant_budget_socle.sql
-- Objet     : socle donnees du module budget (US #146, M4-A).
--             1) Table budget : presente dans le DDL v4 (002, "nouvelle table,
--                Samuel, juillet") avec exactement les colonnes de la US
--                (id, id_licence, type, montant_capex, quantite_capex,
--                date_capex, montant_opex, quantite_opex, date_debut,
--                date_fin, created_at). Cette migration la cree si elle
--                manque (base partielle), la complete colonne par colonne
--                sinon, et ajoute ce que le DDL ne portait pas : montants et
--                quantites positifs ou nuls, au moins un montant par ligne,
--                commentaires. AUCUNE colonne organisation, contrat ou
--                editeur : l'organisation payeuse se deduit de la chaine
--                licence -> commande -> societe, l'editeur du contrat de la
--                commande. Le type ENUM de la US est porte par un CHECK,
--                convention 002 du projet (pas de type ENUM natif).
--             2) societe.debut_exercice_fiscal : DEFAULT au 1er janvier
--                (DATE '2000-01-01', seuls jour et mois significatifs, meme
--                sentinelle que tenant_config.debut_exercice_fiscal_defaut).
--                Colonne laissee nullable, aucune reprise : NULL garde le sens
--                "defaut du tenant", resolu par l'API et par les fonctions
--                ci-dessous.
--             3) Fonctions d'exercice fiscal, source unique du calcul cote
--                base et cote API : exercice_fiscal_de(date, debut),
--                exercice_fiscal_debut(exercice, debut),
--                exercice_fiscal_fin(exercice, debut). Un exercice est
--                identifie par l'annee civile de son premier jour, comme
--                src/utils/fiscalPeriod.js. Comparaison mois/jour et non
--                decalage en jours : le 29/02/2000 de la sentinelle
--                fausserait un calcul par intervalle.
-- Cible     : PostgreSQL 16 - base Tenant, a jouer sur dev ET staging
--             (aucun mot "commune" dans le nom : migrate.js route sur tenantPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 002 (budget, societe, tenant_config), 014 (licence sans
--             id_contrat), 016/017 (precalcul_financier, engage).
-- Note      : budget est vide en dev et en staging (aucune saisie possible
--             avant cette story) : les contraintes s'ajoutent sans reprise.
--             Elles sont posees sans NOT VALID pour qu'une base qui porterait
--             deja des lignes non conformes fasse echouer la migration
--             plutot que de les laisser passer en silence.
-- Rejouable : IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE, sans effet
--             sur une base deja conforme.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Table budget
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_licence     UUID NOT NULL REFERENCES licence(id),
  type           VARCHAR(15) NOT NULL CHECK (type IN ('previsionnel', 'alloue')),
  montant_capex  DECIMAL(12,2),
  quantite_capex DECIMAL(12,2),
  date_capex     DATE,
  montant_opex   DECIMAL(12,2),
  quantite_opex  DECIMAL(12,2),
  date_debut     DATE NOT NULL,
  date_fin       DATE NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT ck_budget_periode CHECK (date_fin >= date_debut)
);

-- Base partielle : chaque colonne de la US est garantie individuellement.
ALTER TABLE budget ADD COLUMN IF NOT EXISTS id_licence     UUID;
ALTER TABLE budget ADD COLUMN IF NOT EXISTS type           VARCHAR(15);
ALTER TABLE budget ADD COLUMN IF NOT EXISTS montant_capex  DECIMAL(12,2);
ALTER TABLE budget ADD COLUMN IF NOT EXISTS quantite_capex DECIMAL(12,2);
ALTER TABLE budget ADD COLUMN IF NOT EXISTS date_capex     DATE;
ALTER TABLE budget ADD COLUMN IF NOT EXISTS montant_opex   DECIMAL(12,2);
ALTER TABLE budget ADD COLUMN IF NOT EXISTS quantite_opex  DECIMAL(12,2);
ALTER TABLE budget ADD COLUMN IF NOT EXISTS date_debut     DATE;
ALTER TABLE budget ADD COLUMN IF NOT EXISTS date_fin       DATE;
ALTER TABLE budget ADD COLUMN IF NOT EXISTS created_at     TIMESTAMP NOT NULL DEFAULT now();

-- Base partielle, suite : les colonnes ajoutees ci-dessus le sont sans
-- contrainte, celles de la US sont reposees ici sous un nom stable. Sur une
-- base issue de 002, SET NOT NULL est sans effet, la FK existe deja
-- (budget_id_licence_fkey) et le CHECK inline budget_type_check est remplace
-- par ck_budget_type, meme regle.
ALTER TABLE budget ALTER COLUMN id_licence SET NOT NULL;
ALTER TABLE budget ALTER COLUMN type       SET NOT NULL;
ALTER TABLE budget ALTER COLUMN date_debut SET NOT NULL;
ALTER TABLE budget ALTER COLUMN date_fin   SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'budget'::regclass AND contype = 'f'
       AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                            WHERE attrelid = 'budget'::regclass AND attname = 'id_licence')]
  ) THEN
    ALTER TABLE budget ADD CONSTRAINT budget_id_licence_fkey
      FOREIGN KEY (id_licence) REFERENCES licence(id);
  END IF;
END $$;

ALTER TABLE budget DROP CONSTRAINT IF EXISTS budget_type_check;
ALTER TABLE budget DROP CONSTRAINT IF EXISTS ck_budget_type;
ALTER TABLE budget ADD CONSTRAINT ck_budget_type
  CHECK (type IN ('previsionnel', 'alloue'));

-- Contraintes absentes du DDL v4. Doublon volontaire des controles de l'API
-- (codes 5116, 5118 a 5122) : l'invariant tient meme en ecriture SQL directe.
ALTER TABLE budget DROP CONSTRAINT IF EXISTS ck_budget_periode;
ALTER TABLE budget ADD CONSTRAINT ck_budget_periode
  CHECK (date_fin >= date_debut);

ALTER TABLE budget DROP CONSTRAINT IF EXISTS ck_budget_montants;
ALTER TABLE budget ADD CONSTRAINT ck_budget_montants
  CHECK ((montant_capex  IS NULL OR montant_capex  >= 0)
     AND (quantite_capex IS NULL OR quantite_capex >= 0)
     AND (montant_opex   IS NULL OR montant_opex   >= 0)
     AND (quantite_opex  IS NULL OR quantite_opex  >= 0));

-- Une ligne sans aucun montant n'est pas une ligne budgetaire. Zero reste
-- admis : un alloue a zero est une decision, pas une absence de saisie.
ALTER TABLE budget DROP CONSTRAINT IF EXISTS ck_budget_un_montant;
ALTER TABLE budget ADD CONSTRAINT ck_budget_un_montant
  CHECK (montant_capex IS NOT NULL OR montant_opex IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_budget_licence ON budget (id_licence);
CREATE INDEX IF NOT EXISTS idx_budget_periode ON budget (date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_budget_type    ON budget (type);

COMMENT ON TABLE budget IS
  'Ligne budgetaire par licence et periode (US #146) : previsionnel ou alloue, CAPEX et OPEX. L''organisation payeuse se deduit de licence -> commande -> societe, l''editeur du contrat de la commande : jamais stockes ici. L''engage n''est pas dans cette table, il vient des commandes (precalcul_financier).';
COMMENT ON COLUMN budget.id_licence     IS 'Licence portee par la ligne. Seule cle de rattachement : societe, contrat et editeur s''en deduisent.';
COMMENT ON COLUMN budget.type           IS 'previsionnel (preparation, pre-rempli depuis la maintenance en cours) ou alloue (budget octroye, saisi).';
COMMENT ON COLUMN budget.montant_capex  IS 'Montant d''investissement (acquisition), positif ou nul.';
COMMENT ON COLUMN budget.quantite_capex IS 'Quantite associee au CAPEX (droits acquis).';
COMMENT ON COLUMN budget.date_capex     IS 'Date d''imputation du CAPEX ; a defaut, date_debut de la ligne.';
COMMENT ON COLUMN budget.montant_opex   IS 'Montant de fonctionnement (souscription, maintenance) sur la periode, positif ou nul.';
COMMENT ON COLUMN budget.quantite_opex  IS 'Quantite associee a l''OPEX (droits en souscription ou sous maintenance).';
COMMENT ON COLUMN budget.date_debut     IS 'Debut de la periode budgetaire, en general le premier jour d''un exercice fiscal de la societe payeuse.';
COMMENT ON COLUMN budget.date_fin       IS 'Fin de la periode budgetaire (>= date_debut).';

-- Semantique lue par le preremplissage budget (#146), hypothese v0.5 a faire
-- valider : le cout d'une periode de maintenance est un cout annuel. Si la
-- decision est "cout total de la periode", annualiser dans le routeur budget
-- et remplacer ce commentaire.
COMMENT ON COLUMN maintenance_historique.cout IS
  'Cout de la periode de maintenance. Lu comme un cout ANNUEL par le preremplissage budget (#146, hypothese v0.5 a valider).';

-- ----------------------------------------------------------------------------
-- 2. Debut d'exercice fiscal de la societe : defaut au 1er janvier
-- ----------------------------------------------------------------------------
ALTER TABLE societe ADD COLUMN IF NOT EXISTS debut_exercice_fiscal DATE;
ALTER TABLE societe ALTER COLUMN debut_exercice_fiscal SET DEFAULT DATE '2000-01-01';

COMMENT ON COLUMN societe.debut_exercice_fiscal IS
  'Debut d''exercice fiscal de la societe, seuls jour et mois significatifs (annee sentinelle 2000, un 29/02 vaut 28/02). DEFAULT 1er janvier (US #146) pour une insertion qui omet la colonne ; NULL explicite (cas de POST /societes) = defaut du tenant (tenant_config.debut_exercice_fiscal_defaut, lui-meme 1er janvier par defaut), resolu par l''API et les fonctions exercice_fiscal_*.';

-- ----------------------------------------------------------------------------
-- 3. Fonctions d'exercice fiscal
-- ----------------------------------------------------------------------------

-- Annee civile du premier jour de l'exercice contenant p_date. Un debut
-- d'exercice NULL vaut 1er janvier : l'appelant passe deja
-- COALESCE(societe, tenant_config), le repli final est ici.
-- Regle unique des trois fonctions : un debut au 29 fevrier (sentinelle 2000
-- bissextile) vaut 28 fevrier, sinon exercice_fiscal_de classerait le
-- premier jour rendu par exercice_fiscal_debut dans l'exercice precedent.
CREATE OR REPLACE FUNCTION exercice_fiscal_de(p_date DATE, p_debut_exercice DATE)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_date IS NULL THEN NULL
    WHEN EXTRACT(MONTH FROM p_date) * 100 + EXTRACT(DAY FROM p_date)
      >= EXTRACT(MONTH FROM COALESCE(p_debut_exercice, DATE '2000-01-01')) * 100
       + LEAST(
           EXTRACT(DAY FROM COALESCE(p_debut_exercice, DATE '2000-01-01')),
           CASE WHEN EXTRACT(MONTH FROM COALESCE(p_debut_exercice, DATE '2000-01-01')) = 2 THEN 28 ELSE 31 END)
    THEN EXTRACT(YEAR FROM p_date)::integer
    ELSE EXTRACT(YEAR FROM p_date)::integer - 1
  END
$$;

COMMENT ON FUNCTION exercice_fiscal_de(DATE, DATE) IS
  'Exercice fiscal (annee civile de son premier jour) contenant une date, pour un debut d''exercice donne (jour et mois significatifs). NULL = 1er janvier.';

-- Premier jour d'un exercice. Un debut au 29 fevrier est ramene au 28, meme
-- regle que exercice_fiscal_de : make_date refuserait le 29/02 d'une annee
-- non bissextile.
CREATE OR REPLACE FUNCTION exercice_fiscal_debut(p_exercice INTEGER, p_debut_exercice DATE)
RETURNS DATE
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_exercice IS NULL THEN NULL ELSE make_date(
    p_exercice,
    EXTRACT(MONTH FROM COALESCE(p_debut_exercice, DATE '2000-01-01'))::integer,
    LEAST(
      EXTRACT(DAY FROM COALESCE(p_debut_exercice, DATE '2000-01-01'))::integer,
      CASE WHEN EXTRACT(MONTH FROM COALESCE(p_debut_exercice, DATE '2000-01-01')) = 2 THEN 28 ELSE 31 END
    )
  ) END
$$;

COMMENT ON FUNCTION exercice_fiscal_debut(INTEGER, DATE) IS
  'Premier jour de l''exercice fiscal donne (annee civile de son debut), pour un debut d''exercice donne. NULL = 1er janvier.';

-- Dernier jour : veille du premier jour de l'exercice suivant.
CREATE OR REPLACE FUNCTION exercice_fiscal_fin(p_exercice INTEGER, p_debut_exercice DATE)
RETURNS DATE
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_exercice IS NULL THEN NULL
         ELSE (exercice_fiscal_debut(p_exercice + 1, p_debut_exercice) - 1)::date END
$$;

COMMENT ON FUNCTION exercice_fiscal_fin(INTEGER, DATE) IS
  'Dernier jour de l''exercice fiscal donne, veille du debut de l''exercice suivant.';

COMMIT;
