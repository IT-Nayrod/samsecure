-- ============================================================================
-- SamSecure - BDD Commune - Migration 034
-- Fichier   : 034_commune_code_retour_budget.sql
-- Objet     : seed de code_retour pour le module 4, partie A, budget (US #146),
--             plage 5100-5199 reservee a cette story. Decoupage : 5100-5109
--             succes, 5110-5129 erreurs de validation, de reference et de
--             filtre, 5130-5139 avertissements du preremplissage, 5150-5159
--             traces audit_log, 5199 erreur serveur du module.
--             Libelles reportes dans server/docs/codes_retour.md, section
--             "Budget (#146, module 4 partie A)".
--             Aucun DDL : migration de donnees uniquement.
-- Cible     : PostgreSQL 16 - base Commune, apres 032 (mot "commune" dans le
--             nom : migrate.js route sur commonPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Rejouable : ON CONFLICT (code) DO UPDATE sur type et libelle, meme motif que
--             025 (referentiel technique non personnalisable, la derniere
--             livraison fait foi). Un code ne change jamais de sens.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  -- Budget (#146) : succes
  (5100, 'succes', 'Liste des lignes budgetaires'),  -- GET /api/budget
  (5101, 'succes', 'Detail de la ligne budgetaire'),  -- GET /api/budget/:id
  (5102, 'succes', 'Ligne budgetaire creee'),  -- POST /api/budget
  (5103, 'succes', 'Ligne budgetaire modifiee'),  -- PATCH /api/budget/:id
  (5104, 'succes', 'Ligne budgetaire supprimee'),  -- DELETE /api/budget/:id
  (5105, 'succes', 'Projection previsionnelle preremplie depuis la maintenance en cours'),  -- GET /api/budget/preremplissage
  (5106, 'succes', 'Engage calcule depuis les commandes'),  -- GET /api/budget/engage
  (5107, 'succes', 'Synthese budgetaire : previsionnel, alloue, engage'),  -- GET /api/budget/synthese
  -- Budget (#146) : erreurs de validation, de reference et de filtre
  (5110, 'erreur', 'Ligne budgetaire introuvable'),  -- GET/PATCH/DELETE /api/budget/:id
  (5111, 'erreur', 'La licence est obligatoire'),  -- POST, PATCH /api/budget, GET /api/budget/preremplissage
  (5112, 'erreur', 'Licence introuvable'),  -- POST, PATCH /api/budget, GET /api/budget/preremplissage
  (5113, 'erreur', 'Le type doit etre previsionnel ou alloue'),  -- POST, PATCH /api/budget, GET /api/budget?type=
  (5114, 'erreur', 'La date de debut est obligatoire'),  -- POST, PATCH /api/budget
  (5115, 'erreur', 'La date de fin est obligatoire'),  -- POST, PATCH /api/budget
  (5116, 'erreur', 'La date de fin doit etre posterieure ou egale a la date de debut'),  -- POST, PATCH /api/budget
  (5117, 'erreur', 'Date invalide'),  -- POST, PATCH /api/budget
  (5118, 'erreur', 'Le montant CAPEX doit etre un montant positif ou nul'),  -- POST, PATCH /api/budget
  (5119, 'erreur', 'La quantite CAPEX doit etre un nombre positif ou nul'),  -- POST, PATCH /api/budget
  (5120, 'erreur', 'Le montant OPEX doit etre un montant positif ou nul'),  -- POST, PATCH /api/budget
  (5121, 'erreur', 'La quantite OPEX doit etre un nombre positif ou nul'),  -- POST, PATCH /api/budget
  (5122, 'erreur', 'Une ligne budgetaire porte au moins un montant, CAPEX ou OPEX'),  -- POST, PATCH /api/budget
  (5123, 'erreur', 'Identifiant de filtre invalide'),  -- GET /api/budget, /engage, /synthese, /preremplissage
  (5124, 'erreur', 'L''exercice demande est invalide'),  -- GET /api/budget, /engage, /synthese, /preremplissage
  (5125, 'erreur', 'La periode demandee est invalide'),  -- GET /api/budget, /engage, /synthese
  (5126, 'erreur', 'Societe introuvable'),  -- GET /api/budget, /engage, /synthese (bornes d'exercice)
  -- Budget (#146) : avertissements du preremplissage (reponse 200, data servie)
  (5130, 'avertissement', 'Aucune maintenance en cours sur cette licence, projection vide'),  -- GET /api/budget/preremplissage
  (5131, 'avertissement', 'Licence sans commande, organisation payeuse indeterminee, exercice du tenant applique'),  -- GET /api/budget/preremplissage
  -- Budget (#146) : traces audit_log
  (5150, 'trace', 'Ligne budgetaire creee (audit_log BUDGET_CREE)'),  -- POST /api/budget
  (5151, 'trace', 'Ligne budgetaire modifiee (audit_log BUDGET_MODIFIE)'),  -- PATCH /api/budget/:id
  (5152, 'trace', 'Ligne budgetaire supprimee (audit_log BUDGET_SUPPRIME)'),  -- DELETE /api/budget/:id
  -- Budget (#146) : erreur serveur
  (5199, 'erreur', 'Erreur serveur inattendue (module budget)')  -- toutes
ON CONFLICT (code) DO UPDATE SET
  type    = EXCLUDED.type,
  libelle = EXCLUDED.libelle;

COMMIT;
