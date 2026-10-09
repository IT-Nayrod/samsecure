-- ============================================================================
-- SamSecure - BDD Tenant - Migration 106
-- Fichier   : 106_tenant_groupes_organisations.sql
-- Objet     : groupes d'organisations (US #277, decisions client du 08/10/2026,
--             issue #213) : un groupe est une somme de societes du tenant,
--             choisie librement. Une societe peut appartenir a plusieurs
--             groupes ; aucune visibilite implicite par la hierarchie (la
--             cascade mere-filles est un confort de saisie a l'ecran, seule la
--             composition enregistree fait foi). Deux tables :
--             - groupe_organisation : identite (nom unique parmi les groupes
--               actifs, description), traçabilite (createur, horodatages),
--               suppression douce (date_suppression), refusee par l'API tant
--               qu'une ligne d'acces d'un groupe d'utilisateurs s'en sert ;
--             - groupe_organisation_societe : composition, remplacee
--               integralement a chaque enregistrement (meme motif que
--               profil_societe_permission, 092 : pas de soft-delete, l'avant/
--               apres est porte par audit_log).
-- Cible     : PostgreSQL 16 - base Tenant, a jouer sur dev ET staging
-- Execution : npm run migrate:dev / migrate:staging
-- Depend    : 002 (societe, utilisateur), 008 (soft delete des societes)
-- Rejouable : oui (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--             aucun DROP, aucune donnee seedee)
-- Numero    : 106 reserve par le chantier groupes-acces (US #277/#330), libre
--             dans server/bdd et sur toutes les branches au 09/10/2026
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS groupe_organisation (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom              VARCHAR(150) NOT NULL,
  description      TEXT,
  id_cree_par      UUID REFERENCES utilisateur(id),
  created_at       TIMESTAMP NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP NOT NULL DEFAULT now(),
  date_suppression TIMESTAMP
);

COMMENT ON TABLE groupe_organisation IS
  'Groupe d''organisations (US #277, 08/10/2026) : somme de sociétés du tenant, référencée par les lignes d''accès des groupes d''utilisateurs (profil × groupe d''organisations). Suppression douce, refusée tant qu''une ligne d''accès active s''en sert.';

-- Nom unique parmi les groupes ACTIFS seulement (index partiel, insensible a
-- la casse) : un groupe supprime libere son nom, les lignes supprimees
-- restent en base pour l'historique.
CREATE UNIQUE INDEX IF NOT EXISTS uq_groupe_organisation_nom_actif
  ON groupe_organisation (lower(nom)) WHERE date_suppression IS NULL;

CREATE TABLE IF NOT EXISTS groupe_organisation_societe (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_groupe_organisation UUID NOT NULL REFERENCES groupe_organisation(id),
  id_societe             UUID NOT NULL REFERENCES societe(id),
  created_at             TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_groupe_organisation_societe UNIQUE (id_groupe_organisation, id_societe)
);

COMMENT ON TABLE groupe_organisation_societe IS
  'Composition d''un groupe d''organisations : sociétés choisies une à une (une société peut être dans plusieurs groupes). Remplacement complet à chaque enregistrement, l''avant/après est porté par audit_log (même motif que profil_societe_permission).';

CREATE INDEX IF NOT EXISTS idx_gos_groupe  ON groupe_organisation_societe (id_groupe_organisation);
CREATE INDEX IF NOT EXISTS idx_gos_societe ON groupe_organisation_societe (id_societe);

COMMIT;
