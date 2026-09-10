-- ============================================================================
-- SamSecure - BDD Tenant - Migration 058
-- Fichier   : 058_tenant_conformite_prix_derniere_commande.sql
-- Objet     : correctifs de conformite (#190), decisions du 10/09/2026.
--             D52, prix unitaire : le prix d'un produit est la valeur tiree de
--               sa derniere commande (ligne de licence la plus recente par
--               date de commande, a defaut par date de creation), jamais une
--               moyenne. Le rapport "somme des couts / somme des quantites"
--               de la 046 est abandonne.
--             D53, droits a zero : un produit porteur d'usages sans aucun
--               droit acquis ne recoit aucun taux (ecart_pct NULL, aucun
--               pourcentage sans sens), son statut est depassement, et une
--               anomalie qualite immediate de type usage_sans_droit est
--               ouverte dans anomalie_qualite, une seule par produit
--               (entite_type 'produit', entite_id = id_produit). Elle est
--               close automatiquement des que des droits reviennent ou que
--               les usages disparaissent.
--             Un trigger sur commande complete la chaine : la date de
--             commande entre desormais dans le calcul du prix.
--             Recalcul complet en fin de migration.
-- Cible     : PostgreSQL 16 - base Tenant (pas de mot "commune" dans le nom :
--             migrate.js route sur tenantPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 046 (precalcul_conformite alimente, conformite_statut,
--             triggers licence et affectation), 015 (commande.date_commande).
-- Rejouable : CREATE OR REPLACE, DROP TRIGGER IF EXISTS puis CREATE, recalcul
--             complet idempotent. Aucun DDL de table, aucune purge.
-- ============================================================================

BEGIN;

COMMENT ON COLUMN precalcul_conformite.prix_unitaire IS
  'Prix unitaire de la derniere commande du produit (D52) : cout_licence / quantite de la ligne de licence la plus recente par date de commande, a defaut par date de creation, parmi les lignes a cout renseigne et quantite > 0. NULL sans ligne exploitable. Jamais une moyenne.';

COMMENT ON COLUMN precalcul_conformite.ecart_pct IS
  'usages / droits x 100, borne a 999.99. NULL quand les droits sont nuls (D53) : aucun taux sans droit.';

-- ----------------------------------------------------------------------------
-- 1. Recalcul d'un produit (remplace la version 046). Relecture complete,
--    jamais de delta, meme motif auto-reparateur.
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

  -- Droits des licences actives : souscription echue le jour meme de sa date
  -- de fin, sans tolerance ; perpetuelle jamais echue ; souscription sans
  -- date de fin (donnee anterieure a la validation) active (regle #102).
  SELECT COALESCE(sum(l.quantite) FILTER (WHERE NOT (
           l.type = 'souscription' AND l.date_fin_souscription IS NOT NULL
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
           format('%s usage(s) déclaré(s) sans aucun droit acquis sur ce produit', v_usages)
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
  'Recalcule la ligne precalcul_conformite d''un produit par relecture des licences et affectations. Prix unitaire de la derniere commande (D52), aucun taux sans droit et anomalie usage_sans_droit (D53). Un produit sans droit ni usage garde une ligne a zero, filtree par l''API.';

-- ----------------------------------------------------------------------------
-- 2. Trigger sur commande : la date de commande designe la derniere ligne.
--    Les triggers licence et affectation de la 046 sont conserves tels quels,
--    ils appellent la fonction remplacee ci-dessus.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_commande_conformite() RETURNS trigger AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT l.id_produit FROM licence l
            WHERE l.id_commande = NEW.id AND l.id_produit IS NOT NULL
  LOOP
    PERFORM recalculer_precalcul_conformite(r.id_produit);
  END LOOP;
  RETURN NULL;  -- AFTER trigger, la valeur de retour est ignoree
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_commande_conformite_au ON commande;
CREATE TRIGGER trg_commande_conformite_au
  AFTER UPDATE OF date_commande ON commande
  FOR EACH ROW
  WHEN (OLD.date_commande IS DISTINCT FROM NEW.date_commande)
  EXECUTE FUNCTION trg_commande_conformite();

-- ----------------------------------------------------------------------------
-- 3. Recalcul complet (remplace la version 046) : remise a zero puis
--    reecriture de chaque produit porteur d'au moins une licence, puis
--    cloture des anomalies usage_sans_droit dont le produit n'est plus dans
--    la situation (par exemple sans plus aucune licence).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculer_conformite_complete()
RETURNS INTEGER AS $$
DECLARE
  r    RECORD;
  v_nb INTEGER := 0;
BEGIN
  -- Remise a zero et non purge : les produits encore porteurs sont reecrits
  -- juste apres, les autres restent a zero et sont filtres par l'API.
  UPDATE precalcul_conformite
     SET droits_total = 0, usages_total = 0, ecart = 0, ecart_pct = NULL,
         prix_unitaire = NULL, ecart_valorise = NULL,
         statut_conformite = 'conforme', derniere_maj = now()
   WHERE id_produit IS NOT NULL;

  FOR r IN SELECT DISTINCT l.id_produit FROM licence l WHERE l.id_produit IS NOT NULL
  LOOP
    PERFORM recalculer_precalcul_conformite(r.id_produit);
    v_nb := v_nb + 1;
  END LOOP;

  UPDATE anomalie_qualite aq
     SET resolu = true
   WHERE aq.type_anomalie = 'usage_sans_droit' AND aq.resolu = false
     AND NOT EXISTS (
       SELECT 1 FROM precalcul_conformite pc
        WHERE pc.id_produit = aq.entite_id
          AND pc.droits_total = 0 AND pc.usages_total > 0);

  RETURN v_nb;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculer_conformite_complete IS
  'Reconstruit precalcul_conformite depuis licences et affectations (prix de la derniere commande, anomalies usage_sans_droit). Amorcage des 046 et 058, reparation a la demande (manual/amorcer-conformite.js), execution quotidienne recommandee (droits dependants de CURRENT_DATE).';

-- ----------------------------------------------------------------------------
-- 4. Amorcage : le parc existant est recalcule avec les nouvelles regles.
-- ----------------------------------------------------------------------------
SELECT recalculer_conformite_complete();

COMMIT;
