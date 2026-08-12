-- ============================================================================
-- SamSecure - BDD Tenant - Migration 016
-- Objet   : precalcul financier des commandes.
--           1) unicite (id_editeur, id_societe, periode), absente du DDL v4
--              alors que la granularite du precalcul la suppose. NULLS NOT
--              DISTINCT : les deux axes sont nullables et un editeur absent
--              doit se regrouper avec lui-meme, pas se dupliquer.
--           2) fonction de recalcul + triggers AFTER sur commande.
--           3) amorcage depuis les commandes preexistantes.
-- Cible   : PostgreSQL - base Tenant
-- Valide  : Dorian, 11/08/2026
-- Note    : montant_paye reste a 0. Aucune table du v4 ne porte de montant
--           paye, facture n'ayant pas de champ montant. Arbitrage en attente.
-- Rejouable : CREATE OR REPLACE / IF NOT EXISTS, l'amorcage etant idempotent.
-- ============================================================================

BEGIN;

-- 1. Unicite de la granularite
CREATE UNIQUE INDEX IF NOT EXISTS uq_precalc_fin_axes
  ON precalcul_financier (id_editeur, id_societe, periode) NULLS NOT DISTINCT;

-- 2. Recalcul d'une combinaison, par relecture complete et non par delta.
-- Choix volontaire : la fonction est idempotente et auto-reparatrice. Un
-- trigger manque ou une ecriture SQL directe ne laissent pas de derive
-- permanente, le prochain recalcul de la combinaison remet la valeur juste.
CREATE OR REPLACE FUNCTION recalculer_precalcul_financier(
  p_id_editeur UUID,
  p_id_societe UUID,
  p_periode    VARCHAR
) RETURNS void AS $$
DECLARE
  v_nb    INTEGER;
  v_total DECIMAL(12,2);
BEGIN
  -- Une commande sans date_commande n'appartient a aucune periode. L'API la
  -- refuse (code 3120), mais une ecriture SQL directe reste possible.
  IF p_periode IS NULL THEN RETURN; END IF;

  SELECT count(*), COALESCE(sum(c.montant), 0)
    INTO v_nb, v_total
    FROM commande c
    LEFT JOIN contrat ct ON ct.id = c.id_contrat
   WHERE to_char(c.date_commande, 'YYYY-MM') = p_periode
     AND ct.id_editeur IS NOT DISTINCT FROM p_id_editeur
     AND c.id_societe  IS NOT DISTINCT FROM p_id_societe;

  -- Test sur le nombre et non sur le total : un total nul peut resulter de
  -- commandes reelles, l'absence de ligne non.
  IF v_nb = 0 THEN
    DELETE FROM precalcul_financier
     WHERE id_editeur IS NOT DISTINCT FROM p_id_editeur
       AND id_societe IS NOT DISTINCT FROM p_id_societe
       AND periode = p_periode;
    RETURN;
  END IF;

  INSERT INTO precalcul_financier (id_editeur, id_societe, periode, montant_commande, derniere_maj)
  VALUES (p_id_editeur, p_id_societe, p_periode, v_total, now())
  ON CONFLICT (id_editeur, id_societe, periode)
  DO UPDATE SET montant_commande = EXCLUDED.montant_commande,
                derniere_maj     = now();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculer_precalcul_financier IS
  'Recalcule une ligne de precalcul par relecture des commandes. montant_paye
   non alimente : aucune table du v4 ne porte de montant paye.';

-- 3. Trigger : sur UPDATE les deux combinaisons sont traitees, l'ancienne
-- pouvant differer par la societe, la date ou l'editeur du contrat rattache.
CREATE OR REPLACE FUNCTION trg_commande_precalcul() RETURNS trigger AS $$
DECLARE
  v_editeur UUID;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT ct.id_editeur INTO v_editeur FROM contrat ct WHERE ct.id = OLD.id_contrat;
    PERFORM recalculer_precalcul_financier(
      v_editeur, OLD.id_societe, to_char(OLD.date_commande, 'YYYY-MM'));
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT ct.id_editeur INTO v_editeur FROM contrat ct WHERE ct.id = NEW.id_contrat;
    PERFORM recalculer_precalcul_financier(
      v_editeur, NEW.id_societe, to_char(NEW.date_commande, 'YYYY-MM'));
  END IF;

  RETURN NULL;  -- AFTER trigger, la valeur de retour est ignoree
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_commande_precalcul_aiud ON commande;
CREATE TRIGGER trg_commande_precalcul_aiud
  AFTER INSERT OR UPDATE OR DELETE ON commande
  FOR EACH ROW EXECUTE FUNCTION trg_commande_precalcul();

-- 4. Amorcage depuis les commandes preexistantes, jeux d'essai de la #44
-- compris. Reconstruction complete : le precalcul n'est qu'un cache, sa
-- source de verite reste la table commande.
DELETE FROM precalcul_financier;
INSERT INTO precalcul_financier (id_editeur, id_societe, periode, montant_commande, derniere_maj)
SELECT ct.id_editeur, c.id_societe, to_char(c.date_commande, 'YYYY-MM'), sum(c.montant), now()
  FROM commande c
  LEFT JOIN contrat ct ON ct.id = c.id_contrat
 WHERE c.date_commande IS NOT NULL
 GROUP BY ct.id_editeur, c.id_societe, to_char(c.date_commande, 'YYYY-MM');

COMMIT;
