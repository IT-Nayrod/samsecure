# SamSecure - Guide du dépôt

**Version 3 - 16/09/2026.** Remplace intégralement la version 2 du 06/08/2026. Rédigé depuis l'état réel du dépôt (branche dev).

## Règle de précédence

1. **Le code du dépôt est la source de vérité.** Si ce document contredit ce que le code fait, le code prime et ce document est à corriger.
2. Tout écart constaté entre ce guide et le dépôt se signale explicitement dans le compte rendu du travail, dans une section « Écarts constatés ».
3. Les documents antérieurs (référentiels BDD de mai 2026, modèle `default_`/`tenant_` par préfixe de table, séquences de migrations 000 à 004) décrivent des états abandonnés.

## Le projet

- SamSecure : plateforme B2B SaaS de Software Asset Management (gestion des licences logicielles, de la conformité droits contre usages, des contrats, commandes et pièces justificatives, du budget).
- Acteurs : Dorian (Nayrod, pilote), Antonin (Nayrod, développeur), Samuel Aurensan (expert technique client, validateur), Vincent Douhairie (commercial client).
- Échéances : septembre 2026 réservé aux corrections et tests, livraison le 25/09/2026.
- Environnements : dev (`dev-samsecure.nayrod.fr`, Vite en direct) et staging (`staging-samsecure.nayrod.fr`, build statique), sur le même serveur Ubuntu 24.04 (Node 24, PostgreSQL 16, NGINX, PM2, WireGuard). La configuration NGINX n'est pas dans le dépôt.

## Structure du dépôt

```
server/                 API Express (ES modules)
  index.js              chaîne des middlewares et montage des 31 routeurs
  db.js                 pools commonPool et tenantPool, lecture de server/.env*
  routes/               un routeur par ressource (31 fichiers)
  middleware/           auth.js (JWT), exigerPermission.js (contrôle des droits)
  config/routesPermissions.js   table route -> permission (164 règles)
  utils/                règles pures et helpers partagés (+ tests node:test)
  utils/notifications/  catalogue, règles, moteur, courriers, planificateur
  bdd/                  migrations SQL numérotées + migrate.js + manual/
  docs/codes_retour.md  pré-catalogue des codes retour de l'API
src/                    front React
  components/           par domaine : Dashboard, admin, auth, budget, contrats,
                        deploiement, layout, notifications, rapports,
                        referentiels, search, settings, ui, users
  pages/                budget, rapports, pages techniques
  services/             accès API (http.js + un service par module)
  context/, hooks/      AuthContext, NotifContext, ToastContext, useRbac, etc.
  utils/                helpers front (+ periode.test.js)
  data/                 données mock encore consommées (rapports, recherche,
                        paramètres du tenant) et dictionnaires des rapports
  router/AppRouter.jsx  routes de l'application (une quarantaine)
docs/bdd/index.html     schéma UML des deux bases
simulateurDroits/       client d'administration autonome (HTML), branché sur l'API
planning/               planning statique
.github/workflows/      deploy-dev.yml (push sur dev), deploy-staging.yml (push sur staging)
ecosystem.config.cjs    PM2 : samsecure-api-staging et samsecure-dev
vite.config.js          serveur Vite (port 5173, proxy /api vers 127.0.0.1:3002)
```

Comptes au 16/09/2026 : 31 routeurs et 169 routes déclarées côté API, 62 fichiers de migration (001 à 065, les numéros 004, 012 et 013 n'existent pas), 17 tables en base Commune, 81 tables en base Tenant, environ 17 000 lignes côté serveur et 27 000 côté front.

## Stack

- Front : React 18.3, Vite 5.4, Tailwind 3.4, react-router-dom 7, recharts 3.8 (graphiques), lucide-react (icônes).
- API : Express 5.2, pg 8, jsonwebtoken, bcryptjs, multer (dépôt de fichiers), nodemailer, dotenv.
- Base : PostgreSQL 16, deux bases sur la même instance (Commune et Tenant), rôle applicatif `samsecure_app`.
- Outils : ESLint 9 (`eslint.config.js`, règles react et react-hooks), node:test.

## Démarrage et scripts

Installation décrite dans `README.md` : création des bases par `server/bdd/manual/000_init_databases.sql` (superuser, mots de passe demandés), copie des exemples `server/.env.example`, `.env.dev.example`, `.env.staging.example` vers `server/.env`, `.env.dev`, `.env.staging` (jamais committés), puis `npm ci`, `npm run migrate` par environnement et `npm run provision:<env>` (premier administrateur).

`db.js` charge `server/.env.<APP_ENV>` puis `server/.env` en socle (APP_ENV vaut `dev` par défaut) et refuse de démarrer si une clé requise est absente ou laissée à `A_RENSEIGNER` : PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE_COMMON, PGDATABASE_TENANT, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET. Autres variables : PORT (3002 en dev, 3001 en staging), RBAC_STRICT (`false` journalise les refus de permission sans bloquer, toute autre valeur vaut strict), URL_PUBLIQUE (liens des mails), SMTP_* et MAIL_* (aucun repli dans le code), NOTIFICATIONS_PLANIFICATEUR (`false` désactive les passages planifiés).

Scripts npm : `dev` (API en `--watch` + Vite, via concurrently), `dev:server`, `dev:front`, `build`, `build:staging`, `preview`, `lint`, `test` (uniquement `src/utils/*.test.js`), `migrate`, `migrate:dev`, `migrate:staging`, `provision:<env>`, `seed:referentiels:<env>`, `seed:catalogue:<env>`, `seed:licences:<env>`, `seed:affectations:dev`, `precalcul:<env>`.

## API

### Chaîne des middlewares (`server/index.js`)

`cors()` sans configuration, `express.json()`, puis dans l'ordre : `/api/auth` (login, refresh, logout, me, mes-droits), le routeur public de réinitialisation de mot de passe (monté avant l'authentification, volontairement), `authMiddleware` (JWT d'accès en mémoire côté front, jeton de rafraîchissement en localStorage), `controlePermissions` (contrôle central des droits), les routeurs métier, un 404 JSON et un gestionnaire d'erreur 500 générique. Au démarrage : chargement du catalogue `code_retour` (BDD Commune) puis lancement du planificateur des notifications après `app.listen`.

### Routeurs

affectations, auth, budget, commandes, conformite, contacts, contrats, dashboards, droitsEffectifs, editeurs, factures, inventaire, journal, licences, logiciels, mails, notifications, permissions, preuves, profilPermissions, profils, qualite, referentiels, referentielsLicences, reinitialisationPublique, revendeurs, societes, utilisateurExceptions, utilisateurProfils, utilisateurs, validation. Tous montés sous `/api`, tous branchés sur PostgreSQL. L'ordre de montage compte pour les chemins partagés (par exemple `GET /editeurs` servi par editeurs.js et non par referentiels.js).

Conventions d'un routeur : projection SQL identique en liste et en détail (`SELECT_X`), garde-fou UUID sur les `:id` (404 propre au lieu d'un 22P02), normalisation du corps (`""` devient `null`), validation des références avant écriture (400 lisible au lieu d'un 23503), une transaction par écriture, relecture de la projection après commit, journal fonctionnel `journal_ecriture` (helper `log()` local, erreurs avalées) et trace probante `audit_log` (helper `audit()`/`auditer()`, erreurs non avalées), suppressions bloquées par compteurs de rattachements avec message rendu (« Suppression impossible : ... ») plutôt que par l'erreur de clé étrangère.

### Enveloppe de réponse et codes retour (`server/utils/reponse.js`)

Succès : `{ code, type: "succes", libelle, data }`. Erreur : `{ code, type: "erreur", libelle, error, details? }` où `error` est le message rendu (libellé du catalogue par défaut, surchargé par la route quand elle interpole un message). Le code est aussi posé en en-tête `X-Code-Retour` (seul vecteur pour une réponse binaire). Le statut HTTP reste décidé route par route ; les suppressions répondent 200 avec `data: null`.

Les codes vivent en base Commune (table `code_retour`, chargée au démarrage : redémarrer l'API après toute migration qui la modifie). `server/docs/codes_retour.md` est le pré-catalogue : tout nouveau code y est rédigé puis seedé par une migration Commune avant d'être émis. Plages : transverse 1000-1999 (mails), administration 2000-2999, contrats 3000-3099, commandes 3100-3199, documents 3200-3299, validation 3300-3399, droits 3400-3499, licences 4000-4099, affectations 4100-4199, inventaire 4200-4299, conformité 4300-4399, budget 5100-5199, référentiels éditeurs 5200-5299 (revendeurs 5220-5239, contacts 5240-5259), logiciels 5300-5399, qualité et confiance 5400-5449, dashboards 5450-5499, notifications 5500-5549. Les routes d'authentification, d'administration (2000-2999), de mails, de permissions, de droits effectifs et les listes de referentiels.js répondent hors enveloppe ; `src/services/http.js` déballe les deux formes.

### Permissions

`server/config/routesPermissions.js` est la seule source du contrôle d'accès serveur : une liste ordonnée `[méthode, chemin, permission]`, la première règle qui correspond gagne, les chemins littéraux précèdent les chemins paramétrés. Le middleware `exigerPermission.js` est fail-closed : une route absente de la table est refusée (403, code 3400). Ajouter une route à l'API impose d'ajouter sa ligne. `PUBLIC_AUTHENTIFIE` (null) réserve les routes accessibles à tout porteur d'un jeton valide.

Référentiel des permissions : 29 codes en 7 modules (administration : gerer_utilisateurs, gerer_exceptions_droit, consulter_audit_log, gerer_connecteurs ; droits_usage : consulter_contrats, consulter_factures, saisir_contrat, saisir_commande, deposer_facture_preuve ; deploiement : valider_saisie, consulter_licences, consulter_inventaire, saisir_licence, saisir_affectation, rapprocher_inventaire, importer_inventaire ; organisation : consulter_referentiels, gerer_referentiels, gerer_contacts ; budget : consulter_budget, saisir_budget, consulter_kpi_financiers, supprimer_budget ; dashboards : acceder_dashboard_manager_dsi, acceder_dashboard_financier, acceder_dashboard_it_ops ; rapports : generer_rapport_conformite, generer_rapport_optimisation, creer_rapport_personnalise, non branchés). Les montants financiers sont servis à `null` avec `montants_masques: true` sans `consulter_kpi_financiers`.

Modèle RBAC (`server/utils/droitsUtilisateur.js`, `routes/droitsEffectifs.js`) : profils (groupes) porteurs de permissions, attribution d'un groupe à un utilisateur valable sur l'intersection de son rattachement (sociétés) et de la diffusion du groupe (`id_societe NULL` = portée tenant), cumul par union, exceptions de droit par utilisateur bornées au rattachement, retrait prioritaire sur ajout. Le filtrage de périmètre par société (`server/utils/scope.js`) n'est appliqué que par les routeurs utilisateurs, utilisateurProfils et utilisateurExceptions ; les autres routeurs ne filtrent que par permission.

### Workflow de validation (`server/utils/validationWorkflow.js`)

Entités validables : contrat, commande, facture, preuve, affectation, editeur, produit_client. Toute création ou modification par l'API appelle `soumettre()` (statut en_attente) dans la transaction de l'écriture ; `POST /validation/:entite/:id/valider|refuser` traite ; `jointureStatut()` et `COLONNES_STATUT` servent `statut_validation`, `statut_validation_label`, `message_refus` dans chaque projection ; `purgerValidations()` nettoie à la suppression (`workflow_validation.entite_id` est polymorphe, sans clé étrangère). Les licences ne passent pas par ce workflow.

### Pièces justificatives

Fichiers stockés hors de l'arborescence servie (`server/utils/stockagePreuves.js` : extensions admises pdf, png, jpg, jpeg, 20 Mo, empreinte SHA-256, nom physique contrôlé, garde-fou de traversée). Objet unique facture = preuve : `POST /factures/depot` crée le fichier, la preuve support et la facture en une transaction, seule la facture est soumise au workflow, `GET /preuves` ne sert que les preuves libres. Dépôt unifié : la modale de preuve est la seule porte d'entrée, ses champs additionnels par type viennent de `GET /types-preuve/champs` (défauts Commune `default_type_preuve_champ`, surcharge Tenant `type_preuve_champ`). Détection des manques documentaires par commande : `GET /commandes/manques` (vue temps réel).

### Mails et notifications

`server/utils/mail.js` est le point de passage unique des mails (nodemailer, configuration par variables SMTP, aucun repli, états 1000 à 1003 renvoyés à l'appelant, incidents dans `log_serveur`). Module notifications (`server/utils/notifications/`) : catalogue des types (`catalogue.js` : echeance_contrat, echeance_souscription, contrat_a_suivre, revalidation_echue, depassement_conformite, budget_seuil, validation_en_attente, saisie_traitee), règles pures testées (`regles.js`), moteur d'insertion avec anti-doublon par clé d'événement et utilisateur (`moteur.js`), courriers immédiats ou récapitulatifs selon les préférences, planificateur à 7 h et 7 h 30 heure de Paris sous verrou journalier `tache_asynchrone`, déclenchement manuel par `POST /notifications/executer-planification`. Clé des échéances : `type:id:date_fin:palier` (une prolongation produit une nouvelle alerte).

## Base de données

### Deux bases, aucune jointure entre elles

- **Commune** (`PGDATABASE_COMMON`, `commonPool`) : catalogue global partagé en lecture (`produit_referentiel`, `version`, `edition`, `langue`, `traduction`), `code_retour`, et les défauts SamSecure `default_*` (`default_fonction`, `default_type_contrat`, `default_type_preuve`, `default_type_preuve_champ`, `default_mode_commande`, `default_unite_mesure`, `default_profil`, `default_permission`, `default_profil_permission`, `default_profil_widget`, `default_seuil_dashboard`).
- **Tenant** (`PGDATABASE_TENANT`, `tenantPool`) : toutes les données d'un espace client, 81 tables, aucune colonne `tenant_id` (isolation physique, une base par client).
- Les identifiants du catalogue global portés par le Tenant (`licence.id_produit`, `id_version`, `id_edition`) sont des liens logiques sans clé étrangère : l'API résout les libellés après lecture (`resoudreCatalogue`, `libellesProduits`), jamais par jointure. Les produits propres au client vivent en Tenant (`produit_client`, `version_client`, `edition_client`) ; les versions et éditions ajoutées par le client sur un produit du catalogue vivent en `version_complement` et `edition_complement` (Tenant), fusionnées par l'API.

### Modèle des défauts et personnalisation

Les référentiels seedés (`type_contrat`, `type_preuve`, `mode_commande`, `unite_mesure`, `fonction`, profils et permissions) existent en Commune sous `default_*` et en Tenant sous leur nom nu, rapprochés par `code`. En Tenant, copy-on-write : `personnalise` (ligne modifiée par le client, protégée des synchronisations) et `valeurs_defaut` (copie du défaut, pour un rétablissement). Les seeds Tenant respectent ce motif : un `ON CONFLICT (code) DO UPDATE` qui laisse intacte une ligne marquée `personnalise`. Deux référentiels sont fusionnés à la lecture par l'API et non recopiés : les seuils de dashboard (`seuil_dashboard` puis `default_seuil_dashboard`) et les champs par type de preuve (`type_preuve_champ` prioritaire sur `default_type_preuve_champ`).

Autres tables structurantes : `workflow_validation`, `journal_ecriture`, `audit_log`, `log_serveur`, `anomalie_qualite`, `precalcul_conformite` (balance droits contre usages par logiciel, alimentée par triggers sur licence, affectation et commande, fonctions `recalculer_precalcul_conformite` et `recalculer_conformite_complete`), `precalcul_financier`, `notification`, `preference_notification`, `tache_asynchrone`, `tenant_config` (paramètres de l'espace client, dont le début d'exercice fiscal).

### Migrations (`server/bdd/`)

- Un fichier par migration, `NNN_(commune|tenant)_objet.sql`, joué par `npm run migrate` dans l'ordre lexicographique ; le mot `commune` dans le nom route vers la base Commune, tout autre nom vers la base Tenant ; table `_migrations` dans chaque base, un fichier déjà appliqué n'est jamais rejoué.
- En-tête obligatoire : Objet, Cible, Exécution, Depend, Rejouable, Numero. Une migration est rejouable sans effet au second passage (`IF NOT EXISTS`, `ON CONFLICT`, `CREATE OR REPLACE`, contraintes ajoutées sous garde `pg_constraint`), transactionnelle (`BEGIN`/`COMMIT`).
- Interdits : renuméroter ou réécrire une migration jouée, `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE` sans `WHERE`. Un correctif de fonction ou de libellé se fait par une nouvelle migration (`CREATE OR REPLACE`, `ON CONFLICT DO UPDATE`).
- Chaque chantier réserve ses numéros à l'avance et vérifie qu'ils sont libres sur toutes les branches ; les libellés destinés à l'écran sont accentués.
- Scripts manuels (`server/bdd/manual/`) : initialisation des bases, provisionnement de l'administrateur, seeds de référentiels, de catalogue et de données de test, amorçage des précalculs, vérification de conformité du schéma.

## Front

- `src/services/http.js` porte le jeton d'accès (Bearer), le rafraîchissement sur 401, la normalisation des erreurs en `ApiError` (`message` = champ `error`, `code` = code retour) et le déballage de l'enveloppe. Chaque module a son service ; aucun `fetch` direct dans les composants. `optionnel(promesse, defaut)` ne tolère que le 403 : une ressource accessoire refusée laisse l'écran servi.
- Auth et droits : `AuthContext` charge `GET /auth/mes-droits` au login et à la restauration de session, même calcul que le middleware serveur. `useRbac({ write, delete, validate })` évalue les droits réels ; appelé sans code il reste permissif (modules non branchés). La barre latérale masque les entrées d'administration selon les permissions ; les dashboards suivent trois permissions cumulables (sélecteur affiché à partir de deux).
- Écrans branchés sur l'API : référentiels (éditeurs, revendeurs, contacts, logiciels, sociétés), contrats, commandes, preuves et factures, licences (prolongation, nouvelle période, maintenance, compléments du catalogue), affectations, inventaire, conformité, qualité, budget, dashboards, notifications, administration (utilisateurs, groupes, exceptions, journal).
- Encore mockés (`src/data/`) : rapports (moteur `reportEngine.js`, catalogue `reportsCatalog.js`, dictionnaire des champs), recherche globale (`searchRegistry.js`), onglet informations de la page Paramètres (`mockSettings.js`), page de double authentification (code de démonstration en dur).
- Persistance navigateur : `ss_refresh_token` (localStorage, jeton de rafraîchissement), `ss_draft_<clé>` (brouillons de formulaires, `utils/formDraft.js`), `ss_report_templates` (modèles de rapports), `samsecure_photos_contacts` (photos des contacts), `ss_custom_report_config` (sessionStorage).
- Conventions d'écran : textes en français accentué ; « logiciel » et jamais « produit » (identifiants techniques `id_produit`, `produit_label`, routes `/produits` inchangés) ; « société » et jamais « organisation », sauf le titre de la section Administration > Organisation ; libellé d'un contrat au format « Libellé (Société) » par `components/contrats/libelleContrat.js`, la société signataire étant servie par l'API (`societe_label` sur les contrats, `contrat_societe_label` sur les objets rattachés) ; messages d'erreur de l'API affichés tels quels, jamais reconstruits ; suppression toujours soumise au refus du serveur.

## Règles métier structurantes

- Types de licence (référentiel `type_licence`, sept valeurs : perpetuelle, souscription, essai, open_source, gratuiciel, education, gouvernement) portant la règle de chaque date. Types à échéance : souscription et essai (`TYPES_A_ECHEANCE`, `server/utils/conformite.js`, même règle en SQL) : la licence sort des droits le lendemain de sa date de fin, sans tolérance.
- Conformité : droits = quantités des licences non expirées, usages = affectations validées (y compris sur licences échues), prix unitaire = dernière commande du logiciel, aucun taux sans droit (anomalie `usage_sans_droit`), écart valorisé rapporté au parc observé, seuils paramétrables (tenant puis défaut Commune).
- Succession (D35) : `licence.id_licence_predecesseur` et `contrat.id_contrat_predecesseur` ; une entité renouvelée par un successeur n'est plus notifiée ; « le contrat suit les licences » (`server/utils/successionContrat.js`) : un contrat échu ou à échéance sans successeur sur lequel des licences ont été renouvelées est signalé (`contrat_a_suivre`, bandeau et notification), rien n'est modifié automatiquement.
- Budget : organisation payeuse dérivée de la chaîne licence -> commande -> société, jamais stockée sur la ligne ; exercice fiscal par société (`debut_exercice_fiscal`, défaut du tenant) ; engagé lu dans `precalcul_financier`.
- Contrats : rattachement cadre (`id_contrat_parent`, contrôle de cycle), archivage et restauration, société signataire obligatoire, suppression possible tant que le contrat n'a jamais été validé.

## Conventions de contribution

- Commits atomiques, messages ASCII préfixés par le ticket (`#209 - ...`, `A67 - ...`, `chore - ...`), une branche par chantier créée sur dev, fusion dans dev par merge.
- Chaque chantier tient un journal hors dépôt (`~/journaux/journal-<chantier>.md`) : pourquoi, avant, après, impacts, pistes écartées, écarts constatés, questions ouvertes.
- Aucun `node_modules` dans les worktrees secondaires : lien symbolique temporaire vers l'installation principale, retiré avant chaque commit, jamais versionné.
- Textes destinés à l'écran, aux notifications et aux libellés du catalogue en français accentué ; pas de tiret cadratin. Les commentaires de code expliquent le pourquoi (décision, ticket, date) plutôt que le quoi.
- Une route nouvelle = une ligne dans `routesPermissions.js`, un code dans `codes_retour.md` puis dans une migration Commune, un service front.
- Jamais de `git push` depuis un chantier automatisé ; le déploiement suit les branches dev et staging.

## Tests et vérifications

- `npm test` : `src/utils/*.test.js` (règles de période).
- `node --test server/utils/conformite.test.js server/utils/indiceConfiance.test.js server/utils/successionContrat.test.js server/utils/notifications/regles.test.js` : règles pures côté serveur, sans base.
- `node --check` sur chaque fichier serveur modifié ; `npx vite build` (avertissement de taille de bundle préexistant, bundle monolithique) ; `npm run lint` (configuration à l'état de l'amorçage Vite : `ignores: ['dist']`, globals navigateur appliqués au serveur, nombreuses erreurs `react/prop-types` préexistantes).
- Contrôle des migrations : grep `DROP`, `TRUNCATE`, `DELETE`, `ALTER` sur chaque nouveau fichier ; aucune exécution contre une base depuis un chantier, les migrations sont jouées en dev puis en staging par l'équipe.

## Déploiement et environnements

- `deploy-dev.yml` (push sur dev) : rsync vers `/var/www/samsecure` (exclusions : `.git`, `node_modules`, `staging-dist`, `dev-dist`, `server/.env*` sauf les exemples), `npm ci`, `pm2 startOrReload ecosystem.config.cjs`. `deploy-staging.yml` (push sur staging) : rsync, `npm ci`, `npm run build:staging`, `pm2 reload samsecure-api-staging`.
- PM2 : `samsecure-api-staging` (APP_ENV=staging, `server/index.js`, port 3001) et `samsecure-dev` (`npm run dev` : API dev sur 3002 et Vite sur 5173). NGINX sert `staging-dist/` et proxifie `/api/` ; en dev, Vite proxifie `/api` vers 3002.
- Les fichiers `server/.env*` réels ne sont jamais déployés par le workflow : ils vivent sur le serveur, lisibles par le compte PM2.

## Limites connues

- Contrôle des permissions par route, pas de filtrage de périmètre société hors des trois routeurs d'administration.
- `cors()` sans configuration ; double authentification factice (code en dur) ; réinitialisation de mot de passe par lien publique branchée, anti-bruteforce en état React.
- Rapports et recherche globale sur données mock ; notifications de fin de maintenance inexistantes ; le planificateur des échéances de souscription ne considère que le type souscription.
- Bundle front monolithique sans `React.lazy` ; dark mode non activable (classe `dark` jamais posée).
- ESLint quasi inopérant en l'état de sa configuration.
