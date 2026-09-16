-- ============================================================================
-- SamSecure - BDD Commune - Migration 064
-- Fichier   : 064_commune_code_retour_orphelins.sql
-- Objet     : harmonisation du 16/09/2026. Seed des codes presents au
--             pre-catalogue (server/docs/codes_retour.md) mais absents de
--             toutes les migrations, releves par comparaison programmatique
--             du pre-catalogue contre les seeds Commune (025 a 060, ON
--             CONFLICT et suppression de la 043 compris) :
--             - 1000 a 1003, 1010, 1011, 1099 : socle d'envoi de mails (#87).
--               Etats renvoyes par envoyerMail() et codes de POST /api/mails/
--               test, jamais seedes ;
--             - 4025 a 4027 : prolongation d'une licence (#209, decision du
--               11/09/2026), routes de la branche successions-maintenance ;
--             - 4034 a 4038 : complements du catalogue (versions et editions
--               ajoutees par le client, migration 063), meme chantier.
--             Verifie dans le meme releve : 3229 (definition des champs par
--             type de preuve) est seede par la 060 ; les codes 5450 a 5499
--             (dashboards) sont seedes (050, 057) et manquaient seulement au
--             pre-catalogue, complete dans le meme lot.
--             Libelles accentues (convention #116 pour tout texte destine a
--             l'ecran), terminologie A67 ("logiciel") sur 4034, 4035 et 4037.
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom :
--             migrate.js route sur commonPool), apres 060.
-- Exécution : npm run migrate:dev / migrate:staging, puis redemarrage de
--             l'API (catalogue charge au demarrage).
-- Depend    : 024 (table code_retour).
-- Rejouable : ON CONFLICT (code) DO NOTHING : un code deja present, quel que
--             soit son libelle, n'est pas reecrit. Aucun DDL, aucune
--             suppression.
-- Numero    : 064 (Commune) et 065 (Tenant) absents de server/bdd et de toutes
--             les references locales au 16/09/2026, numeros reserves.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  -- Socle d'envoi de mails (#87), plage transverse 1000-1999
  (1000, 'succes', 'Mail envoyé'),
  (1001, 'erreur', 'L''envoi de mails n''est pas configuré sur ce serveur'),
  (1002, 'erreur', 'Adresse de destinataire absente ou invalide'),
  (1003, 'erreur', 'Le mail n''a pas pu être envoyé. L''incident a été journalisé'),
  (1010, 'succes', 'Mail de test envoyé'),
  (1011, 'erreur', 'Mail de test non envoyé (état 1001 à 1003 joint)'),
  (1099, 'erreur', 'Erreur serveur inattendue (module mails)'),
  -- Prolongation d'une licence (#209)
  (4025, 'succes', 'Licence prolongée'),
  (4026, 'erreur', 'Cette licence ne porte aucune échéance à prolonger'),
  (4027, 'erreur', 'La nouvelle date de fin doit être postérieure à l''échéance actuelle'),
  -- Complements du catalogue (#209, migration 063)
  (4034, 'succes', 'Version ajoutée au logiciel'),
  (4035, 'succes', 'Édition ajoutée au logiciel'),
  (4036, 'erreur', 'Le libellé de la version ou de l''édition est obligatoire'),
  (4037, 'erreur', 'Cette version ou édition existe déjà pour ce logiciel'),
  (4038, 'succes', 'Compléments du catalogue (versions et éditions ajoutées par le client)')
ON CONFLICT (code) DO NOTHING;

COMMIT;
