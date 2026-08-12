-- ============================================================================
-- SamSecure - BDD Tenant - Migration 022
-- Fichier   : 022_desactivation_remplace_suppression.sql
-- Objet     : la suppression logique d'un utilisateur est abandonnee au profit
--             de la desactivation. Un compte retire reste visible a l'ecran,
--             porte le statut Desactive et peut etre reactive.
--
--             Deux raisons. D'usage : un compte disparu de la liste ne peut
--             plus etre reactive par l'interface, il fallait passer en base.
--             De securite : date_suppression etait le seul etat de retrait
--             teste au login et au calcul des droits, alors que la colonne
--             actif existait deja et n'etait verifiee nulle part. Un compte
--             mis a actif = false conservait donc tous ses droits.
--
--             Les comptes deja supprimes logiquement basculent en desactives.
--             Leurs rattachements, groupes et exceptions ne sont PAS restaures
--             (decision du 12/08) : la suppression les avait retires, la
--             reactivation eventuelle passera par une reattribution explicite.
-- Cible     : PostgreSQL - base Tenant, a jouer sur dev ET staging
-- Valide    : Antonin, 12/08/2026, en attente de confirmation Dorian
-- Rejouable : apres un premier passage, plus aucune ligne ne porte
--             date_suppression, le UPDATE ne touche rien.
-- ============================================================================

BEGIN;

UPDATE utilisateur
   SET actif = false,
       date_suppression = NULL
 WHERE date_suppression IS NOT NULL;

COMMENT ON COLUMN utilisateur.date_suppression IS
  'Vestige de la suppression logique, abandonnee par la migration 022 au profit de actif = false. Doit rester NULL : le retrait d''un compte se fait desormais par desactivation, jamais par suppression.';
COMMENT ON COLUMN utilisateur.actif IS
  'false = compte desactive : connexion refusee, aucun droit effectif, mais le compte reste visible a l''ecran utilisateurs et reactivable.';

COMMIT;
