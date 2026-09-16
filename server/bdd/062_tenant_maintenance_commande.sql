-- ============================================================================
-- SamSecure - BDD Tenant - Migration 062
-- Fichier   : 062_tenant_maintenance_commande.sql
-- Objet     : story #209, decision de la reunion client du 11/09/2026 :
--             une periode de maintenance se rattache a une commande.
--             Existant inventorie avant ecriture : maintenance_historique
--             (002) porte id_mainteneur, id_revendeur, dates, cout, et depuis
--             la 056 id_version ; aucun lien vers commande. Le revendeur d'une
--             periode etait saisi directement (id_revendeur).
--             Ajout : maintenance_historique.id_commande, FK NULLable vers
--             commande. Le formulaire de maintenance propose desormais la
--             commande (celles du contrat de la licence en premier) et ne
--             propose plus le revendeur : il se lit par la commande
--             (commande.id_revendeur). La colonne id_revendeur reste en base,
--             plus alimentee par le formulaire, lue en repli pour les periodes
--             anterieures. Les maintenances existantes restent valides sans
--             commande (colonne NULLable, aucune donnee modifiee).
--             Pas de ON DELETE : une commande qui porte des periodes de
--             maintenance est protegee, comme elle l'est deja par
--             licence.id_commande (la route DELETE /commandes controle ses
--             rattachements).
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 002 (maintenance_historique, commande).
-- Rejouable : ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.
--             Aucune suppression, aucune donnee modifiee.
-- Numero    : 059, 060 et 061 sont reserves au chantier parallele
--             (terminologie et preuves) ; 062 et 063 sont les numeros prevus
--             par le protocole et sont libres sur origin/dev.
-- ============================================================================

BEGIN;

ALTER TABLE maintenance_historique ADD COLUMN IF NOT EXISTS id_commande UUID REFERENCES commande(id);
COMMENT ON COLUMN maintenance_historique.id_commande IS 'Commande qui porte la periode de maintenance (decision du 11/09/2026). NULLable : les periodes anterieures restent valides sans commande. Le revendeur de la periode se lit par commande.id_revendeur ; id_revendeur n''est plus alimente par le formulaire et ne sert qu''en repli.';
COMMENT ON COLUMN maintenance_historique.id_revendeur IS 'Revendeur saisi directement sur la periode (avant la 062). Plus alimente par le formulaire : le revendeur se lit par la commande (id_commande). Conserve en repli pour les periodes anterieures.';

CREATE INDEX IF NOT EXISTS idx_maintenance_commande ON maintenance_historique (id_commande);

COMMIT;
