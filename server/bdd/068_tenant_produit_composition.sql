-- ============================================================================
-- SamSecure - BDD Tenant - Migration 068
-- Fichier   : 068_tenant_produit_composition.sql
-- Objet     : logiciel compose (#216), regle client du 17/09/2026.
--             Un logiciel compose regroupe deux logiciels ou plus du meme
--             editeur (exemple : Office, compose de Word et d'Excel). Il porte
--             sa propre licence. Chaque composant est couvert par heritage par
--             la licence du compose ; l'inverse n'existe pas : une licence de
--             composant ne couvre jamais le compose. Un composant reste aussi
--             couvert par ses licences propres : sur un poste avec Word et
--             Excel, une licence Office seule suffit, ou une licence par
--             composant.
--             1) Table produit_composition : couples (compose, composant),
--                unicite du couple. Le compose et le composant sont des
--                logiciels existants, du catalogue global (BDD Commune) ou
--                crees localement (produit_client) : les deux colonnes sont
--                des liens logiques sans cle etrangere, comme
--                licence.id_produit. Aucun changement au catalogue Commune.
--                Le controle "meme editeur" est porte par l'API (l'editeur
--                d'un logiciel du catalogue vit en Commune, hors de portee
--                d'une contrainte Tenant).
--             2) Un seul niveau en v0.5 : un compose ne peut pas etre
--                composant d'un autre compose. Garde par trigger, en plus du
--                refus lisible de l'API (code 4066).
--             3) Conformite : les droits effectifs d'un composant incluent les
--                droits propres des composes qui le contiennent ; les usages
--                de chacun restent les siens. precalcul_conformite porte la
--                part heritee (droits_herites), droits_total reste le droit
--                effectif sur lequel se lisent l'ecart, le taux et le statut.
--                L'heritage complete la ligne d'un logiciel porteur d'au moins
--                une licence propre ; il ne cree pas de ligne : sans licence
--                propre un composant n'a aucun usage declarable (une
--                affectation passe par une licence).
--                Valorisation : un manque reste valorise en entier au prix du
--                composant ; un excedent n'est valorise que sur les droits
--                propres (les droits herites le sont deja sur la ligne du
--                compose). Meme regle cote API : valoriserBalance et
--                appliquerHeritageComposes, server/utils/conformite.js.
--             4) Recalcul complet de precalcul_conformite en fin de migration.
-- Cible     : PostgreSQL 16 - base Tenant (aucun mot "commune" dans le nom :
--             migrate.js route sur tenantPool).
-- Exécution : npm run migrate:dev / migrate:staging.
-- Depend    : 046, 058 et 065 (precalcul_conformite, conformite_statut,
--             recalculer_precalcul_conformite, triggers licence, affectation
--             et commande), 002 (licence, affectation, utilisateur).
-- Rejouable : CREATE TABLE et CREATE INDEX IF NOT EXISTS, ADD COLUMN IF NOT
--             EXISTS, CREATE OR REPLACE (fonctions et triggers, PostgreSQL 14
--             et suivants), recalcul complet idempotent. Aucune suppression.
-- Numero    : 068 (Tenant) et 069 (Commune) reserves pour ce chantier,
--             absents de server/bdd sur toutes les branches locales et
--             distantes connues au 21/09/2026.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Table de composition
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produit_composition (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produit_compose    UUID NOT NULL,  -- lien logique : produit_referentiel (BDD Commune) ou produit_client
  id_produit_composant  UUID NOT NULL,  -- lien logique : produit_referentiel (BDD Commune) ou produit_client
  id_auteur             UUID REFERENCES utilisateur(id),
  created_at            TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_produit_composition_couple UNIQUE (id_produit_compose, id_produit_composant),
  CONSTRAINT ck_produit_composition_distincts CHECK (id_produit_compose <> id_produit_composant)
);
COMMENT ON TABLE  produit_composition IS 'Composition des logiciels composes (#216, regle client du 17/09/2026) : un compose regroupe au moins deux logiciels du meme editeur. La licence du compose couvre ses composants par heritage, jamais l''inverse. Un seul niveau en v0.5 : un compose n''est jamais composant.';
COMMENT ON COLUMN produit_composition.id_produit_compose   IS 'Logiciel compose. Lien logique vers produit_referentiel (BDD Commune) ou produit_client, resolu par l''API.';
COMMENT ON COLUMN produit_composition.id_produit_composant IS 'Logiciel composant, du meme editeur que le compose (controle porte par l''API). Lien logique vers produit_referentiel (BDD Commune) ou produit_client.';

-- L'unicite du couple sert deja la lecture par compose ; la lecture par
-- composant (heritage des droits) a son propre index.
CREATE INDEX IF NOT EXISTS idx_produit_composition_composant ON produit_composition (id_produit_composant);

-- ----------------------------------------------------------------------------
-- 2. Un seul niveau (v0.5) : un compose ne peut pas etre composant d'un autre
--    compose. L'API refuse avant d'ecrire (4066) ; ce trigger tient la regle
--    face a une ecriture SQL directe, l'heritage des droits la supposant.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_produit_composition_niveau() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM produit_composition pc
              WHERE pc.id_produit_compose = NEW.id_produit_composant AND pc.id <> NEW.id) THEN
    RAISE EXCEPTION 'Un logiciel composé ne peut pas être composant d''un autre logiciel composé (composant %).', NEW.id_produit_composant
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM produit_composition pc
              WHERE pc.id_produit_composant = NEW.id_produit_compose AND pc.id <> NEW.id) THEN
    RAISE EXCEPTION 'Un logiciel déjà composant d''un logiciel composé ne peut pas devenir composé (composé %).', NEW.id_produit_compose
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_produit_composition_niveau_biu
  BEFORE INSERT OR UPDATE ON produit_composition
  FOR EACH ROW EXECUTE FUNCTION trg_produit_composition_niveau();

-- ----------------------------------------------------------------------------
-- 3. Precalcul : part heritee des droits
-- ----------------------------------------------------------------------------
ALTER TABLE precalcul_conformite ADD COLUMN IF NOT EXISTS droits_herites INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN precalcul_conformite.droits_herites IS
  'Part de droits_total heritee des logiciels composes qui contiennent ce logiciel (#216) : somme de leurs droits propres actifs. 0 pour un logiciel qui n''est composant d''aucun compose. Droits propres = droits_total - droits_herites.';
COMMENT ON COLUMN precalcul_conformite.droits_total IS
  'Droits effectifs : quantites des licences actives du logiciel, plus les droits propres des composes qui le contiennent (droits_herites, #216).';

-- ----------------------------------------------------------------------------
-- 4. Droits propres d'un logiciel : quantites de ses licences actives. Meme
--    regle d'echeance que la 065 (souscription et essai echues le lendemain
--    de leur date de fin, sans tolerance ; perpetuelle jamais echue ; licence
--    a echeance sans date de fin active). Isolee parce qu'elle sert deux
--    fois : pour le logiciel lui-meme et pour chacun de ses composes.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION conformite_droits_propres(p_id_produit UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(sum(l.quantite) FILTER (WHERE NOT (
           l.type IN ('souscription', 'essai') AND l.date_fin_souscription IS NOT NULL
           AND l.date_fin_souscription < CURRENT_DATE)), 0)::int
    FROM licence l
   WHERE l.id_produit = p_id_produit;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION conformite_droits_propres IS
  'Droits propres d''un logiciel : somme des quantites de ses licences actives (types a echeance souscription et essai, D44 etendu). Sans heritage.';

-- ----------------------------------------------------------------------------
-- 5. Recalcul d'une ligne : version 065 plus l'heritage des composes.
--    Relecture complete, jamais de delta, meme motif auto-reparateur.
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
  -- D53 : aucun taux sans droit (droit effectif, heritage compris).
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
    (p_id_produit, v_droits, v_herites, v_usages, v_ecart, LEAST(v_taux, 999.99),
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
  'Recalcule la ligne precalcul_conformite d''un logiciel par relecture des licences, des affectations et de la composition. Droits effectifs = droits propres + droits propres des composes qui le contiennent (#216), usages propres, prix unitaire de la derniere commande (D52), aucun taux sans droit et anomalie usage_sans_droit (D53). Ne propage rien : voir recalculer_precalcul_conformite.';

-- ----------------------------------------------------------------------------
-- 6. Point d'entree des triggers (046 licence et affectation, 058 commande),
--    inchanges : la ligne du logiciel, puis celle de chacun de ses composants
--    porteurs d'une licence, dont les droits herites dependent de lui. Pas de
--    recursion : la propagation appelle la fonction de ligne, qui ne propage
--    pas, et un composant n'a pas de composants (un seul niveau).
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

  FOR r IN SELECT pc.id_produit_composant
             FROM produit_composition pc
            WHERE pc.id_produit_compose = p_id_produit
              AND EXISTS (SELECT 1 FROM licence l WHERE l.id_produit = pc.id_produit_composant)
  LOOP
    PERFORM recalculer_precalcul_conformite_ligne(r.id_produit_composant);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculer_precalcul_conformite IS
  'Recalcule la ligne precalcul_conformite d''un logiciel, puis celle de ses composants porteurs d''une licence quand il est compose (#216 : leurs droits herites dependent de ses licences). Point d''entree des triggers licence, affectation et commande.';

-- ----------------------------------------------------------------------------
-- 7. Trigger sur la composition : ajouter ou retirer un composant deplace ses
--    droits herites. Seule la ligne du composant bouge, celle du compose ne
--    lit jamais ses composants.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_produit_composition_conformite() RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF EXISTS (SELECT 1 FROM licence l WHERE l.id_produit = OLD.id_produit_composant) THEN
      PERFORM recalculer_precalcul_conformite_ligne(OLD.id_produit_composant);
    END IF;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF EXISTS (SELECT 1 FROM licence l WHERE l.id_produit = NEW.id_produit_composant) THEN
      PERFORM recalculer_precalcul_conformite_ligne(NEW.id_produit_composant);
    END IF;
  END IF;
  RETURN NULL;  -- AFTER trigger, la valeur de retour est ignoree
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_produit_composition_conformite_aiud
  AFTER INSERT OR UPDATE OR DELETE ON produit_composition
  FOR EACH ROW EXECUTE FUNCTION trg_produit_composition_conformite();

-- ----------------------------------------------------------------------------
-- 8. Recalcul complet (remplace la version 058) : remise a zero, heritage
--    compris, puis reecriture de chaque logiciel porteur d'au moins une
--    licence. La boucle couvre tous les composants concernes (l'heritage ne
--    complete que des logiciels porteurs d'une licence) : elle appelle la
--    fonction de ligne, sans propagation.
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
     SET droits_total = 0, droits_herites = 0, usages_total = 0, ecart = 0, ecart_pct = NULL,
         prix_unitaire = NULL, ecart_valorise = NULL,
         statut_conformite = 'conforme', derniere_maj = now()
   WHERE id_produit IS NOT NULL;

  FOR r IN SELECT DISTINCT l.id_produit FROM licence l WHERE l.id_produit IS NOT NULL
  LOOP
    PERFORM recalculer_precalcul_conformite_ligne(r.id_produit);
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
  'Reconstruit precalcul_conformite depuis licences, affectations et composition des logiciels composes (prix de la derniere commande, anomalies usage_sans_droit, droits herites #216). Amorcage des 046, 058, 065 et 068, reparation a la demande (manual/amorcer-conformite.js), execution quotidienne recommandee (droits dependants de CURRENT_DATE).';

-- ----------------------------------------------------------------------------
-- 9. Amorcage : le parc est recalcule avec la regle d'heritage (sans effet
--    tant qu'aucune composition n'est saisie).
-- ----------------------------------------------------------------------------
SELECT recalculer_conformite_complete();

COMMIT;
