-- ============================================================================
-- SamSecure - BDD Commune - Migration 083
-- Fichier   : 083_commune_facture_montant_date.sql
-- Objet     : depot unifie, decision client du 10/09/2026 : le type facture
--             exige montant et date.
--             1) definition des champs du type facture
--                (default_type_preuve_champ, 060) : montant (nombre,
--                obligatoire) et date_preuve (date de la facture,
--                obligatoire). date_preuve est un champ commun du formulaire :
--                la definition n'apporte que son caractere obligatoire et son
--                libelle, la modale ne le rend pas deux fois.
--             2) codes retour du depot : 3257 (montant obligatoire),
--                3258 (montant invalide), 3246 (date de la facture
--                obligatoire).
--             3) libelle du 4012 realigne : depuis le correctif du 06/10/2026
--                (bug Samuel), une licence peut viser un logiciel cree par le
--                client, "au catalogue" etait devenu faux.
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom :
--             migrate.js route sur commonPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 024 (code_retour), 060 (default_type_preuve_champ).
-- Rejouable : ON CONFLICT DO UPDATE, sans effet au second passage.
-- Numero    : plage 080-090 reservee au chantier droits, 083 absent de
--             server/bdd et de toutes les branches au 06/10/2026.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Champs obligatoires du type facture
-- ----------------------------------------------------------------------------
INSERT INTO default_type_preuve_champ (code_type_preuve, nom, libelle, type_champ, obligatoire, ordre, actif) VALUES
  ('facture', 'date_preuve', 'Date de la facture', 'date',   true,  5, true),
  ('facture', 'montant',     'Montant',            'nombre', true, 30, true)
ON CONFLICT (code_type_preuve, nom) DO UPDATE SET
  libelle     = EXCLUDED.libelle,
  type_champ  = EXCLUDED.type_champ,
  obligatoire = EXCLUDED.obligatoire,
  ordre       = EXCLUDED.ordre,
  actif       = EXCLUDED.actif;

-- ----------------------------------------------------------------------------
-- 2. Codes retour du depot de facture
-- ----------------------------------------------------------------------------
INSERT INTO code_retour (code, type, libelle) VALUES
  (3246, 'erreur', 'La date de la facture est obligatoire'),              -- POST /api/factures/depot
  (3257, 'erreur', 'Le montant de la facture est obligatoire'),          -- POST /api/factures/depot
  (3258, 'erreur', 'Le montant doit être un montant positif ou nul')     -- POST /api/factures/depot, POST et PATCH /api/factures
ON CONFLICT (code) DO UPDATE SET
  type    = EXCLUDED.type,
  libelle = EXCLUDED.libelle;

-- ----------------------------------------------------------------------------
-- 3. Libelle du 4012 realigne (logiciel du catalogue ou du client)
-- ----------------------------------------------------------------------------
INSERT INTO code_retour (code, type, libelle) VALUES
  (4012, 'erreur', 'Logiciel introuvable')
ON CONFLICT (code) DO UPDATE SET
  type    = EXCLUDED.type,
  libelle = EXCLUDED.libelle;

COMMIT;
