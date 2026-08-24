-- ============================================================================
-- SamSecure - BDD Commune - Migration 029
-- Fichier   : 029_commune_code_retour_affectations.sql
-- Objet     : seed des codes retour du module 3, bloc affectations, usage
--             declare et revalidation (US #106, M3-B). Plage 4100-4199, deuxieme
--             plage des "modules 3 et 4" reserves par la 024 (licences 4000-4099).
--             Aucune modification de schema : donnees de referentiel
--             technique, meme famille que la 025.
-- Cible     : PostgreSQL 16 - base Commune, apres 028 (mot "commune" dans le nom, route
--             vers commonPool par migrate.js)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 024 (table code_retour), story #68 (helper d'enveloppe).
-- Rejouable : ON CONFLICT (code) DO UPDATE, idempotent.
-- Redaction : server/docs/codes_retour.md, section "Affectations (#106)".
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  -- Succes
  (4100, 'succes', 'Liste des affectations'),                                   -- GET /api/affectations
  (4101, 'succes', 'Detail de l''affectation'),                                 -- GET /api/affectations/:id
  (4102, 'succes', 'Affectation declaree et soumise a validation'),             -- POST /api/affectations (201)
  (4103, 'succes', 'Affectation modifiee et resoumise a validation'),           -- PATCH /api/affectations/:id
  (4104, 'succes', 'Affectation supprimee'),                                    -- DELETE /api/affectations/:id
  (4105, 'succes', 'Affectation revalidee, nouveau cycle ouvert'),              -- POST /api/affectations/:id/revalider
  (4106, 'succes', 'Decompte des usages declares pour la conformite'),          -- GET /api/affectations/decompte
  (4107, 'succes', 'Historique des declarations'),                              -- GET /api/affectations/historique
  -- Erreurs de saisie et de lecture
  (4110, 'erreur', 'Affectation introuvable'),                                  -- toutes les routes /affectations/:id
  (4111, 'erreur', 'La licence est obligatoire'),                               -- POST, PATCH
  (4112, 'erreur', 'Licence introuvable'),                                      -- POST, PATCH
  (4113, 'erreur', 'La societe est obligatoire'),                               -- POST, PATCH
  (4114, 'erreur', 'Societe introuvable'),                                      -- POST, PATCH
  (4115, 'erreur', 'La quantite doit etre un entier strictement positif'),      -- POST, PATCH
  (4116, 'erreur', 'La reference client est obligatoire'),                      -- POST, PATCH
  (4117, 'erreur', 'Identifiant de societe invalide'),                          -- filtres GET
  (4118, 'erreur', 'Identifiant de produit invalide'),                          -- filtres GET
  (4119, 'erreur', 'Identifiant de licence invalide'),                          -- filtre GET /affectations
  -- Erreurs d'etat
  (4130, 'erreur', 'Seule une affectation validee peut etre revalidee'),        -- POST .../revalider (409)
  (4132, 'erreur', 'Suppression impossible : affectation rapprochee d''un inventaire'), -- DELETE (409)
  -- Technique
  (4199, 'erreur', 'Erreur serveur inattendue (module affectations)')           -- toutes
ON CONFLICT (code) DO UPDATE SET type = EXCLUDED.type, libelle = EXCLUDED.libelle;

COMMIT;
