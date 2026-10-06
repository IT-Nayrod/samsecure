-- ============================================================================
-- SamSecure - BDD Commune - Migration 086
-- Fichier   : 086_commune_matrice_it_ops_d45.sql
-- Objet     : pendant Commune de la 077 Tenant (chantier rbac) : alignement du
--             defaut default_profil_permission (027) sur la decision D45 :
--               1) IT Ops perd saisir_licence (lecture seule sur les
--                  licences) ;
--               2) saisir_affectation : conservee, reposee au cas ou un essai
--                  l'aurait retiree ;
--               3) importer_inventaire : accordee (la 031 ne l'avait donnee
--                  qu'a admin_sam et manager_dsi).
--             ECART NOTE AU JOURNAL : pas de soft delete en Commune
--             (default_profil_permission ne porte pas date_suppression, 026),
--             le retrait est donc un DELETE cible, motif 027 (retrait
--             manager_dsi), la trace du retrait etant la presente migration ;
--             les reposes sont en ON CONFLICT DO NOTHING et non en upsert
--             reactivant : sans suppression douce il n'y a rien a reactiver.
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom).
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 026 (tables default_*), 027 (matrice), 031
--             (importer_inventaire), 077 Tenant (meme decision D45)
-- Rejouable : oui (DELETE cible sans effet au second passage, ON CONFLICT DO
--             NOTHING, aucun DDL)
-- Numero    : 086 reserve par le chantier finition, libre dans server/bdd et
--             sur toutes les branches locales et de suivi au 06/10/2026.
-- ============================================================================

BEGIN;

-- 1) IT Ops perd la saisie des licences (D45).
DELETE FROM default_profil_permission dpp
 USING default_profil p, default_permission perm
 WHERE dpp.id_profil = p.id
   AND dpp.id_permission = perm.id
   AND p.code = 'it_ops'
   AND perm.code = 'saisir_licence';

-- 2) et 3) IT Ops garde saisir_affectation et recoit importer_inventaire.
INSERT INTO default_profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
  FROM default_profil p
  JOIN default_permission perm ON perm.code IN ('saisir_affectation', 'importer_inventaire')
 WHERE p.code = 'it_ops'
ON CONFLICT (id_profil, id_permission) DO NOTHING;

COMMIT;
