-- ============================================================================
-- SamSecure - BDD Commune - Migration 108
-- Fichier   : 108_commune_codes_retour_groupes.sql
-- Objet     : codes retour 2100 a 2113 (plage administration 2000-2999,
--             tranche 2100-2119 reservee au chantier groupes-acces) : groupes
--             d'organisations (US #277) et groupes d'utilisateurs (US #330).
--             Rediges au pre-catalogue (server/docs/codes_retour.md, section
--             Groupes). Les refus de delegation et le verrou admin_sam
--             reutilisent les codes existants 2080, 2081 et 2051 (aucun
--             doublon seede ici). Aucun DDL : les tables vivent en Tenant
--             (migrations 106 et 107).
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom)
-- Execution : npm run migrate:dev / migrate:staging, puis redemarrage de l'API
--             (catalogue code_retour charge au demarrage)
-- Depend    : 024 (code_retour)
-- Rejouable : ON CONFLICT DO NOTHING, aucune suppression.
-- Numero    : 108 reserve par le chantier groupes-acces (US #277/#330), libre
--             dans server/bdd et sur toutes les branches au 09/10/2026
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  (2100, 'trace',  'Groupe d''organisations créé'),
  (2101, 'trace',  'Groupe d''organisations modifié'),
  (2102, 'trace',  'Groupe d''organisations supprimé (suppression douce)'),
  (2103, 'erreur', 'Données du groupe d''organisations invalides'),
  (2104, 'erreur', 'Suppression impossible : le groupe d''organisations est utilisé par des accès'),
  (2105, 'trace',  'Groupe d''utilisateurs créé'),
  (2106, 'trace',  'Groupe d''utilisateurs modifié'),
  (2107, 'trace',  'Groupe d''utilisateurs supprimé (suppression douce)'),
  (2108, 'trace',  'Accès profil × groupe d''organisations ajouté à un groupe d''utilisateurs'),
  (2109, 'trace',  'Accès retiré d''un groupe d''utilisateurs'),
  (2110, 'trace',  'Membre ajouté à un groupe d''utilisateurs'),
  (2111, 'trace',  'Membre retiré d''un groupe d''utilisateurs'),
  (2112, 'erreur', 'Données du groupe d''utilisateurs invalides'),
  (2113, 'erreur', 'Le profil Admin SAM ne se donne pas par un groupe d''utilisateurs')
ON CONFLICT (code) DO NOTHING;

COMMIT;
