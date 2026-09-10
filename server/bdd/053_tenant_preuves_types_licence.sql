-- ============================================================================
-- SamSecure - BDD Tenant - Migration 053
-- Fichier   : 053_tenant_preuves_types_licence.sql
-- Objet     : preuves documentaires, stories #208 et #204.
--             1) referentiel type_preuve : liste ferme decidee par le client
--                (#208), sept valeurs : bon de commande, bon de livraison,
--                certificat, clefs de licence, contrat et annexes, facture,
--                autre. Insertion ON CONFLICT (code) selon le motif protege
--                (003, 018) : une ligne personnalisee par le client garde son
--                libelle. Aucun retrait des types existants (capture_portail,
--                attestation_editeur, contrat_scanne) : des preuves peuvent les
--                referencer, le formulaire ne les propose simplement plus.
--             2) preuve.id_licence, FK nullable vers licence (#208) : une
--                preuve peut se rattacher a un contrat, a une commande ou a
--                une licence. FK sans action referentielle (RESTRICT) : une
--                preuve est une piece d'audit, elle ne doit pas etre detachee
--                en silence par la suppression d'une licence.
--             Le pendant Commune (default_type_preuve, codes retour) est la 054.
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 002 (type_preuve, preuve, licence), 003 et 018 (seed protege).
-- Rejouable : ON CONFLICT (code) sur le seed, IF NOT EXISTS sur la colonne et
--             l'index, contrainte ajoutee sous garde pg_constraint.
-- Numero    : 053 et 054 absents de server/bdd et de toutes les branches
--             distantes au 10/09/2026, numeros prevus par le protocole.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Types de preuve : liste ferme du client (#208), motif protege
-- ----------------------------------------------------------------------------
INSERT INTO type_preuve (code, label, valeurs_defaut) VALUES
  ('bon_commande',    'Bon de commande',    '{"label": "Bon de commande"}'),
  ('bon_livraison',   'Bon de livraison',   '{"label": "Bon de livraison"}'),
  ('certificat',      'Certificat',         '{"label": "Certificat"}'),
  ('clefs_licence',   'Clefs de licence',   '{"label": "Clefs de licence"}'),
  ('contrat_annexes', 'Contrat et annexes', '{"label": "Contrat et annexes"}'),
  ('facture',         'Facture',            '{"label": "Facture"}'),
  ('autre',           'Autre',              '{"label": "Autre"}')
ON CONFLICT (code) DO UPDATE SET
  label          = CASE WHEN type_preuve.personnalise THEN type_preuve.label ELSE EXCLUDED.label END,
  valeurs_defaut = EXCLUDED.valeurs_defaut;

-- ----------------------------------------------------------------------------
-- 2. Rattachement d'une preuve a une licence (#208)
-- ----------------------------------------------------------------------------
ALTER TABLE preuve ADD COLUMN IF NOT EXISTS id_licence UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'preuve_id_licence_fkey') THEN
    ALTER TABLE preuve
      ADD CONSTRAINT preuve_id_licence_fkey FOREIGN KEY (id_licence) REFERENCES licence(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_preuve_licence ON preuve (id_licence);

COMMENT ON COLUMN preuve.id_licence IS
  'Licence a laquelle la preuve se rattache (certificat, clefs de licence). Nullable : une preuve se rattache a un contrat, a une commande ou a une licence, l''API impose au moins un rattachement (#208).';

COMMIT;
