-- ============================================================================
-- SamSecure - BDD Tenant - Migration 012
-- Fichier   : 012_tenant_migration_comptes_mock.sql
-- Objet     : migre les 3 comptes actuellement codés en dur dans
--             src/context/AuthContext.jsx (MOCK_CREDENTIALS) vers la base
--             réelle : même email, même mot de passe (haché bcrypt),
--             groupe admin_sam (rôle d'administration complète du tenant,
--             cf. migration 011), rattachement à l'échelle du tenant.
--             Mots de passe sources (en clair dans le front avant migration) :
--               admin@demo.fr     -> Admin1234!
--               financier@demo.fr -> User1234!
--               itops@demo.fr     -> User1234!
--             Les autres utilisateurs mock (src/data/mockUsers.js) ne
--             servaient qu'à peupler des listes d'affichage : non migrés.
-- Cible     : PostgreSQL - base Tenant
-- Exécution : rejouable (ON CONFLICT DO NOTHING sur l'email)
-- ============================================================================

BEGIN;

INSERT INTO utilisateur (nom, prenom, email, mot_de_passe_hash, actif, langue) VALUES
  ('Durand', 'Sophie', 'admin@demo.fr',     '$2b$10$dipJbIJhTENnuZo08kecVe.ZOQNRiL6Ja/Jffkd3VPPE/vhBpV4bi', true, 'fr'),
  ('Martin', 'Paul',   'financier@demo.fr', '$2b$10$xTTLtmo1LnLe3fWEYweacuzBDJwbvEI5rwhVMvgoYVQXKr3izDbnW', true, 'fr'),
  ('Petit',  'Julie',  'itops@demo.fr',     '$2b$10$xTTLtmo1LnLe3fWEYweacuzBDJwbvEI5rwhVMvgoYVQXKr3izDbnW', true, 'fr')
ON CONFLICT (email) DO NOTHING;

-- Rattachement à l'échelle du tenant (id_societe NULL = toutes sociétés,
-- actuelles et futures).
INSERT INTO utilisateur_societe (id_utilisateur, id_societe)
SELECT u.id, NULL FROM utilisateur u
WHERE u.email IN ('admin@demo.fr', 'financier@demo.fr', 'itops@demo.fr')
ON CONFLICT ON CONSTRAINT uq_utilisateur_societe DO NOTHING;

-- Attribution du groupe admin_sam, portée tenant.
INSERT INTO utilisateur_profil_societe (id_utilisateur, id_profil, id_societe)
SELECT u.id, p.id, NULL
FROM utilisateur u
CROSS JOIN profil p
WHERE u.email IN ('admin@demo.fr', 'financier@demo.fr', 'itops@demo.fr')
  AND p.code = 'admin_sam'
ON CONFLICT ON CONSTRAINT uq_utilisateur_profil_societe DO NOTHING;

COMMIT;
