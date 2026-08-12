-- ============================================================================
-- SamSecure - Migration : renomme date_validite en date_finale + date_mise_en_fonction
-- ============================================================================

BEGIN;

-- Renomme date_validite en date_finale si elle existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'utilisateur' AND column_name = 'date_validite'
  ) THEN
    ALTER TABLE utilisateur RENAME COLUMN date_validite TO date_finale;
  END IF;
END $$;

-- Crée date_finale si ni l'ancien ni le nouveau n'existaient
ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS date_finale DATE;

-- Crée date_mise_en_fonction (date de début d'activité)
ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS date_mise_en_fonction DATE;

-- Index pour filtrage rapide
CREATE INDEX IF NOT EXISTS idx_utilisateur_date_finale ON utilisateur (date_finale);
CREATE INDEX IF NOT EXISTS idx_utilisateur_date_mef ON utilisateur (date_mise_en_fonction);

COMMIT;