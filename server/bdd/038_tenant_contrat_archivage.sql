-- ============================================================================
-- SamSecure - BDD Tenant - Migration 038
-- Fichier   : 038_tenant_contrat_archivage.sql
-- Objet     : archivage d'un contrat a la place de sa suppression (#96).
--             Un contrat entre en validation ne se supprime plus : il
--             s'archive, disparait des listes par defaut, reste consultable
--             sur demande, ne se modifie plus et peut etre restaure.
--
--             Motif retenu : archive BOOLEAN + date_archivage + id_archive_par,
--             et non date_suppression de la migration 008. Deux raisons :
--             date_suppression porte le sens d'une suppression logique, que
--             la migration 022 a d'ailleurs abandonnee pour utilisateur ; et
--             l'archivage est reversible et audite, il faut savoir qui l'a
--             fait, ce que 008 ne modelise pas. Le booleen porte l'etat, la
--             date et l'auteur portent la trace ; les trois sont remis a
--             false / NULL / NULL a la restauration.
--             Aucune cascade : sous-contrats et commandes ne changent pas.
--             Pendant Commune : 037 (codes retour).
-- Cible     : PostgreSQL 16 - base Tenant, apres 032
-- Rejouable : ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.
--             Aucune instruction destructrice.
-- ============================================================================

BEGIN;

ALTER TABLE contrat ADD COLUMN IF NOT EXISTS archive        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE contrat ADD COLUMN IF NOT EXISTS date_archivage TIMESTAMP;
ALTER TABLE contrat ADD COLUMN IF NOT EXISTS id_archive_par UUID REFERENCES utilisateur(id);

-- Les listes excluent les archives par defaut : index partiel sur le cas
-- courant, les contrats vivants.
CREATE INDEX IF NOT EXISTS idx_contrat_archive ON contrat (archive) WHERE archive = false;

COMMENT ON COLUMN contrat.archive IS
  'true = contrat archive (#96) : masque des listes par defaut, non modifiable, restaurable. Remplace la suppression pour tout contrat entre en validation.';
COMMENT ON COLUMN contrat.date_archivage IS
  'Horodatage du dernier archivage, NULL si le contrat est vivant.';
COMMENT ON COLUMN contrat.id_archive_par IS
  'Utilisateur ayant archive le contrat, NULL si le contrat est vivant.';

COMMIT;
