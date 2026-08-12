-- ============================================================================
-- SamSecure - Migration soft delete + journal + utilisateurs temporaires
-- Fichier   : 007_soft_delete_migration.sql
-- Cible     : PostgreSQL 16 - base Tenant
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Colonnes date_suppression sur toutes les tables métier
-- ----------------------------------------------------------------------------
ALTER TABLE societe               ADD COLUMN IF NOT EXISTS date_suppression TIMESTAMP;
ALTER TABLE profil                ADD COLUMN IF NOT EXISTS date_suppression TIMESTAMP;
ALTER TABLE utilisateur           ADD COLUMN IF NOT EXISTS date_suppression TIMESTAMP;
ALTER TABLE utilisateur           ADD COLUMN IF NOT EXISTS date_validite DATE;
ALTER TABLE exception_droit       ADD COLUMN IF NOT EXISTS date_suppression TIMESTAMP;
ALTER TABLE exception_droit       ADD COLUMN IF NOT EXISTS motif_modification TEXT;
ALTER TABLE utilisateur_profil_societe ADD COLUMN IF NOT EXISTS date_suppression TIMESTAMP;
ALTER TABLE profil_societe        ADD COLUMN IF NOT EXISTS date_suppression TIMESTAMP;
ALTER TABLE utilisateur_societe   ADD COLUMN IF NOT EXISTS date_suppression TIMESTAMP;
ALTER TABLE profil_permission     ADD COLUMN IF NOT EXISTS date_suppression TIMESTAMP;

-- ----------------------------------------------------------------------------
-- 2. Table journal d'écriture (logs métier lisibles)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_ecriture (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action       VARCHAR(50) NOT NULL,           -- CREATE, UPDATE, DELETE, SOFT_DELETE
  entite_type  VARCHAR(50) NOT NULL,           -- utilisateur, profil, societe, exception, attribution...
  entite_id    UUID,
  description  TEXT NOT NULL,                  -- "Samuel A. a créé l'exception 'Consulter référentiels'"
  id_auteur    UUID REFERENCES utilisateur(id),
  payload      JSONB,                          -- données brutes pour traçabilité
  created_at   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_entite  ON journal_ecriture (entite_type, entite_id);
CREATE INDEX IF NOT EXISTS idx_journal_created ON journal_ecriture (created_at);
CREATE INDEX IF NOT EXISTS idx_journal_auteur  ON journal_ecriture (id_auteur);

-- ----------------------------------------------------------------------------
-- 3. Index sur date_suppression pour filtrage rapide
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_societe_date_supp     ON societe (date_suppression);
CREATE INDEX IF NOT EXISTS idx_profil_date_supp      ON profil (date_suppression);
CREATE INDEX IF NOT EXISTS idx_utilisateur_date_supp ON utilisateur (date_suppression);
CREATE INDEX IF NOT EXISTS idx_exception_date_supp   ON exception_droit (date_suppression);
CREATE INDEX IF NOT EXISTS idx_ups_date_supp         ON utilisateur_profil_societe (date_suppression);
CREATE INDEX IF NOT EXISTS idx_ps_date_supp          ON profil_societe (date_suppression);
CREATE INDEX IF NOT EXISTS idx_us_date_supp          ON utilisateur_societe (date_suppression);

COMMIT;
