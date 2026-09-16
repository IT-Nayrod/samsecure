-- ============================================================================
-- SamSecure - BDD Tenant - Migration 065
-- Fichier   : 065_tenant_conformite_type_essai.sql
-- Objet     : harmonisation du 16/09/2026 (#209).
--             1) Code du type version d'essai. La 058 (D44 etendu) faisait
--                expirer les types 'souscription' et 'version_essai', code
--                pose par hypothese avant la 055 ; la 055 a seede le
--                referentiel type_licence avec le code 'essai'. Aucune licence
--                ne portant 'version_essai', les versions d'essai echues
--                restaient comptees dans les droits du precalcul. La fonction
--                recalculer_precalcul_conformite est rejouee a l'identique
--                avec le code 'essai', meme constante que TYPES_A_ECHEANCE de
--                server/utils/conformite.js (alignee dans le meme lot).
--                recalculer_conformite_complete (058) et les triggers (046,
--                058) sont inchanges : ils appellent la fonction remplacee.
--             2) Cles d'evenement des alertes d'echeance (notifications). La
--                cle des types echeance_contrat et echeance_souscription porte
--                desormais la date de fin (type:id:date_fin:palier, regle
--                cleEcheance de server/utils/notifications/regles.js) : une
--                prolongation produit naturellement une nouvelle alerte, sans
--                liberation manuelle. Les cles deja emises sont realignees sur
--                ce format a partir de la date de fin portee par donnees
--                (cles nues) ou par le suffixe pose par l'ancienne liberation
--                (type:id:palier:ancienne_date), pour que l'anti-doublon
--                (index unique utilisateur + cle, 051) continue de couvrir les
--                alertes en cours. Une ligne dont la nouvelle cle existe deja
--                pour le meme utilisateur n'est pas touchee.
--             3) Recalcul complet de precalcul_conformite en fin de migration.
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool).
-- Exécution : npm run migrate:dev / migrate:staging.
-- Depend    : 046 et 058 (precalcul_conformite, conformite_statut,
--             anomalie_qualite), 051 (notification.cle_evenement, donnees),
--             055 (type_licence, code essai).
-- Rejouable : CREATE OR REPLACE, UPDATE bornes par WHERE sans effet au second
--             passage, recalcul complet idempotent. Aucun DDL de table,
--             aucune suppression.
-- Numero    : 064 (Commune) et 065 (Tenant) absents de server/bdd et de toutes
--             les references locales au 16/09/2026, numeros reserves.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Recalcul d'un produit : version 058 avec le code 'essai' (055)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculer_precalcul_conformite(p_id_produit UUID)
RETURNS void AS $$
DECLARE
  v_droits INTEGER;
  v_usages INTEGER;
  v_prix   NUMERIC;
  v_ecart  INTEGER;
  v_taux   NUMERIC;
  v_val    NUMERIC;
BEGIN
  -- Une licence sans produit n'appartient a aucune balance. L'API la refuse
  -- (code 4011), mais une ecriture SQL directe reste possible.
  IF p_id_produit IS NULL THEN
    RETURN;
  END IF;

  -- Droits des licences actives : souscription et version d'essai (D44
  -- etendu, code 'essai' du referentiel type_licence, 055) echues le
  -- lendemain de leur date de fin, sans tolerance ; perpetuelle jamais
  -- echue ; licence a echeance sans date de fin (donnee anterieure a la
  -- validation) active (regle #102).
  SELECT COALESCE(sum(l.quantite) FILTER (WHERE NOT (
           l.type IN ('souscription', 'essai') AND l.date_fin_souscription IS NOT NULL
           AND l.date_fin_souscription < CURRENT_DATE)), 0)::int
    INTO v_droits
    FROM licence l
   WHERE l.id_produit = p_id_produit;

  -- Usages : affectations dont la derniere entree du workflow est valide
  -- (le a_revalider de lecture en fait partie : il n'est jamais persiste).
  -- Les affectations des licences echues comptent : un usage declare sur une
  -- licence echue reste un usage, c'est le cas que la conformite doit sortir.
  SELECT COALESCE(sum(a.quantite), 0)::int
    INTO v_usages
    FROM affectation a
    JOIN licence l ON l.id = a.id_licence
    LEFT JOIN LATERAL (
      SELECT vs.code
        FROM workflow_validation w
        LEFT JOIN validation_status vs ON vs.id = w.id_statut
       WHERE w.entite_type = 'affectation' AND w.entite_id = a.id
       ORDER BY w.created_at DESC, w.id DESC
       LIMIT 1
    ) wv ON true
   WHERE l.id_produit = p_id_produit
     AND wv.code = 'valide';

  -- D52 : prix unitaire de la derniere commande. Ligne la plus recente par
  -- date de commande (une licence sans commande se classe apres les lignes
  -- datees, par sa date de creation), parmi les lignes a prix calculable.
  -- Toutes les lignes du produit sont candidates, echues comprises : c'est le
  -- dernier prix paye, il vaut pour valoriser un manque de droits meme
  -- quand plus aucune licence n'est active.
  v_prix := NULL;
  SELECT round(l.cout_licence / l.quantite, 2)
    INTO v_prix
    FROM licence l
    LEFT JOIN commande c ON c.id = l.id_commande
   WHERE l.id_produit = p_id_produit
     AND l.cout_licence IS NOT NULL
     AND l.quantite > 0
   ORDER BY c.date_commande DESC NULLS LAST, l.created_at DESC, l.id DESC
   LIMIT 1;

  v_ecart := v_droits - v_usages;
  -- D53 : aucun taux sans droit.
  v_taux  := CASE WHEN v_droits > 0 THEN round(v_usages::numeric / v_droits * 100, 2) END;
  v_val   := CASE WHEN v_prix IS NOT NULL THEN round(v_ecart * v_prix, 2) END;

  INSERT INTO precalcul_conformite
    (id_produit, droits_total, usages_total, ecart, ecart_pct,
     prix_unitaire, ecart_valorise, statut_conformite, derniere_maj)
  VALUES
    (p_id_produit, v_droits, v_usages, v_ecart, LEAST(v_taux, 999.99),
     v_prix, v_val, conformite_statut(v_droits, v_usages, v_val), now())
  ON CONFLICT (id_produit)
  DO UPDATE SET droits_total      = EXCLUDED.droits_total,
                usages_total      = EXCLUDED.usages_total,
                ecart             = EXCLUDED.ecart,
                ecart_pct         = EXCLUDED.ecart_pct,
                prix_unitaire     = EXCLUDED.prix_unitaire,
                ecart_valorise    = EXCLUDED.ecart_valorise,
                statut_conformite = EXCLUDED.statut_conformite,
                derniere_maj      = now();

  -- D53 : anomalie qualite immediate, une seule ouverte par produit. Le
  -- libelle du produit vit en BDD Commune, hors de portee d'ici : l'API
  -- (GET /qualite) le resout a la lecture. Close des que la condition cesse :
  -- une anomalie de fait n'a pas a etre resolue a la main.
  IF v_droits = 0 AND v_usages > 0 THEN
    INSERT INTO anomalie_qualite (entite_type, entite_id, type_anomalie, gravite, description)
    SELECT 'produit', p_id_produit, 'usage_sans_droit', 'critique',
           format('%s usage(s) déclaré(s) sans aucun droit acquis sur ce logiciel', v_usages)
     WHERE NOT EXISTS (
       SELECT 1 FROM anomalie_qualite aq
        WHERE aq.entite_type = 'produit' AND aq.entite_id = p_id_produit
          AND aq.type_anomalie = 'usage_sans_droit' AND aq.resolu = false);
  ELSE
    UPDATE anomalie_qualite
       SET resolu = true
     WHERE entite_type = 'produit' AND entite_id = p_id_produit
       AND type_anomalie = 'usage_sans_droit' AND resolu = false;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculer_precalcul_conformite IS
  'Recalcule la ligne precalcul_conformite d''un logiciel par relecture des licences et affectations. Prix unitaire de la derniere commande (D52), aucun taux sans droit et anomalie usage_sans_droit (D53), types a echeance souscription et essai (D44 etendu, code de la 055). Un logiciel sans droit ni usage garde une ligne a zero, filtree par l''API.';

-- ----------------------------------------------------------------------------
-- 2. Cles d'evenement des alertes d'echeance : la date de fin entre dans la
--    cle (type:id:date_fin:palier). UPDATE bornes par type et motif, jamais
--    appliques quand la cle cible existe deja pour le meme utilisateur (index
--    unique de la 051) : la ligne est alors laissee telle quelle.
-- ----------------------------------------------------------------------------
-- a) Cles suffixees par l'ancienne liberation manuelle a la prolongation
--    (type:id:palier:ancienne_date) : l'ancienne date passe avant le palier.
UPDATE notification n
   SET cle_evenement = regexp_replace(n.cle_evenement,
         '^(echeance_(?:contrat|souscription)):([^:]+):([0-9]+):([0-9]{4}-[0-9]{2}-[0-9]{2})$',
         '\1:\2:\4:\3')
 WHERE n.type IN ('echeance_contrat', 'echeance_souscription')
   AND n.cle_evenement ~ '^echeance_(contrat|souscription):[^:]+:[0-9]+:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   AND NOT EXISTS (
     SELECT 1 FROM notification n2
      WHERE n2.id_utilisateur = n.id_utilisateur
        AND n2.cle_evenement = regexp_replace(n.cle_evenement,
              '^(echeance_(?:contrat|souscription)):([^:]+):([0-9]+):([0-9]{4}-[0-9]{2}-[0-9]{2})$',
              '\1:\2:\4:\3'));

-- b) Cles nues (type:id:palier) : la date de fin portee par donnees (posee a
--    l'emission) s'insere avant le palier ; sans date connue, le segment vaut
--    'aucun', comme le rend cleEvenement.
UPDATE notification n
   SET cle_evenement = regexp_replace(n.cle_evenement,
         '^(echeance_(?:contrat|souscription)):([^:]+):([0-9]+)$',
         '\1:\2:' || COALESCE(substr(n.donnees->>'date_fin', 1, 10), 'aucun') || ':\3')
 WHERE n.type IN ('echeance_contrat', 'echeance_souscription')
   AND n.cle_evenement ~ '^echeance_(contrat|souscription):[^:]+:[0-9]+$'
   AND NOT EXISTS (
     SELECT 1 FROM notification n2
      WHERE n2.id_utilisateur = n.id_utilisateur
        AND n2.cle_evenement = regexp_replace(n.cle_evenement,
              '^(echeance_(?:contrat|souscription)):([^:]+):([0-9]+)$',
              '\1:\2:' || COALESCE(substr(n.donnees->>'date_fin', 1, 10), 'aucun') || ':\3'));

COMMENT ON COLUMN notification.cle_evenement IS 'Cle d''evenement unique par utilisateur (anti-doublon) : type:identifiants:palier ; pour echeance_contrat et echeance_souscription, type:id:date_fin:palier depuis la 065 (une prolongation produit une nouvelle cle, sans liberation manuelle). Une seule notification par utilisateur et par cle.';

-- ----------------------------------------------------------------------------
-- 3. Amorcage : le parc est recalcule avec le code aligne.
-- ----------------------------------------------------------------------------
SELECT recalculer_conformite_complete();

COMMIT;
