-- ============================================================================
-- SamSecure - BDD Commune - Migration 045
-- Fichier   : 045_commune_code_retour_revendeurs.sql
-- Objet     : seed de code_retour pour le referentiel revendeurs (module 1),
--             plage 5220-5239, rendue continue par la migration 043.
--             Decoupage : 5220-5226 succes, 5227-5236 erreurs (dont 5236,
--             erreur serveur du module, la plage n'ayant pas de x99),
--             5237-5239 traces audit_log.
--             Libelles reportes dans server/docs/codes_retour.md.
--             Aucun DDL : migration de donnees uniquement.
-- Cible     : PostgreSQL 16 - base Commune, apres 044 (mot "commune" dans le
--             nom : migrate.js route sur commonPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Rejouable : ON CONFLICT (code) DO UPDATE sur type et libelle.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  -- Revendeurs : succes
  (5220, 'succes', 'Liste des revendeurs'),  -- GET /api/revendeurs
  (5221, 'succes', 'Detail du revendeur'),  -- GET /api/revendeurs/:id
  (5222, 'succes', 'Revendeur cree'),  -- POST /api/revendeurs
  (5223, 'succes', 'Revendeur modifie'),  -- PATCH /api/revendeurs/:id
  (5224, 'succes', 'Revendeur desactive'),  -- POST /api/revendeurs/:id/desactiver
  (5225, 'succes', 'Revendeur reactive'),  -- POST /api/revendeurs/:id/reactiver
  (5226, 'succes', 'Suggestions de revendeurs'),  -- GET /api/revendeurs/recherche
  -- Revendeurs : erreurs de validation, de reference et d'etat
  (5227, 'erreur', 'Revendeur introuvable'),  -- GET/PATCH /api/revendeurs/:id et changements d'etat
  (5228, 'erreur', 'La raison sociale est obligatoire'),  -- POST, PATCH /api/revendeurs
  (5229, 'erreur', 'Le SIRET doit contenir 14 chiffres'),  -- POST, PATCH /api/revendeurs
  (5230, 'erreur', 'Un revendeur porte deja ce SIRET'),  -- POST, PATCH /api/revendeurs
  (5231, 'erreur', 'Un revendeur au nom tres proche existe deja'),  -- POST, PATCH /api/revendeurs
  (5232, 'erreur', 'IBAN invalide'),  -- POST, PATCH /api/revendeurs
  (5233, 'erreur', 'Adresse email invalide'),  -- POST, PATCH /api/revendeurs
  (5234, 'erreur', 'Ce revendeur est deja desactive'),  -- POST /api/revendeurs/:id/desactiver
  (5235, 'erreur', 'Ce revendeur est deja actif'),  -- POST /api/revendeurs/:id/reactiver
  (5236, 'erreur', 'Erreur serveur inattendue (referentiel revendeurs)'),  -- toutes
  -- Revendeurs : traces audit_log
  (5237, 'trace', 'Revendeur cree'),  -- POST /api/revendeurs
  (5238, 'trace', 'Revendeur modifie'),  -- PATCH /api/revendeurs/:id
  (5239, 'trace', 'Statut du revendeur modifie')  -- POST /api/revendeurs/:id/desactiver et /reactiver
ON CONFLICT (code) DO UPDATE SET
  type    = EXCLUDED.type,
  libelle = EXCLUDED.libelle;

COMMIT;