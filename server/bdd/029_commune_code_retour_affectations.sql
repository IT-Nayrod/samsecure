-- ============================================================================
-- SamSecure - BDD Commune - Migration 029
-- Fichier   : 029_commune_code_retour_affectations.sql
-- Objet     : seed des codes retour du module 3, bloc affectations, usage
--             declare et revalidation (US #106, M3-B). Plage 4000-4099,
--             premiere plage "modules 3 et 4" reservee par la 024.
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
  (4000, 'succes', 'Liste des affectations'),                                   -- GET /api/affectations
  (4001, 'succes', 'Detail de l''affectation'),                                 -- GET /api/affectations/:id
  (4002, 'succes', 'Affectation declaree et soumise a validation'),             -- POST /api/affectations (201)
  (4003, 'succes', 'Affectation modifiee et resoumise a validation'),           -- PATCH /api/affectations/:id
  (4004, 'succes', 'Affectation supprimee'),                                    -- DELETE /api/affectations/:id
  (4005, 'succes', 'Affectation revalidee, nouveau cycle ouvert'),              -- POST /api/affectations/:id/revalider
  (4006, 'succes', 'Decompte des usages declares pour la conformite'),          -- GET /api/affectations/decompte
  (4007, 'succes', 'Historique des declarations'),                              -- GET /api/affectations/historique
  -- Erreurs de saisie et de lecture
  (4010, 'erreur', 'Affectation introuvable'),                                  -- toutes les routes /affectations/:id
  (4011, 'erreur', 'La licence est obligatoire'),                               -- POST, PATCH
  (4012, 'erreur', 'Licence introuvable'),                                      -- POST, PATCH
  (4013, 'erreur', 'La societe est obligatoire'),                               -- POST, PATCH
  (4014, 'erreur', 'Societe introuvable'),                                      -- POST, PATCH
  (4015, 'erreur', 'La quantite doit etre un entier strictement positif'),      -- POST, PATCH
  (4016, 'erreur', 'La reference client est obligatoire'),                      -- POST, PATCH
  (4017, 'erreur', 'Identifiant de societe invalide'),                          -- filtres GET
  (4018, 'erreur', 'Identifiant de produit invalide'),                          -- filtres GET
  (4019, 'erreur', 'Identifiant de licence invalide'),                          -- filtre GET /affectations
  -- Erreurs d'etat
  (4030, 'erreur', 'Seule une affectation validee peut etre revalidee'),        -- POST .../revalider (409)
  (4032, 'erreur', 'Suppression impossible : affectation rapprochee d''un inventaire'), -- DELETE (409)
  -- Technique
  (4099, 'erreur', 'Erreur serveur inattendue (module affectations)')           -- toutes
ON CONFLICT (code) DO UPDATE SET type = EXCLUDED.type, libelle = EXCLUDED.libelle;

COMMIT;
