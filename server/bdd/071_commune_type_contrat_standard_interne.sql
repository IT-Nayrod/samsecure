-- ============================================================================
-- SamSecure - BDD Commune - Migration 071
-- Fichier   : 071_commune_type_contrat_standard_interne.sql
-- Objet     : pendant Commune de la 070 (chantier contrats-types).
--             1) Defauts SamSecure des types de contrat (default_type_contrat,
--                rapproches du Tenant par code) :
--                - #218 : le defaut de code 'simple' prend le libelle
--                  "Standard", le code ne change pas ;
--                - #219 : nouveau defaut de code 'interne' (pret de licences
--                  entre entites d'une meme organisation, regle client du
--                  17/09/2026).
--                Sans cet alignement, un tenant provisionne depuis les
--                defauts retrouverait "Simple" et n'aurait pas le type
--                Interne.
--             2) Codes retour 3030 a 3034 du type Interne (#219), rediges au
--                pre-catalogue server/docs/codes_retour.md, section Contrats.
--                Libelles accentues (convention pour tout texte destine a
--                l'ecran).
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom),
--             apres 067.
-- Exécution : manuelle sur dev puis staging, redemarrage de l'API ensuite
--             (catalogue code_retour charge au demarrage).
-- Depend    : 024 (table code_retour), 026 (default_type_contrat), 027 (seed
--             des defauts).
-- Rejouable : ON CONFLICT (code) DO UPDATE sur les defauts (meme motif que
--             027), ON CONFLICT (code) DO NOTHING sur les codes retour.
--             Aucun DDL, aucune suppression.
-- Numero    : 071 reserve par le protocole du chantier, absent de server/bdd,
--             de toutes les branches et de tous les worktrees au 21/09/2026.
-- ============================================================================

BEGIN;

-- Defauts des types de contrat : meme motif que 027, le libelle du defaut suit.
INSERT INTO default_type_contrat (code, label) VALUES
  ('simple',  'Standard'),
  ('interne', 'Interne')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label;

-- Type Interne (#219), plage contrats 3000-3099, premiers codes libres.
INSERT INTO code_retour (code, type, libelle) VALUES
  (3030, 'erreur', 'La société prêteuse est obligatoire pour un contrat de type Interne'),
  (3031, 'erreur', 'La société prêteuse doit être différente de la société signataire'),
  (3032, 'erreur', 'Un contrat de type Interne ne porte pas de revendeur : le signataire côté vendeur est la société prêteuse'),
  (3033, 'erreur', 'La société prêteuse est réservée aux contrats de type Interne'),
  (3034, 'erreur', 'Société prêteuse introuvable')
ON CONFLICT (code) DO NOTHING;

COMMIT;
