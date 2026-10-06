-- ============================================================================
-- SamSecure - BDD Commune - Migration 087
-- Fichier   : 087_commune_code_retour_profils.sql
-- Objet     : seed des codes retour 2060 a 2069 (plage administration),
--             rediges au pre-catalogue (server/docs/codes_retour.md) par le
--             chantier rbac (gestion des groupes : creation, modification,
--             corbeille #64, permissions et diffusions) mais jamais inseres
--             en base :
--             - 2060 a 2067 : traces audit_log des gestes sur les groupes ;
--             - 2068 : suppression refusee, profil par defaut ou systeme
--               (074 Tenant ; la route interpole le libelle rendu) ;
--             - 2069 : restauration refusee, groupe absent de la corbeille.
--             Libelles accentues (convention pour tout texte destine a
--             l'ecran), annotations du pre-catalogue non reprises, motif 067.
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom).
-- Exécution : npm run migrate:dev / migrate:staging, puis redemarrage de
--             l'API (catalogue charge au demarrage).
-- Depend    : 024 (table code_retour), 025 (plage 2000)
-- Rejouable : ON CONFLICT (code) DO NOTHING, aucun DDL, aucune suppression.
-- Numero    : 087 reserve par le chantier finition, libre dans server/bdd et
--             sur toutes les branches locales et de suivi au 06/10/2026.
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  (2060, 'trace',  'Groupe créé'),
  (2061, 'trace',  'Groupe modifié'),
  (2062, 'trace',  'Groupe mis en corbeille'),
  (2063, 'trace',  'Groupe restauré depuis la corbeille'),
  (2064, 'trace',  'Permission ajoutée à un groupe'),
  (2065, 'trace',  'Permission retirée d''un groupe'),
  (2066, 'trace',  'Diffusion ajoutée à un groupe'),
  (2067, 'trace',  'Diffusion retirée d''un groupe'),
  (2068, 'erreur', 'Suppression impossible : profil par défaut ou système'),
  (2069, 'erreur', 'Ce groupe n''est pas dans la corbeille')
ON CONFLICT (code) DO NOTHING;

COMMIT;
