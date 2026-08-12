-- ============================================================================
-- SamSecure - BDD Tenant - Migration 023
-- Fichier   : 023_utilisateur_drop_date_suppression.sql
-- Objet     : suppression de utilisateur.date_suppression. La gestion des
--             comptes ne passe plus que par actif : activation et
--             desactivation, aucune suppression logique.
--
--             La colonne devenait un piege : deux etats de retrait
--             coexistaient, date_suppression et actif, et le code n'en testait
--             qu'un seul selon les endroits. Un compte pouvait etre desactive
--             sans que rien ne le bloque, ou supprime sans etre desactive.
--             Un seul etat, une seule verite.
--
--             Attention : les autres tables conservent leur date_suppression,
--             elles relevent d'une autre doctrine (arbitrage soft delete D11
--             toujours ouvert). Seule la table utilisateur est concernee.
--
--             Une desactivation differee se pose sur date_finale, deja
--             controlee au login et dans le calcul des droits : inutile
--             d'ajouter une colonne pour cela.
-- Cible     : PostgreSQL - base Tenant, a jouer sur dev ET staging
-- Prealable : plus aucune ligne en soft-delete, migration 022 puis purge
--             definitive du 12/08.
-- Valide    : Antonin, 12/08/2026, en attente de confirmation Dorian
-- Rejouable : IF EXISTS.
-- ============================================================================

BEGIN;

-- Garde-fou : la migration echoue plutot que de detruire des comptes encore
-- marques supprimes, qui disparaitraient alors sans laisser de trace.
DO $$
DECLARE restants integer;
BEGIN
  SELECT count(*) INTO restants FROM utilisateur WHERE date_suppression IS NOT NULL;
  IF restants > 0 THEN
    RAISE EXCEPTION 'Migration 023 refusee : % compte(s) encore en soft-delete. Les traiter avant de retirer la colonne.', restants;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_utilisateur_date_supp;
ALTER TABLE utilisateur DROP COLUMN IF EXISTS date_suppression;

COMMENT ON COLUMN utilisateur.actif IS
  'Seul etat de retrait d''un compte. false = desactive : connexion refusee, aucun droit effectif, compte visible a l''ecran et reactivable. Une desactivation programmee se pose sur date_finale.';

COMMIT;
