-- ============================================================================
-- SamSecure - BDD Commune - Migration 041
-- Fichier   : 041_commune_code_retour_referentiels.sql
-- Objet     : seed de code_retour pour le module 1, referentiels editeurs et
--             logiciels. Deux plages, reservees a ces deux ressources :
--             5200-5299 editeurs, 5300-5399 logiciels. Les plages precedentes
--             s'arretent a 5199 (budget, migration 034).
--             Decoupage, identique dans les deux plages : x00-x09 succes,
--             x10-x29 erreurs de validation et de reference, x30-x39 traces
--             audit_log, x99 erreur serveur du module.
--             Libelles reportes dans server/docs/codes_retour.md.
--             Aucun DDL : migration de donnees uniquement.
-- Cible     : PostgreSQL 16 - base Commune, apres 038 (mot "commune" dans le
--             nom : migrate.js route sur commonPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Rejouable : ON CONFLICT (code) DO UPDATE sur type et libelle, meme motif que
--             025 et 034. Un code ne change jamais de sens.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  -- Editeurs : succes
  (5200, 'succes', 'Liste des editeurs'),  -- GET /api/editeurs
  (5201, 'succes', 'Detail de l''editeur'),  -- GET /api/editeurs/:id
  (5202, 'succes', 'Editeur cree'),  -- POST /api/editeurs
  (5203, 'succes', 'Editeur modifie'),  -- PATCH /api/editeurs/:id
  (5204, 'succes', 'Editeur supprime'),  -- DELETE /api/editeurs/:id
  -- Editeurs : erreurs de validation et de reference
  (5210, 'erreur', 'Editeur introuvable'),  -- GET/PATCH/DELETE /api/editeurs/:id
  (5211, 'erreur', 'La raison sociale est obligatoire'),  -- POST, PATCH /api/editeurs
  (5212, 'erreur', 'Un editeur porte deja cette raison sociale'),  -- POST, PATCH /api/editeurs
  (5213, 'erreur', 'Suppression impossible : cet editeur porte des rattachements'),  -- DELETE /api/editeurs/:id
  -- Editeurs : traces audit_log
  (5230, 'trace', 'Editeur cree'),  -- POST /api/editeurs
  (5231, 'trace', 'Editeur modifie'),  -- PATCH /api/editeurs/:id
  (5232, 'trace', 'Editeur supprime'),  -- DELETE /api/editeurs/:id
  -- Editeurs : erreur serveur du module
  (5299, 'erreur', 'Erreur serveur inattendue (referentiel editeurs)'),  -- toutes
  -- Logiciels : succes
  (5300, 'succes', 'Liste des logiciels'),  -- GET /api/logiciels
  (5301, 'succes', 'Detail du logiciel'),  -- GET /api/logiciels/:id
  (5302, 'succes', 'Logiciel cree'),  -- POST /api/logiciels
  (5303, 'succes', 'Logiciel modifie'),  -- PATCH /api/logiciels/:id
  (5304, 'succes', 'Logiciel supprime'),  -- DELETE /api/logiciels/:id
  (5305, 'succes', 'Version ajoutee'),  -- POST /api/logiciels/:id/versions
  (5306, 'succes', 'Version supprimee'),  -- DELETE /api/logiciels/:id/versions/:idVersion
  (5307, 'succes', 'Edition ajoutee'),  -- POST /api/logiciels/:id/editions
  (5308, 'succes', 'Edition supprimee'),  -- DELETE /api/logiciels/:id/editions/:idEdition
  -- Logiciels : erreurs de validation et de reference
  (5310, 'erreur', 'Logiciel introuvable'),  -- GET/PATCH/DELETE /api/logiciels/:id
  (5311, 'erreur', 'Le libelle est obligatoire'),  -- POST, PATCH /api/logiciels
  (5312, 'erreur', 'Editeur introuvable'),  -- POST, PATCH /api/logiciels
  (5313, 'erreur', 'Produit parent introuvable'),  -- POST, PATCH /api/logiciels
  (5314, 'erreur', 'Un produit ne peut pas etre son propre parent'),  -- PATCH /api/logiciels/:id
  (5315, 'erreur', 'Ce rattachement fermerait une boucle dans la hierarchie'),  -- PATCH /api/logiciels/:id
  (5316, 'erreur', 'Le catalogue commun n''est pas modifiable depuis un espace client'),  -- PATCH/DELETE /api/logiciels/:id et declinaisons
  (5317, 'erreur', 'Suppression impossible : ce logiciel porte des rattachements'),  -- DELETE /api/logiciels/:id
  (5318, 'erreur', 'Le libelle de la version est obligatoire'),  -- POST /api/logiciels/:id/versions
  (5319, 'erreur', 'Cette version existe deja pour ce logiciel'),  -- POST /api/logiciels/:id/versions
  (5320, 'erreur', 'Le libelle de l''edition est obligatoire'),  -- POST /api/logiciels/:id/editions
  (5321, 'erreur', 'Cette edition existe deja pour ce logiciel'),  -- POST /api/logiciels/:id/editions
  (5322, 'erreur', 'Version introuvable'),  -- DELETE /api/logiciels/:id/versions/:idVersion
  (5323, 'erreur', 'Edition introuvable'),  -- DELETE /api/logiciels/:id/editions/:idEdition
  -- Logiciels : traces audit_log
  (5330, 'trace', 'Logiciel cree'),  -- POST /api/logiciels
  (5331, 'trace', 'Logiciel modifie'),  -- PATCH /api/logiciels/:id
  (5332, 'trace', 'Logiciel supprime'),  -- DELETE /api/logiciels/:id
  -- Logiciels : erreur serveur du module
  (5399, 'erreur', 'Erreur serveur inattendue (referentiel logiciels)')  -- toutes
ON CONFLICT (code) DO UPDATE SET
  type    = EXCLUDED.type,
  libelle = EXCLUDED.libelle;

COMMIT;
