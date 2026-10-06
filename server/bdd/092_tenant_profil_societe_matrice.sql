-- ============================================================================
-- SamSecure - BDD Tenant - Migration 092
-- Fichier   : 092_tenant_profil_societe_matrice.sql
-- Objet     : refonte des droits #249, socle du modele. Deux tables :
--             - profil_societe_permission : matrice d'un profil par defaut
--               pour une societe. Remplacement complet a chaque enregistrement
--               (Q2) : jamais un delta du defaut, pas de soft-delete (l'avant/
--               apres est porte par audit_log) ;
--             - profil_societe_configuration : marqueur « societe configuree »
--               (Q3), distinct d'une matrice vide. Une matrice videe
--               volontairement reste configuree (ligne presente, zero
--               permission) ; une societe jamais touchee n'a pas de ligne et
--               suit la matrice par defaut du tenant.
--             Aucune ligne seedee : au depart, aucune societe n'est configuree,
--             tous les profils suivent le defaut.
-- Cible     : PostgreSQL 16 - base Tenant, a jouer sur dev ET staging
-- Execution : npm run migrate:dev / migrate:staging
-- Depend    : 002 (profil, permission, societe, utilisateur), 074 (profil.type)
-- Rejouable : oui (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS)
-- Numero    : 092 reserve par le chantier #249, libre dans server/bdd et sur
--             toutes les branches au 06/10/2026
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS profil_societe_permission (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_profil     UUID NOT NULL REFERENCES profil(id),
  id_societe    UUID NOT NULL REFERENCES societe(id),
  id_permission UUID NOT NULL REFERENCES permission(id),
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_profil_societe_permission UNIQUE (id_profil, id_societe, id_permission)
);

COMMENT ON TABLE profil_societe_permission IS
  'Matrice d''un profil par défaut pour une société (#249). Remplacement complet à chaque enregistrement (Q2), jamais un delta du défaut. Ne fait foi que si la société est configurée (profil_societe_configuration).';

CREATE INDEX IF NOT EXISTS idx_psp_profil_societe ON profil_societe_permission (id_profil, id_societe);
CREATE INDEX IF NOT EXISTS idx_psp_societe        ON profil_societe_permission (id_societe);

CREATE TABLE IF NOT EXISTS profil_societe_configuration (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_profil        UUID NOT NULL REFERENCES profil(id),
  id_societe       UUID NOT NULL REFERENCES societe(id),
  configure_le     TIMESTAMP NOT NULL DEFAULT now(),
  id_configure_par UUID REFERENCES utilisateur(id),
  CONSTRAINT uq_profil_societe_configuration UNIQUE (id_profil, id_societe)
);

COMMENT ON TABLE profil_societe_configuration IS
  'Marqueur « société configurée » par profil et société (#249, Q3). Présent = la matrice profil_societe_permission fait foi intégralement, même vide ; absent = la société suit la matrice par défaut du tenant. Une évolution du défaut ne touche jamais une société configurée (Q2).';

CREATE INDEX IF NOT EXISTS idx_psc_societe ON profil_societe_configuration (id_societe);
CREATE INDEX IF NOT EXISTS idx_psc_profil  ON profil_societe_configuration (id_profil);

COMMIT;
