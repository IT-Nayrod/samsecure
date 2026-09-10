-- ============================================================================
-- SamSecure - BDD Tenant - Migration 051
-- Fichier   : 051_tenant_notifications.sql
-- Objet     : module notifications (story #121, M3-notifications).
--             Les tables alerte et notification existent depuis le schema 002
--             (section 11) : elles sont REUTILISEES, pas recreees. Cette
--             migration ne cree que ce qui manque reellement :
--             1) colonnes additionnelles sur notification (type, cle
--                d'evenement, titre, message, lien, gravite, societe, donnees,
--                suivi du courrier). Toutes NULLables : aucun NOT NULL ajoute
--                sur une table existante, les lignes anterieures restent
--                valides ;
--             2) unicite utilisateur + cle d'evenement (anti-doublon, insertion
--                en ON CONFLICT DO NOTHING) et index de lecture ;
--             3) table preference_notification (reglage du courrier par type
--                et par utilisateur : immediat, quotidien, desactive) ;
--             4) verrou journalier du planificateur sur tache_asynchrone
--                (index unique partiel type + date du payload) ;
--             5) seuil budget_taux_engagement dans seuil_dashboard (echelle 1,
--                90 pourcent par defaut, meme mecanisme que les seuils de
--                conformite de la 046) ;
--             6) fonction purger_notifications() : DELETE bornes (lues de plus
--                de 90 jours, toutes au-dela de 180 jours, alertes orphelines
--                au-dela de 180 jours), appelee par le traitement quotidien.
--             Le type de notification est un texte controle par le
--             pre-catalogue applicatif (server/utils/notifications/
--             catalogue.js) : un nouveau type ne demande aucune migration.
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 002 (alerte, notification, tache_asynchrone, seuil_dashboard,
--             utilisateur, societe), 046 (convention des seuils echelle 1).
-- Rejouable : IF NOT EXISTS partout, contraintes ajoutees sous garde
--             pg_constraint, ON CONFLICT DO NOTHING sur le seuil.
-- Numero    : 048 et 049 sont absents de server/bdd et de origin/dev (plage
--             043 a 049 reservee aux chantiers paralleles du module 4, note de
--             la 050) ; 050 est prise. 051 (Tenant) et 052 (Commune) sont les
--             numeros prevus par le protocole et sont libres.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Colonnes additionnelles sur notification (toutes NULLables)
-- ----------------------------------------------------------------------------
ALTER TABLE notification ADD COLUMN IF NOT EXISTS type                VARCHAR(50);
ALTER TABLE notification ADD COLUMN IF NOT EXISTS cle_evenement       VARCHAR(255);
ALTER TABLE notification ADD COLUMN IF NOT EXISTS titre               VARCHAR(255);
ALTER TABLE notification ADD COLUMN IF NOT EXISTS message             TEXT;
ALTER TABLE notification ADD COLUMN IF NOT EXISTS lien                VARCHAR(500);
ALTER TABLE notification ADD COLUMN IF NOT EXISTS gravite             VARCHAR(10);
ALTER TABLE notification ADD COLUMN IF NOT EXISTS id_societe          UUID REFERENCES societe(id);
ALTER TABLE notification ADD COLUMN IF NOT EXISTS donnees             JSONB;
-- Suivi du courrier : mode retenu a la creation (preference de l'utilisateur
-- pour ce type, defaut du catalogue sinon), statut, date et resultat du
-- dernier envoi, nombre de tentatives.
ALTER TABLE notification ADD COLUMN IF NOT EXISTS courrier_mode       VARCHAR(10);
ALTER TABLE notification ADD COLUMN IF NOT EXISTS courrier_statut     VARCHAR(12);
ALTER TABLE notification ADD COLUMN IF NOT EXISTS courrier_date       TIMESTAMP;
ALTER TABLE notification ADD COLUMN IF NOT EXISTS courrier_resultat   TEXT;
ALTER TABLE notification ADD COLUMN IF NOT EXISTS courrier_tentatives INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_notification_gravite') THEN
    ALTER TABLE notification ADD CONSTRAINT ck_notification_gravite
      CHECK (gravite IS NULL OR gravite IN ('info', 'jaune', 'orange', 'rouge'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_notification_courrier_mode') THEN
    ALTER TABLE notification ADD CONSTRAINT ck_notification_courrier_mode
      CHECK (courrier_mode IS NULL OR courrier_mode IN ('immediat', 'quotidien', 'desactive'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_notification_courrier_statut') THEN
    ALTER TABLE notification ADD CONSTRAINT ck_notification_courrier_statut
      CHECK (courrier_statut IS NULL OR courrier_statut IN ('a_envoyer', 'envoye', 'echec', 'sans_objet'));
  END IF;
END $$;

COMMENT ON COLUMN notification.type            IS 'Type de notification, texte controle par le pre-catalogue applicatif (echeance_contrat, echeance_souscription, depassement_conformite, budget_seuil, validation_en_attente, saisie_traitee, revalidation_echue). Un nouveau type ne demande aucune migration.';
COMMENT ON COLUMN notification.cle_evenement   IS 'Cle d''evenement unique par utilisateur (anti-doublon) : type:identifiants:palier. Une seule notification par utilisateur et par cle.';
COMMENT ON COLUMN notification.message         IS 'Texte affiche a l''utilisateur, deja adapte a ses droits (montants masques sans consulter_kpi_financiers).';
COMMENT ON COLUMN notification.lien            IS 'Chemin de l''ecran concerne, relatif a la racine du front.';
COMMENT ON COLUMN notification.gravite         IS 'Niveau visuel, memes valeurs que alerte.niveau : info, jaune, orange, rouge.';
COMMENT ON COLUMN notification.courrier_mode   IS 'Mode de courrier retenu a la creation : immediat, quotidien (recapitulatif du matin) ou desactive.';
COMMENT ON COLUMN notification.courrier_statut IS 'a_envoyer, envoye, echec (retente au passage suivant), sans_objet (courrier desactive).';

-- ----------------------------------------------------------------------------
-- 2. Anti-doublon et index de lecture
--    Les lignes anterieures a cette migration ont cle_evenement NULL : les
--    NULL sont distincts pour un index unique, elles ne se heurtent pas.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_utilisateur_evenement
  ON notification (id_utilisateur, cle_evenement);

CREATE INDEX IF NOT EXISTS idx_notification_utilisateur_date
  ON notification (id_utilisateur, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_courrier_attente
  ON notification (courrier_mode, created_at)
  WHERE courrier_statut IN ('a_envoyer', 'echec');

-- ----------------------------------------------------------------------------
-- 3. Preferences de courrier par type et par utilisateur
--    Absence de ligne = defaut du catalogue applicatif pour ce type.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS preference_notification (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_utilisateur UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  type           VARCHAR(50) NOT NULL,
  courrier       VARCHAR(10) NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_preference_notification UNIQUE (id_utilisateur, type),
  CONSTRAINT ck_preference_notification_courrier CHECK (courrier IN ('immediat', 'quotidien', 'desactive'))
);
COMMENT ON TABLE preference_notification IS 'Reglage du courrier par type de notification et par utilisateur (#121). La notification en application est toujours creee ; seul le courrier suit ce reglage.';

CREATE INDEX IF NOT EXISTS idx_preference_notification_utilisateur
  ON preference_notification (id_utilisateur);

-- ----------------------------------------------------------------------------
-- 4. Verrou journalier du planificateur : une execution par type et par jour
--    (payload->>'date'). ON CONFLICT DO UPDATE ... WHERE statut = 'echec'
--    permet de rejouer un traitement echoue, jamais un traitement reussi.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_tache_notifications_jour
  ON tache_asynchrone (type, (payload->>'date'))
  WHERE type LIKE 'notifications_%';

-- ----------------------------------------------------------------------------
-- 5. Seuil du taux d'engagement budgetaire (echelle 1, pourcent), meme
--    convention que conformite_taux (046). DO NOTHING : un seuil deja
--    personnalise par le client n'est jamais ecrase par une livraison.
-- ----------------------------------------------------------------------------
INSERT INTO seuil_dashboard (widget_code, echelle, valeur, unite, direction) VALUES
  ('budget_taux_engagement', 1, 90.00, 'pourcent', 'max')
ON CONFLICT (widget_code, echelle) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. Purge, appelee par le traitement quotidien. Les trois DELETE sont bornes
--    par des conditions de date fixes : lues depuis plus de 90 jours, toutes
--    au-dela de 180 jours, alertes sans notification au-dela de 180 jours.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purger_notifications()
RETURNS TABLE (lues_supprimees INTEGER, anciennes_supprimees INTEGER, alertes_supprimees INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  v_lues      INTEGER := 0;
  v_anciennes INTEGER := 0;
  v_alertes   INTEGER := 0;
BEGIN
  DELETE FROM notification
   WHERE statut = 'lu'
     AND COALESCE(lu_at, created_at) < now() - INTERVAL '90 days';
  GET DIAGNOSTICS v_lues = ROW_COUNT;

  DELETE FROM notification
   WHERE created_at < now() - INTERVAL '180 days';
  GET DIAGNOSTICS v_anciennes = ROW_COUNT;

  DELETE FROM alerte a
   WHERE a.created_at < now() - INTERVAL '180 days'
     AND NOT EXISTS (SELECT 1 FROM notification n WHERE n.id_alerte = a.id);
  GET DIAGNOSTICS v_alertes = ROW_COUNT;

  RETURN QUERY SELECT v_lues, v_anciennes, v_alertes;
END;
$$;

COMMENT ON FUNCTION purger_notifications() IS
  'Purge bornee des notifications (#121) : lues de plus de 90 jours, toutes au-dela de 180 jours, alertes orphelines au-dela de 180 jours. Appelee par le traitement quotidien.';

COMMIT;
