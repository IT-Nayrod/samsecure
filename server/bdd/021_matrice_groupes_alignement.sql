-- ============================================================================
-- SamSecure - BDD Tenant - Migration 021
-- Fichier   : 021_matrice_groupes_alignement.sql
-- Objet     : aligne la matrice des groupes sur l'etat de reference (staging)
--             et la rend coherente avec ce que les ecrans chargent reellement.
--             L'activation du controle des permissions sur l'API a revele deux
--             defauts que le masquage des boutons cachait :
--
--             1. it_data_input n'est attribue dans aucune migration : la 011
--                ne traite que manager_dsi, financier, it_ops et admin_sam.
--                Le groupe existait donc sans aucun droit, et ses porteurs
--                voyaient les six ecrans du module 2 en "Chargement impossible".
--
--             2. La matrice accordait des droits de saisie sans le droit de
--                consulter la meme ressource. Un groupe pouvait ainsi detenir
--                saisir_contrat sans consulter_contrats, donc sans pouvoir
--                ouvrir l'ecran ou l'exercer.
--
--             REGLE POSEE ICI, valable pour tout groupe futur : un droit de
--             saisie implique le droit de consultation de la meme ressource.
--
--             Le retrait sur manager_dsi applique la decision de la 011,
--             "jamais de permission administration pour ces 3 groupes", actee
--             avec Dorian. Staging avait derive, vraisemblablement par des
--             essais dans le simulateur de droits : le profil de test test_sau
--             porte exactement les deux memes permissions.
-- Cible     : PostgreSQL - base Tenant, a jouer sur dev ET staging
-- Valide    : Antonin, 12/08/2026, en attente de confirmation Dorian
-- Rejouable : ON CONFLICT DO NOTHING a l'ajout, garde sur date_suppression au
--             retrait.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- IT Data input : saisie de donnees, perimetre restreint.
-- Les 5 permissions de reference, plus les 3 consultations qu'elles impliquent.
-- ----------------------------------------------------------------------------
INSERT INTO profil_permission (id_profil, id_permission)
SELECT p.id, perm.id
FROM profil p
JOIN permission perm ON perm.code IN (
  -- Reference
  'consulter_referentiels',
  'saisir_contrat', 'saisir_commande', 'deposer_facture_preuve', 'saisir_affectation',
  -- Consultations impliquees : sans elles, les droits de saisie ci-dessus sont
  -- inexercables, l'ecran qui les porte ne se charge pas.
  'consulter_contrats',   -- exige par saisir_contrat et saisir_commande
  'consulter_factures',   -- exige par deposer_facture_preuve
  'consulter_inventaire'  -- exige par saisir_affectation, comme pour it_ops
)
WHERE p.code = 'it_data_input'
ON CONFLICT (id_profil, id_permission) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Manager DSI : retrait des deux permissions d'administration.
-- Soft delete et non DELETE : la trace du retrait doit rester lisible, et une
-- ligne soft-supprimee resiste a un rejeu de la 011, dont le ON CONFLICT DO
-- NOTHING ne la ressuscitera pas.
-- ----------------------------------------------------------------------------
UPDATE profil_permission pp
   SET date_suppression = now()
  FROM profil p, permission perm
 WHERE pp.id_profil = p.id
   AND pp.id_permission = perm.id
   AND p.code = 'manager_dsi'
   AND perm.code IN ('gerer_utilisateurs', 'consulter_audit_log')
   AND pp.date_suppression IS NULL;

COMMIT;
