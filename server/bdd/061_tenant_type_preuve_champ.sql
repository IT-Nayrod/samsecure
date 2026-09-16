-- ============================================================================
-- SamSecure - BDD Tenant - Migration 061
-- Fichier   : 061_tenant_type_preuve_champ.sql
-- Objet     : depot unifie des preuves (#204), pendant Tenant de la 060.
--             type_preuve_champ : surcharge par espace client de la definition
--             des champs additionnels par type de preuve, meme structure que
--             default_type_preuve_champ (Commune). Table creee vide, prevue
--             pour la personnalisation par espace client : une ligne de meme
--             (code_type_preuve, nom) qu'un defaut Commune le remplace, une
--             ligne sans equivalent s'ajoute, une ligne inactive masque le
--             defaut. La fusion est faite par l'API (GET /api/types-preuve/
--             champs), les deux bases ne se joignant pas.
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool).
-- Exécution : npm run migrate:dev / migrate:staging.
-- Depend    : 002 (type_preuve), 053 (code facture en Tenant).
-- Rejouable : CREATE TABLE IF NOT EXISTS. Aucun seed, aucun DDL destructif,
--             aucune suppression.
-- Numero    : 061 absent de server/bdd et de toutes les branches locales au
--             16/09/2026.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS type_preuve_champ (
  code_type_preuve VARCHAR(50)  NOT NULL REFERENCES type_preuve(code),
  nom              VARCHAR(63)  NOT NULL,
  libelle          VARCHAR(100) NOT NULL,
  type_champ       VARCHAR(20)  NOT NULL,
  obligatoire      BOOLEAN      NOT NULL DEFAULT false,
  ordre            INTEGER      NOT NULL DEFAULT 0,
  actif            BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMP    NOT NULL DEFAULT now(),
  CONSTRAINT pk_type_preuve_champ PRIMARY KEY (code_type_preuve, nom),
  CONSTRAINT ck_type_preuve_champ_nom  CHECK (nom ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT ck_type_preuve_champ_type CHECK (type_champ IN ('texte', 'nombre', 'date', 'reference'))
);
COMMENT ON TABLE  type_preuve_champ IS 'Surcharge par espace client des champs additionnels par type de preuve (#204, depot unifie). Meme structure que default_type_preuve_champ (Commune, 060) ; prioritaire a la fusion par l''API. Vide a la creation.';
COMMENT ON COLUMN type_preuve_champ.code_type_preuve IS 'Code du type de preuve (type_preuve.code).';
COMMENT ON COLUMN type_preuve_champ.nom IS 'Nom technique du champ, tel que transmis au circuit de depot.';
COMMENT ON COLUMN type_preuve_champ.libelle IS 'Libelle affiche dans la modale de depot.';
COMMENT ON COLUMN type_preuve_champ.type_champ IS 'texte, nombre, date ou reference (identifiant d''un objet rattache : id_contrat, id_commande, id_licence).';
COMMENT ON COLUMN type_preuve_champ.obligatoire IS 'Le depot est refuse par le formulaire tant que le champ est vide.';
COMMENT ON COLUMN type_preuve_champ.ordre IS 'Ordre d''affichage dans la modale, croissant.';
COMMENT ON COLUMN type_preuve_champ.actif IS 'Une ligne inactive masque le defaut Commune de meme nom.';

COMMIT;
