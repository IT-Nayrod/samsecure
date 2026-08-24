-- ============================================================================
-- SamSecure - BDD Commune - Migration 030
-- Fichier   : 030_commune_code_retour_inventaire_seed.sql
-- Objet     : seed de code_retour pour le module 3, inventaire (US #111) :
--             plage 4000-4099, ouverte conformement a l'en-tete de 024
--             ("4000 et plus modules 3 et 4"). Libelles repris du
--             pre-catalogue server/docs/codes_retour.md, section Inventaire.
--             Aucun DDL : migration de donnees uniquement.
-- Cible     : PostgreSQL 16 - base Commune, apres 029 (mot "commune" dans le nom)
-- Exécution : npm run migrate:dev / migrate:staging
-- Rejouable : ON CONFLICT (code) DO UPDATE sur type et libelle, meme motif
--             que 025. Un code ne change jamais de sens.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  -- Succes
  (4000, 'succes', 'Liste des imports d''inventaire'),
  (4001, 'succes', 'Detail de l''import'),
  (4002, 'succes', 'Import d''inventaire effectue'),
  (4003, 'succes', 'Liste des releves d''inventaire'),
  (4004, 'succes', 'Detail du releve'),
  (4005, 'succes', 'Ecarts d''inventaire'),
  (4006, 'succes', 'Releve rapproche de l''affectation'),
  (4007, 'succes', 'Releve marque en ecart assume'),
  (4008, 'succes', 'Releve rejete'),
  (4009, 'succes', 'Releve remis en attente'),
  (4010, 'succes', 'Liste des affectations rapprochables'),
  (4011, 'avertissement', 'Import effectue avec des lignes en erreur'),
  -- Erreurs
  (4020, 'erreur', 'Import introuvable'),
  (4021, 'erreur', 'Releve introuvable'),
  (4022, 'erreur', 'Aucun fichier n''a ete transmis'),
  (4023, 'erreur', 'Extension non admise, format accepte csv'),
  (4024, 'erreur', 'Le fichier depasse la taille maximale de 20 Mo'),
  (4025, 'erreur', 'Un seul fichier peut etre depose'),
  (4026, 'erreur', 'Fichier vide ou illisible, encodage UTF-8 attendu'),
  (4027, 'erreur', 'Colonnes obligatoires absentes : produit, reference, quantite'),
  (4028, 'erreur', 'Aucune ligne exploitable, import en echec'),
  (4029, 'erreur', 'Societe introuvable'),
  (4030, 'erreur', 'Valeur de filtre invalide'),
  (4031, 'erreur', 'L''affectation est obligatoire'),
  (4032, 'erreur', 'Affectation introuvable'),
  (4033, 'erreur', 'Transition de statut non permise pour ce releve'),
  (4034, 'erreur', 'Le motif de rejet est obligatoire'),
  (4035, 'reserve', 'Fichier archive introuvable, contenu du releve indisponible'),
  (4036, 'erreur', 'Le fichier depasse le nombre maximal de lignes'),
  -- Traces audit_log (la route repond son propre code)
  (4050, 'trace', 'Inventaire importe'),
  (4051, 'trace', 'Releve rapproche'),
  (4052, 'trace', 'Releve marque en ecart assume'),
  (4053, 'trace', 'Releve rejete'),
  (4054, 'trace', 'Releve remis en attente'),
  (4099, 'erreur', 'Erreur serveur inattendue (module inventaire)')
ON CONFLICT (code) DO UPDATE SET type = EXCLUDED.type, libelle = EXCLUDED.libelle;

COMMIT;
