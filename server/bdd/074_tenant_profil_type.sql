-- ============================================================================
-- SamSecure - BDD Tenant - Migration 074
-- Fichier   : 074_tenant_profil_type.sql
-- Objet     : separation profils par defaut / groupes personnalises (version
--             minimum actee le 06/10/2026, la refonte matricielle par societe
--             #249 reste reservee au bouclage). Colonne profil.type a trois
--             valeurs :
--               - profil_defaut : profils seedes de la plateforme (003),
--                 matrice editable, suppression interdite ;
--               - groupe        : groupes crees par le client, CRUD complet
--                 (valeur par defaut, donc celle de tout l'existant) ;
--               - systeme       : admin_sam, groupe d'administration complete
--                 du tenant (011), suppression interdite.
--             Le seed des types est borne aux codes connus : un groupe cree
--             par le client garde 'groupe'. UPDATE rejouable sans effet au
--             second passage (clause type <>).
-- Cible     : PostgreSQL 16 - base Tenant, a jouer sur dev ET staging
-- Execution : npm run migrate
-- Depend    : 002 (table profil), 003 (profils seedes), 011 (admin_sam)
-- Rejouable : oui (IF NOT EXISTS, garde pg_constraint, UPDATE bornes)
-- Numero    : 074
-- ============================================================================

BEGIN;

ALTER TABLE profil ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'groupe';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_profil_type'
  ) THEN
    ALTER TABLE profil ADD CONSTRAINT ck_profil_type
      CHECK (type IN ('profil_defaut', 'groupe', 'systeme'));
  END IF;
END
$$;

COMMENT ON COLUMN profil.type IS
  'profil_defaut (seede, non supprimable), groupe (cree par le client, CRUD), systeme (admin_sam, non supprimable). Separation actee le 06/10/2026, version minimum avant la refonte #249.';

UPDATE profil SET type = 'profil_defaut'
 WHERE code IN ('it_ops', 'financier', 'manager_dsi', 'it_data_input')
   AND type <> 'profil_defaut';

UPDATE profil SET type = 'systeme'
 WHERE code = 'admin_sam'
   AND type <> 'systeme';

COMMIT;
