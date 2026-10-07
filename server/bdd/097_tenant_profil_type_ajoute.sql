-- ============================================================================
-- SamSecure - BDD Tenant - Migration 097
-- Fichier   : 097_tenant_profil_type_ajoute.sql
-- Objet     : tout est profil (#276, decision client du 06/10/2026) : il n'y a
--             plus de groupes personnalises, les groupes existants deviennent
--             des profils ajoutes.
--             1. profil.type accepte la valeur 'ajoute' (profil cree par
--                l'administrateur, CRUD complet, corbeille 90 jours #64,
--                matrices par defaut et par societe comme un profil par
--                defaut). La valeur 'groupe' reste admise par la contrainte :
--                plus aucune ecriture ne la pose, son retrait serait un
--                resserrement hors demande (journal du chantier, a arbitrer
--                plus tard).
--             2. UPDATE borne : les lignes de type 'groupe' passent en
--                'ajoute', lignes conservees, corbeille comprise (un groupe
--                supprime devient un profil ajoute supprime, restaurable aux
--                memes conditions). Justification : decision du 06/10, "les
--                groupes existants deviennent des profils ajoutes" (#276).
--                it_data_input reste profil par defaut : statu quo, aucune
--                ligne touchee (validation Samuel en attente, cf. journal).
--             3. purger_corbeille_profils() remplacee (meme signature que la
--                075) : la purge couvre type IN ('groupe','ajoute') et
--                nettoie d'abord les references sans ON DELETE CASCADE vers
--                profil apparues depuis la 075 : profil_societe_permission et
--                profil_societe_configuration (092), et la colonne inerte
--                utilisateur.id_profil (094, plus lue nulle part). Sans ce
--                nettoyage, la purge d'un profil ajoute configure par societe
--                echoue en 23503 et GET /profils/corbeille repond 500 (#282).
-- Cible     : PostgreSQL 16 - base Tenant, a jouer sur dev ET staging
-- Execution : npm run migrate:dev / migrate:staging, AVANT le deploiement du
--             code du chantier tout-profil (la creation d'un profil ajoute
--             ecrit type='ajoute')
-- Depend    : 074 (profil.type, ck_profil_type), 075 (fonction v1),
--             092 (profil_societe_permission, profil_societe_configuration),
--             094 (utilisateur.id_profil)
-- Rejouable : oui (DROP CONSTRAINT IF EXISTS + ADD, UPDATE borne sans effet
--             au second passage, CREATE OR REPLACE, DELETE bornes de purge)
-- Numero    : 097 reserve par le chantier tout-profil, libre dans server/bdd
--             et sur toutes les branches au 07/10/2026
-- ============================================================================

BEGIN;

-- 1. Contrainte : la paire DROP IF EXISTS + ADD vaut redefinition et reste
-- rejouable. Les quatre valeurs sont validees sur l'existant (les lignes
-- 'groupe' restent admises, la bascule suit).
ALTER TABLE profil DROP CONSTRAINT IF EXISTS ck_profil_type;
ALTER TABLE profil ADD CONSTRAINT ck_profil_type
  CHECK (type IN ('profil_defaut', 'groupe', 'systeme', 'ajoute'));

COMMENT ON COLUMN profil.type IS
  'profil_defaut (seede, ni suppression ni renommage), systeme (admin_sam, fige), ajoute (cree par l''administrateur, CRUD et corbeille #64, matrices comme un profil par defaut). groupe : valeur historique, basculee en ajoute par la 097 (tout est profil, 06/10/2026).';

-- 2. Bascule bornee des groupes existants (actifs ET en corbeille) : decision
-- client du 06/10/2026 (#276), les groupes deviennent des profils ajoutes.
-- Rejouable : plus aucune ligne 'groupe' au second passage.
UPDATE profil SET type = 'ajoute' WHERE type = 'groupe';

-- 3. Purge de la corbeille, version 097. Meme signature et meme motif que la
-- 075 (appelee au fil de l'eau par GET /profils/corbeille, aucun
-- ordonnanceur) ; DELETE bornes aux profils ajoutes (jamais un profil par
-- defaut ni systeme) supprimes depuis plus de 90 jours. L'ordre des
-- suppressions suit les contraintes : d'abord les tables sans ON DELETE
-- CASCADE vers profil (utilisateur_profil_societe 002, matrices par societe
-- 092, colonne inerte utilisateur.id_profil 094), puis profil
-- (profil_permission, profil_societe et profil_widget cascadent).
CREATE OR REPLACE FUNCTION purger_corbeille_profils()
RETURNS TABLE (groupes_purges INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  v_purges INTEGER := 0;
BEGIN
  DELETE FROM profil_societe_permission psp
   USING profil p
   WHERE psp.id_profil = p.id
     AND p.type IN ('groupe', 'ajoute')
     AND p.date_suppression IS NOT NULL
     AND p.date_suppression < now() - INTERVAL '90 days';

  DELETE FROM profil_societe_configuration psc
   USING profil p
   WHERE psc.id_profil = p.id
     AND p.type IN ('groupe', 'ajoute')
     AND p.date_suppression IS NOT NULL
     AND p.date_suppression < now() - INTERVAL '90 days';

  -- Colonne abandonnee par le correctif multi-profils (plus lue nulle part) :
  -- detachee par precaution, sa contrainte referencant profil n'a pas de
  -- cascade et bloquerait la purge.
  UPDATE utilisateur u
     SET id_profil = NULL
    FROM profil p
   WHERE u.id_profil = p.id
     AND p.type IN ('groupe', 'ajoute')
     AND p.date_suppression IS NOT NULL
     AND p.date_suppression < now() - INTERVAL '90 days';

  DELETE FROM utilisateur_profil_societe ups
   USING profil p
   WHERE ups.id_profil = p.id
     AND p.type IN ('groupe', 'ajoute')
     AND p.date_suppression IS NOT NULL
     AND p.date_suppression < now() - INTERVAL '90 days';

  DELETE FROM profil p
   WHERE p.type IN ('groupe', 'ajoute')
     AND p.date_suppression IS NOT NULL
     AND p.date_suppression < now() - INTERVAL '90 days';
  GET DIAGNOSTICS v_purges = ROW_COUNT;

  RETURN QUERY SELECT v_purges;
END;
$$;

COMMENT ON FUNCTION purger_corbeille_profils() IS
  'Purge bornee de la corbeille des profils ajoutes (#64, tout est profil 097) : profils de type groupe ou ajoute supprimes depuis plus de 90 jours, avec leurs attributions, leurs matrices par societe (092) et la colonne inerte utilisateur.id_profil (094). Appelee par GET /profils/corbeille.';

COMMIT;
