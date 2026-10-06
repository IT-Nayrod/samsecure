-- ============================================================================
-- SamSecure - Recette fonctionnelle - 00_reset_tenant.sql
-- Objet     : vider les tables métier du tenant avant rechargement du jeu de
--             recette (01_jeu_recette.sql). Conserve intégralement la
--             configuration et les référentiels du tenant : tenant_config,
--             sociétés, utilisateurs, éditeurs, revendeurs, mainteneurs,
--             contacts, profils par défaut et système avec leurs matrices
--             (profil_permission, profil_societe, utilisateur_profil_societe,
--             utilisateur_societe), permissions, seuils diffusés
--             (seuil_dashboard), types de preuve, de contrat, de licence,
--             unités de mesure (métriques), modes de commande, fonctions,
--             statuts de validation, connecteurs, abonnement, langues (BDD
--             Commune, jamais touchée ici).
-- Cible     : base TENANT uniquement. Aucun nom de base dans ce fichier :
--             la base est choisie par l'option -d de psql.
-- Exécution : psql -v ON_ERROR_STOP=1 -d <base_tenant> -f 00_reset_tenant.sql
-- Rejouable : oui, sans effet de bord au second passage.
-- Notes     :
--   - TRUNCATE nominatif sans CASCADE : toutes les tables qui référencent une
--     table de la liste figurent dans la même liste (vérifié sur pg_constraint,
--     aucune FK entrante depuis une table conservée).
--   - Les groupes personnalisés (profil.type = 'groupe') sont supprimés par
--     DELETE ciblés, pour conserver les profils par défaut (profil_defaut) et
--     système (admin_sam) ainsi que leurs matrices.
--   - tache_asynchrone (verrous journaliers du planificateur) et
--     preference_notification (préférences de courrier) font partie de l'état
--     « notifications » : remises à zéro, le jeu repose les préférences utiles.
--   - Transaction unique : tout ou rien.
-- ============================================================================

BEGIN;

-- 1. Données métier, journaux et précalculs. Un seul TRUNCATE multi-tables :
--    l'ordre des dépendances est porté par l'atomicité de l'instruction
--    (notification -> alerte, facture -> preuve -> licence -> commande ->
--    contrat, affectation -> licence, revalidation / inventaire_raw ->
--    affectation, budget / maintenance / historiques -> licence,
--    déclinaisons -> produit_client).
TRUNCATE TABLE
  notification,
  alerte,
  preference_notification,
  tache_asynchrone,
  inventaire_raw,
  log_import,
  collecte_log,
  facture,
  preuve,
  budget,
  licence_version_historique,
  maintenance_historique,
  revalidation,
  historique_declaration,
  affectation,
  pre_parametre_licence,
  licence,
  commande,
  contrat,
  produit_composition,
  version_client,
  edition_client,
  version_complement,
  edition_complement,
  produit_client,
  workflow_validation,
  anomalie_qualite,
  precalcul_conformite,
  precalcul_financier,
  journal_ecriture,
  audit_log,
  exception_droit;

-- 2. Groupes personnalisés : attributions, matrices, diffusions, puis les
--    groupes eux-mêmes (corbeille comprise). Les profils par défaut et le
--    profil système admin_sam ne sont pas touchés.
DELETE FROM utilisateur_profil_societe ups
 USING profil p
 WHERE ups.id_profil = p.id AND p.type = 'groupe';

DELETE FROM profil_permission pp
 USING profil p
 WHERE pp.id_profil = p.id AND p.type = 'groupe';

DELETE FROM profil_societe ps
 USING profil p
 WHERE ps.id_profil = p.id AND p.type = 'groupe';

DELETE FROM profil
 WHERE type = 'groupe';

COMMIT;
