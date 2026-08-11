-- ============================================================================
-- SamSecure - BDD Tenant - Migration 018
-- Objet   : alignement des referentiels seedes sur les listes attendues par
--           l'interface, pour mode_commande et type_preuve.
--           Les deux tables etaient seedees avec un vocabulaire de modelisation
--           (modes de declenchement, categories techniques de preuve) tandis
--           que la maquette validee par le client proposait, pour la premiere,
--           la nature du document d'achat, et pour la seconde, la nature de la
--           piece justificative. Les deux listes n'ont jamais ete reliees : le
--           front mocke ne lisait pas la base.
-- Cible   : PostgreSQL - base Tenant
-- Valide  : Dorian, [a completer]
-- Note    : aucune commande ne reference de mode et aucune preuve de type a ce
--           jour, les substitutions se font sans reprise de donnees. Les lignes
--           personnalisees par le client sont preservees, conformement au motif
--           copy-on-write (personnalise / valeurs_defaut).
-- Rejouable : ON CONFLICT et suppressions conditionnelles.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Modes de commande : nature du document d'achat
-- ----------------------------------------------------------------------------
INSERT INTO mode_commande (code, label, valeurs_defaut) VALUES
  ('bon_commande',     'Bon de commande',            '{"label": "Bon de commande"}'),
  ('devis_signe',      'Devis signé',                '{"label": "Devis signé"}'),
  ('bon_commande_edi', 'Bon de commande EDI',        '{"label": "Bon de commande EDI"}'),
  ('verbal_email',     'Verbal confirmé par email',  '{"label": "Verbal confirmé par email"}')
ON CONFLICT (code) DO UPDATE SET
  label          = CASE WHEN mode_commande.personnalise THEN mode_commande.label ELSE EXCLUDED.label END,
  valeurs_defaut = EXCLUDED.valeurs_defaut;

DELETE FROM mode_commande mc
 WHERE mc.code IN ('automatise', 'semi_automatique', 'manuel')
   AND mc.personnalise = false
   AND NOT EXISTS (SELECT 1 FROM commande c WHERE c.id_mode_commande = mc.id);

-- ----------------------------------------------------------------------------
-- Types de preuve : nature de la piece justificative
-- ----------------------------------------------------------------------------
INSERT INTO type_preuve (code, label, valeurs_defaut) VALUES
  ('bon_livraison',       'Bon de livraison',              '{"label": "Bon de livraison"}'),
  ('capture_portail',     'Capture écran portail éditeur', '{"label": "Capture écran portail éditeur"}'),
  ('attestation_editeur', 'Attestation éditeur',           '{"label": "Attestation éditeur"}'),
  ('contrat_scanne',      'Contrat signé scanné',          '{"label": "Contrat signé scanné"}'),
  ('autre',               'Autre',                         '{"label": "Autre"}')
ON CONFLICT (code) DO UPDATE SET
  label          = CASE WHEN type_preuve.personnalise THEN type_preuve.label ELSE EXCLUDED.label END,
  valeurs_defaut = EXCLUDED.valeurs_defaut;

DELETE FROM type_preuve tp
 WHERE tp.code IN ('pdf_signe', 'certificat', 'journal_audit')
   AND tp.personnalise = false
   AND NOT EXISTS (SELECT 1 FROM preuve p WHERE p.id_type_preuve = tp.id);

COMMIT;
