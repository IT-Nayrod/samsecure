-- ============================================================================
-- SamSecure - BDD Commune - Migration 078
-- Fichier   : 078_commune_code_retour_notifications_lot2.sql
-- Objet     : notifications v1.1 (retours Samuel du 27/09/2026, stories #258
--             a #261 et alertes lot 2).
--             1) codes retour de la relance volontaire des courriers (plage
--                notifications 5500-5549) : 5507 (succes) et 5518 (erreur,
--                relance deja en cours). Libelles reportes dans
--                server/docs/codes_retour.md.
--             2) seed des traductions anglaises du module notifications dans
--                le referentiel langue/traduction (montee en Commune par la
--                005, module 'notifications') : libelles de l'application
--                (titres et messages des notifications, types, modes) et des
--                courriels (objets et messages generiques, recapitulatif).
--                Le francais reste porte par le code (catalogue.js,
--                regles.js), qui sert de repli : il n'est pas seede ici.
--                Les cles sont celles consommees par composerTexte,
--                composerCourrier et composerRecapitulatif.
--             Le type fin_maintenance (D59-D60) ne demande aucun DDL : type
--             texte du pre-catalogue applicatif (regle 8), tables de la 051
--             reutilisees. Aucune migration Tenant necessaire (079 non prise).
-- Cible     : PostgreSQL 16 - base Commune (mot "commune" dans le nom :
--             migrate.js route sur commonPool)
-- Exécution : npm run migrate:dev / migrate:staging
-- Depend    : 005 (langue, traduction), 024 (code_retour), 052 (plage 5500).
-- Rejouable : ON CONFLICT (code) DO UPDATE sur les codes et ON CONFLICT
--             (id_langue, cle) DO UPDATE sur les traductions (referentiels
--             techniques non personnalisables, la derniere livraison fait
--             foi, meme motif que 025, 034, 047 et 052).
-- Numero    : 074 a 079 verifies libres sur toutes les branches locales le
--             06/10/2026 ; 078 est le numero reserve au chantier notifications.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Codes retour : relance volontaire des courriers (spec v1.1, pas de file
--    de retry applicative ; la reprise des echecs est un acte volontaire de
--    l'administrateur).
-- ----------------------------------------------------------------------------
INSERT INTO code_retour (code, type, libelle) VALUES
  (5507, 'succes', 'Courriers de notification relancés'),            -- POST /api/notifications/relancer-courriers
  (5518, 'erreur', 'Une relance des courriers est déjà en cours')    -- POST /api/notifications/relancer-courriers (409)
ON CONFLICT (code) DO UPDATE
  SET type = EXCLUDED.type, libelle = EXCLUDED.libelle;

-- ----------------------------------------------------------------------------
-- 2. Traductions anglaises du module notifications.
--    Une ligne par cle consommee par le serveur ; les espaces de tete des
--    fragments optionnels sont significatifs.
-- ----------------------------------------------------------------------------
INSERT INTO traduction (id_langue, cle, valeur, module)
SELECT l.id, v.cle, v.valeur, 'notifications'
FROM (VALUES
  -- Fragments communs
  ('app.commun.aujourdhui',      'today'),
  ('app.commun.dans_jour',       'in {n} day'),
  ('app.commun.dans_jours',      'in {n} days'),
  ('app.commun.jour',            '{n} day'),
  ('app.commun.jours',           '{n} days'),
  ('app.commun.sans_libelle',    'untitled'),
  ('app.commun.societe_suffixe', ', company {societe}'),
  ('app.commun.par',             ' by {nom}'),
  ('app.commun.saisie',          'entry'),
  -- Echeances de contrats
  ('app.echeance_contrat.titre',   'Contract “{label}” expiring {quand}'),
  ('app.echeance_contrat.message', 'The contract “{label}”{societe} reaches its end date on {date_fin}, {quand}. Consider preparing its renewal or termination.'),
  -- Echeances de souscriptions
  ('app.echeance_souscription.droit',   ' ({n} right)'),
  ('app.echeance_souscription.droits',  ' ({n} rights)'),
  ('app.echeance_souscription.titre',   'Subscription “{nom}” expiring {quand}'),
  ('app.echeance_souscription.message', 'The subscription “{nom}”{quantite}{societe} ends on {date_fin}, {quand}. Without renewal, the corresponding rights will disappear from the compliance balance.'),
  -- Fins de maintenance (D59-D60)
  ('app.fin_maintenance.titre',   'Maintenance of “{nom}” expiring {quand}'),
  ('app.fin_maintenance.message', 'The maintenance of the licence “{nom}”{societe} ends on {date_fin}, {quand}. Without renewal, updates and support will stop and the version will be frozen.'),
  -- Depassements de conformite
  ('app.depassement_conformite.sans_libelle',        'Untitled software'),
  ('app.depassement_conformite.depassement.titre',   'Compliance overrun: {nom}'),
  ('app.depassement_conformite.depassement.message', 'The software “{nom}”{editeur} is over-deployed: {usages} declared usage(s) for {droits} acquired right(s), {manque} missing.'),
  ('app.depassement_conformite.ecart.titre',         'Compliance gap: {nom}'),
  ('app.depassement_conformite.ecart.message',       'The software “{nom}”{editeur} shows a significant gap between declared usages ({usages}) and acquired rights ({droits}).'),
  ('app.depassement_conformite.montant',             ' Valued gap: {montant}.'),
  ('app.depassement_conformite.montant_seuil',       ' Valued gap: {montant} (alert threshold {seuil}).'),
  -- Seuil budgetaire
  ('app.budget_seuil.la_societe', 'the company'),
  ('app.budget_seuil.titre',      '{exercice} budget of {societe} committed at {taux}'),
  ('app.budget_seuil.message',    'The commitment rate of the allocated budget of {societe} reaches {taux} for fiscal year {exercice}, beyond the alert threshold of {seuil}.'),
  ('app.budget_seuil.montants',   ' Committed: {engage} out of {alloue} allocated.'),
  -- Validations en attente
  ('app.validation_en_attente.titre',   'Entry to validate: {nom}'),
  ('app.validation_en_attente.message', 'The {entite} “{label}”{societe} was submitted{par} and awaits your validation.'),
  -- Saisies traitees
  ('app.saisie_traitee.motif',           ' Reason: {motif}'),
  ('app.saisie_traitee.refusee.titre',   'Entry rejected: {nom}'),
  ('app.saisie_traitee.refusee.message', 'Your {entite} entry “{label}” was rejected{par}.{motif}'),
  ('app.saisie_traitee.validee.titre',   'Entry validated: {nom}'),
  ('app.saisie_traitee.validee.message', 'Your {entite} entry “{label}” was validated{par}.'),
  -- Contrats a faire suivre
  ('app.contrat_a_suivre.licence',       'one licence was renewed'),
  ('app.contrat_a_suivre.licences',      '{n} licences were renewed'),
  ('app.contrat_a_suivre.echeance',      'is reaching its end date'),
  ('app.contrat_a_suivre.echeance_jour', 'reaches its end date today'),
  ('app.contrat_a_suivre.echeance_date', 'reaches its end date on {date_fin}, {quand}'),
  ('app.contrat_a_suivre.echu',          'has been expired since {date_fin}'),
  ('app.contrat_a_suivre.titre',         'Contract “{label}” to renew or extend'),
  ('app.contrat_a_suivre.message',       'This contract must be renewed or extended: {licences} on it. The contract “{label}”{societe} {etat} and has neither successor nor extension.'),
  -- Revalidations echues
  ('app.revalidation_echue.logiciel', ', software {logiciel}'),
  ('app.revalidation_echue.titre',    'Revalidation overdue: {nom}'),
  ('app.revalidation_echue.message',  'The assignment “{nom}”{societe}{logiciel} was due for revalidation on {date} and is {retard} late. Confirm or correct this assignment.'),
  -- Courriels : objets et messages generiques (confidentialite v1.1)
  ('courriel.echeance_contrat.objet',         'Contract expiry'),
  ('courriel.echeance_contrat.message',       'A contract in your scope is approaching its end date.'),
  ('courriel.echeance_souscription.objet',    'Subscription expiry'),
  ('courriel.echeance_souscription.message',  'A subscription licence in your scope is approaching its end date.'),
  ('courriel.fin_maintenance.objet',          'Maintenance ending'),
  ('courriel.fin_maintenance.message',        'The maintenance of a licence in your scope is approaching its end date.'),
  ('courriel.depassement_conformite.objet',   'Compliance alert'),
  ('courriel.depassement_conformite.message', 'A software shows a compliance gap.'),
  ('courriel.budget_seuil.objet',             'Budget threshold reached'),
  ('courriel.budget_seuil.message',           'A company budget has crossed its alert threshold.'),
  ('courriel.validation_en_attente.objet',    'Entry awaiting validation'),
  ('courriel.validation_en_attente.message',  'An entry awaits your validation.'),
  ('courriel.saisie_traitee.objet',           'Entry processed'),
  ('courriel.saisie_traitee.message',         'One of your entries has been processed.'),
  ('courriel.revalidation_echue.objet',       'Revalidation overdue'),
  ('courriel.revalidation_echue.message',     'An assignment is past its revalidation date.'),
  ('courriel.contrat_a_suivre.objet',         'Contract to renew or extend'),
  ('courriel.contrat_a_suivre.message',       'An expiring contract carries renewed licences.'),
  ('courriel.commun.ouvrir',                  'View the details in SamSecure: {lien}'),
  ('courriel.commun.preferences',             'You receive this message according to your notification preferences, which you can change in SamSecure, My profile menu, Notifications tab.'),
  -- Courriel recapitulatif
  ('courriel.recap.intro_une',       'You have {n} new notification in SamSecure{date}.'),
  ('courriel.recap.intro_plusieurs', 'You have {n} new notifications in SamSecure{date}.'),
  ('courriel.recap.consulter',       'View: {lien}'),
  ('courriel.recap.objet_une',       'daily digest, {n} notification'),
  ('courriel.recap.objet_plusieurs', 'daily digest, {n} notifications'),
  -- Types (ecran des preferences et groupes du recapitulatif)
  ('type.echeance_contrat.libelle',            'Contract expiries'),
  ('type.echeance_contrat.description',        'An active contract is approaching its end date (90, 60 and 30 days before).'),
  ('type.echeance_souscription.libelle',       'Subscription expiries'),
  ('type.echeance_souscription.description',   'A subscription licence ends within 30 days.'),
  ('type.fin_maintenance.libelle',             'Maintenance endings'),
  ('type.fin_maintenance.description',         'The maintenance of a licence ends within 30 days.'),
  ('type.depassement_conformite.libelle',      'Compliance overruns'),
  ('type.depassement_conformite.description',  'A software goes over-deployed, or its negative valued gap crosses the euro threshold.'),
  ('type.budget_seuil.libelle',                'Budget threshold'),
  ('type.budget_seuil.description',            'A company commitment rate exceeds the alert threshold (90% by default).'),
  ('type.validation_en_attente.libelle',       'Pending validations'),
  ('type.validation_en_attente.description',   'An entry is submitted for validation within your scope.'),
  ('type.saisie_traitee.libelle',              'Processed entries'),
  ('type.saisie_traitee.description',          'One of your entries was validated or rejected (immediate email on rejection).'),
  ('type.revalidation_echue.libelle',          'Overdue revalidations'),
  ('type.revalidation_echue.description',      'An assignment due for revalidation is past its deadline.'),
  ('type.contrat_a_suivre.libelle',            'Contracts to follow up'),
  ('type.contrat_a_suivre.description',        'Licences were renewed on an expired or expiring contract that was neither renewed nor extended.'),
  -- Modes de courrier
  ('mode.immediat',  'Immediate email'),
  ('mode.quotidien', 'Daily digest'),
  ('mode.desactive', 'No email')
) AS v(cle, valeur)
JOIN langue l ON l.code = 'en'
ON CONFLICT (id_langue, cle) DO UPDATE
  SET valeur = EXCLUDED.valeur, module = EXCLUDED.module;

COMMIT;
