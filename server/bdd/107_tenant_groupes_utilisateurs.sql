-- ============================================================================
-- SamSecure - BDD Tenant - Migration 107
-- Fichier   : 107_tenant_groupes_utilisateurs.sql
-- Objet     : groupes d'utilisateurs (US #330, decisions client du 08/10/2026,
--             issue #213) : un groupe est une somme de comptes dont les acces
--             sont une somme de lignes profil × groupe d'organisations.
--             Ajouter un compte au groupe lui donne tous ces acces ; un compte
--             peut appartenir a plusieurs groupes et garder des attributions
--             directes (« et/ou »). Trois tables :
--             - groupe_utilisateur : identite (nom unique parmi les groupes
--               actifs), traçabilite, suppression douce (ses lignes cessent
--               alors de compter dans les droits effectifs) ;
--             - groupe_utilisateur_membre : appartenance d'un compte, une fois
--               par groupe (unicite), soft-delete pour que le retrait reste
--               trace et qu'un re-ajout reactive la ligne (ON CONFLICT DO
--               UPDATE, meme motif que uq_utilisateur_profil_societe) ;
--             - groupe_utilisateur_acces : ligne profil × groupe
--               d'organisations, une fois par groupe (unicite), soft-delete
--               pour la meme raison. Le profil admin_sam y est refuse par
--               l'API (decision a valider par Samuel, reserve au journal).
-- Cible     : PostgreSQL 16 - base Tenant, a jouer sur dev ET staging,
--             APRES la 106 (reference groupe_organisation)
-- Execution : npm run migrate:dev / migrate:staging
-- Depend    : 002 (utilisateur, profil), 106 (groupe_organisation)
-- Rejouable : oui (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--             aucun DROP, aucune donnee seedee)
-- Numero    : 107 reserve par le chantier groupes-acces (US #277/#330), libre
--             dans server/bdd et sur toutes les branches au 09/10/2026
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS groupe_utilisateur (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom              VARCHAR(150) NOT NULL,
  description      TEXT,
  id_cree_par      UUID REFERENCES utilisateur(id),
  created_at       TIMESTAMP NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP NOT NULL DEFAULT now(),
  date_suppression TIMESTAMP
);

COMMENT ON TABLE groupe_utilisateur IS
  'Groupe d''utilisateurs (US #330, 08/10/2026) : somme de comptes dont les accès sont les lignes de groupe_utilisateur_acces. Les droits effectifs d''un membre sont l''union de ses attributions directes et des lignes de ses groupes. Suppression douce : un groupe supprimé ne confère plus rien.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_groupe_utilisateur_nom_actif
  ON groupe_utilisateur (lower(nom)) WHERE date_suppression IS NULL;

CREATE TABLE IF NOT EXISTS groupe_utilisateur_membre (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_groupe_utilisateur UUID NOT NULL REFERENCES groupe_utilisateur(id),
  id_utilisateur       UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  id_ajoute_par        UUID REFERENCES utilisateur(id),
  created_at           TIMESTAMP NOT NULL DEFAULT now(),
  date_suppression     TIMESTAMP,
  CONSTRAINT uq_groupe_utilisateur_membre UNIQUE (id_groupe_utilisateur, id_utilisateur)
);

COMMENT ON TABLE groupe_utilisateur_membre IS
  'Appartenance d''un compte à un groupe d''utilisateurs, une fois par groupe. Soft-delete : un retrait pose date_suppression, un re-ajout réactive la ligne (ON CONFLICT DO UPDATE), l''historique est porté par audit_log sur le compte.';

CREATE INDEX IF NOT EXISTS idx_gum_groupe      ON groupe_utilisateur_membre (id_groupe_utilisateur);
CREATE INDEX IF NOT EXISTS idx_gum_utilisateur ON groupe_utilisateur_membre (id_utilisateur);

CREATE TABLE IF NOT EXISTS groupe_utilisateur_acces (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_groupe_utilisateur  UUID NOT NULL REFERENCES groupe_utilisateur(id),
  id_profil              UUID NOT NULL REFERENCES profil(id),
  id_groupe_organisation UUID NOT NULL REFERENCES groupe_organisation(id),
  id_ajoute_par          UUID REFERENCES utilisateur(id),
  created_at             TIMESTAMP NOT NULL DEFAULT now(),
  date_suppression       TIMESTAMP,
  CONSTRAINT uq_groupe_utilisateur_acces UNIQUE (id_groupe_utilisateur, id_profil, id_groupe_organisation)
);

COMMENT ON TABLE groupe_utilisateur_acces IS
  'Ligne d''accès d''un groupe d''utilisateurs : un profil appliqué aux sociétés d''un groupe d''organisations (ex. IT Ops sur le groupe A-B-C), une fois par groupe. Soft-delete, re-ajout par réactivation. Chaque membre du groupe porte l''union de ces lignes.';

CREATE INDEX IF NOT EXISTS idx_gua_groupe             ON groupe_utilisateur_acces (id_groupe_utilisateur);
CREATE INDEX IF NOT EXISTS idx_gua_profil             ON groupe_utilisateur_acces (id_profil);
CREATE INDEX IF NOT EXISTS idx_gua_groupe_organisation ON groupe_utilisateur_acces (id_groupe_organisation);

COMMIT;
