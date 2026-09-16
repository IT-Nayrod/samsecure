-- ============================================================================
-- SamSecure - BDD Commune - Migration 059
-- Fichier   : 059_commune_code_retour_logiciel.sql
-- Objet     : terminologie "logiciel" (A67, decision D47) : dans l'interface,
--             "logiciel" remplace "produit". Cette migration reecrit les
--             libelles du catalogue code_retour qui contiennent "produit",
--             alignes sur server/docs/codes_retour.md mis a jour dans le
--             meme lot. Seul le mot change : ni la formulation, ni le type,
--             ni le code. Onze libelles concernes, releves par relecture de
--             l'ensemble des migrations Commune (025 a 057, ON CONFLICT
--             compris) : 4011, 4012, 4013, 4014, 4042, 4050, 4118, 4300,
--             4312, 5313, 5314.
--             Exclu : 4227 "Colonnes obligatoires absentes : produit,
--             reference, quantite", qui cite les noms de colonnes du CSV
--             d'import d'inventaire (identifiants techniques, meme doctrine
--             que la 057 sur les valeurs d'enumeration).
--             Les identifiants techniques (id_produit, produit_client,
--             produit_referentiel, routes /produits, axe "produit") ne
--             bougent pas.
--             Modele : migration 057 (INSERT ... ON CONFLICT (code) DO UPDATE
--             SET libelle). Le type est porte par l'INSERT pour un catalogue
--             incomplet, mais jamais reecrit sur un code existant.
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom :
--             migrate.js route sur commonPool), apres 058.
-- Exécution : npm run migrate:dev / migrate:staging, puis redemarrage de
--             l'API (catalogue charge au demarrage).
-- Depend    : 024 (table code_retour), 057 (libelles accentues).
-- Rejouable : ON CONFLICT (code) DO UPDATE, un second passage reecrit a
--             l'identique. Aucun DDL, aucune suppression.
-- Numero    : 059 absent de server/bdd et de toutes les branches locales au
--             16/09/2026, numero reserve par le protocole.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  (4011, 'erreur', 'Le logiciel est obligatoire'),
  (4012, 'erreur', 'Logiciel introuvable au catalogue'),
  (4013, 'erreur', 'Édition introuvable ou étrangère au logiciel'),
  (4014, 'erreur', 'Version introuvable ou étrangère au logiciel'),
  (4042, 'erreur', 'Version à figer introuvable ou étrangère au logiciel'),
  (4050, 'succes', 'Catalogue des logiciels (versions et éditions incluses)'),
  (4118, 'erreur', 'Identifiant de logiciel invalide'),
  (4300, 'succes', 'État de conformité par logiciel'),
  (4312, 'erreur', 'Identifiant de logiciel invalide'),
  (5313, 'erreur', 'Logiciel parent introuvable'),
  (5314, 'erreur', 'Un logiciel ne peut pas être son propre parent')
ON CONFLICT (code) DO UPDATE SET
  libelle = EXCLUDED.libelle;

COMMIT;
