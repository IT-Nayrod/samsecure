-- ============================================================================
-- SamSecure - BDD Commune - Migration 093
-- Fichier   : 093_commune_gerer_profils.sql
-- Objet     : refonte des droits #249, cote Commune.
--             1. Permission gerer_profils (module administration, Q5) dans les
--                defauts SamSecure : default_permission, et matrice
--                default_profil_permission pour admin_sam SEULEMENT (decision
--                Q5 : distincte de gerer_utilisateurs, aucun profil par defaut
--                ne la porte). 30e code du referentiel.
--             2. Codes retour 2070 a 2078 (plage administration 2000-2999),
--                rediges au pre-catalogue (server/docs/codes_retour.md,
--                section #249) : traces audit_log des matrices par societe,
--                de la matrice par defaut et du profil d'un utilisateur, et
--                refus des routes de parametrage (les routes interpolent le
--                libelle rendu). Libelles accentues (convention).
--             Pendant Tenant : 094. Aucun DDL, donnees uniquement.
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom)
-- Execution : npm run migrate:dev / migrate:staging, puis redemarrage de l'API
--             (catalogue code_retour charge au demarrage)
-- Depend    : 024 (code_retour), 026 (default_permission, default_profil),
--             027 (matrice default_profil_permission)
-- Rejouable : ON CONFLICT DO UPDATE sur la permission (motif 031), DO NOTHING
--             sur la matrice et les codes retour. Aucune suppression.
-- Numero    : 093 reserve par le chantier #249, libre dans server/bdd et sur
--             toutes les branches au 06/10/2026
-- ============================================================================

BEGIN;

INSERT INTO default_permission (code, label, module) VALUES
  ('gerer_profils', 'Gérer les profils et leurs matrices', 'administration')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, module = EXCLUDED.module;

INSERT INTO default_profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM default_profil p
JOIN default_permission perm ON perm.code = 'gerer_profils'
WHERE p.code = 'admin_sam'
ON CONFLICT (id_profil, id_permission) DO NOTHING;

INSERT INTO code_retour (code, type, libelle) VALUES
  (2070, 'trace',  'Matrice par défaut d''un profil remplacée'),
  (2071, 'trace',  'Profil configuré pour une société'),
  (2072, 'trace',  'Profil revenu au défaut pour une société'),
  (2073, 'trace',  'Profil par défaut d''un utilisateur modifié'),
  (2074, 'erreur', 'Ce profil n''est pas un profil par défaut'),
  (2075, 'erreur', 'Société introuvable'),
  (2076, 'erreur', 'Cette permission n''existe pas au catalogue'),
  (2077, 'erreur', 'Ce profil ne s''attribue pas par cette route'),
  (2078, 'erreur', 'La matrice d''un profil par défaut se gère par remplacement complet')
ON CONFLICT (code) DO NOTHING;

COMMIT;
