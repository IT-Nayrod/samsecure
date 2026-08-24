-- ============================================================================
-- SamSecure - BDD Commune - Migration 025
-- Fichier   : 025_commune_code_retour_seed.sql
-- Objet     : seed de code_retour depuis le pre-catalogue
--             server/docs/codes_retour.md (etat de la branche agent-bdd-v4 au
--             24/08/2026) : 134 codes, plages 2000-2099 (administration #79),
--             3000-3099 (contrats #41), 3100-3199 (commandes #44), 3200-3299
--             (documents #48, #49, #50), 3300-3399 (validation #53), 3400-3499
--             (droits, transverse).
--             Genere par extraction des tableaux du pre-catalogue (colonnes
--             Code, Type, Libelle) : aucun libelle n'a ete invente ni
--             reformule. La colonne Route du pre-catalogue n'est pas portee
--             par le referentiel v4 et reste documentaire.
-- Cible     : PostgreSQL 16 - base Commune, apres 024
-- Exécution : npm run migrate:dev / migrate:staging
-- Rejouable : ON CONFLICT (code) DO UPDATE sur type et libelle. Le catalogue
--             est un referentiel technique non personnalisable : la derniere
--             livraison fait foi, sans motif protege. Un code retire du
--             pre-catalogue n'est PAS supprime ici (un code ne change jamais de
--             sens, il ne disparait pas non plus) : le retrait se fera par une
--             migration dediee, explicite.
-- Note      : la plage 1000-1999 (transverse, socle mail #87) est ouverte sur
--             la branche agent-mail et absente de cette branche ; a completer
--             lors de la fusion par un seed additionnel, meme motif.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  -- Administration des comptes, trace probante (#79)
  (2000, 'trace', 'Compte cree'),  -- POST /api/utilisateurs
  (2001, 'trace', 'Compte modifie'),  -- PATCH /api/utilisateurs/:id
  (2002, 'trace', 'Compte active'),  -- PATCH /api/utilisateurs/:id
  (2003, 'trace', 'Compte desactive'),  -- PATCH /api/utilisateurs/:id
  (2004, 'trace', 'Desactivation planifiee'),  -- PATCH /api/utilisateurs/:id
  (2005, 'trace', 'Planification levee'),  -- PATCH /api/utilisateurs/:id
  (2006, 'trace', 'Mise en fonction planifiee'),  -- PATCH /api/utilisateurs/:id
  (2007, 'erreur', 'Cet email est deja utilise'),  -- POST, PATCH /api/utilisateurs
  (2010, 'trace', 'Mot de passe defini par un administrateur'),  -- POST /api/utilisateurs
  (2011, 'reserve', '[PREREQUIS] Mail de reinitialisation envoye. Route inexistante'),  -- -
  (2012, 'reserve', '[PREREQUIS] Mot de passe reinitialise par lien. Route inexistante'),  -- -
  (2013, 'succes', 'Mot de passe defini'),  -- PUT /api/utilisateurs/:id/mot-de-passe
  (2014, 'succes', 'Mot de passe genere'),  -- POST /api/utilisateurs/:id/mot-de-passe/generer
  (2015, 'erreur', 'Le mot de passe ne respecte pas la politique'),  -- PUT /api/utilisateurs/:id/mot-de-passe
  (2016, 'erreur', 'Le mot de passe est obligatoire'),  -- PUT /api/utilisateurs/:id/mot-de-passe
  (2017, 'erreur', 'Cette action doit etre effectuee depuis l''interface'),  -- les deux
  (2018, 'trace', 'Mot de passe genere par un administrateur'),  -- POST /api/utilisateurs/:id/mot-de-passe/generer
  (2019, 'succes', 'Lien de reinitialisation genere'),  -- POST /api/utilisateurs/:id/mot-de-passe/reinitialisation
  (2020, 'trace', 'Groupe attribue'),  -- POST /api/utilisateurs/:id/profils
  (2021, 'trace', 'Groupe retire'),  -- DELETE /api/utilisateurs/:id/profils/:attribId
  (2022, 'trace', 'Exception de droit ajoutee'),  -- POST /api/utilisateurs/:id/exceptions
  (2023, 'trace', 'Exception de droit modifiee'),  -- PATCH /api/utilisateurs/:id/exceptions/:excId
  (2024, 'trace', 'Exception de droit supprimee'),  -- DELETE /api/utilisateurs/:id/exceptions/:excId
  (2025, 'succes', 'Lien de reinitialisation valide'),  -- GET /api/mot-de-passe/reinitialisation/:jeton
  (2026, 'succes', 'Mot de passe reinitialise'),  -- POST /api/mot-de-passe/reinitialisation/:jeton
  (2027, 'erreur', 'Ce lien n''est plus valide'),  -- GET, POST /api/mot-de-passe/reinitialisation/:jeton
  (2028, 'trace', 'Lien de reinitialisation emis par un administrateur'),  -- POST /api/utilisateurs/:id/mot-de-passe/reinitialisation
  (2029, 'erreur', 'Compte desactive, reactivation requise'),  -- POST /api/utilisateurs/:id/mot-de-passe/reinitialisation
  (2030, 'trace', 'Connexion reussie'),  -- POST /api/auth/login
  (2040, 'reserve', '[PREREQUIS] Execution d''une planification a l''echeance. Aucun ordonnanceur n''existe'),  -- -
  (2041, 'reserve', '[PREREQUIS] Activation de la double authentification. Aucune route serveur'),  -- -
  (2050, 'erreur', 'Utilisateur introuvable'),  -- GET /api/utilisateurs/:id/historique
  (2051, 'erreur', 'Cet utilisateur n''est pas dans votre perimetre'),  -- GET /api/utilisateurs/:id/historique
  (2052, 'succes', 'Historique du compte'),  -- GET /api/utilisateurs/:id/historique
  (2099, 'erreur', 'Erreur serveur inattendue (module administration)'),  -- toutes
  -- Contrats (#41)
  (3000, 'succes', 'Liste des contrats'),  -- GET /api/contrats
  (3001, 'succes', 'Detail du contrat'),  -- GET /api/contrats/:id
  (3002, 'succes', 'Contrat cree'),  -- POST /api/contrats
  (3003, 'succes', 'Contrat modifie'),  -- PATCH /api/contrats/:id
  (3004, 'succes', 'Contrat supprime'),  -- DELETE /api/contrats/:id
  (3010, 'erreur', 'Contrat introuvable'),  -- GET/PATCH/DELETE /api/contrats/:id
  (3011, 'erreur', 'Le libelle est obligatoire'),  -- POST, PATCH /api/contrats
  (3012, 'erreur', 'Le type de contrat est obligatoire'),  -- POST, PATCH /api/contrats
  (3013, 'erreur', 'La date de debut doit preceder la date de fin'),  -- POST, PATCH /api/contrats
  (3014, 'erreur', 'Type de contrat introuvable'),  -- POST, PATCH /api/contrats
  (3015, 'erreur', 'Editeur introuvable'),  -- POST, PATCH /api/contrats
  (3016, 'erreur', 'Societe signataire introuvable'),  -- POST, PATCH /api/contrats
  (3017, 'erreur', 'Revendeur signataire introuvable'),  -- POST, PATCH /api/contrats
  (3018, 'erreur', 'Contrat parent introuvable'),  -- POST, PATCH /api/contrats
  (3019, 'erreur', 'Ce rattachement creerait un cycle'),  -- POST, PATCH /api/contrats
  (3020, 'erreur', 'Suppression impossible : elements lies'),  -- DELETE /api/contrats/:id
  (3021, 'avertissement', 'Parent non cadre, anomalie qualite enregistree'),  -- POST, PATCH /api/contrats
  (3099, 'erreur', 'Erreur serveur inattendue (module contrats)'),  -- toutes
  -- Commandes (#44)
  (3100, 'succes', 'Liste des commandes'),  -- GET /api/commandes
  (3101, 'succes', 'Detail de la commande'),  -- GET /api/commandes/:id
  (3102, 'succes', 'Commande creee'),  -- POST /api/commandes
  (3103, 'succes', 'Commande modifiee'),  -- PATCH /api/commandes/:id
  (3104, 'succes', 'Commande supprimee'),  -- DELETE /api/commandes/:id
  (3110, 'erreur', 'Commande introuvable'),  -- GET/PATCH/DELETE /api/commandes/:id
  (3111, 'erreur', 'Le libelle est obligatoire'),  -- POST, PATCH /api/commandes
  (3112, 'erreur', 'Le contrat est obligatoire'),  -- POST, PATCH /api/commandes
  (3113, 'erreur', 'Contrat introuvable'),  -- POST, PATCH /api/commandes
  (3114, 'erreur', 'La societe acheteuse est obligatoire'),  -- POST, PATCH /api/commandes
  (3115, 'erreur', 'Societe acheteuse introuvable'),  -- POST, PATCH /api/commandes
  (3116, 'erreur', 'Revendeur introuvable'),  -- POST, PATCH /api/commandes
  (3117, 'erreur', 'Mode de commande introuvable'),  -- POST, PATCH /api/commandes
  (3118, 'erreur', 'Le montant est obligatoire'),  -- POST, PATCH /api/commandes
  (3119, 'erreur', 'Le montant doit etre strictement positif'),  -- POST, PATCH /api/commandes
  (3120, 'erreur', 'La date de commande est obligatoire'),  -- POST, PATCH /api/commandes
  (3121, 'erreur', 'La date de fin doit etre posterieure a la date de commande'),  -- POST, PATCH /api/commandes
  (3130, 'erreur', 'Suppression impossible : elements lies'),  -- DELETE /api/commandes/:id
  (3140, 'succes', 'Agregats financiers'),  -- GET /api/commandes/agregats
  (3141, 'erreur', 'L''endpoint accepte soit annee, soit le couple date_debut / date_fin. Le precalcul etant mensuel, une plage au jour pres est servie au mois pres et les bornes appliquees sont renvoyees dans periode_debut et periode_fin.'),  -- GET /api/commandes/agregats
  (3142, 'erreur', 'Identifiant de societe invalide'),  -- GET /api/commandes/agregats
  (3143, 'erreur', 'Identifiant d''editeur invalide'),  -- GET /api/commandes/agregats
  (3144, 'erreur', 'La periode demandee est invalide'),  -- GET /api/commandes/agregats
  (3199, 'erreur', 'Erreur serveur inattendue (module commandes)'),  -- toutes
  -- Documents (#48, #49, #50)
  (3200, 'succes', 'Liste des preuves'),  -- GET /api/preuves
  (3201, 'succes', 'Detail de la preuve'),  -- GET /api/preuves/:id
  (3202, 'succes', 'Preuve creee'),  -- POST /api/preuves
  (3203, 'succes', 'Preuve modifiee'),  -- PATCH /api/preuves/:id
  (3204, 'succes', 'Preuve supprimee'),  -- DELETE /api/preuves/:id
  (3205, 'succes', 'Fichier depose'),  -- POST /api/preuves/:id/fichier
  (3206, 'succes', 'Fichier servi'),  -- GET /api/preuves/:id/fichier
  (3210, 'erreur', 'Preuve introuvable'),  -- GET/PATCH/DELETE /api/preuves/:id
  (3211, 'erreur', 'Le libelle est obligatoire'),  -- POST, PATCH /api/preuves
  (3212, 'erreur', 'Le type de preuve est obligatoire'),  -- POST, PATCH /api/preuves
  (3213, 'erreur', 'Type de preuve introuvable'),  -- POST, PATCH /api/preuves
  (3214, 'erreur', 'Une preuve doit etre rattachee a un contrat, a une commande, ou aux deux'),  -- POST, PATCH /api/preuves
  (3215, 'erreur', 'Contrat introuvable'),  -- POST, PATCH /api/preuves
  (3216, 'erreur', 'Commande introuvable'),  -- POST, PATCH /api/preuves
  (3217, 'erreur', 'Le chemin du fichier est obligatoire'),  -- POST, PATCH /api/preuves
  (3218, 'erreur', 'L''empreinte SHA-256 doit comporter 64 caracteres hexadecimaux'),  -- POST, PATCH /api/preuves
  (3219, 'erreur', 'Valeur de filtre invalide'),  -- GET /api/preuves
  (3220, 'erreur', 'Aucun fichier n''a ete transmis'),  -- POST /api/preuves/:id/fichier
  (3221, 'erreur', 'Extension non admise, formats acceptes pdf png jpg jpeg'),  -- POST /api/preuves/:id/fichier
  (3222, 'erreur', 'Le fichier depasse la taille maximale de 20 Mo (413)'),  -- POST /api/preuves/:id/fichier
  (3223, 'erreur', 'Le contenu du fichier ne correspond pas a son extension'),  -- POST /api/preuves/:id/fichier
  (3224, 'erreur', 'Aucun fichier n''a ete depose pour cette preuve'),  -- GET /api/preuves/:id/fichier
  (3225, 'erreur', 'Le fichier est introuvable dans le stockage'),  -- GET /api/preuves/:id/fichier
  (3226, 'erreur', 'Chemin de stockage invalide, traversee refusee'),  -- GET /api/preuves/:id/fichier
  (3227, 'erreur', 'Un seul fichier peut etre depose, dans le champ fichier'),  -- POST /api/preuves/:id/fichier
  (3230, 'erreur', 'Suppression impossible : preuve rattachee a une facture'),  -- DELETE /api/preuves/:id
  (3231, 'reserve', '[ARBITRAGE D27] lien externe GED refuse. Non emis a ce jour'),  -- POST, PATCH /api/preuves
  (3232, 'reserve', '[ARBITRAGE D27] redirection vers un lien GED externe. Non emis a ce jour'),  -- GET /api/preuves/:id/fichier
  (3240, 'succes', 'Liste des factures'),  -- GET /api/factures
  (3241, 'succes', 'Detail de la facture'),  -- GET /api/factures/:id
  (3242, 'succes', 'Facture creee'),  -- POST /api/factures
  (3243, 'succes', 'Facture modifiee'),  -- PATCH /api/factures/:id
  (3244, 'succes', 'Facture supprimee'),  -- DELETE /api/factures/:id
  (3245, 'succes', 'Facture et preuve creees en une transaction'),  -- POST /api/factures/depot
  (3250, 'erreur', 'Facture introuvable'),  -- GET/PATCH/DELETE /api/factures/:id
  (3251, 'erreur', 'Le libelle est obligatoire'),  -- POST, PATCH /api/factures
  (3252, 'erreur', 'La commande est obligatoire'),  -- POST, PATCH /api/factures
  (3253, 'erreur', 'Commande introuvable'),  -- POST, PATCH /api/factures
  (3254, 'erreur', 'Preuve introuvable'),  -- POST, PATCH /api/factures
  (3255, 'reserve', '[ARBITRAGE flux] la preuve est obligatoire des la creation. Non emis a ce jour'),  -- POST /api/factures
  (3256, 'erreur', 'Le fichier justificatif est obligatoire, depot combine'),  -- POST /api/factures/depot
  (3259, 'erreur', 'Valeur de filtre invalide'),  -- GET /api/factures
  (3280, 'succes', 'Liste des commandes en manque documentaire'),  -- GET /api/commandes/manques
  (3281, 'erreur', 'Identifiant de societe invalide'),  -- GET /api/commandes/manques
  (3282, 'erreur', 'Identifiant de contrat invalide'),  -- GET /api/commandes/manques
  (3283, 'erreur', 'L''annee demandee est invalide'),  -- GET /api/commandes/manques
  (3299, 'erreur', 'Erreur serveur inattendue (module documents)'),  -- toutes
  -- Validation des saisies (#53)
  (3300, 'succes', 'Saisie validee'),  -- POST /api/validation/:entite_type/:entite_id/valider
  (3301, 'succes', 'Saisie refusee'),  -- POST /api/validation/:entite_type/:entite_id/refuser
  (3310, 'erreur', 'Type d''entite inconnu du workflow de validation'),  -- les deux
  (3311, 'erreur', 'Entite introuvable'),  -- les deux
  (3312, 'erreur', 'Cette saisie ne porte aucune demande de validation'),  -- les deux
  (3313, 'erreur', 'Seule une saisie en attente peut etre traitee'),  -- les deux
  (3314, 'erreur', 'Le motif de refus est obligatoire'),  -- POST .../refuser
  (3399, 'erreur', 'Erreur serveur inattendue (module validation)'),  -- toutes
  -- Controle des permissions (transverse)
  (3400, 'erreur', 'Cette action n''est pas permise pour votre niveau de droit. Permission requise : <code>.'),  -- toutes les routes protegees
  (3499, 'erreur', 'Erreur serveur inattendue (calcul des droits)')  -- toutes les routes protegees
ON CONFLICT (code) DO UPDATE SET
  type    = EXCLUDED.type,
  libelle = EXCLUDED.libelle;

COMMIT;
