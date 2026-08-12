# SamSecure - Contexte projet pour Claude Code

**Version 2 - 06/08/2026.** Intègre l'état des lieux d'onboarding du 06/08/2026 (écarts E1 à E12 reportés). Remplace intégralement la version 1.

## RÈGLE DE PRÉCÉDENCE (à lire en premier)

1. **Le code réel du projet est la source de vérité.** Si ce que tu observes dans le repo contredit ce document, c'est le code qui prime.
2. **Signale systématiquement les écarts** dans une section "Écarts constatés" de ta réponse, pour mise à jour de ce document. Ne suis jamais silencieusement l'un ou l'autre.
3. Les documents antérieurs (notamment le Référentiel Technique BDD v3 de mai 2026, modèle default_/tenant_) décrivent des états abandonnés. Ce document, daté du 06/08, fait foi côté documentation.

## TON RÔLE SUR CE SERVEUR

- Tu es en **lecture seule stricte** (Plan Mode + règles deny). Tu ne modifies aucun fichier, tu ne lances aucune commande d'écriture.
- Ta mission : analyser les bugs, identifier les causes racines, fournir des corrections précises (diff ou bloc de code complet) que l'équipe applique à la main via git.
- **Devoir de challenge** : si une demande ou un constat te semble incohérent, risqué ou erroné, dis-le et propose une alternative argumentée.
- **Aucune invention** : toute affirmation fonctionnelle doit se rattacher au code observé ou à une décision documentée ici.
- Réponds en français. Jamais de tiret cadratin, tirets simples ou virgules.

## LE PROJET

- **SamSecure** : plateforme B2B SaaS de Software Asset Management.
- **Acteurs** : Dorian (Nayrod, pilote), Antonin (Nayrod, dev, ton interlocuteur), Samuel Aurensan (expert technique client, validateur), Vincent Douhairie (commercial client).
- **Échéances** : développement terminé fin août 2026, septembre réservé corrections/tests, livraison le 25 septembre 2026.
- Serveur actuel : staging, `staging-samsecure.nayrod.fr`.

## ÉTAT ACTUEL (constaté le 06/08/2026)

Application **2-tiers hybride**, plus un simple front mocké :

- **Front** : React 18.3.1 + Vite 5.4.10 + Tailwind 3.4.19, react-router-dom 7.14.0, ~20 000 lignes, 36 routes sans lazy loading. Charts : **recharts 3.8.1** (pas Chart.js). Icônes UI : lucide-react.
- **API** : Express 5.2.1 (`server/`, ~1 350 l.), pg 8.22, jsonwebtoken, bcryptjs. 44 endpoints (5 auth publics + 39 protégés JWT). Port 3001, préfixe `/api`, URL relative côté front, **aucune variable d'environnement front** (pas de bascule dev/staging/prod).
- **Branché PostgreSQL** : auth, utilisateurs, profils/groupes, permissions, attributions, exceptions, journal, organisation/sociétés.
- **Encore mocké et non persistant** : dashboards, budget, rapports, contrats/commandes/factures, déploiement, référentiels. Mocks : 13 fichiers dans `src/data/` (~2 076 l.), CRUD en state React.
- **Persistance navigateur, inventaire exhaustif (5 clés)** : `ss_refresh_token` (localStorage, JWT refresh, access token en mémoire), `ss_report_templates`, `ss_draft_<key>`, `samsecure_photos_contacts`, `ss_custom_report_config` (sessionStorage). Rien d'autre ne persiste.
- **Dashboards** : 3 permissions cumulables (`acceder_dashboard_manager_dsi`, `_financier`, `_it_ops`), pas 3 personas. Un utilisateur peut en voir 0 à 3, RoleSelector affiché seulement s'il en a plus d'un.
- **simulateurDroits/index.html** (2 208 l., autonome hors React) : client d'administration **opérationnel** branché sur la vraie API (JWT, POST/PATCH/DELETE sur `/api/utilisateurs/:id/exceptions`, `/profils`, `/societes`), exposé par NGINX sur le staging. Ce n'est pas qu'un front de référence.
- **Ambiguïté structurante connue** : les sociétés existent en double, schémas divergents (API : `id_societe_parent` via `societeHierarchy.js` ; mock : `societe_parent_id` via `orgUtils.js`), ids non correspondants. Plan de convergence à décider.
- **useRbac (front) neutralisé** : renvoie des droits permissifs en dur (décision v0.5 assumée, commentaire l. 3-8), consommé par ~21 composants. Rebranchement avant livraison à décider.
- **API sans contrôle de permission** : les 39 routes protégées ne vérifient que la validité du JWT. Filtrage de périmètre société (`server/utils/scope.js`) appliqué dans 3 routeurs sur 10. Durcissement à planifier.

## STACK ET INFRASTRUCTURE (réelle)

- Ubuntu 24.04, Node v24.14.0, PostgreSQL 16 (127.0.0.1:5432), NGINX, PM2 (sous l'utilisateur `deploy`, `/home/deploy/.pm2`), GitHub Actions, WireGuard.
- NGINX `staging-samsecure` : statique `staging-dist/`, `/api/` vers 127.0.0.1:3001, alias `/planning` `/bdd` `/simulateurDroits`, filtré VPN 10.8.1.0/24 + auth_basic.
- NGINX `dev-samsecure` : proxy 127.0.0.1:5173 (Vite).
- Scripts npm : `dev`, `dev:server`, `dev:front`, `migrate`, `build`, `lint`, `preview`, `build:staging`.
- **SQL, source réellement exécutée : `server/bdd/`** (12 fichiers + `migrate.js`, ordre lexicographique 001 à 013). `bdd/` : 13 SQL quasi identiques + `000_init_databases.sql` (jamais joué par migrate.js) + index.html (UML). `db/` : vestige de test. **`004_commune_seed.sql` n'existe pas** : l'ancienne séquence documentée (000, 001, 004, 002, 003) est obsolète.
- Codebase synchronisé Dropbox entre machines + déploiement GitHub Actions. Résidus Dropbox (`*.tmp.*`, `desktop.ini`) non ignorés par git. Conflit de propriétaire `node_modules` entre `deploy` (PM2) et `antonin-hornoy` (installations manuelles).

## DOCTRINE BDD (v3) - CONFORME, VÉRIFIÉE LE 06/08

- **59 tables** : 5 en BDD Commune (`produit_referentiel`, `version`, `edition`, `langue`, `traduction`) + 54 en Tenant (`journal_ecriture` ajoutée par la migration 008, après la validation initiale à 58).
- Zéro `tenant_id`. Table `client` dissoute dans `tenant_config` (migration 006). Copy-on-write `code` / `personnalise` / `valeurs_defaut` sur 9 tables. `profil_societe` et `utilisateur_societe` en UNIQUE NULLS NOT DISTINCT. Aucune trace du modèle `default_`/`tenant_` abandonné.
- Isolation physique : jointures inter-bases impossibles, l'API fait le pont. `commonPool` présent mais pas encore utilisé hors migrateur. Aucun tenant provisionné à ce jour (`003_tenant_seed.sql` fait un UPDATE de `tenant_config` sans ligne insérée, pas de société initiale).

## RBAC ET PORTÉES

- Modèle acté le 29/07 inchangé : attribution valable sur l'intersection rattachement x diffusion (tout ou rien), cumul par union entre groupes, `id_societe NULL` = portée tenant, exceptions bornées au rattachement.
- **Retrait prioritaire sur ajout : déjà implémenté** dans `server/routes/droitsEffectifs.js:62-92` (tous les accorde traités avant tous les retire, indépendamment de l'ordre SQL). Validation formelle de la règle par Samuel toujours attendue.
- Le fichier de référence réel est `simulateurDroits/index.html` (non tracké git). `Nayrod_SamSec_Simulateur_Droits_v3.html` n'existe pas sous ce nom dans le repo ; `Nayrod_SamSec_Spec_Portees_RBAC_v1.md` absent du repo.
- Point 7 (catalogue RBAC dynamique) : toujours en attente, ne pas implémenter.

## MODULE BUDGET

- Doctrine respectée : organisation payeuse dérivée de la chaîne `licence -> commande -> société`, jamais stockée sur la ligne budgétaire.
- Dette connue : second module budget legacy `src/components/contrats/BudgetPage.jsx` routé sur `/contrats/budget`, avec `mockBudgets.js` incompatible (mono-montant vs CAPEX/OPEX de `mockBudget.js`). Suppression à décider.

## MODULE RAPPORTS

- Complet : 6 conformité + 6 optimisation, builder 8 sections, aperçu live. Données mock + localStorage. Moteur : `reportEngine.js`, `reportsCatalog.js`.

## BACKLOG BDD

- **Point 6 (exceptions de droits)** : mécanisme implémenté et branché (API + simulateur). Reste la validation Samuel de la règle de retrait.
- **Point 8 (`contrat.id_societe`) : FAIT** (`server/bdd/002_tenant_schema.sql:317`, index `idx_contrat_societe`). À clôturer dans le suivi.
- Points 9 à 21 : backlog étendu inchangé.

## QUESTIONS OUVERTES

- Samuel : validation formelle du retrait prioritaire (implémentation existante) ; décision soft delete D11, urgente avant données réelles.
- Dashboard multi-groupes : le code affiche tous les dashboards accessibles avec commutateur ; à confirmer comme réponse définitive.

## CHANTIERS OUVERTS CONNUS (constat du 06/08, section datée, à purger au fil des corrections)

- **Versionnement git incomplet** : `server/`, `bdd/`, `db/`, `simulateurDroits/`, `planning/`, `src/components/admin/`, `src/services/`, `src/constants/` non trackés. Aucune branche ne contient l'API.
- **Workflows GitHub Actions à réaligner** : le `rsync -rt --delete` du deploy dev n'exclut pas `server/` (le prochain push sur dev efface l'API et `server/.env`) ; le workflow staging appelle `npm run build:staging`, supprimé du package.json.
- **Sécurité** : alias NGINX `/bdd` expose les SQL en HTTP (hashes bcrypt et mots de passe en clair dans les commentaires, migrations 012/013 avec comptes de test `admin_sam` mot de passe 1234, rejoués en staging) ; épisodes 28P01 sur le rôle `samsecure_app` (désynchronisation `server/.env` vs rôle PG, `CHANGEZ_MOI` dans `000_init_databases.sql:19`) ; `cors()` sans configuration ; 2FA avec code `'123456'` en dur contournant AuthContext ; ForgotPassword/ResetPassword factices (setTimeout, `:token` jamais lu) ; anti-bruteforce en state React réinitialisé par F5 ; aucune route de changement de mot de passe malgré la table `reset_password_token`.
- **API, traitement d'erreurs** : toutes les erreurs PostgreSQL renvoient un 500 générique "Erreur serveur". Mapper 23505 en 409, 22001 en 400, 23503 en 409. `DELETE /societes/:id` casse sur `profil_societe_id_societe_fkey` (les diffusions de groupes ne sont pas nettoyées) : bug fonctionnel réel. `validateSiret` non appliqué côté serveur.
- **Front** : code mort intégral `src/components/charts/` (7 composants, dont `GrafanaPanel.jsx` qui pointe sur l'API et non Grafana) ; 5 pages orphelines (Renouvellements, Equipe, AnalysesUsage, ParcLicences, Dashboard) ; `server/routes/droits.js` fichier de 0 octet ; dark mode inatteignable (classe `dark` jamais posée sur html) ; bundle monolithique 1,24 Mo sans React.lazy ; notifications non persistantes (mock figé).
- **Environnement dev** : Vite mort depuis le 05/08 12:13 (n'écoute plus sur 5173, dev-samsecure en 502) ; 50 801 erreurs "Cannot find module tailwindcss" liées au conflit de propriétaire node_modules ; ESLint quasi inopérant (`ignores: ['dist']` seulement, `globals.browser` sur server/).
- Trois dossiers SQL concurrents sans synchronisation (`server/bdd/` exécuté, `bdd/`, `db/`), incohérences internes (en-têtes 007/005/008 mal auto-nommés, 004 manquant, repair.sql doublon de 009).

## CONVENTIONS

- Nommage documents : `Nayrod_SamSec_[Objet]_v[N].[ext]`.
- Jamais de tiret cadratin. Accents français corrects.
- UML : BDD Commune en ambre, BDD Tenant en bleu, dark mode.

## FORMAT DE TES RÉPONSES DE DEBUG

Pour chaque bug analysé, fournis :
1. La cause racine.
2. Les fichiers et lignes concernés.
3. La correction exacte à appliquer à la main (diff ou bloc de code complet).
4. Les effets de bord possibles de la correction.
5. Une section "Écarts constatés" si le code contredit ce document (peut être vide).
