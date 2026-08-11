-- ============================================================================
-- SamSecure - BDD Tenant - Migration 015
-- Objet   : deux manques du DDL v4 sur commande.
--           1) date_commande : date metier, absente. Indispensable a la
--              timeline mensuelle et aux periodes fiscales (#45), et seul
--              terme de comparaison possible pour la coherence avec date_fin.
--              created_at ne convient pas : horodatage d'insertion, il
--              vaudrait la date d'import sur une reprise d'historique.
--           2) updated_at : present sur contrat, absent sur commande. Sans
--              lui le PATCH ne laisse aucune trace de modification.
-- Cible   : PostgreSQL - base Tenant
-- Valide  : Dorian, 11/08/2026
-- Note    : les deux bases sont vides de commandes, aucune valeur de reprise
--           n'est necessaire. La colonne reste nullable en base, l'obligation
--           est portee par l'API comme pour id_contrat et montant.
-- Rejouable : IF NOT EXISTS / DROP IF EXISTS, sans effet sur une base conforme.
-- ============================================================================

BEGIN;

ALTER TABLE commande ADD COLUMN IF NOT EXISTS date_commande DATE;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

COMMENT ON COLUMN commande.date_commande IS
  'Date metier de la commande. Base de la timeline mensuelle et du rattachement
   aux periodes fiscales. A ne pas confondre avec created_at, technique.';

-- Terminologie actee story 17 : societe acheteuse. Le role budgetaire reste
-- inchange, seul le vocabulaire est aligne.
COMMENT ON COLUMN commande.id_societe IS
  'Societe acheteuse : base de la chaine budget licence -> commande -> societe.';

-- Coherence des dates, pendant de ck_contrat_dates. Doublon volontaire de la
-- validation API : la contrainte garantit l'invariant meme en ecriture directe.
ALTER TABLE commande DROP CONSTRAINT IF EXISTS ck_commande_dates;
ALTER TABLE commande ADD CONSTRAINT ck_commande_dates
  CHECK (date_fin IS NULL OR date_commande IS NULL OR date_fin >= date_commande);

CREATE INDEX IF NOT EXISTS idx_commande_date ON commande (date_commande);

COMMIT;
