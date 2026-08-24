-- ============================================================================
-- SamSecure - BDD Commune - Migration 028
-- Fichier   : 028_commune_code_retour_licences.sql
-- Objet     : seed de code_retour pour le module 3, partie A, licences (US #102),
--             plage 4000-4099 reservee aux modules 3 et 4 par l'en-tete de 024.
--             Decoupage : 4000-4009 succes licences, 4010-4029 erreurs de
--             validation et de reference, 4030-4039 historique de maintenance,
--             4040-4049 arret et reprise de maintenance, 4050-4059 referentiels
--             du module (produits du catalogue, unites de mesure, mainteneurs),
--             4099 erreur serveur du module.
--             Libelles reportes dans server/docs/codes_retour.md, section
--             "Licences (#102)".
-- Cible     : PostgreSQL 16 - base Commune, apres 025
-- Exécution : npm run migrate:dev / migrate:staging
-- Rejouable : ON CONFLICT (code) DO UPDATE sur type et libelle, meme motif que
--             025 (referentiel technique non personnalisable, la derniere
--             livraison fait foi).
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  -- Licences (#102) : succes
  (4000, 'succes', 'Liste des licences'),  -- GET /api/licences
  (4001, 'succes', 'Detail de la licence'),  -- GET /api/licences/:id
  (4002, 'succes', 'Licence creee'),  -- POST /api/licences
  (4003, 'succes', 'Licence modifiee'),  -- PATCH /api/licences/:id
  (4004, 'succes', 'Licence supprimee'),  -- DELETE /api/licences/:id
  (4005, 'succes', 'Historique de maintenance de la licence'),  -- GET /api/licences/:id/maintenance
  (4006, 'succes', 'Periode de maintenance ajoutee'),  -- POST /api/licences/:id/maintenance
  (4007, 'succes', 'Periode de maintenance modifiee'),  -- PATCH /api/licences/:id/maintenance/:mid
  (4008, 'succes', 'Periode de maintenance supprimee'),  -- DELETE /api/licences/:id/maintenance/:mid
  (4009, 'succes', 'Maintenance arretee, version figee'),  -- POST /api/licences/:id/arret-maintenance
  -- Licences (#102) : erreurs de validation et de reference
  (4010, 'erreur', 'Licence introuvable'),  -- GET/PATCH/DELETE /api/licences/:id et sous-routes
  (4011, 'erreur', 'Le produit est obligatoire'),  -- POST, PATCH /api/licences
  (4012, 'erreur', 'Produit introuvable au catalogue'),  -- POST, PATCH /api/licences
  (4013, 'erreur', 'Edition introuvable ou etrangere au produit'),  -- POST, PATCH /api/licences
  (4014, 'erreur', 'Version introuvable ou etrangere au produit'),  -- POST, PATCH /api/licences
  (4015, 'erreur', 'Commande introuvable'),  -- POST, PATCH /api/licences
  (4016, 'erreur', 'Revendeur introuvable'),  -- POST, PATCH /api/licences
  (4017, 'erreur', 'Unite de mesure introuvable'),  -- POST, PATCH /api/licences
  (4018, 'erreur', 'Le type de licence doit etre perpetuelle ou souscription'),  -- POST, PATCH /api/licences
  (4019, 'erreur', 'La quantite doit etre un entier positif ou nul'),  -- POST, PATCH /api/licences
  (4020, 'erreur', 'Le cout doit etre un montant positif ou nul'),  -- POST, PATCH /api/licences
  (4021, 'erreur', 'La date de fin de souscription est obligatoire pour une souscription'),  -- POST, PATCH /api/licences
  (4022, 'erreur', 'Mainteneur introuvable'),  -- POST, PATCH /api/licences et maintenance
  (4023, 'erreur', 'Suppression impossible : elements lies'),  -- DELETE /api/licences/:id
  (4024, 'erreur', 'Date invalide'),  -- POST, PATCH /api/licences et maintenance
  -- Licences (#102) : historique de maintenance
  (4030, 'erreur', 'Periode de maintenance introuvable'),  -- PATCH/DELETE /api/licences/:id/maintenance/:mid
  (4031, 'erreur', 'La date de debut est obligatoire'),  -- POST, PATCH .../maintenance
  (4032, 'erreur', 'La date de fin doit etre posterieure a la date de debut'),  -- POST, PATCH .../maintenance
  (4033, 'erreur', 'Le cout de maintenance doit etre un montant positif ou nul'),  -- POST, PATCH .../maintenance
  -- Licences (#102) : arret et reprise de maintenance
  (4040, 'erreur', 'La maintenance de cette licence est deja arretee'),  -- POST .../arret-maintenance
  (4041, 'erreur', 'La date d''arret est invalide'),  -- POST .../arret-maintenance
  (4042, 'erreur', 'Version a figer introuvable ou etrangere au produit'),  -- POST .../arret-maintenance
  (4043, 'erreur', 'Cette licence ne porte aucune maintenance a arreter'),  -- POST .../arret-maintenance
  (4044, 'succes', 'Maintenance reprise, version liberee'),  -- POST .../reprise-maintenance
  (4045, 'erreur', 'La maintenance de cette licence n''est pas arretee'),  -- POST .../reprise-maintenance
  -- Licences (#102) : referentiels du module
  (4050, 'succes', 'Catalogue des produits (versions et editions incluses)'),  -- GET /api/produits
  (4051, 'succes', 'Liste des unites de mesure'),  -- GET /api/unites-mesure
  (4052, 'succes', 'Liste des mainteneurs'),  -- GET /api/mainteneurs
  (4059, 'erreur', 'Erreur serveur inattendue (referentiels du module licences)'),  -- les trois
  -- Licences (#102) : erreur serveur
  (4099, 'erreur', 'Erreur serveur inattendue (module licences)')  -- toutes
ON CONFLICT (code) DO UPDATE SET
  type    = EXCLUDED.type,
  libelle = EXCLUDED.libelle;

COMMIT;
