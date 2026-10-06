-- ============================================================================
-- SamSecure - BDD Tenant - Migration 075
-- Fichier   : 075_tenant_corbeille_profils.sql
-- Objet     : corbeille des groupes (#64), cote base. ECART CONSTATE : la
--             commande demandait d'ajouter date_suppression sur profil, mais
--             la colonne existe depuis la 008 et la suppression douce est deja
--             le comportement de DELETE /profils/:id (profil et lignes liees
--             horodatees dans la meme transaction). Cette migration ne porte
--             donc que ce qui manque : la purge au-dela de 90 jours, fonction
--             purger_corbeille_profils() sur le modele de purger_notifications
--             (051, #121). DELETE bornes : uniquement les groupes (type =
--             'groupe', jamais un profil par defaut ni systeme) supprimes
--             depuis plus de 90 jours. utilisateur_profil_societe ne porte pas
--             de ON DELETE CASCADE vers profil : les attributions du groupe
--             purge se suppriment d'abord ; profil_permission, profil_societe
--             et profil_widget cascadent. Appelee au fil de l'eau par
--             GET /profils/corbeille (modele purgeExceptionsExpirees).
-- Cible     : PostgreSQL 16 - base Tenant, a jouer sur dev ET staging
-- Execution : npm run migrate
-- Depend    : 008 (date_suppression), 074 (profil.type)
-- Rejouable : oui (CREATE OR REPLACE, DELETE bornes sans effet au rejeu)
-- Numero    : 075
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION purger_corbeille_profils()
RETURNS TABLE (groupes_purges INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  v_groupes INTEGER := 0;
BEGIN
  DELETE FROM utilisateur_profil_societe ups
   USING profil p
   WHERE ups.id_profil = p.id
     AND p.type = 'groupe'
     AND p.date_suppression IS NOT NULL
     AND p.date_suppression < now() - INTERVAL '90 days';

  DELETE FROM profil p
   WHERE p.type = 'groupe'
     AND p.date_suppression IS NOT NULL
     AND p.date_suppression < now() - INTERVAL '90 days';
  GET DIAGNOSTICS v_groupes = ROW_COUNT;

  RETURN QUERY SELECT v_groupes;
END;
$$;

COMMENT ON FUNCTION purger_corbeille_profils() IS
  'Purge bornee de la corbeille des groupes (#64) : groupes (type groupe uniquement) supprimes depuis plus de 90 jours, attributions comprises. Appelee par GET /profils/corbeille.';

COMMIT;
