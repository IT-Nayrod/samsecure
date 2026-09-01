-- ============================================================================
-- SamSecure - BDD Tenant - Migration 046
-- Fichier   : 046_tenant_conformite_precalcul.sql
-- Objet     : module 3, conformite (US #116). Alimentation de
--             precalcul_conformite, table presente depuis 002 mais jamais
--             ecrite (constat repris dans server/utils/conformite.js).
--             1) colonnes prix_unitaire et ecart_valorise (evolution de
--                schema autorisee par la story) ;
--             2) unicite par produit, absente du DDL v4 alors que la
--                granularite du precalcul la suppose ;
--             3) seuils de conformite dans seuil_dashboard (echelle 1) :
--                taux d'attention en pourcent et seuil en montant sur
--                l'ecart valorise negatif, la structure existante suffisant
--                (colonne unite, commentaire du DDL 002 : "le type en montant
--                d'ecart valorise passe par unite = euros"), aucune colonne
--                ajoutee aux tables de seuils ;
--             4) fonctions de calcul + triggers AFTER sur licence et
--                affectation (insert, update, delete), meme motif
--                auto-reparateur que la migration 016 : relecture complete
--                de la combinaison, jamais de delta ;
--             5) fonction de recalcul complet appelable
--                (recalculer_conformite_complete), executee en fin de
--                migration pour amorcer, puis rejouable a la demande
--                (script server/bdd/manual/amorcer-conformite.js).
--             Regles de calcul (validees Dorian, US #116) :
--               droits  = quantites des licences perpetuelles + souscriptions
--                         dont date_fin_souscription >= date du jour (sortie
--                         le jour meme, sans tolerance, regle #102 conservee) ;
--               usages  = quantites des affectations dont la derniere entree
--                         workflow_validation est valide (le a_revalider de
--                         lecture en fait partie) ; en_attente et refuse
--                         exclus ; pas de deduplication par reference ;
--               ecart   = droits - usages ; ecart_pct = usages / droits x 100 ;
--               prix unitaire = somme des couts des licences actives / somme
--                         de leurs quantites ; ecart valorise = ecart x prix ;
--               statut  = depassement si usages > droits, attention si taux >=
--                         seuil (defaut 90), conforme sinon. Droits nuls et
--                         usages nuls = produit non compte (ligne a zero,
--                         filtree par l'API, jamais purgee : pas d'ordre de
--                         suppression dans cette migration).
--             id_editeur n'est pas alimente : l'editeur d'un produit vit en
--             BDD Commune (produit_referentiel.id_editeur), hors de portee
--             d'un trigger Tenant. L'API le resout a la lecture, comme les
--             libelles produit (resoudreCatalogue de licences.js).
-- Cible     : PostgreSQL 16 - base Tenant (pas de mot "commune" dans le nom :
--             migrate.js route sur tenantPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 002 (precalcul_conformite, seuil_dashboard), 003
--             (validation_status), 020 (workflow rattrape).
-- Rejouable : ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, ON CONFLICT,
--             recalcul complet idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Colonnes de valorisation (evolution de schema autorisee US #116)
-- ----------------------------------------------------------------------------
ALTER TABLE precalcul_conformite ADD COLUMN IF NOT EXISTS prix_unitaire  DECIMAL(12,2);
ALTER TABLE precalcul_conformite ADD COLUMN IF NOT EXISTS ecart_valorise DECIMAL(14,2);

COMMENT ON COLUMN precalcul_conformite.prix_unitaire  IS 'Somme des couts des licences actives du produit divisee par la somme de leurs quantites. NULL quand aucune licence active.';
COMMENT ON COLUMN precalcul_conformite.ecart_valorise IS 'ecart x prix_unitaire. Negatif en depassement. NULL quand le prix unitaire est inconnu.';

-- ----------------------------------------------------------------------------
-- 2. Unicite par produit, support de l'ON CONFLICT du recalcul
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_precalcul_conformite_produit
  ON precalcul_conformite (id_produit);

-- ----------------------------------------------------------------------------
-- 3. Seuils de conformite (echelle 1 de seuil_dashboard, structure inchangee)
--    Pendant Commune : default_seuil_dashboard, seede par la migration 047.
--    DO NOTHING et non DO UPDATE : un seuil deja personnalise par le client
--    ne doit jamais etre ecrase par une livraison.
-- ----------------------------------------------------------------------------
INSERT INTO seuil_dashboard (widget_code, echelle, valeur, unite, direction) VALUES
  ('conformite_taux',           1,    90.00, 'pourcent', 'max'),
  ('conformite_ecart_valorise', 1, 10000.00, 'euros',    'max')
ON CONFLICT (widget_code, echelle) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Lecture d'un seuil : valeur du tenant, sinon defaut passe en argument.
--    La chaine "tenant puis defaut Commune" est fermee par le seed ci-dessus
--    (les defauts Commune sont diffuses dans seuil_dashboard) : une jointure
--    inter-bases est impossible depuis un trigger Tenant.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION conformite_seuil(p_widget VARCHAR, p_defaut NUMERIC)
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    (SELECT s.valeur FROM seuil_dashboard s
      WHERE s.widget_code = p_widget AND s.echelle = 1
      LIMIT 1),
    p_defaut);
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION conformite_seuil IS
  'Seuil de conformite du tenant (seuil_dashboard, echelle 1), sinon le defaut passe en argument. Miroir des defauts Commune seedes par 047.';

-- ----------------------------------------------------------------------------
-- 5. Statut de conformite d'une balance. Regle US #116 : depassement prime,
--    puis attention au taux (>= seuil pourcent) ou a l'ecart valorise negatif
--    au-dela du seuil en montant, conforme sinon. La branche montant est
--    aujourd'hui couverte par le depassement (un ecart valorise negatif
--    suppose usages > droits) : elle est conservee telle que la regle
--    l'enonce, pour le jour ou la precedence changerait.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION conformite_statut(
  p_droits         INTEGER,
  p_usages         INTEGER,
  p_ecart_valorise NUMERIC
) RETURNS VARCHAR AS $$
DECLARE
  v_seuil_taux    NUMERIC := conformite_seuil('conformite_taux', 90);
  v_seuil_montant NUMERIC := conformite_seuil('conformite_ecart_valorise', 10000);
BEGIN
  IF p_usages > p_droits THEN
    RETURN 'depassement';
  END IF;
  IF p_droits > 0 AND p_usages >= p_droits * v_seuil_taux / 100 THEN
    RETURN 'attention';
  END IF;
  IF p_ecart_valorise IS NOT NULL AND p_ecart_valorise < 0
     AND abs(p_ecart_valorise) >= v_seuil_montant THEN
    RETURN 'attention';
  END IF;
  RETURN 'conforme';
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------------------------
-- 6. Recalcul d'un produit, par relecture complete et non par delta (meme
--    choix auto-reparateur que recalculer_precalcul_financier, 016) : un
--    trigger manque ou une ecriture SQL directe ne laissent pas de derive,
--    le prochain recalcul du produit remet la valeur juste.
--    ecart_pct est borne a 999.99 : la colonne du DDL v4 est en DECIMAL(5,2)
--    et son elargissement n'est pas une evolution autorisee par la story.
--    Le statut est calcule avant la borne, il n'en depend pas.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculer_precalcul_conformite(p_id_produit UUID)
RETURNS void AS $$
DECLARE
  v_droits INTEGER;
  v_cout   NUMERIC;
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

  -- Droits et couts des licences actives : souscription echue le jour meme de
  -- sa date de fin, sans tolerance ; perpetuelle jamais echue ; souscription
  -- sans date de fin (donnee anterieure a la validation) active (regle #102).
  SELECT
    COALESCE(sum(l.quantite) FILTER (WHERE NOT (
      l.type = 'souscription' AND l.date_fin_souscription IS NOT NULL
      AND l.date_fin_souscription < CURRENT_DATE)), 0)::int,
    COALESCE(sum(l.cout_licence) FILTER (WHERE NOT (
      l.type = 'souscription' AND l.date_fin_souscription IS NOT NULL
      AND l.date_fin_souscription < CURRENT_DATE)), 0)
    INTO v_droits, v_cout
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

  v_prix  := CASE WHEN v_droits > 0 THEN round(v_cout / v_droits, 2) END;
  v_ecart := v_droits - v_usages;
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
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculer_precalcul_conformite IS
  'Recalcule la ligne precalcul_conformite d''un produit par relecture des licences et affectations. Un produit sans droit ni usage garde une ligne a zero, filtree par l''API.';

-- ----------------------------------------------------------------------------
-- 7. Triggers. Sur UPDATE les deux produits sont traites, un changement de
--    produit ou de licence deplacant la quantite d'une balance a l'autre.
--    Cote affectation, les traitements du workflow passent tous par une
--    ecriture de la ligne (refleterStatut, ouvrirCycle) : la validation et le
--    refus declenchent donc bien le recalcul, sans trigger sur
--    workflow_validation.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_licence_conformite() RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM recalculer_precalcul_conformite(OLD.id_produit);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF TG_OP = 'INSERT' OR NEW.id_produit IS DISTINCT FROM OLD.id_produit THEN
      PERFORM recalculer_precalcul_conformite(NEW.id_produit);
    END IF;
  END IF;
  RETURN NULL;  -- AFTER trigger, la valeur de retour est ignoree
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_affectation_conformite() RETURNS trigger AS $$
DECLARE
  v_produit UUID;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT l.id_produit INTO v_produit FROM licence l WHERE l.id = OLD.id_licence;
    PERFORM recalculer_precalcul_conformite(v_produit);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF TG_OP = 'INSERT' OR NEW.id_licence IS DISTINCT FROM OLD.id_licence THEN
      SELECT l.id_produit INTO v_produit FROM licence l WHERE l.id = NEW.id_licence;
      PERFORM recalculer_precalcul_conformite(v_produit);
    END IF;
  END IF;
  RETURN NULL;  -- AFTER trigger, la valeur de retour est ignoree
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_licence_conformite_aiud ON licence;
CREATE TRIGGER trg_licence_conformite_aiud
  AFTER INSERT OR UPDATE OR DELETE ON licence
  FOR EACH ROW EXECUTE FUNCTION trg_licence_conformite();

DROP TRIGGER IF EXISTS trg_affectation_conformite_aiud ON affectation;
CREATE TRIGGER trg_affectation_conformite_aiud
  AFTER INSERT OR UPDATE OR DELETE ON affectation
  FOR EACH ROW EXECUTE FUNCTION trg_affectation_conformite();

-- ----------------------------------------------------------------------------
-- 8. Recalcul complet appelable : remise a zero puis reecriture de chaque
--    produit porteur d'au moins une licence (les affectations n'existant que
--    par une licence, la liste couvre tout). Les droits dependant de
--    CURRENT_DATE (souscriptions echues), une execution quotidienne planifiee
--    est recommandee : les triggers ne se declenchent qu'a l'ecriture.
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

  RETURN v_nb;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculer_conformite_complete IS
  'Reconstruit precalcul_conformite depuis licences et affectations. Amorcage de la 046, reparation a la demande (manual/amorcer-conformite.js), execution quotidienne recommandee (droits dependants de CURRENT_DATE).';

-- ----------------------------------------------------------------------------
-- 9. Amorcage : le parc existant entre dans le precalcul des la migration.
-- ----------------------------------------------------------------------------
SELECT recalculer_conformite_complete();

COMMIT;
