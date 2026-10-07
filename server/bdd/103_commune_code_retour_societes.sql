-- ============================================================================
-- SamSecure - BDD Commune - Migration 103
-- Fichier   : 103_commune_code_retour_societes.sql
-- Objet     : codes retour 2090 a 2093 (plage administration 2000-2999) du
--             chantier #281 (issue 60) : suppression douce controlee et
--             desactivation des societes, regle du ticket #62. Rediges au
--             pre-catalogue (server/docs/codes_retour.md, section Societes).
--             Aucun DDL : la date de desactivation (societe.date_fin_activite,
--             002) et la suppression douce (societe.date_suppression, 008)
--             existent deja. Le numero avait ete reserve cote Tenant ; faute
--             de colonne a ajouter il est employe cote Commune pour le seed
--             des codes - ecart signale au journal du chantier, a valider
--             avant de jouer.
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom)
-- Execution : npm run migrate:dev / migrate:staging, puis redemarrage de l'API
--             (catalogue code_retour charge au demarrage)
-- Depend    : 024 (code_retour)
-- Rejouable : ON CONFLICT DO NOTHING, aucune suppression.
-- Numero    : 103 reserve par le chantier societes-suppression, libre dans
--             server/bdd et sur les branches au 07/10/2026
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  (2090, 'erreur', 'Suppression impossible : des objets se raccrochent encore à la société'),
  (2091, 'trace',  'Société supprimée (suppression douce)'),
  (2092, 'trace',  'Société désactivée'),
  (2093, 'trace',  'Société réactivée')
ON CONFLICT (code) DO NOTHING;

COMMIT;
