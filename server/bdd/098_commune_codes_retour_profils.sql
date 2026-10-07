-- ============================================================================
-- SamSecure - BDD Commune - Migration 098
-- Fichier   : 098_commune_codes_retour_profils.sql
-- Objet     : codes retour du chantier tout-profil (#276 profils ajoutes,
--             #278 delegation, #282 correctif suppression), plage
--             administration 2000-2999, rediges au pre-catalogue
--             (server/docs/codes_retour.md, section tout est profil).
--             Seed des codes 2078 a 2089 en ON CONFLICT DO NOTHING :
--             - 2078 existe deja sur toute base ou la 093 est passee, il
--               n'est alors pas touche (libelle d'origine conserve) ; il
--               n'est seede ici, avec le libelle generalise sans « par
--               defaut », que sur une base ou il manquerait ;
--             - 2079 a 2089 sont nouveaux (verrous des profils par defaut,
--               garde-fous de delegation, traces du cycle de vie des profils
--               ajoutes et des attributions).
--             Les codes 2090 a 2093 sont RESERVES au chantier societes
--             (decision du 07/10/2026) : ne pas les employer ici.
--             Libelles accentues (convention). Aucun DDL, donnees seulement.
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom)
-- Execution : npm run migrate:dev / migrate:staging, puis redemarrage de
--             l'API (catalogue code_retour charge au demarrage)
-- Depend    : 024 (table code_retour), 093 (codes 2070 a 2078 du #249)
-- Rejouable : oui (ON CONFLICT (code) DO NOTHING, aucune suppression)
-- Numero    : 098 attribue par le chef de projet le 07/10/2026 (la plage
--             initiale 097-099 du chantier etait tenant ; arbitrage du jour)
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  (2078, 'erreur', 'La matrice d''un profil se gère par remplacement complet'),
  (2079, 'erreur', 'Un profil par défaut ne se renomme pas'),
  (2080, 'erreur', 'Délégation refusée : permission non détenue par l''acteur'),
  (2081, 'erreur', 'Réservé à un administrateur SAM'),
  (2082, 'trace',  'Délégation accordée à un profil'),
  (2083, 'trace',  'Délégation retirée d''un profil'),
  (2084, 'trace',  'Profil ajouté créé'),
  (2085, 'trace',  'Profil ajouté modifié'),
  (2086, 'trace',  'Profil mis en corbeille'),
  (2087, 'trace',  'Profil restauré depuis la corbeille'),
  (2088, 'trace',  'Profil attribué'),
  (2089, 'trace',  'Profil retiré')
ON CONFLICT (code) DO NOTHING;

COMMIT;
