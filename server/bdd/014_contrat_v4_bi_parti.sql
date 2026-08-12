-- ============================================================================
-- SamSecure - BDD Tenant - Migration 014
-- Objet   : alignement DDL v4. Deux changements dans le meme train :
--           1) contrat.id_revendeur : signataire fournisseur (optionnel),
--              pendant de id_societe (signataire client, modif 8).
--           2) suppression de licence.id_contrat : anti-hyperstatisme. Le lien
--              licence -> contrat passe desormais par la commande
--              (licence.id_commande -> commande.id_contrat), conformement a la
--              doctrine budget "organisation payeuse derivee de la chaine
--              licence -> commande -> societe".
-- Cible   : PostgreSQL - base Tenant
-- Valide  : Dorian, 10/08/2026
-- Note    : numerotee 014 et non 012, les numeros 012 et 013 restant inscrits
--           dans _migrations des bases existantes (comptes de test retires).
-- Rejouable : IF NOT EXISTS / IF EXISTS, sans effet sur une base deja conforme.
-- ============================================================================

BEGIN;

ALTER TABLE contrat ADD COLUMN IF NOT EXISTS id_revendeur UUID NULL REFERENCES revendeur(id);

COMMENT ON COLUMN contrat.id_revendeur IS
  'Signataire fournisseur (referentiel v4), optionnel.';

CREATE INDEX IF NOT EXISTS idx_contrat_revendeur ON contrat (id_revendeur);

-- L'index idx_licence_contrat tombe automatiquement avec la colonne.
ALTER TABLE licence DROP COLUMN IF EXISTS id_contrat;

COMMIT;
