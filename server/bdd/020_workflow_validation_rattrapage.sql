-- ============================================================================
-- SamSecure - BDD Tenant - Migration 020
-- Objet   : rattrapage du workflow de validation (#53). Les entites saisies
--           avant cette tache ne portent aucune entree workflow_validation :
--           elles ressortiraient sans statut et ne seraient ni validables ni
--           refusables. Une entree en_attente est creee pour chacune, avec
--           id_soumis_par NULL, l'auteur d'origine n'etant pas connu.
-- Cible   : PostgreSQL - base Tenant
-- Valide  : Antonin, 12/08/2026, en attente de confirmation Dorian
-- Rejouable : chaque insertion est gardee par NOT EXISTS.
-- ============================================================================

BEGIN;

INSERT INTO workflow_validation (entite_type, entite_id, id_soumis_par, id_statut)
SELECT src.entite_type, src.id, NULL, vs.id
  FROM (
              SELECT 'contrat'::varchar(100) AS entite_type, id FROM contrat
    UNION ALL SELECT 'commande',                             id FROM commande
    UNION ALL SELECT 'facture',                              id FROM facture
    UNION ALL SELECT 'preuve',                               id FROM preuve
  ) src
  CROSS JOIN validation_status vs
 WHERE vs.code = 'en_attente'
   AND NOT EXISTS (
     SELECT 1 FROM workflow_validation w
      WHERE w.entite_type = src.entite_type AND w.entite_id = src.id
   );

COMMIT;
