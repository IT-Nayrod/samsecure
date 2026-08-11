  -- ============================================================================
  -- SamSecure - BDD Tenant - Migration 017
  -- Objet   : alignement du modele commande sur les besoins de l'ecran (#46).
  --           1) commande.reference_interne : reference d'achat interne, affichee
  --              par le front et absente du DDL v4.
  --           2) precalcul_financier gagne trois mesures : montant a renouveler,
  --              nombre de commandes, nombre a renouveler. Ce ne sont pas de
  --              nouveaux axes, la granularite (editeur, societe, periode) est
  --              inchangee : les 4 KPI de l'ecran viennent ainsi tous de la meme
  --              source que la timeline, sans aucun calcul de montant au front.
  -- Cible   : PostgreSQL - base Tenant
  -- Valide  : Dorian, 11/08/2026
  -- Rejouable : IF NOT EXISTS, le reamorcage etant idempotent.
  -- ============================================================================

  BEGIN;

  ALTER TABLE commande ADD COLUMN IF NOT EXISTS reference_interne VARCHAR(100);
  COMMENT ON COLUMN commande.reference_interne IS
    'Reference d''achat interne au client, libre. Distincte de numero_devis, emis par le fournisseur.';

  ALTER TABLE precalcul_financier
    ADD COLUMN IF NOT EXISTS montant_a_renouveler DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS nb_commandes         INTEGER       NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS nb_a_renouveler      INTEGER       NOT NULL DEFAULT 0;

  -- Recalcul etendu aux trois nouvelles mesures. Meme principe qu'en 016 :
  -- relecture complete, idempotente et auto-reparatrice.
  CREATE OR REPLACE FUNCTION recalculer_precalcul_financier(
    p_id_editeur UUID,
    p_id_societe UUID,
    p_periode    VARCHAR
  ) RETURNS void AS $$
  DECLARE
    v_nb        INTEGER;
    v_total     DECIMAL(12,2);
    v_renouv    DECIMAL(12,2);
    v_nb_renouv INTEGER;
  BEGIN
    IF p_periode IS NULL THEN RETURN; END IF;

    SELECT count(*),
           COALESCE(sum(c.montant), 0),
           COALESCE(sum(c.montant) FILTER (WHERE c.a_renouveler), 0),
           count(*) FILTER (WHERE c.a_renouveler)
      INTO v_nb, v_total, v_renouv, v_nb_renouv
      FROM commande c
      LEFT JOIN contrat ct ON ct.id = c.id_contrat
     WHERE to_char(c.date_commande, 'YYYY-MM') = p_periode
       AND ct.id_editeur IS NOT DISTINCT FROM p_id_editeur
       AND c.id_societe  IS NOT DISTINCT FROM p_id_societe;


  IF v_nb = 0 THEN
    DELETE FROM precalcul_financier
     WHERE id_editeur IS NOT DISTINCT FROM p_id_editeur
       AND id_societe IS NOT DISTINCT FROM p_id_societe
       AND periode = p_periode;
    RETURN;
  END IF;

  INSERT INTO precalcul_financier (id_editeur, id_societe, periode,
                                   montant_commande, montant_a_renouveler,
                                   nb_commandes, nb_a_renouveler, derniere_maj)
  VALUES (p_id_editeur, p_id_societe, p_periode, v_total, v_renouv, v_nb, v_nb_renouv, now())
  ON CONFLICT (id_editeur, id_societe, periode)
  DO UPDATE SET montant_commande     = EXCLUDED.montant_commande,
                montant_a_renouveler = EXCLUDED.montant_a_renouveler,
                nb_commandes         = EXCLUDED.nb_commandes,
                nb_a_renouveler      = EXCLUDED.nb_a_renouveler,
                derniere_maj         = now();
END;
$$ LANGUAGE plpgsql;

-- Reamorcage : les lignes existantes n'ont pas les nouvelles mesures.
DELETE FROM precalcul_financier;
INSERT INTO precalcul_financier (id_editeur, id_societe, periode,
                                 montant_commande, montant_a_renouveler,
                                 nb_commandes, nb_a_renouveler, derniere_maj)
SELECT ct.id_editeur, c.id_societe, to_char(c.date_commande, 'YYYY-MM'),
       sum(c.montant),
       COALESCE(sum(c.montant) FILTER (WHERE c.a_renouveler), 0),
       count(*),
       count(*) FILTER (WHERE c.a_renouveler),
       now()
  FROM commande c
  LEFT JOIN contrat ct ON ct.id = c.id_contrat
 WHERE c.date_commande IS NOT NULL
 GROUP BY ct.id_editeur, c.id_societe, to_char(c.date_commande, 'YYYY-MM');

COMMIT;
