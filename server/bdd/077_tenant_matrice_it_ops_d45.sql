-- ============================================================================
-- SamSecure - BDD Tenant - Migration 077
-- Fichier   : 077_tenant_matrice_it_ops_d45.sql
-- Objet     : correctif de la matrice IT Ops (decision D45) :
--               1) lecture seule sur les licences : retrait de saisir_licence,
--                  soft delete et non DELETE (meme motif que la 021 : la trace
--                  reste lisible et la ligne resiste a un rejeu des seeds 011
--                  et 032, dont les ON CONFLICT DO NOTHING ne la ressuscitent
--                  pas) ; consulter_licences est conservee par la 011 ;
--               2) saisir_affectation : conservee, reposee par upsert
--                  reactivant (reseed idempotent, modele #170) au cas ou un
--                  essai l'aurait decochee ;
--               3) importer_inventaire : accordee (la 032 ne l'avait donnee
--                  qu'a admin_sam et manager_dsi), meme upsert reactivant.
--             ECART NOTE AU JOURNAL : le defaut Commune (027,
--             default_profil_permission) garde l'ancienne matrice ; son
--             alignement demande une migration commune hors de la plage
--             074-077 reservee a ce chantier.
-- Cible     : PostgreSQL 16 - base Tenant, a jouer sur dev ET staging
-- Execution : npm run migrate
-- Depend    : 003 (it_ops), 007 (permissions), 011 (matrice), 032
--             (importer_inventaire)
-- Rejouable : oui (UPDATE garde sur date_suppression, ON CONFLICT DO UPDATE)
-- Numero    : 077
-- ============================================================================

BEGIN;

-- 1) IT Ops perd la saisie des licences.
UPDATE profil_permission pp
   SET date_suppression = now()
  FROM profil p, permission perm
 WHERE pp.id_profil = p.id
   AND pp.id_permission = perm.id
   AND p.code = 'it_ops'
   AND perm.code = 'saisir_licence'
   AND pp.date_suppression IS NULL;

-- 2) et 3) IT Ops garde saisir_affectation et recoit importer_inventaire.
-- DO UPDATE et non DO NOTHING : une ligne soft-supprimee occupe toujours
-- uq_profil_permission, l'upsert la reactive (motif #170).
INSERT INTO profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
  FROM profil p
  JOIN permission perm ON perm.code IN ('saisir_affectation', 'importer_inventaire')
 WHERE p.code = 'it_ops'
ON CONFLICT (id_profil, id_permission) DO UPDATE SET date_suppression = NULL;

COMMIT;
