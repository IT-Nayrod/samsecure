-- ============================================================================
-- SamSecure - BDD Commune - Migration 060
-- Fichier   : 060_commune_type_preuve_champ.sql
-- Objet     : depot unifie des preuves (#204). Decision du chef de projet du
--             12/09/2026, revue en reunion client du 16/09/2026 : la modale de
--             preuve est la seule porte d'entree des pieces justificatives,
--             facture comprise, et s'adapte au type choisi par une definition
--             de champs portee par la base, jamais par le front.
--             1) default_type_preuve_champ : definition SamSecure des champs
--                additionnels par type de preuve. Rapprochement sur le code du
--                type, comme default_type_preuve vers type_preuve : les deux
--                bases ne se joignent pas, l'API fait le pont
--                (GET /api/types-preuve/champs sert la definition fusionnee,
--                surcharge Tenant prioritaire). Colonnes : type de preuve
--                (code), nom technique, libelle, type de champ, obligatoire,
--                ordre, actif.
--             2) seed du type facture, inventorie depuis la table facture
--                (002_tenant_schema.sql:356, jamais modifiee depuis) : id,
--                label, id_commande, id_preuve, created_at. Seuls label et
--                id_commande sont des saisies, id_preuve et created_at sont
--                poses par le depot. Ni montant, ni date de facturation, ni
--                numero n'existent dans la table : aucun champ n'est invente.
--                Les deux champs sont obligatoires : le depot avec type
--                facture emprunte POST /api/factures/depot (3251, 3252).
--             3) code_retour 3229 : lecture de la definition fusionnee, plage
--                preuves 3200-3239, premier numero libre apres 3228.
--             Le pendant Tenant (type_preuve_champ, surcharge par espace
--             client, vide) est la 061.
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom :
--             migrate.js route sur commonPool), apres 059.
-- Exécution : npm run migrate:dev / migrate:staging, puis redemarrage de
--             l'API (catalogue charge au demarrage).
-- Depend    : 024 (code_retour), 026 et 054 (default_type_preuve, code
--             facture).
-- Rejouable : CREATE TABLE IF NOT EXISTS, ON CONFLICT DO UPDATE sur le seed
--             et sur le code retour (referentiel technique, la derniere
--             livraison fait foi, meme motif que 027 et 054). Aucun DDL
--             destructif, aucune suppression.
-- Numero    : 059, 060 et 061 absents de server/bdd et de toutes les branches
--             locales au 16/09/2026 ; 059 est reservee a la terminologie (A67).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Definition des champs par type de preuve
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS default_type_preuve_champ (
  code_type_preuve VARCHAR(50)  NOT NULL REFERENCES default_type_preuve(code),
  nom              VARCHAR(63)  NOT NULL,
  libelle          VARCHAR(100) NOT NULL,
  type_champ       VARCHAR(20)  NOT NULL,
  obligatoire      BOOLEAN      NOT NULL DEFAULT false,
  ordre            INTEGER      NOT NULL DEFAULT 0,
  actif            BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMP    NOT NULL DEFAULT now(),
  CONSTRAINT pk_default_type_preuve_champ PRIMARY KEY (code_type_preuve, nom),
  CONSTRAINT ck_default_type_preuve_champ_nom  CHECK (nom ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT ck_default_type_preuve_champ_type CHECK (type_champ IN ('texte', 'nombre', 'date', 'reference'))
);
COMMENT ON TABLE  default_type_preuve_champ IS 'Defauts SamSecure des champs additionnels par type de preuve (#204, depot unifie). Rapprochement sur le code du type ; surcharge par espace client dans type_preuve_champ (Tenant, 061), fusion par l''API.';
COMMENT ON COLUMN default_type_preuve_champ.code_type_preuve IS 'Code du type de preuve (default_type_preuve.code, type_preuve.code en Tenant).';
COMMENT ON COLUMN default_type_preuve_champ.nom IS 'Nom technique du champ, tel que transmis au circuit de depot (nom de colonne de la table cible).';
COMMENT ON COLUMN default_type_preuve_champ.libelle IS 'Libelle affiche dans la modale de depot.';
COMMENT ON COLUMN default_type_preuve_champ.type_champ IS 'texte, nombre, date ou reference (identifiant d''un objet rattache : id_contrat, id_commande, id_licence).';
COMMENT ON COLUMN default_type_preuve_champ.obligatoire IS 'Le depot est refuse par le formulaire tant que le champ est vide.';
COMMENT ON COLUMN default_type_preuve_champ.ordre IS 'Ordre d''affichage dans la modale, croissant.';
COMMENT ON COLUMN default_type_preuve_champ.actif IS 'Un champ inactif n''est pas servi par l''API ; une surcharge Tenant inactive masque le defaut.';

-- ----------------------------------------------------------------------------
-- 2. Type facture : champs inventories depuis la table facture
-- ----------------------------------------------------------------------------
INSERT INTO default_type_preuve_champ (code_type_preuve, nom, libelle, type_champ, obligatoire, ordre, actif) VALUES
  ('facture', 'label',       'Libellé',  'texte',     true, 10, true),
  ('facture', 'id_commande', 'Commande', 'reference', true, 20, true)
ON CONFLICT (code_type_preuve, nom) DO UPDATE SET
  libelle     = EXCLUDED.libelle,
  type_champ  = EXCLUDED.type_champ,
  obligatoire = EXCLUDED.obligatoire,
  ordre       = EXCLUDED.ordre,
  actif       = EXCLUDED.actif;

-- ----------------------------------------------------------------------------
-- 3. Code retour de la lecture fusionnee
-- ----------------------------------------------------------------------------
INSERT INTO code_retour (code, type, libelle) VALUES
  (3229, 'succes', 'Définition des champs par type de preuve')  -- GET /api/types-preuve/champs
ON CONFLICT (code) DO UPDATE SET
  type    = EXCLUDED.type,
  libelle = EXCLUDED.libelle;

COMMIT;
