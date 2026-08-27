-- ============================================================================
-- SamSecure - BDD Commune - Migration 030
-- Fichier   : 030_commune_code_retour_inventaire_seed.sql
-- Objet     : seed de code_retour pour le module 3, inventaire (US #111) :
--             plage 4200-4299, ouverte conformement a l'en-tete de 024
--             ("4200 et plus modules 3 et 4"). Libelles repris du
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
  (4200, 'succes', 'Liste des imports d''inventaire'),
  (4201, 'succes', 'Detail de l''import'),
  (4202, 'succes', 'Import d''inventaire effectue'),
  (4203, 'succes', 'Liste des releves d''inventaire'),
  (4204, 'succes', 'Detail du releve'),
  (4205, 'succes', 'Ecarts d''inventaire'),
  (4206, 'succes', 'Releve rapproche de l''affectation'),
  (4207, 'succes', 'Releve marque en ecart assume'),
  (4208, 'succes', 'Releve rejete'),
  (4209, 'succes', 'Releve remis en attente'),
  (4210, 'succes', 'Liste des affectations rapprochables'),
  (4211, 'avertissement', 'Import effectue avec des lignes en erreur'),
  -- Erreurs
  (4220, 'erreur', 'Import introuvable'),
  (4221, 'erreur', 'Releve introuvable'),
  (4222, 'erreur', 'Aucun fichier n''a ete transmis'),
  (4223, 'erreur', 'Extension non admise, format accepte csv'),
  (4224, 'erreur', 'Le fichier depasse la taille maximale de 20 Mo'),
  (4225, 'erreur', 'Un seul fichier peut etre depose'),
  (4226, 'erreur', 'Fichier vide ou illisible, encodage UTF-8 attendu'),
  (4227, 'erreur', 'Colonnes obligatoires absentes : produit, reference, quantite'),
  (4228, 'erreur', 'Aucune ligne exploitable, import en echec'),
  (4229, 'erreur', 'Societe introuvable'),
  (4230, 'erreur', 'Valeur de filtre invalide'),
  (4231, 'erreur', 'L''affectation est obligatoire'),
  (4232, 'erreur', 'Affectation introuvable'),
  (4233, 'erreur', 'Transition de statut non permise pour ce releve'),
  (4234, 'erreur', 'Le motif de rejet est obligatoire'),
  (4235, 'reserve', 'Fichier archive introuvable, contenu du releve indisponible'),
  (4236, 'erreur', 'Le fichier depasse le nombre maximal de lignes'),
  -- Traces audit_log (la route repond son propre code)
  (4250, 'trace', 'Inventaire importe'),
  (4251, 'trace', 'Releve rapproche'),
  (4252, 'trace', 'Releve marque en ecart assume'),
  (4253, 'trace', 'Releve rejete'),
  (4254, 'trace', 'Releve remis en attente'),
  (4299, 'erreur', 'Erreur serveur inattendue (module inventaire)')
ON CONFLICT (code) DO UPDATE SET type = EXCLUDED.type, libelle = EXCLUDED.libelle;

COMMIT;
