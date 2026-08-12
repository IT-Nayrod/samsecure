  -- ============================================================================
  -- SamSecure - BDD Tenant - Migration 019
  -- Objet   : preuve.nom_origine, nom du fichier tel que depose par l'utilisateur
  --           (#49). Le fichier physique porte un nom neutre et unique
  --           (UUID + extension) pour eviter les collisions et les caracteres
  --           speciaux ; le nom d'origine reste necessaire pour servir le
  --           telechargement sous un nom lisible et pour la valeur probante de
  --           l'audit. Le DDL v4 ne portait aucune colonne pour cela.
  -- Cible   : PostgreSQL - base Tenant
  -- Valide  : Antonin, 11/08/2026, en attente de confirmation Dorian
  -- Rejouable : IF NOT EXISTS.
  -- ============================================================================

  BEGIN;

  ALTER TABLE preuve ADD COLUMN IF NOT EXISTS nom_origine VARCHAR(255);
  COMMENT ON COLUMN preuve.nom_origine IS
    'Nom du fichier tel que transmis au depot. Jamais utilise comme nom physique : url_fichier porte un nom neutre UUID + extension, relatif au repertoire de stockage PREUVES_DIR.';

  COMMIT;
