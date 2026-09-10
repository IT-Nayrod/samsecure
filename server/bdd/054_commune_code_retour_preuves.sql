-- ============================================================================
-- SamSecure - BDD Commune - Migration 054
-- Fichier   : 054_commune_code_retour_preuves.sql
-- Objet     : pendant Commune de la 053 (stories #208 et #204).
--             1) default_type_preuve : liste ferme du client (#208), meme
--                contenu que le seed Tenant de la 053, rapprochement sur code.
--                Aucun retrait des defauts existants.
--             2) code_retour, plage documents 3200-3299 : nouveau code 3228
--                (licence introuvable au rattachement d'une preuve) ; libelle
--                du 3214 aligne sur la nouvelle regle de rattachement
--                (contrat, commande ou licence). Libelles reportes dans
--                server/docs/codes_retour.md.
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom :
--             migrate.js route sur commonPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 024 (table code_retour), 026 (default_type_preuve).
-- Rejouable : ON CONFLICT (code) DO UPDATE sur les deux tables (referentiels
--             techniques, la derniere livraison fait foi, meme motif que 027
--             et 052).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Defauts SamSecure des types de preuve (#208)
-- ----------------------------------------------------------------------------
INSERT INTO default_type_preuve (code, label) VALUES
  ('bon_commande',    'Bon de commande'),
  ('bon_livraison',   'Bon de livraison'),
  ('certificat',      'Certificat'),
  ('clefs_licence',   'Clefs de licence'),
  ('contrat_annexes', 'Contrat et annexes'),
  ('facture',         'Facture'),
  ('autre',           'Autre')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label;

-- ----------------------------------------------------------------------------
-- 2. Codes retour du module documents (#208)
-- ----------------------------------------------------------------------------
INSERT INTO code_retour (code, type, libelle) VALUES
  (3214, 'erreur', 'Une preuve doit être rattachée à un contrat, à une commande ou à une licence'), -- POST, PATCH /api/preuves
  (3228, 'erreur', 'Licence introuvable')                                                          -- POST, PATCH /api/preuves
ON CONFLICT (code) DO UPDATE
  SET type = EXCLUDED.type, libelle = EXCLUDED.libelle;

COMMIT;
