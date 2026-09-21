-- ============================================================================
-- SamSecure - BDD Commune - Migration 067
-- Fichier   : 067_commune_code_retour_complements.sql
-- Objet     : seed des codes rediges au pre-catalogue par les chantiers du
--             17/09/2026 et laisses orphelins faute de migration Commune
--             dans leur perimetre :
--             - 2053 a 2055 : desactivation groupee des utilisateurs (#212,
--               POST /api/utilisateurs/desactivation) ;
--             - 3233 : date de la preuve invalide (#214, colonne
--               preuve.date_preuve, migration 066 Tenant) ;
--             - 3234 : type Facture refuse hors du depot de facture (#99,
--               retour de recette du 16/09/2026).
--             Libelles accentues (convention pour tout texte destine a
--             l'ecran).
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom),
--             apres 064.
-- Exécution : manuelle sur dev puis staging, redemarrage de l'API ensuite
--             (catalogue charge au demarrage).
-- Depend    : 024 (table code_retour).
-- Rejouable : ON CONFLICT (code) DO NOTHING, aucun DDL, aucune suppression.
-- Numero    : 067 libre sur origin/dev au 21/09/2026 (066 Tenant prise par
--             le chantier preuves).
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  -- Desactivation groupee des utilisateurs (#212), plage module 1
  (2053, 'succes', 'Sélection désactivée'),
  (2054, 'erreur', 'La sélection est vide ou invalide'),
  (2055, 'erreur', 'La sélection contient le compte connecté'),
  -- Preuves (#214 et #99), plage module 2
  (3233, 'erreur', 'La date de la preuve est invalide, format attendu AAAA-MM-JJ'),
  (3234, 'erreur', 'Le type Facture n''est pas accepté ici : une facture se dépose avec son fichier par le dépôt de facture')
ON CONFLICT (code) DO NOTHING;

COMMIT;

