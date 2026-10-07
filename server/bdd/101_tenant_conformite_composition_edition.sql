-- ============================================================================
-- SamSecure - BDD Tenant - Migration 101
-- Fichier   : 101_tenant_conformite_composition_edition.sql
-- Objet     : conformite du logiciel compose par edition (#279, decision
--             client du 06/10/2026) : un usage d'un composant n'est couvert
--             par une licence du compose que si l'edition de cette licence
--             contient ce composant (composition effective = defaut moins
--             les exclusions de l'edition, plus ses inclusions, table
--             produit_composition_exception de la 100). Une licence du
--             compose sans edition couvre la composition par defaut. Seule
--             l'edition compte, jamais la version.
--             1) recalculer_precalcul_conformite_ligne : reprise de la 096 a
--                l'identique hors le calcul de v_herites, qui ventile les
--                droits propres actifs du compose par edition de licence et
--                n'en transmet au composant que les tranches dont l'edition
--                le contient. Sans aucune exception, la somme vaut
--                conformite_droits_propres du compose : comportement
--                strictement identique a la 096. Pendant JS :
--                droitsHeritesParComposantParEdition
--                (server/utils/conformite.js, testee).
--             2) recalculer_precalcul_conformite (propagation, 068) : la
--                boucle s'etend aux composants ajoutes par exception
--                (inclus), sinon l'ecriture d'une licence du compose ne
--                rafraichirait jamais leurs droits herites (figes jusqu'au
--                recalcul complet quotidien). Quatre lignes d'ecart avec la
--                068. Le brief demandait "la seule fonction concernee" :
--                l'ecart est motive et isole en section 2, voir
--                ~/journaux/journal-composition.md (point d'arbitrage 4) --
--                ne pas jouer la section 2 revient a la lettre stricte, au
--                prix du differe d'un jour.
--             Rien d'autre du precalcul : conformite_droits_propres,
--             conformite_statut, les triggers licence/affectation/commande
--             (046, 058) et recalculer_conformite_complete (068) sont
--             inchanges -- la boucle de cette derniere passe par la fonction
--             de ligne, qui porte la nouvelle regle.
--             3) Recalcul complet final, auto-reparateur et sans effet tant
--                qu'aucune exception n'existe (la table nait vide en 100).
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool).
-- Exécution : npm run migrate:dev / migrate:staging.
-- Depend    : 100 (produit_composition_exception), 096 (derniere revision de
--             recalculer_precalcul_conformite_ligne), 068 (composition,
--             conformite_droits_propres, propagation,
--             recalculer_conformite_complete), 065 (conformite_statut, regle
--             d'echeance), 058 et 046 (precalcul_conformite, triggers).
-- Rejouable : CREATE OR REPLACE, recalcul complet idempotent. Aucune
--             suppression.
-- Numero    : 101 (Tenant) reserve pour ce chantier avec le 100, libre sur
--             toutes les branches locales et distantes connues au 07/10/2026.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Recalcul d'une ligne : version 096, seul le calcul des droits herites
--    change (couverture par edition, #279).
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

  -- #216 revise par #279 : droits herites des composes qui contiennent ce
  -- logiciel, licence par licence du compose. Une licence du compose ne
  -- couvre ce composant que si la composition effective de son edition le
  -- contient (defaut moins les exclusions de l'edition, plus ses
  -- inclusions, produit_composition_exception) :
  --   - composant du defaut : couvert, sauf exclusion posee pour l'edition
  --     de la licence ; une licence sans edition couvre le defaut (le
  --     predicat x.id_edition = l.id_edition ne matche jamais un NULL) ;
  --   - composant ajoute par exception (inclus) : couvert par les seules
  --     licences portant cette edition, jamais par une licence sans
  --     edition.
  -- Sans aucune exception, la somme vaut conformite_droits_propres du
  -- compose : comportement identique a la 096. Le filtre d'activite repete
  -- la regle d'echeance de la 065 (souscription et essai echues le
  -- lendemain de leur date de fin), la meme que conformite_droits_propres.
  -- Ce sont toujours les droits PROPRES du compose qui se transmettent (un
  -- seul niveau), jamais dans l'autre sens, et l'heritage ne cree pas de
  -- balance : il complete la ligne d'un logiciel porteur d'au moins une
  -- licence propre.
  IF EXISTS (SELECT 1 FROM licence l WHERE l.id_produit = p_id_produit) THEN
    SELECT COALESCE(sum(l.quantite), 0)::int
      INTO v_herites
      FROM (
        SELECT pc.id_produit_compose
          FROM produit_composition pc
         WHERE pc.id_produit_composant = p_id_produit
        UNION
        SELECT pe.id_produit_compose
          FROM produit_composition_exception pe
         WHERE pe.id_produit_composant = p_id_produit AND pe.inclus
      ) cp
      JOIN licence l ON l.id_produit = cp.id_produit_compose
     WHERE NOT (l.type IN ('souscription', 'essai') AND l.date_fin_souscription IS NOT NULL
                AND l.date_fin_souscription < CURRENT_DATE)
       AND (
         (EXISTS (SELECT 1 FROM produit_composition pc
                   WHERE pc.id_produit_compose = cp.id_produit_compose
                     AND pc.id_produit_composant = p_id_produit)
          AND NOT EXISTS (SELECT 1 FROM produit_composition_exception x
                           WHERE x.id_produit_compose = cp.id_produit_compose
                             AND x.id_produit_composant = p_id_produit
                             AND NOT x.inclus
                             AND x.id_edition = l.id_edition))
         OR EXISTS (SELECT 1 FROM produit_composition_exception x
                     WHERE x.id_produit_compose = cp.id_produit_compose
                       AND x.id_produit_composant = p_id_produit
                       AND x.inclus
                       AND x.id_edition = l.id_edition)
       );
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
  'Recalcule la ligne precalcul_conformite d''un logiciel par relecture des licences, des affectations et de la composition. Droits effectifs = droits propres + droits herites des composes qui le contiennent, une licence du compose ne couvrant le composant que si la composition effective de son edition le contient (#279, revision de #216 ; une licence sans edition couvre la composition par defaut). Usages propres, prix unitaire de la derniere commande (D52), aucun taux sans droit - ecart_pct reste NULL quand les droits sont a zero (096) - et anomalie usage_sans_droit (D53). Ne propage rien : voir recalculer_precalcul_conformite.';

-- ----------------------------------------------------------------------------
-- 2. Propagation (068) : la ligne du logiciel, puis celle de chacun de ses
--    composants porteurs d'une licence -- ceux du defaut ET ceux ajoutes par
--    exception d'edition (#279), dont les droits herites dependent aussi de
--    ses licences. Pas de recursion : la fonction de ligne ne propage pas,
--    et un composant n'a pas de composants (un seul niveau).
--    Point d'arbitrage : section separable, voir l'en-tete.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculer_precalcul_conformite(p_id_produit UUID)
RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  IF p_id_produit IS NULL THEN
    RETURN;
  END IF;

  PERFORM recalculer_precalcul_conformite_ligne(p_id_produit);

  FOR r IN SELECT x.id_produit_composant
             FROM (
               SELECT pc.id_produit_composant
                 FROM produit_composition pc
                WHERE pc.id_produit_compose = p_id_produit
               UNION
               SELECT pe.id_produit_composant
                 FROM produit_composition_exception pe
                WHERE pe.id_produit_compose = p_id_produit AND pe.inclus
             ) x
            WHERE EXISTS (SELECT 1 FROM licence l WHERE l.id_produit = x.id_produit_composant)
  LOOP
    PERFORM recalculer_precalcul_conformite_ligne(r.id_produit_composant);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculer_precalcul_conformite IS
  'Recalcule la ligne precalcul_conformite d''un logiciel, puis celle de ses composants porteurs d''une licence quand il est compose - composants du defaut et composants ajoutes par exception d''edition (#279) : leurs droits herites dependent de ses licences. Point d''entree des triggers licence, affectation et commande.';

-- ----------------------------------------------------------------------------
-- 3. Amorcage : le parc est recalcule avec la regle d'edition (sans effet
--    tant qu'aucune exception n'est saisie, la table de la 100 naissant
--    vide ; auto-reparateur sinon).
-- ----------------------------------------------------------------------------
SELECT recalculer_conformite_complete();

COMMIT;
