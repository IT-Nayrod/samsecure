-- ============================================================================
-- SamSecure - BDD Commune - Migration 042
-- Fichier   : 042_commune_code_retour_editeur_suggestions.sql
-- Objet     : code retour de la recherche incrementale d'editeurs.
--             GET /api/editeurs/recherche sert les editeurs deja references
--             qui correspondent au texte saisi, au fil de la frappe, pour que
--             le client voie qu'un editeur existe avant de le recreer. Le
--             referentiel pouvant compter des milliers de lignes, personne ne
--             peut verifier de visu qu'un editeur est absent : le doublon nait
--             de cette impossibilite, pas d'une inattention.
--             Code distinct de 5200 (liste complete) : les deux reponses n'ont
--             ni la meme forme ni le meme cout, la liste portant les compteurs
--             et la conformite que la recherche n'a pas.
--             Plage 5200-5299, ouverte par la migration 041.
--             Aucun DDL : migration de donnees uniquement.
-- Cible     : PostgreSQL 16 - base Commune, apres 041 (mot "commune" dans le
--             nom : migrate.js route sur commonPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Rejouable : ON CONFLICT (code) DO UPDATE sur type et libelle, meme motif que
--             025, 034 et 041. Un code ne change jamais de sens.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  (5205, 'succes', 'Suggestions d''editeurs')  -- GET /api/editeurs/recherche
ON CONFLICT (code) DO UPDATE SET
  type    = EXCLUDED.type,
  libelle = EXCLUDED.libelle;

COMMIT;
