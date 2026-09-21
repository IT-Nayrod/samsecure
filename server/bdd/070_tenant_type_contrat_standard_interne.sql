-- ============================================================================
-- SamSecure - BDD Tenant - Migration 070
-- Fichier   : 070_tenant_type_contrat_standard_interne.sql
-- Objet     : deux tickets du chantier contrats-types.
--             1) #218, Simple devient Standard : le libelle affiche du type
--                de contrat de code 'simple' passe a "Standard". Le code ne
--                change pas, contrat.id_type_contrat non plus : les contrats
--                existants ne bougent pas. UPDATE borne a la ligne de code
--                'simple', motif protege du referentiel (003) : une ligne
--                marquee personnalise garde le libelle du client, seule sa
--                copie du defaut (valeurs_defaut, bouton retablir) suit.
--             2) #219, type Interne (regle client du 17/09/2026) : pret de
--                licences entre entites d'une meme organisation. Le
--                signataire cote vendeur est une societe du tenant, pas un
--                revendeur.
--                - type_contrat : ligne de code 'interne', meme motif
--                  protege que le seed 003 ;
--                - contrat.id_societe_preteuse (FK societe, nullable) :
--                  pendant de id_revendeur pour un contrat Interne. Nommage
--                  id_<table>_<qualificatif>, comme id_contrat_parent et
--                  id_contrat_predecesseur ;
--                - deux garde-fous en base, verifiables sans lire le type :
--                  la preteuse est distincte de la signataire, et un contrat
--                  ne porte jamais a la fois un revendeur et une preteuse.
--                  La regle "type Interne = preteuse obligatoire, revendeur
--                  interdit" depend du code du type : elle reste a l'API
--                  (server/routes/contrats.js, codes 3030 a 3034).
--                Aucun changement aux regles de succession, d'echeance ou
--                de validation : un contrat Interne suit le droit commun.
--             Pendant Commune : 071 (default_type_contrat et codes retour).
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool).
-- Exécution : npm run migrate:dev / migrate:staging.
-- Depend    : 002 (type_contrat, contrat, societe), 003 (seed des types),
--             014 (contrat.id_revendeur).
-- Rejouable : UPDATE borne idempotent, ON CONFLICT (code) DO UPDATE,
--             ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--             contraintes sous garde pg_constraint, COMMENT idempotent.
--             Aucun DDL destructif, aucune suppression.
-- Numero    : 070 reserve par le protocole du chantier, absent de server/bdd,
--             de toutes les branches et de tous les worktrees au 21/09/2026.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) #218 : libelle "Standard" sur le type de code 'simple'
-- ----------------------------------------------------------------------------
UPDATE type_contrat
   SET label          = CASE WHEN personnalise THEN label ELSE 'Standard' END,
       valeurs_defaut = '{"label": "Standard"}'::jsonb
 WHERE code = 'simple';

COMMENT ON TABLE type_contrat IS 'Types contractuels (CGU/CGV, Standard, Cadre, Interne). Seedé. Le code du type Standard reste ''simple'' (#218).';

-- ----------------------------------------------------------------------------
-- 2) #219 : type Interne (motif protégé, comme le seed 003)
-- ----------------------------------------------------------------------------
INSERT INTO type_contrat (code, label, valeurs_defaut) VALUES
  ('interne', 'Interne', '{"label": "Interne"}')
ON CONFLICT (code) DO UPDATE SET
  label          = CASE WHEN type_contrat.personnalise THEN type_contrat.label ELSE EXCLUDED.label END,
  valeurs_defaut = EXCLUDED.valeurs_defaut;

ALTER TABLE contrat ADD COLUMN IF NOT EXISTS id_societe_preteuse UUID REFERENCES societe(id);

COMMENT ON COLUMN contrat.id_societe_preteuse IS
  'Société prêteuse d''un contrat de type Interne (#219) : signataire côté vendeur, société du tenant distincte de la signataire id_societe. NULL sur tout autre type ; id_revendeur reste NULL sur un contrat Interne.';

CREATE INDEX IF NOT EXISTS idx_contrat_societe_preteuse ON contrat (id_societe_preteuse);

-- Une société ne se prête pas de licences à elle-même. id_societe NULL (contrat
-- hérité d'avant la #95) rend la comparaison NULL, donc la contrainte passante.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_contrat_preteuse_distincte') THEN
    ALTER TABLE contrat ADD CONSTRAINT ck_contrat_preteuse_distincte
      CHECK (id_societe_preteuse IS NULL OR id_societe_preteuse <> id_societe);
  END IF;
END $$;

-- Un seul signataire côté vendeur : revendeur ou société prêteuse, jamais les
-- deux. Les contrats existants n'ont pas de prêteuse, la contrainte passe.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_contrat_preteuse_sans_revendeur') THEN
    ALTER TABLE contrat ADD CONSTRAINT ck_contrat_preteuse_sans_revendeur
      CHECK (id_societe_preteuse IS NULL OR id_revendeur IS NULL);
  END IF;
END $$;

COMMIT;
