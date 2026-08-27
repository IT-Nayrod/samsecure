-- ============================================================================
-- SamSecure - BDD Commune - Migration 037
-- Fichier   : 037_commune_code_retour_contrats_archivage.sql
-- Objet     : seed de code_retour pour les retours de Samuel sur le module 2,
--             sous-bloc contrats (3000-3099) : champs obligatoires (#95) et
--             archivage d'un contrat a la place de la suppression (#96).
--             Numeros pris dans les trous du sous-bloc : 3005-3006 succes,
--             3022-3029 erreurs. Libelles reportes dans
--             server/docs/codes_retour.md, section "Contrats (#41)".
-- Cible     : PostgreSQL 16 - base Commune, apres 031
-- Rejouable : ON CONFLICT (code) DO UPDATE sur type et libelle, meme motif que
--             025 et 028 (referentiel technique non personnalisable, la
--             derniere livraison fait foi). Aucun DDL.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  -- Contrats (#95) : champs obligatoires
  (3022, 'erreur', 'L''editeur est obligatoire'),  -- POST, PATCH /api/contrats
  (3023, 'erreur', 'La societe signataire est obligatoire'),  -- POST, PATCH /api/contrats
  (3024, 'erreur', 'Le revendeur signataire est obligatoire'),  -- POST, PATCH /api/contrats
  (3025, 'erreur', 'La date de debut est obligatoire'),  -- POST, PATCH /api/contrats
  -- Contrats (#96) : archivage a la place de la suppression
  (3005, 'succes', 'Contrat archive'),  -- POST /api/contrats/:id/archiver
  (3006, 'succes', 'Contrat restaure'),  -- POST /api/contrats/:id/restaurer
  (3026, 'erreur', 'Contrat archive : modification impossible, restaurez-le d''abord'),  -- PATCH /api/contrats/:id
  (3027, 'erreur', 'Suppression impossible : contrat deja valide, archivez-le'),  -- suppression physique /api/contrats/:id
  (3028, 'erreur', 'Contrat deja archive'),  -- POST /api/contrats/:id/archiver
  (3029, 'erreur', 'Contrat non archive'),  -- POST /api/contrats/:id/restaurer
  (3007, 'succes', 'Liste des contrats, archives inclus')  -- GET /api/contrats?inclure_archives=1
ON CONFLICT (code) DO UPDATE SET type = EXCLUDED.type, libelle = EXCLUDED.libelle;

COMMIT;
