-- ============================================================================
-- SamSecure - BDD Tenant - Migration 039
-- Fichier   : 039_tenant_editeur_referentiel.sql
-- Objet     : ouverture du referentiel editeur a la saisie (module 1).
--             La table existait depuis 002 mais n'a jamais eu de CRUD : elle
--             etait amorcee par le seul script manuel seed-referentiels.js et
--             servait uniquement de selecteur au formulaire contrat.
--
--             Deux ajouts, tires de l'ecran existant :
--             - pays, saisi par le formulaire depuis toujours et jusqu'ici
--               perdu, faute de colonne ;
--             - unicite de la raison sociale, jusqu'a present verifiee cote
--               front seulement, donc contournable par appel direct a l'API.
--               Index sur lower() : "Microsoft" et "microsoft" designent le
--               meme editeur, la casse ne doit pas creer un doublon.
--
--             Pas de statut de validation en colonne : l'editeur rejoint le
--             workflow unique de la #53 (workflow_validation), comme contrat,
--             commande, facture, preuve et affectation.
--             Pas de date_suppression : l'editeur se supprime reellement, la
--             suppression etant deja bloquee par ses rattachements.
--             Pendant Commune : 041 (codes retour).
-- Cible     : PostgreSQL 16 - base Tenant, apres 038
-- Rejouable : ADD COLUMN IF NOT EXISTS, CREATE UNIQUE INDEX IF NOT EXISTS.
--             Aucune instruction destructrice.
-- Attention : la creation de l'index unique echoue si la table porte deja deux
--             editeurs de meme raison sociale a la casse pres. C'est voulu :
--             mieux vaut un echec bruyant qu'un dedoublonnage automatique qui
--             choisirait a la place de l'equipe. Diagnostic :
--               SELECT lower(raison_sociale), count(*) FROM editeur
--                GROUP BY 1 HAVING count(*) > 1;
-- ============================================================================

BEGIN;

ALTER TABLE editeur ADD COLUMN IF NOT EXISTS pays VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_editeur_raison_sociale
  ON editeur (lower(raison_sociale));

COMMENT ON COLUMN editeur.pays IS
  'Pays du siege, optionnel. Saisi par le formulaire editeur du module 1.';

COMMIT;
