# Attendus de recette fonctionnelle — SamSecure

Check-list de la recette jouée sur le jeu de données `server/bdd/recette/`
(00_reset_tenant.sql puis 01_jeu_recette.sql). Rédigée le 06/10/2026, vérifiée
intégralement sur le tenant de dev (SQL + API). Chaque cas donne : ce qui est
en base, l'écran où regarder, le résultat exact attendu.

## Mise en place

1. Jouer, sur la base **Tenant** de l'environnement (en transaction, arrêt à la
   première erreur) :
   ```
   psql -v ON_ERROR_STOP=1 -d <base_tenant> -f server/bdd/recette/00_reset_tenant.sql
   psql -v ON_ERROR_STOP=1 -d <base_tenant> -f server/bdd/recette/01_jeu_recette.sql
   ```
   Le reset conserve configuration et référentiels du tenant ; le jeu est
   rejouable après chaque reset. **Avant de jouer le jeu sur un autre
   environnement que dev** : vérifier l'identifiant du produit de catalogue
   (variable `id_produit_catalogue` en tête de 01_jeu_recette.sql, requête
   fournie dans l'en-tête du script).
2. Déclencher le traitement des notifications : connexion `admin.recette`,
   puis `POST /api/notifications/executer-planification` (ou attendre le
   passage planifié de 7 h). Le traitement complet passe depuis le correctif
   BUG-1 du 06/10/2026 : réponse 200, code 5506, toutes les détections
   exécutées.
3. Utilisateurs de recette — mot de passe commun **Recette#2026** :

   | Compte | Profil / particularité |
   |---|---|
   | admin.recette@samsecure.test | Admin SAM, portée tenant |
   | dsi.recette@samsecure.test | Manager DSI, portée tenant |
   | financier.recette@samsecure.test | Financier, portée tenant |
   | itops.recette@samsecure.test | IT Ops ; courrier des dépassements désactivé (NTF-09) |
   | saisie.recette@samsecure.test | IT Data input (saisie) |
   | dsi.en.recette@samsecure.test | Manager DSI, langue **anglaise** |
   | cumul.recette@samsecure.test | IT Data input + groupe « REC Groupe lecture transverse » |
   | financier.retire.recette@samsecure.test | Financier privé de consulter_kpi_financiers (exception retire) |
   | saisie.accorde.recette@samsecure.test | IT Data input + consulter_licences (exception accorde) |
   | dsi.nord.recette@samsecure.test | Manager DSI rattaché à la seule Filiale Nord |

4. Sur le tenant de **dev**, des utilisateurs historiques (…@demo.fr) restent
   actifs et reçoivent aussi les notifications : les attendus se lisent par
   compte de recette (présence/absence), jamais en nombre total de
   destinataires.

## Bugs applicatifs révélés par ce jeu (corrigés le 06/10/2026 ; migration 096 à jouer)

- **BUG-1 (bloquant)** — `server/utils/notifications/planificateur.js:171-172`
  (`detecterFinsMaintenance`) référence `l.id_contrat`, colonne supprimée de
  `licence` par la migration 014 : erreur SQL 42703 au parse, **tout le
  traitement quotidien échoue** (manuel : 500 code 5549 ; planifié : tâche en
  échec). Conséquences : aucune notification `fin_maintenance` (cas LIC-08) et,
  le traitement s'arrêtant là, `contrat_a_suivre`, `revalidation_echue`,
  `depassement_conformite` et `budget_seuil` ne sortent pas non plus par la
  route. Révélé par LIC-08 + POST /notifications/executer-planification. Les
  attendus NTF-04 à NTF-07 ont été vérifiés en appelant les détections une à
  une (fonctions exportées du planificateur) : ils valent après correctif.
  **Corrigé le 06/10/2026** : le contrat est déduit par la chaîne licence →
  commande → contrat (`co.id_contrat` via `licence.id_commande`), même motif
  que le reste du dépôt ; test pur `planificateur.test.js` ; vérifié par la
  route (200, code 5506, `fin_maintenance : 10`, NTF-04 à NTF-07 et NTF-13
  conformes).
- **BUG-2** — D53 partiellement cassé : quand droits = 0 avec des usages, le
  taux doit être ABSENT ; `recalculer_precalcul_conformite_ligne` (046, révisée
  058/065/068) insère `LEAST(v_taux, 999.99)` or `LEAST(NULL, 999.99)` vaut
  999.99 en SQL : `ecart_pct` sort à **999.99 au lieu de null** (statut
  dépassement et anomalie restent corrects). Révélé par LIC-04 et LIC-10
  (GET /conformite, colonne taux). Le pendant JS (`valoriserBalance`) est,
  lui, correct. **Corrigé le 06/10/2026** par la migration
  `096_tenant_correctif_taux_droits_nuls.sql` (CASE conservant le NULL,
  reprise des seules lignes faussées), **à jouer en dev puis staging** ;
  vérifié en transaction annulée sur le tenant dev : LIC-04 et LIC-10
  ressortent avec ecart_pct null, témoins 84/86/140 inchangés, rejouable.
- **BUG-3 (mineur)** — `server/utils/notifications/courriers.js:48` lit
  `FROM client`, table inexistante (le nom du tenant vit dans
  `tenant_config.raison_sociale`) : l'objet des courriels sort « SamSecure : … »
  sans le nom du client, et `log_serveur` trace « nom du tenant illisible » à
  chaque envoi. Révélé par l'envoi des courriers immédiats. **Corrigé le
  06/10/2026** : lecture de `tenant_config.raison_sociale` ; l'objet sort
  « SamSecure - REC Client Recette : … » (vu dans log_serveur) et la trace
  « nom du tenant illisible » a disparu du log.

---

## SOC — Sociétés

### SOC-01 — Hiérarchie mère / filiales
- **En base** : REC Groupe Horizon (mère), REC Filiale Nord et REC Filiale Sud
  (id_societe_parent = mère).
- **Écran** : Référentiels > Organisation.
- **Attendu** : les trois sociétés listées, les deux filiales rattachées à la
  mère. — **Vérifié.**

### SOC-02 — Société acheteuse ≠ bénéficiaire
- **En base** : commande « REC Commande acheteuse mère » (payeuse = REC Groupe
  Horizon), licence « REC Licence logiciel client RH », affectation « REC Usage
  bénéficiaire Sud » (id_societe = REC Filiale Sud).
- **Écrans** : Contrats > Commandes (détail), Conformité > Affectations, Budget.
- **Attendu** : la commande affiche la société Groupe Horizon ; l'affectation
  affiche la Filiale Sud ; au budget, la payeuse de la licence est **déduite**
  de la chaîne licence → commande → société (Groupe Horizon), jamais saisie sur
  la ligne. — **Vérifié.**

### SOC-03 — Société signataire des contrats
- **En base** : chaque contrat porte id_societe (signataire).
- **Écran** : Contrats > Liste.
- **Attendu** : libellé « Libellé (Société) » partout, p. ex. « REC Contrat
  applicatif Nord (REC Filiale Nord) » ; le contrat interne Sud affiche la
  société prêteuse REC Groupe Horizon. — **Vérifié.**

## USR / DRT — Utilisateurs et droits

### DRT-01 — Exception « retire » (Financier sans montants)
- **En base** : financier.retire.recette, profil Financier + exception retire
  sur consulter_kpi_financiers (portée tenant).
- **Écrans** : Contrats > Factures ; Conformité > Licences ; Dashboards.
- **Attendu** : connecté avec ce compte, les montants sont servis à null
  (montants_masques = true) : facture REC sans montant, conformité sans écart
  valorisé ; `GET /auth/mes-droits` ne porte pas consulter_kpi_financiers.
  Il reçoit la notification budget (profil Financier) mais **sans la phrase
  des montants** (voir NTF-06). — **Vérifié.**

### DRT-02 — Exception « accorde »
- **En base** : saisie.accorde.recette, profil IT Data input + exception
  accorde sur consulter_licences.
- **Écran** : Conformité > Licences.
- **Attendu** : l'écran répond (GET /licences 200, code 4000) alors que le
  compte saisie.recette (même profil, sans exception) est refusé (403, code
  3400). — **Vérifié.**

### DRT-03 — Cumul profil + groupe (union)
- **En base** : cumul.recette = IT Data input + groupe « REC Groupe lecture
  transverse » (consulter_licences, consulter_budget).
- **Attendu** : mes-droits = union des deux sources : les droits de saisie du
  profil ET consulter_licences + consulter_budget du groupe. — **Vérifié.**

### DRT-04 — Portée restreinte à une filiale
- **En base** : dsi.nord.recette, Manager DSI attribué et rattaché à la seule
  REC Filiale Nord.
- **Attendu** : mes-droits avec isTenantScope = false ; il reçoit les
  notifications d'événements de la Filiale Nord (échéance de souscription,
  contrat à suivre, revalidation) et PAS celles du Groupe Horizon (échéance du
  contrat CTR-03) ni de la Filiale Sud (budget). — **Vérifié.**

### DRT-05 — IT Ops : licences en lecture seule, affectations en saisie (D45)
- **En base** : itops.recette, profil IT Ops (matrice 077/086).
- **Attendu** : GET /licences 200 ; POST /licences refusé 403 code 3400 (pas de
  bouton de création à l'écran) ; POST /affectations autorisé. — **Vérifié.**

## GRP — Groupes personnalisés

### GRP-01 — Groupe actif
- **En base** : « REC Groupe lecture transverse » (type groupe, diffusion
  tenant), attribué à cumul.recette.
- **Écran** : Administration > Groupes.
- **Attendu** : groupe listé avec ses 2 permissions ; effet prouvé par DRT-03.
  — **Vérifié.**

### GRP-02 — Corbeille, 10 jours (restaurable)
- **En base** : « REC Groupe corbeille 10 jours », date_suppression = J-10.
- **Écran** : Administration > Groupes > Corbeille.
- **Attendu** : listé avec **80 jours restants** (rétention 90 jours),
  restaurable. — **Vérifié** (GET /profils/corbeille : jours_restants = 80).

### GRP-03 — Corbeille, 100 jours (purgeable)
- **En base** : « REC Groupe corbeille 100 jours », date_suppression = J-100.
- **Écran** : Administration > Groupes > Corbeille.
- **Attendu** : absent de la corbeille — la purge (90 jours dépassés) est
  appliquée au premier affichage de l'écran, le groupe est supprimé
  physiquement. — **Vérifié** (présent en base après le jeu, purgé à la
  première lecture de la corbeille).

## LOG — Logiciels

### LOG-01 — Logiciel du catalogue commun, versions et éditions
- **En base** : produit Commune « Adobe Photoshop » (variable
  id_produit_catalogue) + compléments Tenant : versions REC v1/v2/v3, éditions
  REC Standard / REC Pro ; licence LIC-07 dessus.
- **Écrans** : Référentiels > Logiciels ; Conformité > Licences (détail LIC-07).
- **Attendu** : libellé « Adobe Photoshop » résolu depuis la Commune, version
  courante « REC v3 », édition « REC Standard » ; les compléments sont fusionnés
  au catalogue dans les listes déroulantes. — **Vérifié.**

### LOG-02 — Logiciel créé côté client
- **En base** : « REC Logiciel RH interne » (produit_client) + version client
  « RH v10 » + édition client « RH Entreprise », licence LIC-13.
- **Attendu** : visible au référentiel (éditeur REC Éditions Soleil), la licence
  affiche version et édition client ; balance : 3 droits, 2 usages, conforme.
  — **Vérifié.**

### LOG-03 — Logiciel composé (#216)
- **En base** : « REC Suite Bureau (composé) » regroupe « REC Compo Texte » et
  « REC Compo Tableur » (même éditeur). Licences : composé q=10 (1 usage),
  Compo Texte q=2 (5 usages). Compo Tableur sans licence.
- **Écran** : Conformité > Licences.
- **Attendu** : Compo Texte : droits totaux **12** (2 propres + 10 hérités),
  5 usages, taux 41,67 %, conforme, **écart valorisé 0** (l'excédent hérité est
  déjà valorisé sur la ligne du composé) ; le composé : 10 droits propres (il
  n'hérite jamais), 1 usage ; Compo Tableur : **aucune ligne** de conformité
  (l'héritage ne crée pas de balance sans licence propre). — **Vérifié.**

### LOG-04 — Logiciel sans aucune licence
- **En base** : « REC Logiciel sans licence ».
- **Attendu** : présent à Référentiels > Logiciels, **absent** de l'écran de
  conformité (aucune balance). — **Vérifié.**

### LOG-05 — Métriques
- **En base** : licences en utilisateur nommé (majorité), device (LIC-17 par
  poste), serveur (composé), utilisateur concurrent (essai), core (budget Sud).
- **Attendu** : l'unité de mesure s'affiche sur chaque fiche licence.
  — **Vérifié.**

## CTR — Contrats

### CTR-01 — Cadre et enfant
- **En base** : « REC Contrat cadre groupe » (type Cadre, Groupe Horizon) ;
  « REC Contrat applicatif Nord » avec id_contrat_parent = le cadre.
- **Attendu** : le rattachement cadre est affiché sur la fiche de l'enfant.
  — **Vérifié.**

### CTR-02 — Contrat interne
- **En base** : « REC Contrat interne Sud » (type Interne, signataire Filiale
  Sud, société prêteuse Groupe Horizon, sans revendeur).
- **Attendu** : type « Interne », prêteuse affichée ; porte la commande budget
  Sud. — **Vérifié.**

### CTR-03 — Échéance dans 15 jours
- **En base** : « REC Contrat échéance 15 jours » (Groupe Horizon), date_fin =
  J+15.
- **Écrans** : Contrats > Liste (badge « à renouveler ») ; Notifications.
- **Attendu** : statut d'échéance « à renouveler » ; notification
  echeance_contrat (palier 30 jours, gravité orange) pour Manager DSI et Admin
  SAM — voir NTF-01. — **Vérifié.**

### CTR-04 — Renouvelé dans la continuité : aucune alerte
- **En base** : « REC Contrat renouvelé (ancien) », date_fin = J+10, renouvelé
  par « REC Contrat renouvelé (nouveau) » (id_contrat_predecesseur).
- **Attendu** : **aucune** notification d'échéance pour l'ancien malgré J+10
  (continuité D35) ; le nouveau n'alerte pas (fin à J+365). — **Vérifié**
  (aucune notification ne référence ce contrat).

### CTR-05 — Contrat à faire suivre
- **En base** : « REC Contrat à faire suivre » (Filiale Nord), échu à J-30,
  sans successeur ; licence LIC-12 renouvelée dessus (ancienne et nouvelle
  période sur ses commandes).
- **Écrans** : fiche du contrat et des licences (bandeau) ; Notifications.
- **Attendu** : bandeau « contrat à suivre » (contrat_a_suivre = true sur les
  licences), notification contrat_a_suivre gravité rouge (échu), Manager DSI et
  Admin SAM, y compris dsi.nord (Filiale Nord) ; rien n'est modifié
  automatiquement. — **Vérifié** (détection directe, puis revérifié par la route le 06/10/2026 après correctif BUG-1).

## CMD — Commandes

### CMD-01 — Dernier prix fait foi (D52)
- **En base** : deux commandes du même logiciel « REC Logiciel Prix dernière
  commande » : J-90, licence 10 u pour 1 000 € (100 €/u) ; J-10, licence 4 u
  pour 600 € (**150 €/u**).
- **Écran** : Conformité > Licences (colonne prix/valorisation).
- **Attendu** : prix unitaire du produit = **150 €** (jamais une moyenne) ;
  balance 14 droits / 3 usages, écart +11 valorisé **+1 650 €**. — **Vérifié.**

### CMD-02 — Manque documentaire
- **En base** : « REC Commande sans preuve » (ni preuve ni facture), licence
  LIC-18 dessus.
- **Écran** : Contrats > Commandes (vue des manques).
- **Attendu** : la commande ressort dans GET /commandes/manques avec
  facture_manquante = true et preuve_manquante = true (8 commandes sans facture
  au total sur le jeu, 6 sans preuve). — **Vérifié.**

### CMD-03 — Facture déposée avec montant et date
- **En base** : facture « REC Facture commande Nord », montant 1 234,56 €,
  preuve support type Facture datée J-30 (mode référence REC-GED-FAC-001).
- **Écran** : Contrats > Factures.
- **Attendu** : montant **1 234,56 €** et date visibles pour financier.recette ;
  montant **null + montants_masques** pour financier.retire.recette et
  saisie.recette (voir PRV-04). — **Vérifié.**

## LIC — Licences (balance : seuil de taux personnalisé à 85 %, SEU-01)

Écran de référence : Conformité > Licences ; valeurs lisibles aussi dans
`precalcul_conformite` et par GET /conformite.

### LIC-01 — Souscription sur-licenciée (10 droits / 8 usages)
- **Attendu** : taux 80 %, statut **conforme**, écart +2 valorisé +1 000 €
  (prix 500 €). — **Vérifié.**

### LIC-02 — Souscription en dépassement (5 / 7)
- **Attendu** : taux 140 %, statut **dépassement**, écart -2 valorisé
  **-12 000 €** (prix 6 000 €), au-delà du seuil en euros (10 000) ;
  notification dépassement (NTF-05). — **Vérifié.**

### LIC-03 — Souscription à l'équilibre (10 / 10)
- **Attendu** : taux 100 %, écart 0, statut **attention** (taux ≥ seuil 85),
  écart valorisé 0. — **Vérifié.**

### LIC-04 — Souscription échue hier (D44)
- **En base** : date_fin_souscription = J-1, 3 usages validés.
- **Attendu** : la licence est sortie des droits **dès aujourd'hui** : droits 0,
  usages 3, statut dépassement, anomalie **usage_sans_droit** ouverte, écart
  -3 valorisé -1 200 € ; **aucun taux** (BUG-2 corrigé par la migration 096 :
  ecart_pct null vérifié en transaction annulée, écran à revoir une fois la
  096 jouée). Statut d'échéance de la licence : « expiré ». — **Vérifié.**

### LIC-05 — Souscription qui échoit dans 20 jours
- **Attendu** : notification echeance_souscription (palier 30 jours, jaune),
  Manager DSI + Admin SAM, y compris dsi.nord (Filiale Nord) ; Financier et
  IT Ops absents (NTF-02). Balance 5/2 conforme. — **Vérifié.**

### LIC-06 — Perpétuelle sans maintenance
- **Attendu** : statut maintenance « aucune », version figée à l'achat
  (« v1.0 »), droits comptés (5/1 conforme), aucune alerte. — **Vérifié.**

### LIC-07 — Perpétuelle, trois maintenances enchaînées
- **En base** : périodes J-30 mois → J-18 → J-6 → J+6 mois, versions REC v1 →
  v2 → v3 (licence_version_historique), dernière période en cours.
- **Attendu** : statut maintenance **active**, mainteneur « REC Maintenance
  Services », fin de maintenance à J+6 mois, **aucune alerte** de fin de
  maintenance ; version courante REC v3 ; l'historique des versions affiche
  3 événements (achat v1, maintenance v1→v2, maintenance v2→v3), du plus récent
  au plus ancien. — **Vérifié.**

### LIC-08 — Maintenance qui se termine dans 20 jours sans suite
- **Attendu** : notification **fin_maintenance** (Manager DSI, Admin SAM,
  IT Ops ; dsi.nord inclus — licence de la Filiale Nord). — **Vérifié le
  06/10/2026 après correctif BUG-1** : admin, dsi, dsi.en, dsi.nord et itops
  servis, gravité jaune, financier et saisie absents. Statut maintenance
  « active » avec fin à J+20 : vérifié.

### LIC-09 — Maintenance arrêtée il y a 6 mois
- **En base** : date_arret_maintenance = J-6 mois, période close à cette date,
  version figée « v2024 (figée) ».
- **Attendu** : statut maintenance **arrêtée**, date de fin affichée = date
  d'arrêt, version figée affichée, **aucune alerte** (l'arrêt est un choix).
  — **Vérifié.**

### LIC-10 — Licence à droits nuls (quantité 0) avec 2 usages (D53)
- **Attendu** : anomalie **usage_sans_droit** immédiate (écran Qualité,
  gravité critique), statut dépassement, écart valorisé null (aucun prix) ;
  **aucun taux** (BUG-2 corrigé par la migration 096 : ecart_pct null vérifié
  en transaction annulée, écran à revoir une fois la 096 jouée). — **Vérifié.**

### LIC-11 — Licence prolongée par extension de période
- **En base** : date de fin étendue à J+300 ; trace « PROLONGATION » au journal
  (date avant J+30 / après J+300).
- **Attendu** : fiche licence avec la nouvelle échéance, aucune alerte ;
  l'écriture figure au journal (Administration > Journal). — **Vérifié.**

### LIC-12 — Période supplémentaire dont le contrat n'a pas suivi
- **En base** : ancienne période échue J-30, nouvelle période
  (id_licence_predecesseur) J+335, toutes deux sur le contrat échu CTR-05.
- **Attendu** : la licence n'alerte pas (succession D35) ; le **contrat**
  ressort « à suivre » (bandeau + notification contrat_a_suivre) ; balance du
  logiciel : 5 droits (la période échue ne compte plus), 0 usage. — **Vérifié.**

### LIC-13 — Licence sur le logiciel client : voir LOG-02. — **Vérifié.**
### LIC-14/15 — Licences du composé et du composant : voir LOG-03. — **Vérifié.**

### LIC-16 — Licence en version d'essai
- **En base** : type « essai » (référentiel), fin J+45, 5 droits / 1 usage.
- **Attendu** : type affiché « Version d'essai », date de fin obligatoire
  portée ; les droits comptent (5/1 conforme) ; à noter (limite connue, hors
  bug) : le planificateur des échéances ne considère que le type souscription,
  une version d'essai n'est pas alertée. — **Vérifié.**

### LIC-17 — Métrique par poste
- **En base** : licence en unité « Device », affectations à deux postes
  (REC-PC-0042 / REC-PC-0043, type_cible = poste).
- **Attendu** : 5 droits / 2 usages ; les affectations affichent la cible
  « poste ». — **Vérifié.**

### LIC-18 — Licence sans aucune preuve : voir CMD-02. — **Vérifié.**

### LIC-19 — Licence avec certificat d'authenticité
- **En base** : preuve type « Certificat d'authenticité » rattachée à la
  licence (id_licence), mode référence.
- **Écran** : fiche licence / preuves.
- **Attendu** : le certificat apparaît rattaché à la licence. — **Vérifié.**

## AFF — Affectations

### AFF-01 — Les validées comptent
- **Attendu** : toutes les balances LIC-* ci-dessus comptent uniquement les
  affectations dont la dernière entrée de workflow est « valide ».
  — **Vérifié.**

### AFF-02 — En attente : ne compte pas
- **En base** : « REC Usage en attente de validation » (q=5) sur la licence à
  l'équilibre LIC-03.
- **Attendu** : balance de LIC-03 inchangée (10/10, pas 10/15) ; l'affectation
  est dans la file de validation (widget « validations en attente » = 1).
  — **Vérifié.**

### AFF-03 — Refusée avec motif
- **En base** : « REC Usage refusé (doublon) », workflow refuse, message_refus
  « REC Doublon de saisie : cet usage est déjà déclaré sur REC-EQUIPE-F. ».
- **Attendu** : ne compte pas dans la balance ; statut « Refusé » ; le motif
  n'est visible qu'en ouvrant la saisie (message_refus sur le détail), jamais
  dans un courriel. — **Vérifié.**

### AFF-04 — Affectation à un poste : voir LIC-17. — **Vérifié.**

### AFF-05 — Même utilisateur sur deux postes = 2 usages (D51)
- **En base** : REC-PC-0042 et REC-PC-0043, même personne (marie.durand), q=1
  chacune.
- **Attendu** : usages du logiciel « REC Logiciel Par poste » = **2** (aucun
  dédoublonnage nominatif). — **Vérifié.**

### AFF-06 — Revalidation échue
- **En base** : « REC Usage à revalider (échu) », validée, cycle ouvert J-35,
  échéance J-5 (délai société 30 jours).
- **Écrans** : Conformité > Affectations ; Notifications.
- **Attendu** : statut relu « à revalider » (jamais persisté), statut de
  revalidation « dépassé », jours restants -5 ; notification
  revalidation_echue (IT Ops, Manager DSI, Admin SAM ; dsi.nord inclus —
  Filiale Nord ; Financier absent), gravité orange (retard ≤ 30 j).
  — **Vérifié** (détection directe, puis revérifié par la route le 06/10/2026 après correctif BUG-1).

### AFF-07 — Usage sur logiciel sans licence
- **Note de modèle** : une affectation exige une licence (id_licence NOT NULL),
  l'« usage sans licence » n'est pas représentable tel quel. Le cas réel est
  couvert par LIC-04 (licence échue : usages sans droit) et LIC-10 (licence à
  0 droit) : anomalie usage_sans_droit dans les deux cas. — **Vérifié.**

## PRV — Preuves et factures

### PRV-01 — Une preuve de chaque type du référentiel
- **En base** : 11 preuves REC, une par type (capture écran portail,
  attestation éditeur, contrat signé scanné, bon de commande, bon de livraison,
  certificat, clefs de licence, contrat et annexes, facture, autre, certificat
  d'authenticité), rattachées à des contrats, commandes ou licences, en mode
  « référence » ou « URL » (aucun fichier physique à déployer).
- **Attendu** : chaque type apparaît une fois ; GET /preuves ne sert que les
  preuves libres (la preuve support de la facture n'y est pas). — **Vérifié.**

### PRV-02 — Preuve externe
- **En base** : « REC Preuve externe portail éditeur », mode URL
  (https://portail-editeur.exemple/REC/licences).
- **Attendu** : la preuve affiche son lien externe, pas de téléchargement.
  — **Vérifié.**

### PRV-03 — Certificat rattaché à une licence : voir LIC-19. — **Vérifié.**

### PRV-04 — Montant de facture : visible / masqué
- **Attendu** : montant 1 234,56 € visible pour financier.recette (et tout
  porteur de consulter_kpi_financiers) ; **null + montants_masques = true**
  pour financier.retire.recette et saisie.recette — jamais « 0 ». — **Vérifié.**

## BUD — Budget (exercice fiscal : année civile, défaut du tenant)

### BUD-01 — Seuil budgétaire franchi (Filiale Sud)
- **En base** : alloué 10 000 € (exercice courant) sur la licence de la
  commande Sud ; engagé 9 500 € (commande J-5).
- **Écran** : Budget (sélecteur société = REC Filiale Sud) ; Notifications.
- **Attendu** : taux d'engagement **95 %** ; notification budget_seuil
  (NTF-06) : Financier et Manager DSI destinataires, gravité orange
  (< 100 %). — **Vérifié.**

### BUD-02 — Prévisionnel saisi ≠ calculé (D43)
- **En base** : ligne prévisionnelle SAISIE 2 500 € sur l'exercice suivant pour
  la licence LIC-07 (maintenance en cours 2 000 €/an).
- **Écran** : Budget > préremplissage de la licence LIC-07.
- **Attendu** : la proposition calculée vaut **2 070 €** (2 000 × 1,035,
  exercice cible = courant + 1) ; la ligne saisie de 2 500 € est affichée dans
  « lignes existantes » et c'est **elle** qui compte dans la synthèse
  prévisionnelle ; le calculé reste une proposition. — **Vérifié.**

### BUD-03 — Ligne sur l'exercice précédent
- **En base** : alloué 8 000 € Filiale Sud, daté de l'exercice précédent.
- **Attendu** : invisible sur l'exercice courant ; le sélecteur de période sur
  l'exercice précédent affiche l'alloué 8 000 € (engagé 0, taux 0).
  — **Vérifié.**

### BUD-04 — Juste sous le seuil (Filiale Nord)
- **En base** : alloué 23 200 € (exercice courant) ; engagé = somme des
  commandes Nord de l'exercice (20 634,56 €).
- **Attendu** : taux **88,94 %**, sous le seuil de 90 : **aucune** notification
  budget pour la Filiale Nord. — **Vérifié.**

### BUD-05 — Écart valorisé rapporté au parc (D54)
- **Écran** : Conformité (agrégats) / dashboards financiers.
- **Attendu** (montants pour un porteur de consulter_kpi_financiers) :
  valorisation du parc **85 500 €**, écart valorisé négatif **-13 200 €** soit
  **-15,44 %** du parc ; écart positif +38 200 € (44,68 %), total +25 000 €
  (29,24 %). Pour IT Ops : tous ces montants à null. — **Vérifié.**

### BUD-06 — Payeuse toujours dérivée : voir SOC-02. — **Vérifié.**

## SEU — Seuils

### SEU-01 — Seuil personnalisé du tenant
- **En base** : seuil_dashboard conformite_taux échelle 1 = **85**,
  personnalise = true, valeurs_defaut mémorise le défaut Commune (90).
- **Écran** : Paramètres > seuils (GET /dashboards/seuils).
- **Attendu** : la ligne sort valeur 85, personnalisée, source « tenant » ; la
  lecture tenant fait foi sur le calcul (SEU-02) ; « rétablir » reviendrait
  à 90. — **Vérifié.**

### SEU-02 — Juste sous / juste sur le seuil de taux
- **En base** : « REC Logiciel Taux 84 » (50/42) et « REC Logiciel Taux 86 »
  (50/43).
- **Attendu** : 84 % → **conforme** (vert) ; 86 % → **attention** (orange) —
  preuve que le seuil appliqué est 85 (tenant) et non 90 (défaut Commune).
  — **Vérifié.**

### SEU-03 — Seuil en euros (écart valorisé, 10 000 €)
- **Attendu** : LIC-02 (-12 000 €) franchit le seuil : la notification de
  dépassement cite « seuil d'alerte 10 000 € » pour les porteurs des montants ;
  LIC-04 (-1 200 €) reste sous le seuil (dépassement par les quantités
  uniquement). — **Vérifié.**

### SEU-04 — Seuil budgétaire (90 %)
- **Attendu** : 95 % (Sud) déclenche, 88,94 % (Nord) ne déclenche pas — voir
  BUD-01/BUD-04. — **Vérifié.**

## NTF — Notifications (après POST /notifications/executer-planification)

BUG-1 corrigé le 06/10/2026 : la route exécute toutes les détections
(réponse 200, code 5506). NTF-04 à NTF-07 et NTF-13 revérifiés par la route
ce jour-là.

### NTF-01 — Échéance de contrat (palier 30)
- **Attendu** : 1 notification « REC Contrat échéance 15 jours », gravité
  orange, pour admin.recette, dsi.recette, dsi.en.recette ; **PAS** pour
  financier.recette, itops.recette, saisie.recette, **ni dsi.nord.recette**
  (contrat du Groupe Horizon, hors de son périmètre). — **Vérifié.**

### NTF-02 — Échéance de souscription (30 jours)
- **Attendu** : 1 notification « REC Logiciel Échéance 20 jours », jaune, pour
  admin, dsi, dsi.en **et dsi.nord** (Filiale Nord) ; Financier et IT Ops
  absents. — **Vérifié.**

### NTF-03 — Renouvelés dans la continuité : silence
- **Attendu** : aucune notification pour « REC Contrat renouvelé (ancien) »
  (successeur, D35) ni pour l'ancienne période de LIC-12 (échue, renouvelée).
  — **Vérifié.**

### NTF-04 — Contrat à faire suivre
- **Attendu** : 1 notification rouge « REC Contrat à faire suivre » (échu),
  Manager DSI + Admin SAM, dsi.nord inclus. — **Vérifié** (par la route le
  06/10/2026, correctif BUG-1).

### NTF-05 — Dépassements de conformité
- **Attendu** : 3 notifications rouges (REC Logiciel Dépassement 5-7, REC
  Logiciel Souscription échue, REC Logiciel Droits nuls) pour Manager DSI,
  Admin SAM, IT Ops ; **Financier absent**. Message pour dsi.recette (porteur
  des montants) : « … Écart valorisé : 12 000 € (seuil d'alerte 10 000 €). » ;
  message pour itops.recette : quantités seules, **aucun montant**.
  — **Vérifié** (par la route le 06/10/2026, correctif BUG-1).

### NTF-06 — Seuil budgétaire
- **Attendu** : 1 notification orange « Budget 2026 de REC Filiale Sud engagé à
  95 % » pour financier.recette, financier.retire.recette, dsi.recette,
  dsi.en.recette, admin.recette ; dsi.nord et itops absents. Le message de
  financier.retire **ne porte pas** la phrase « Engagé : 9 500 € pour
  10 000 € alloués. » (montants masqués). — **Vérifié** (par la route le
  06/10/2026, correctif BUG-1).

### NTF-07 — Revalidation échue : voir AFF-06. — **Vérifié** (par la route le 06/10/2026, correctif BUG-1).

### NTF-08 — Validation en attente (action de recette)
- **Action** : connecté saisie.recette, créer une affectation (licence « REC
  Perpétuelle sans maintenance », Filiale Nord, quantité 1, référence
  REC-FLUX-01).
- **Attendu** : notification « Saisie à valider : REC-FLUX-01 » pour les
  porteurs de valider_saisie (admin, dsi, dsi.en — en anglais : « Entry to
  validate » —, dsi.nord), **jamais l'auteur** saisie.recette. — **Vérifié.**

### NTF-09 — Saisie refusée (action de recette)
- **Action** : connecté dsi.recette, refuser la saisie REC-FLUX-01 avec le
  motif « REC Refus de recette : justificatif manquant. ».
- **Attendu** : notification « Saisie refusée : REC-FLUX-01 » pour le seul
  auteur (saisie.recette), gravité orange, **courrier immédiat** ; le motif est
  dans la notification en application et sur la saisie, **jamais dans le
  courriel**. — **Vérifié.**

### NTF-10 — Préférence désactivée
- **En base** : itops.recette a désactivé le courrier des « Dépassements de
  conformité ».
- **Attendu** : il reçoit la notification en application, mais courrier_mode =
  desactive et courrier_statut = sans_objet (aucun courriel) ; dsi.recette, lui,
  est en courrier immédiat (a_envoyer / envoyé). — **Vérifié.**

### NTF-11 — Langue anglaise
- **Attendu** : toutes les notifications de dsi.en.recette sortent en anglais
  (p. ex. « Contract “REC Contrat échéance 15 jours” expiring in 15 days »,
  « Compliance overrun: … », « 2026 budget of REC Filiale Sud committed at
  95 % »). — **Vérifié** (92 clés traduites, module notifications, BDD
  Commune).

### NTF-12 — Confidentialité des courriers
- **Attendu** : aucun courriel (immédiat ou récapitulatif) ne porte montant,
  quantité, motif ni libellé de donnée métier : objet et message génériques du
  type + lien vers l'écran + mention des préférences. — **Vérifié** (courriers
  composés depuis les notifications réelles : conformes ; depuis le correctif
  BUG-3 du 06/10/2026 l'objet porte le nom du tenant : « SamSecure -
  REC Client Recette : … »).

### NTF-13 — Fin de maintenance
- **Attendu** : notification fin_maintenance (30 jours avant) pour Manager DSI,
  Admin SAM, IT Ops sur LIC-08 (dsi.nord inclus — Filiale Nord) ; continuité
  pour LIC-07 (période suivante) et LIC-09 (arrêt volontaire). — **Vérifié le
  06/10/2026 après correctif BUG-1** : 10 notifications créées par la route,
  gravité jaune, aucune sur LIC-07 ni LIC-09.

## CPL — Complétude : actions requises sur chaque fiche (US #324)

Bloc « Actions requises » en tête des fiches contrat, commande, licence et
affectation, servi par GET /api/completude/:type/:id (règles pures de
`server/utils/completude.js`, mêmes définitions que la détection des manques
et les signaux existants) ; GET /api/completude/resume alimente les compteurs.
Rédigé le 07/10/2026 : les faits en base sont vérifiés à la source du jeu
(01_jeu_recette.sql) et les règles au node:test (completude.test.js, scénario
du jeu rejoué à l'identique), mais **l'API dev répondait 3499 (« calcul des
droits impossible », migrations 092-094 du #249 à jouer) le jour de la
rédaction : repasser les cas CPL à l'écran après le jeu des migrations et la
mise en ligne de la branche.**

### CPL-01 — Commande sans facture ni preuve : les deux actions
- **En base** : « REC Commande prix 2 (dernière) » (45000000-…-0004) : montant
  600 €, une licence rattachée (REC Licence prix 2), aucune preuve, aucune
  facture.
- **Écran** : fiche de la commande (Contrats > Commandes).
- **Attendu** : bloc « Actions requises (2) » en tête de fiche, deux lignes
  **Recommandé audit** : « Aucune facture rattachée à la commande » avec le
  bouton **« Déposer une facture »**, « Aucune preuve rattachée à la
  commande » avec le bouton **« Rattacher une preuve »**. Aucune ligne
  bloquante (montant et licence présents). — Règles vérifiées au node:test
  sur ces faits exacts ; écran à vérifier après mise en ligne.

### CPL-02 — Les boutons ouvrent la bonne modale, pré-remplie
- **Écran** : même fiche, clic sur chaque bouton.
- **Attendu** : « Déposer une facture » ouvre la modale de dépôt unifiée,
  rattachement Commande pré-rempli sur la commande et type **Facture**
  pré-sélectionné (circuit POST /factures/depot, montant et date exigés) ;
  « Rattacher une preuve » ouvre la même modale sur le premier type proposé
  (Bon de commande). Après dépôt, le bloc se recharge sans rechargement de la
  page : la ligne levée disparaît ; après la facture (qui crée aussi sa preuve
  support), le bloc disparaît entièrement.

### CPL-03 — Les alertes de la page Preuves ouvrent la fiche, action surlignée
- **Écran** : Droits d'usage > Preuves, section « Détection des manques ».
- **Attendu** : les compteurs (tuile « Manques détectés », « X sans facture,
  Y sans preuve ») lisent le résumé de complétude et valent exactement les
  totaux de la détection (mêmes règles : 8 sans facture, 6 sans preuve sur le
  jeu au 06/10). Le clic sur un badge « Sans facture » ouvre la fiche de la
  commande avec `?action=deposer_facture` : la ligne correspondante du bloc
  est surlignée et défilée en vue, sans ouverture automatique de la modale.

### CPL-04 — Fiches licence, contrat, affectation
- **En base** : « REC Licence sans preuve ni affectation » si présente, sinon
  toute licence du jeu sans affectation ; « REC Contrat à suivre (ancienne) »
  côté commande ; une affectation en attente (AFF) et une refusée.
- **Attendu** :
  - licence sans affectation : ligne bloquante « Aucun usage déclaré sur cette
    licence », bouton « Déclarer une affectation » (modale pré-remplie sur la
    licence) ;
  - contrat échu sans successeur : ligne bloquante « Échéance passée le … sans
    renouvellement » (le renouvelé dans la continuité, CTR-04, n'affiche
    rien) ;
  - affectation en attente : ligne bloquante « En attente de validation :
    cet usage n'est pas compté dans la balance », sans bouton (Valider et
    Refuser sont en tête de fiche) ; affectation refusée : « Saisie refusée
    sans correction : <motif> », bouton « Corriger la saisie » (modale
    d'édition) ;
  - une fiche complète n'affiche aucun bloc.

### CPL-05 — Résumé pour les compteurs
- **Appel** : GET /api/completude/resume (admin.recette).
- **Attendu** : réponse 5551 avec `types.commande.par_regle.
  commande_sans_facture` = total « sans facture » de GET /commandes/manques et
  `commande_sans_preuve` = total « sans preuve » (mêmes règles partout) ;
  compteurs licence/contrat/affectation/logiciel cohérents avec les cas LIC,
  CTR, AFF et LOG du jeu (notamment usage sans droit D53 et le composé #216).
