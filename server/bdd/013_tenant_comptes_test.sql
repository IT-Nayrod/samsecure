-- ============================================================================
-- SamSecure - BDD Tenant - Migration 013
-- Fichier   : 013_tenant_comptes_test.sql
-- Objet     : crée 3 comptes de test, un par groupe métier, mot de passe
--             "1234" (haché bcrypt), rattachement à l'échelle du tenant.
-- Cible     : PostgreSQL - base Tenant
-- Exécution : rejouable (ON CONFLICT DO NOTHING sur l'email)
-- ============================================================================

BEGIN;

INSERT INTO utilisateur (nom, prenom, email, mot_de_passe_hash, actif, langue) VALUES
  ('Test', 'Manager',   'test.manager@demo.fr',   '$2b$10$ILz7F.kMUo5lrXi9a9MPYuZZhngAjB2TQ.cwsQUJVAOP6WFvDmHj6', true, 'fr'),
  ('Test', 'Financier', 'test.financier@demo.fr', '$2b$10$ILz7F.kMUo5lrXi9a9MPYuZZhngAjB2TQ.cwsQUJVAOP6WFvDmHj6', true, 'fr'),
  ('Test', 'ITOps',     'test.itops@demo.fr',     '$2b$10$ILz7F.kMUo5lrXi9a9MPYuZZhngAjB2TQ.cwsQUJVAOP6WFvDmHj6', true, 'fr')
ON CONFLICT (email) DO NOTHING;

INSERT INTO utilisateur_societe (id_utilisateur, id_societe)
SELECT u.id, NULL FROM utilisateur u
WHERE u.email IN ('test.manager@demo.fr', 'test.financier@demo.fr', 'test.itops@demo.fr')
ON CONFLICT ON CONSTRAINT uq_utilisateur_societe DO NOTHING;

INSERT INTO utilisateur_profil_societe (id_utilisateur, id_profil, id_societe)
SELECT u.id, p.id, NULL
FROM utilisateur u
JOIN profil p ON (
  (u.email = 'test.manager@demo.fr'   AND p.code = 'manager_dsi') OR
  (u.email = 'test.financier@demo.fr' AND p.code = 'financier')   OR
  (u.email = 'test.itops@demo.fr'     AND p.code = 'it_ops')
)
WHERE u.email IN ('test.manager@demo.fr', 'test.financier@demo.fr', 'test.itops@demo.fr')
ON CONFLICT ON CONSTRAINT uq_utilisateur_profil_societe DO NOTHING;

COMMIT;
