-- ============================================================================
-- SamSecure - BDD Tenant - Migration 096
-- Fichier   : 096_tenant_correctif_taux_droits_nuls.sql
-- Objet     : correctif D53, recette du 06/10/2026 (BUG-2 des attendus,
--             reveles par LIC-04 et LIC-10) : aucun taux sans droit.
--             recalculer_precalcul_conformite_ligne (046, revisee 058, 065 et
--             068) plafonne le taux ecrit par LEAST(v_taux, 999.99) ; or
--             LEAST ignore les NULL en SQL : LEAST(NULL, 999.99) vaut 999.99.
--             Droits a zero avec des usages (v_taux NULL) ecrivait donc
--             ecart_pct = 999.99 au lieu de NULL (statut depassement et
--             anomalie usage_sans_droit restaient corrects ; le pendant JS
--             valoriserBalance aussi). Le CASE de l'INSERT conserve le NULL,
--             le plafond ne vaut que pour un taux calcule. Reprise finale des
--             seules lignes faussees (droits_total = 0 et ecart_pct porte).
--             La fonction est reprise de la 068 a l'identique hors ce point.
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool).
-- Exécution : npm run migrate:dev / migrate:staging.
-- Depend    : 068 (derniere revision de recalculer_precalcul_conformite_ligne,
--             produit_composition, conformite_droits_propres), 065
--             (conformite_statut, regle d'echeance), 058 et 046
--             (precalcul_conformite, triggers licence, affectation, commande).
-- Rejouable : CREATE OR REPLACE ; reprise idempotente (plus aucune ligne
--             candidate au second passage). Aucune suppression.
-- Numero    : 096 (Tenant) attribue a ce correctif, absent de server/bdd sur
--             toutes les branches locales et distantes connues au 06/10/2026
--             (seuls les numeros 091 existent en 09x ; 092 a 094 sont
--             reserves par le chantier #249, hors branche a ce jour).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Recalcul d'une ligne : version 068, seul le taux ecrit change. D53 :
--    aucun taux sans droit ; le NULL de v_taux doit traverser l'INSERT.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculer_precalcul_conformite_ligne(p_id_produit UUID)
RETURNS void AS $$
DECLARE
  v_propres INTEGER;
  v_herites INTEGER := 0;
  v_droits  INTEGER;
  v_usages  INTEGER;
  v_prix    NUMERIC;
  v_ecart   INTEGER;
  v_taux    NUMERIC;
  v_val     NUMERIC;
BEGIN
  -- Une licence sans produit n'appartient a aucune balance. L'API la refuse
  -- (code 4011), mais une ecriture SQL directe reste possible.
  IF p_id_produit IS NULL THEN
    RETURN;
  END IF;

  v_propres := conformite_droits_propres(p_id_produit);

  -- #216 : droits herites des composes qui contiennent ce logiciel. Ce sont
  -- les droits PROPRES du compose qui se transmettent (un seul niveau), et
  -- jamais dans l'autre sens : la ligne d'un compose ne lit pas ses
  -- composants. L'heritage complete la balance d'un logiciel qui porte au
  -- moins une licence propre, echue ou non ; il ne cree pas de balance.
  IF EXISTS (SELECT 1 FROM licence l WHERE l.id_produit = p_id_produit) THEN
    SELECT COALESCE(sum(conformite_droits_propres(pc.id_produit_compose)), 0)::int
      INTO v_herites
      FROM produit_composition pc
     WHERE pc.id_produit_composant = p_id_produit;
  END IF;

  v_droits := v_propres + v_herites;

  -- Usages : affectations dont la derniere entree du workflow est valide
  -- (le a_revalider de lecture en fait partie : il n'est jamais persiste).
  -- Les affectations des licences echues comptent : un usage declare sur une
  -- licence echue reste un usage, c'est le cas que la conformite doit sortir.
  -- Les usages de chacun restent les siens (#216) : ni ceux du compose, ni
  -- ceux des autres composants n'entrent ici.
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
  -- quand plus aucune licence n'est active. Le prix est toujours celui du
  -- logiciel lui-meme, jamais celui d'un compose.
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
  -- D53 : aucun taux sans droit (droit effectif, heritage compris). Le
  -- plafond d'affichage ne vaut que pour un taux calcule : LEAST ignore les
  -- NULL en SQL (LEAST(NULL, 999.99) = 999.99), le CASE de l'INSERT conserve
  -- donc le NULL tel quel (correctif recette du 06/10/2026).
  v_taux  := CASE WHEN v_droits > 0 THEN round(v_usages::numeric / v_droits * 100, 2) END;
  -- #216 : un manque est valorise en entier ; un excedent ne l'est que sur
  -- les droits propres, les droits herites etant deja valorises sur la ligne
  -- du compose. Sans heritage, l'expression vaut v_ecart * v_prix (065).
  v_val   := CASE WHEN v_prix IS NOT NULL THEN round(
               (CASE WHEN v_ecart < 0 THEN v_ecart ELSE GREATEST(v_propres - v_usages, 0) END) * v_prix, 2) END;

  INSERT INTO precalcul_conformite
    (id_produit, droits_total, droits_herites, usages_total, ecart, ecart_pct,
     prix_unitaire, ecart_valorise, statut_conformite, derniere_maj)
  VALUES
    (p_id_produit, v_droits, v_herites, v_usages, v_ecart,
     CASE WHEN v_taux IS NULL THEN NULL ELSE LEAST(v_taux, 999.99) END,
     v_prix, v_val, conformite_statut(v_droits, v_usages, v_val), now())
  ON CONFLICT (id_produit)
  DO UPDATE SET droits_total      = EXCLUDED.droits_total,
                droits_herites    = EXCLUDED.droits_herites,
                usages_total      = EXCLUDED.usages_total,
                ecart             = EXCLUDED.ecart,
                ecart_pct         = EXCLUDED.ecart_pct,
                prix_unitaire     = EXCLUDED.prix_unitaire,
                ecart_valorise    = EXCLUDED.ecart_valorise,
                statut_conformite = EXCLUDED.statut_conformite,
                derniere_maj      = now();

  -- D53 : anomalie qualite immediate, une seule ouverte par produit. Le
  -- libelle du produit vit en BDD Commune, hors de portee d'ici : l'API
  -- (GET /qualite) le resout a la lecture. Close des que la condition cesse,
  -- y compris quand la licence d'un compose vient couvrir le composant.
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

COMMENT ON FUNCTION recalculer_precalcul_conformite_ligne IS
  'Recalcule la ligne precalcul_conformite d''un logiciel par relecture des licences, des affectations et de la composition. Droits effectifs = droits propres + droits propres des composes qui le contiennent (#216), usages propres, prix unitaire de la derniere commande (D52), aucun taux sans droit - ecart_pct reste NULL quand les droits sont a zero (correctif 096 du 06/10/2026) - et anomalie usage_sans_droit (D53). Ne propage rien : voir recalculer_precalcul_conformite.';

-- ----------------------------------------------------------------------------
-- 2. Reprise des lignes faussees par l'ancien plafond : droits a zero avec un
--    taux ecrit. La relecture complete de chaque ligne reecrit ecart_pct a
--    NULL sans toucher au reste (statut, anomalie et valorisation etaient
--    deja corrects). Plus aucune ligne candidate au second passage.
-- ----------------------------------------------------------------------------
SELECT recalculer_precalcul_conformite_ligne(pc.id_produit)
  FROM precalcul_conformite pc
 WHERE pc.id_produit IS NOT NULL
   AND pc.droits_total = 0
   AND pc.ecart_pct IS NOT NULL;

COMMIT;
