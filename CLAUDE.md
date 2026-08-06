# SamSecure - Contexte projet pour Claude Code

## REGLE DE PRECEDENCE (a lire en premier)

Ce document a ete redige en amont et peut etre partiellement obsolete.

1. **Le code reel du projet est la source de verite.** Si ce que tu observes dans le repo contredit ce document, c'est le code qui prime.
2. **Signale systematiquement les ecarts.** Quand tu constates une contradiction entre ce document et le code, mentionne-le explicitement dans ta reponse (section "Ecarts constates") pour que la documentation soit corrigee. Ne suis jamais silencieusement l'un ou l'autre.
3. Les documents anterieurs a aout 2026 (notamment le Referentiel Technique BDD v3 de mai 2026) decrivent en partie des modeles abandonnes depuis. Les decisions listees ici sous "Doctrine d'architecture" sont les plus recentes connues.

## TON ROLE SUR CE SERVEUR

- Tu es en **lecture seule stricte** (Plan Mode + regles deny). Tu ne modifies aucun fichier, tu ne lances aucune commande d'ecriture.
- Ta mission : analyser les bugs du staging, identifier les causes racines, et fournir des corrections precises (diff ou bloc de code complet) que l'equipe appliquera a la main via le workflow git.
- **Devoir de challenge** : si une demande ou un constat te semble incoherent, risque ou errone, dis-le et propose une alternative argumentee. Va au-dela de la demande litterale.
- **Aucune invention** : toute affirmation fonctionnelle doit se rattacher au code observe ou a une decision documentee ici. Si tu n'es pas sur, dis-le.
- Reponds en francais. N'utilise jamais de tiret cadratin, utilise des tirets simples ou des virgules.

## LE PROJET

- **SamSecure** : plateforme B2B SaaS de Software Asset Management (SAM). Gestion des licences logicielles, conformite, budget, rapports pour les clients de SamSecure.
- **Acteurs** :
  - Dorian (Nayrod) : pilote du projet, redige les specs et les prompts.
  - Antonin (Nayrod) : developpeur, ton interlocuteur direct sur ce serveur.
  - Samuel Aurensan : expert technique cote client, valide les decisions structurantes.
  - Vincent Douhairie : commercial cote client.
- **Echeances** : developpement des modules termine fin aout 2026. Septembre 2026 reserve aux corrections, tests et livraison. Livraison finale le 25 septembre 2026.
- **Serveur actuel** : staging, `staging-samsecure.nayrod.fr`.

## ETAT ACTUEL : v0.5

- Front **mono-tenant, donnees mockees**, React + Vite + Tailwind + Chart.js.
- 3 profils utilisateurs : **Manager DSI, Financier, IT Ops**, chacun avec son dashboard.
- Tableaux de bord temps reel, masques de saisie.
- Persistance v0.5 : **localStorage** (notamment les templates de rapports). Pas encore de branchement BDD complet cote front, a verifier dans le code.
- Logos editeurs : Simple Icons CDN.
- Recherche insensible aux accents (normalisation cote front).
- Le front est un artefact vivant, pas un livrable fige.

## ROADMAP (phasage previsionnel)

- v0.5 : front minimum, dashboards, mono-tenant, 3 profils, mono-serveur (pre-release).
- v1.0 : rapports/livrables via Grafana connecte au SGBD (release).
- v2.0 : multi-tenancy, SSO, back-office technique, micro-services, une dizaine de profils, connecteurs REST vers outils d'inventaire (LanSweeper, AD, SCCM, Intune, Ivanti).
- v3.0 : blockchain (tracabilite des droits d'usage) et IA.

## STACK ET INFRASTRUCTURE

- Ubuntu 24.04, Node.js 24 LTS, NGINX, PM2, Docker, PostgreSQL 16.
- CI/CD : GitHub Actions. Supervision : Prometheus + Grafana. Acces admin via VPN WireGuard.
- pgAdmin 4 : `pgadmin-dev-samsecure.nayrod.fr` et `pgadmin-staging-samsecure.nayrod.fr`.
- Sequence d'installation SQL : `000_init_databases.sql` puis `001_commune_schema.sql` puis `004_commune_seed.sql` puis `002_tenant_schema.sql` puis `003_tenant_seed.sql`.
- Le codebase est synchronise par Dropbox entre les machines de dev, et deploye sur le staging. Toute correction doit passer par une branche git, jamais en direct sur le serveur.

## DOCTRINE D'ARCHITECTURE BDD (v3, decisions de juillet 2026)

- **Isolation physique** : 1 BDD Commune + 1 BDD Tenant par client. AUCUN champ `tenant_id` nulle part. Les jointures SQL ne peuvent pas traverser Commune et Tenant : c'est l'API qui fait le pont.
- **BDD Commune reduite a 5 tables** (arbitrage 29/07) : `produit_referentiel`, `version`, `edition`, `langue`, `traduction`. Les traductions sont un actif SamSecure, non editables par les tenants.
- **Tous les referentiels** (profil, type_contrat, fonction, etc.) sont en BDD Tenant, peuples par des seeds idempotents.
- **Copy-on-write** pour les referentiels personnalisables : colonnes `code`, `personnalise` (boolean), `valeurs_defaut` (JSONB snapshot) permettant un "restaurer par defaut" sans lire la BDD Commune a l'execution. Diffusion des defauts a tous les tenants via workers et `tache_asynchrone`.
- **Table `client` dissoute** : absorbee dans `tenant_config` (raison_sociale, id_abonnement, id_administrateur). Les colonnes `id_client` ont ete supprimees.
- **Modele fallback `default_`/`tenant_` ABANDONNE** : l'ancien modele a 17 tables partagees avec surcharge creait des FK impossibles entre bases et violait la doctrine d'isolation. Ne jamais le reintroduire. Attention : le document Referentiel Technique BDD v3 (mai 2026) decrit encore ce modele, il est obsolete sur ce point.
- Schema v3 : 58 tables, validees contre une instance PostgreSQL 16 reelle (delta structurel zero).

## RBAC ET PORTEES (acte le 29/07/2026)

- Deux tables de portee : `profil_societe` (diffusion d'un groupe de droits) et `utilisateur_societe` (rattachement d'un utilisateur). `id_societe NULL` = portee tenant entier.
- Une attribution n'est valable que sur l'**intersection** rattachement x diffusion, en tout ou rien.
- Les droits de plusieurs groupes se **cumulent par union**. Le **retrait (exception) est prioritaire** sur l'ajout. Les exceptions sont bornees au rattachement de l'utilisateur.
- Hors scope v1 : modification retroactive des portees.
- References : `Nayrod_SamSec_Simulateur_Droits_v3.html` (front de reference faisant autorite) et `Nayrod_SamSec_Spec_Portees_RBAC_v1.md`.
- Point 7 (catalogue RBAC dynamique module/ressource/action) : **en attente, ne pas planifier ni implementer**.

## MODULE BUDGET

- L'organisation payeuse est **toujours derivee de la chaine `licence -> commande -> societe`**, jamais stockee sur la ligne budgetaire elle-meme. `commande.id_societe` reste l'organisation payeuse.
- Des sections budget doivent apparaitre sur les fiches de detail : KPIs agreges sur les fiches contrat, lignes budgetaires brutes sur les fiches licence.

## MODULE RAPPORTS

- 6 rapports de conformite + 6 rapports d'optimisation.
- Generateur de rapports sur mesure : 8 sections de configuration, apercu live, templates persistes en localStorage (v0.5).
- Moteur partage : `reportEngine.js` et `reportsCatalog.js`.

## BACKLOG BDD ACTIF (points en cours)

- **Point 6** : table `exception_droit` en BDD Tenant, surcharges de droits par utilisateur/societe (type grants/removes, raison, dates, `id_accorde_par`). Retrait prioritaire sur ajout, regle a confirmer avec Samuel.
- **Point 8** : reintegrer `id_societe` (societe signataire, FK vers societe) sur la table `contrat`. Existait en v2, perdue par regression lors de la consolidation v3. Sans impact sur la logique budget.
- Points 9 a 21 : backlog etendu issu de l'analyse des transcriptions de sprint (mai-juillet 2026).

## QUESTIONS OUVERTES (en attente de Samuel)

- Confirmation de la regle "retrait toujours prioritaire" pour `exception_droit`.
- Choix du dashboard quand plusieurs groupes s'appliquent a un utilisateur (pas de profil actif unique).
- Decision soft delete (D11), urgente avant accumulation de donnees reelles.

## CONVENTIONS

- Nommage des documents : `Nayrod_SamSec_[Objet]_v[N].[ext]`.
- Jamais de tiret cadratin dans les textes generes. Accents francais corrects partout.
- UML : BDD Commune en ambre, BDD Tenant en bleu, dark mode.

## FORMAT DE TES REPONSES DE DEBUG

Pour chaque bug analyse, fournis :
1. La cause racine.
2. Les fichiers et lignes concernes.
3. La correction exacte a appliquer a la main (diff ou bloc de code complet).
4. Les effets de bord possibles de la correction.
5. Une section "Ecarts constates" si le code contredit ce document (peut etre vide).
