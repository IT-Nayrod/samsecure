-- ============================================================================
-- SamSecure - BDD Commune - Migration 104
-- Fichier   : 104_commune_code_retour_composition_edition.sql
-- Objet     : seed des codes retour de la composition par edition (#279,
--             decision client du 06/10/2026) : grille de la fiche du
--             logiciel compose (PUT /api/logiciels/:id/composition-editions),
--             refus lisibles (pas un compose, edition inconnue, exception
--             invalide) et la trace d'audit. Plage licences 4000-4099, bloc
--             4070-4074, premiers codes libres en bloc apres le bloc
--             4060-4069 de la composition (#216, migration 069). Les refus
--             partages avec le defaut (4062 introuvable, 4063 reflexif,
--             4064 editeur, 4066 niveau) sont reutilises, pas dupliques.
--             Redaction prealable dans server/docs/codes_retour.md.
--             Libelles accentues (convention pour tout texte destine a
--             l'ecran).
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom),
--             apres 069.
-- Exécution : npm run migrate:dev / migrate:staging, redemarrage de l'API
--             ensuite (catalogue charge au demarrage).
-- Depend    : 024 (table code_retour). La table produit_composition_exception
--             est creee par la 100 (Tenant), sans dependance d'ordre avec ce
--             seed.
-- Rejouable : ON CONFLICT (code) DO NOTHING, aucun DDL, aucune suppression.
-- Numero    : 104. Le brief du chantier ne reservait que 100 et 101 (Tenant) ;
--             102 est pris par le chantier #280 (Tenant, maintenance) et 103
--             par le chantier societes (Commune), tous deux hors branche.
--             104 verifie libre sur toutes les branches locales et distantes
--             et dans tous les worktrees au 07/10/2026 -- numero a confirmer
--             par le chef de projet avant de jouer (voir
--             ~/journaux/journal-composition.md).
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  (4070, 'succes', 'Composition par édition enregistrée'),
  (4071, 'erreur', 'Ce logiciel n''est pas un logiciel composé'),
  (4072, 'erreur', 'Édition inconnue pour ce logiciel composé'),
  (4073, 'erreur', 'Exception de composition invalide'),
  (4074, 'trace',  'Composition par édition modifiée')
ON CONFLICT (code) DO NOTHING;

COMMIT;
