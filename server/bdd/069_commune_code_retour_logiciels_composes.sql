-- ============================================================================
-- SamSecure - BDD Commune - Migration 069
-- Fichier   : 069_commune_code_retour_logiciels_composes.sql
-- Objet     : seed des codes retour des logiciels composes (#216, regle
--             client du 17/09/2026) : ajout et retrait d'un composant sur la
--             fiche logiciel (routes /api/logiciels/:id/composants),
--             refus lisibles (composant inconnu, auto-composition, editeur
--             different, doublon du couple, compose deja composant) et les
--             deux traces d'audit. Plage licences 4000-4099, bloc 4060-4069,
--             premiers codes libres en bloc apres 4059. Redaction prealable
--             dans server/docs/codes_retour.md.
--             Libelles accentues (convention pour tout texte destine a
--             l'ecran).
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom),
--             apres 067.
-- Exécution : npm run migrate:dev / migrate:staging, redemarrage de l'API
--             ensuite (catalogue charge au demarrage).
-- Depend    : 024 (table code_retour). La table produit_composition est creee
--             par la 068 (Tenant), sans dependance d'ordre avec ce seed.
-- Rejouable : ON CONFLICT (code) DO NOTHING, aucun DDL, aucune suppression.
-- Numero    : 069 reserve pour ce chantier, libre sur toutes les branches
--             locales et distantes connues au 21/09/2026.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  (4060, 'succes', 'Composant ajouté au logiciel composé'),
  (4061, 'succes', 'Composant retiré du logiciel composé'),
  (4062, 'erreur', 'Logiciel composant introuvable'),
  (4063, 'erreur', 'Un logiciel ne peut pas être son propre composant'),
  (4064, 'erreur', 'Le composant doit appartenir au même éditeur que le logiciel composé'),
  (4065, 'erreur', 'Ce logiciel fait déjà partie de la composition'),
  (4066, 'erreur', 'Un logiciel composé ne peut pas être composant d''un autre logiciel composé'),
  (4067, 'erreur', 'Ce logiciel ne fait pas partie de la composition'),
  (4068, 'trace',  'Composant ajouté à un logiciel composé'),
  (4069, 'trace',  'Composant retiré d''un logiciel composé')
ON CONFLICT (code) DO NOTHING;

COMMIT;
