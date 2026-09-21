-- ============================================================================
-- SamSecure - BDD Commune - Migration 073
-- Fichier   : 073_commune_code_retour_preuve_externe.sql
-- Objet     : ticket #220, regle client du 17/09/2026, preuve externe.
--             Seed des codes retour rediges au pre-catalogue
--             (server/docs/codes_retour.md), plage preuves 3200-3239,
--             premiers numeros libres apres 3234 :
--             - 3235 : mode de preuve invalide ;
--             - 3236 : URL externe absente ou invalide (mode url) ;
--             - 3237 : reference externe absente ou trop longue (mode
--               reference) ;
--             - 3238 : type Facture tente en mode externe (le circuit facture
--               exige le document) ;
--             - 3239 : depot de fichier tente sur une preuve externe.
--             Libelles accentues (convention pour tout texte destine a
--             l'ecran). La plage preuves 3200-3239 est desormais pleine a
--             l'exception de 3207 a 3209.
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom).
-- Exécution : npm run migrate:dev / migrate:staging, puis redemarrage de
--             l'API (catalogue charge au demarrage).
-- Depend    : 024 (table code_retour), 067 (3233 et 3234).
-- Rejouable : ON CONFLICT (code) DO NOTHING, aucun DDL, aucune suppression.
-- Numero    : 073 reserve par le protocole du chantier, absent de server/bdd
--             et de toutes les branches locales et de suivi au 21/09/2026.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  -- Preuves externes (#220), plage module 2
  (3235, 'erreur', 'Le mode de la preuve est invalide, valeurs admises : fichier, url, reference'),
  (3236, 'erreur', 'L''URL externe est obligatoire et doit être une adresse http ou https valide'),
  (3237, 'erreur', 'La référence externe est obligatoire, 500 caractères au plus'),
  (3238, 'erreur', 'Le type Facture est réservé au mode fichier : une facture se dépose avec son document'),
  (3239, 'erreur', 'Dépôt de fichier impossible : cette preuve est externe')
ON CONFLICT (code) DO NOTHING;

COMMIT;
