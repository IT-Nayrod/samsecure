-- ============================================================================
-- SamSecure - BDD Commune - Migration 048
-- Fichier   : 048_commune_code_retour_contacts.sql
-- Objet     : seed de code_retour pour le referentiel contacts (module 4,
--             #181), plage 5240-5259, a la suite des revendeurs (5220-5239,
--             migration 045).
--             Meme decoupage compact que la 045, la plage n'ayant pas de x99 :
--             5240-5246 succes, 5247-5256 erreurs (dont 5256, erreur serveur
--             du module), 5257-5259 traces audit_log. Deux codes portent des
--             messages surcharges par la route (5249 et 5251, 5253),
--             precedent des codes 3119 et 4024.
--             Libelles reportes dans server/docs/codes_retour.md.
--             Aucun DDL : migration de donnees uniquement.
-- Cible     : PostgreSQL 16 - base Commune, apres 045 (mot "commune" dans le
--             nom : migrate.js route sur commonPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Rejouable : ON CONFLICT (code) DO UPDATE sur type et libelle.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  -- Contacts : succes
  (5240, 'succes', 'Liste des contacts'),  -- GET /api/contacts
  (5241, 'succes', 'Detail du contact'),  -- GET /api/contacts/:id
  (5242, 'succes', 'Contact cree'),  -- POST /api/contacts
  (5243, 'succes', 'Contact modifie'),  -- PATCH /api/contacts/:id
  (5244, 'succes', 'Contact supprime'),  -- DELETE /api/contacts/:id
  (5245, 'succes', 'Suggestions de contacts'),  -- GET /api/contacts/recherche
  (5246, 'succes', 'Liste des fonctions'),  -- GET /api/fonctions
  -- Contacts : erreurs de validation et de reference
  (5247, 'erreur', 'Contact introuvable'),  -- GET/PATCH/DELETE /api/contacts/:id
  (5248, 'erreur', 'Le nom est obligatoire'),  -- POST, PATCH /api/contacts
  (5249, 'erreur', 'Saisie invalide'),  -- POST, PATCH /api/contacts ; message surcharge : adresse email ou telephone
  (5250, 'erreur', 'Fonction introuvable'),  -- POST, PATCH /api/contacts
  (5251, 'erreur', 'Rattachement introuvable'),  -- POST, PATCH /api/contacts ; message surcharge : societe, editeur ou revendeur
  (5252, 'erreur', 'Un contact porte au plus un rattachement'),  -- POST, PATCH /api/contacts
  (5253, 'erreur', 'Dates invalides'),  -- POST, PATCH /api/contacts ; message surcharge : format, ou fin anterieure au debut
  (5254, 'erreur', 'Un contact porte deja cette adresse email'),  -- POST, PATCH /api/contacts (409, details.existant)
  (5255, 'erreur', 'Un contact au nom tres proche existe deja'),  -- POST, PATCH /api/contacts (409, details.existant)
  (5256, 'erreur', 'Erreur serveur inattendue (referentiel contacts)'),  -- toutes
  -- Contacts : traces audit_log
  (5257, 'trace', 'Contact cree'),  -- POST /api/contacts
  (5258, 'trace', 'Contact modifie'),  -- PATCH /api/contacts/:id
  (5259, 'trace', 'Contact supprime')  -- DELETE /api/contacts/:id
ON CONFLICT (code) DO UPDATE SET
  type    = EXCLUDED.type,
  libelle = EXCLUDED.libelle;

COMMIT;
