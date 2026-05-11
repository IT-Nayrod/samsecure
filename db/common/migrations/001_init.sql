-- ================================================
-- Migration 001 - Init BDD Commune
-- Table de test uniquement - schema metier a venir
-- ================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT PRIMARY KEY,
  applied_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_common (
  id         SERIAL PRIMARY KEY,
  message    VARCHAR(255) NOT NULL,
  env        VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO test_common (message, env)
  VALUES ('Connexion BDD Commune OK', current_database());

INSERT INTO schema_migrations (version) VALUES ('001');
