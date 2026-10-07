-- ============================================================================
-- SamSecure - BDD Commune - Migration 105
-- Fichier   : 105_commune_codes_retour_completude.sql
-- Objet     : seed des codes retour 5550 a 5559, nouvelle plage "completude"
--             (5550-5599, a la suite des notifications 5500-5549), rediges au
--             pre-catalogue (server/docs/codes_retour.md) par le chantier #324
--             (actions requises sur chaque fiche) :
--             - 5550 / 5551 : succes de GET /api/completude/:type/:id et de
--               GET /api/completude/resume (routes/completude.js, lecture
--               seule, regles pures de server/utils/completude.js) ;
--             - 5552 : type de fiche hors catalogue (400 ; en RBAC strict un
--               type absent de la table des permissions est refuse 3400 en
--               amont, la table ne declarant que les cinq types) ;
--             - 5553 : fiche introuvable (404, message du type de fiche) ;
--             - 5559 : erreur serveur du module.
--             Seuls ces cinq codes existent dans la plage a ce jour.
--             Libelles accentues (convention pour tout texte destine a
--             l'ecran), annotations du pre-catalogue non reprises, motif 067.
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom).
-- Exécution : npm run migrate:dev / migrate:staging, puis redemarrage de
--             l'API (catalogue charge au demarrage).
-- Depend    : 024 (table code_retour)
-- Rejouable : ON CONFLICT (code) DO UPDATE (type et libelle realignes sur ce
--             seed a chaque rejeu), aucun DDL, aucune suppression.
-- Numero    : 105 attribue par arbitrage du 07/10/2026 (chantier #324) ;
--             libre dans server/bdd et sur toutes les branches locales et de
--             suivi au 07/10/2026 (la 106 reste en reserve, non employee).
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  (5550, 'succes', 'Complétude de la fiche servie'),
  (5551, 'succes', 'Résumé de complétude servi'),
  (5552, 'erreur', 'Type de fiche inconnu pour la complétude'),
  (5553, 'erreur', 'Fiche introuvable pour la complétude'),
  (5559, 'erreur', 'Erreur serveur du module complétude')
ON CONFLICT (code) DO UPDATE
  SET type = EXCLUDED.type, libelle = EXCLUDED.libelle;

COMMIT;
