-- ============================================================================
-- SamSecure - BDD Commune - Migration 052
-- Fichier   : 052_commune_code_retour_notifications.sql
-- Objet     : module notifications (story #121).
--             1) seed de code_retour : plage 5500-5549. Decoupage habituel :
--                5500-5509 succes, 5510-5529 erreurs de validation et de
--                filtre, 5549 erreur serveur. Libelles reportes dans
--                server/docs/codes_retour.md.
--             2) seuil par defaut du taux d'engagement budgetaire dans
--                default_seuil_dashboard (pendant Commune du seed Tenant de
--                la 051) : 90 pourcent, echelle 1, meme convention que
--                conformite_taux (047).
--             Libelles accentues, comme la 047 (textes destines a l'ecran).
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom :
--             migrate.js route sur commonPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 024 (table code_retour), 026 (default_seuil_dashboard).
-- Rejouable : ON CONFLICT (code) DO UPDATE sur les codes (referentiel
--             technique non personnalisable, la derniere livraison fait foi,
--             meme motif que 025, 034 et 047) ; ON CONFLICT DO NOTHING sur le
--             seuil par defaut (valeur de reference, jamais reecrite).
-- ============================================================================

BEGIN;

INSERT INTO code_retour (code, type, libelle) VALUES
  -- Notifications (#121) : succes
  (5500, 'succes', 'Liste des notifications'),                              -- GET /api/notifications
  (5501, 'succes', 'Compteur des notifications non lues'),                  -- GET /api/notifications/compteur
  (5502, 'succes', 'Notification marquée comme lue'),                       -- PATCH /api/notifications/:id/lu
  (5503, 'succes', 'Toutes les notifications ont été marquées comme lues'), -- POST /api/notifications/tout-lu
  (5504, 'succes', 'Préférences de notification'),                          -- GET /api/notifications/preferences
  (5505, 'succes', 'Préférences de notification enregistrées'),             -- PUT /api/notifications/preferences
  (5506, 'succes', 'Traitement planifié des notifications exécuté'),        -- POST /api/notifications/executer-planification
  -- Notifications (#121) : erreurs
  (5510, 'erreur', 'Notification introuvable'),                             -- PATCH /api/notifications/:id/lu (404)
  (5511, 'erreur', 'Identifiant de notification invalide'),                 -- PATCH /api/notifications/:id/lu (400)
  (5512, 'erreur', 'Le filtre lu doit valoir true ou false'),               -- GET /api/notifications
  (5513, 'erreur', 'Pagination invalide'),                                  -- GET /api/notifications
  (5514, 'erreur', 'Type de notification inconnu'),                         -- PUT /api/notifications/preferences
  (5515, 'erreur', 'Le réglage du courrier doit valoir immediat, quotidien ou desactive'), -- PUT /api/notifications/preferences
  (5516, 'erreur', 'Un traitement planifié est déjà en cours'),             -- POST /api/notifications/executer-planification (409)
  (5517, 'erreur', 'Les préférences doivent être transmises sous forme de liste'), -- PUT /api/notifications/preferences
  (5549, 'erreur', 'Erreur serveur inattendue (module notifications)')      -- toutes
ON CONFLICT (code) DO UPDATE
  SET type = EXCLUDED.type, libelle = EXCLUDED.libelle;

-- ----------------------------------------------------------------------------
-- Seuil par defaut du taux d'engagement budgetaire (echelle 1). Diffusion
-- vers seuil_dashboard par la 051 cote Tenant, comme 046/047 pour la
-- conformite.
-- ----------------------------------------------------------------------------
INSERT INTO default_seuil_dashboard (widget_code, echelle, valeur, unite, direction) VALUES
  ('budget_taux_engagement', 1, 90.00, 'pourcent', 'max')
ON CONFLICT (widget_code, echelle) DO NOTHING;

COMMIT;
