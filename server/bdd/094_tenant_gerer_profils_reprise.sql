-- ============================================================================
-- SamSecure - BDD Tenant - Migration 094
-- Fichier   : 094_tenant_gerer_profils_reprise.sql
-- Objet     : refonte des droits #249, cote Tenant.
--             1. Permission gerer_profils (Q5) dans le referentiel du tenant
--                (permission) et la matrice (profil_permission) pour admin_sam
--                SEULEMENT. Pendant Commune : 093.
--             2. Reprise du modele d'attribution : nouvelle colonne
--                utilisateur.id_profil (le profil par defaut du compte, un
--                seul, applique a tout le rattachement). Remplie depuis les
--                attributions non-groupe actives de utilisateur_profil_societe
--                (la plus recente par created_at). Ces lignes historiques ne
--                sont PAS supprimees : elles cessent simplement d'etre lues
--                (regle du depot : l'abandonne reste en base). Les groupes
--                restent portes par utilisateur_profil_societe, dont la
--                colonne id_societe n'est plus lue (#57).
--             AVANT DE JOUER : verifier les comptes a profils multiples, la
--             reprise prend le plus recent (STOP 1 du journal-249) :
--               SELECT ups.id_utilisateur, count(DISTINCT ups.id_profil)
--               FROM utilisateur_profil_societe ups
--               JOIN profil p ON p.id = ups.id_profil AND p.type <> 'groupe'
--               WHERE ups.date_suppression IS NULL
--               GROUP BY 1 HAVING count(DISTINCT ups.id_profil) > 1;
-- Cible     : PostgreSQL 16 - base Tenant, a jouer sur dev ET staging
-- Execution : npm run migrate:dev / migrate:staging (apres 092 et 093)
-- Depend    : 002 (permission, utilisateur), 006 (utilisateur_profil_societe
--             nullable), 011 (admin_sam), 074 (profil.type), 092
-- Rejouable : oui (ADD COLUMN IF NOT EXISTS, ON CONFLICT, reprise bornee a
--             id_profil IS NULL : sans effet au second passage)
-- Numero    : 094 reserve par le chantier #249, libre dans server/bdd et sur
--             toutes les branches au 06/10/2026
-- ============================================================================

BEGIN;

INSERT INTO permission (code, label, module) VALUES
  ('gerer_profils', 'Gérer les profils et leurs matrices', 'administration')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, module = EXCLUDED.module;

INSERT INTO profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM profil p
JOIN permission perm ON perm.code = 'gerer_profils'
WHERE p.code = 'admin_sam'
ON CONFLICT (id_profil, id_permission) DO NOTHING;

-- Une permission retiree puis re-seedee garde sa ligne soft-deletee : la
-- reactivation explicite couvre un re-jeu apres un decochage accidentel sur
-- admin_sam (le profil systeme doit toujours porter l'administration).
UPDATE profil_permission pp SET date_suppression = NULL
FROM profil p, permission perm
WHERE pp.id_profil = p.id AND pp.id_permission = perm.id
  AND p.code = 'admin_sam' AND perm.code = 'gerer_profils'
  AND pp.date_suppression IS NOT NULL;

ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS id_profil UUID REFERENCES profil(id);

COMMENT ON COLUMN utilisateur.id_profil IS
  'Profil par défaut du compte (#249) : un seul, appliqué à toutes les sociétés de rattachement, chacune avec sa matrice configurée ou la matrice par défaut. Les groupes personnalisés restent portés par utilisateur_profil_societe. NULL = aucun profil.';

-- Reprise : le profil non-groupe le plus recemment attribue (created_at, puis
-- id pour departager deux lignes au meme instant). Bornee aux comptes sans
-- profil deja pose : rejouable sans effet, et une correction manuelle
-- posterieure n'est jamais ecrasee.
UPDATE utilisateur u
   SET id_profil = reprise.id_profil
  FROM (
    SELECT DISTINCT ON (ups.id_utilisateur) ups.id_utilisateur, ups.id_profil
      FROM utilisateur_profil_societe ups
      JOIN profil p ON p.id = ups.id_profil
     WHERE ups.date_suppression IS NULL
       AND p.date_suppression IS NULL
       AND p.type <> 'groupe'
     ORDER BY ups.id_utilisateur, ups.created_at DESC, ups.id DESC
  ) reprise
 WHERE u.id = reprise.id_utilisateur
   AND u.id_profil IS NULL;

COMMIT;
