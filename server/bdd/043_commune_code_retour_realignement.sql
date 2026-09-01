-- ============================================================================
-- SamSecure - BDD Commune - Migration 043
-- Fichier   : 043_commune_code_retour_realignement.sql
-- Objet     : libere 5230-5232 pour le referentiel revendeurs, en deplacant
--             les trois traces audit des editeurs vers 5290-5292.
--
--             La migration 041 avait pose les traces editeurs a l'ouverture de
--             la plage 5230-5239, avant que le decoupage du module 1 ne soit
--             arrete. Les revendeurs occupant 5220-5239 en continu, ces trois
--             codes deviennent leur place.
--
--             Sans effet sur les donnees : un code de type trace ne transite
--             pas en HTTP et audit_log ne le stocke pas. Il ne vit qu'en
--             commentaire dans le routeur, en regard de l'action auditee, et
--             dans le catalogue. Rien ne le lit a l'execution.
--             Les commentaires de server/routes/editeurs.js sont a corriger
--             dans le meme lot.
-- Cible     : PostgreSQL 16 - base Commune, apres 042 (mot "commune" dans le
--             nom : migrate.js route sur commonPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Rejouable : DELETE des anciens codes puis INSERT ON CONFLICT des nouveaux.
--             Un second passage ne trouve plus rien a supprimer et reecrit a
--             l'identique.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  (5290, 'trace', 'Editeur cree'),      -- POST /api/editeurs
  (5291, 'trace', 'Editeur modifie'),   -- PATCH /api/editeurs/:id
  (5292, 'trace', 'Editeur supprime')   -- DELETE /api/editeurs/:id
ON CONFLICT (code) DO UPDATE SET
  type    = EXCLUDED.type,
  libelle = EXCLUDED.libelle;

-- Les anciens emplacements sont rendus au catalogue. Le DELETE est borne au
-- libelle attendu : si un autre module les a deja repris, on ne detruit rien.
DELETE FROM code_retour
 WHERE code IN (5230, 5231, 5232)
   AND libelle IN ('Editeur cree', 'Editeur modifie', 'Editeur supprime');

COMMIT;