# Scénarios de recette par profil

Feuille de route de tests de SamSecure : parcours utilisateurs de bout en bout,
par profil, rédigés depuis les user stories livrées et vérifiés contre
l'application telle qu'elle fonctionne aujourd'hui. Version 1, du 09/10/2026,
à revoir en atelier avec Samuel et Vincent.

## 1. Objet et usage

Ce document est la source unique des parcours de recette. Il sert :

1. **À la recette** : chaque scénario se rejoue sur staging avec le jeu de
   données de recette, après chaque livraison, comme test de non-régression.
2. **À la supervision** : en production, un scénario rejoué doit aller au bout
   et sa durée se compare à la durée de référence indiquée. Les modalités de
   la supervision (compte dédié, données neutres) seront précisées en atelier.
3. **À l'automatisation** : chaque étape est une action observable dans un
   navigateur, avec un résultat vérifiable. Les scénarios pourront être
   automatisés tels quels, sans réécriture du fond.

La validation de ce document en atelier vaut aussi vérification partagée de
notre lecture des parcours.

## 2. Préparation de la campagne

### Environnement et données

- Environnement cible : staging (`https://staging-samsecure.nayrod.fr`).
- Les migrations de base doivent être à jour (jusqu'à la 109 incluse) et
  l'API redémarrée après leur passage.
- Le jeu de recette est rejoué avant chaque campagne : scripts
  `server/bdd/recette/00_reset_tenant.sql` puis `01_jeu_recette.sql`, selon la
  procédure décrite dans `server/docs/attendus_recette.md` (section « Mise en
  place »). Le reset remet le jeu à l'état initial : les objets créés par une
  campagne précédente disparaissent.
- Les dates du jeu sont relatives au jour du chargement : jouer la campagne
  le jour même du chargement du jeu.
- Le traitement planifié des notifications doit être passé avant les
  scénarios qui lisent la cloche (passage automatique de 7 h, ou
  déclenchement manuel décrit dans les attendus de recette).

### Comptes de recette

Mot de passe commun : `Recette#2026`.

| Compte | Profil et particularité |
|---|---|
| admin.recette@samsecure.test | Admin SAM, portée tenant |
| dsi.recette@samsecure.test | Manager DSI, portée tenant |
| financier.recette@samsecure.test | Financier, portée tenant |
| itops.recette@samsecure.test | IT Ops, courrier des dépassements désactivé |
| saisie.recette@samsecure.test | Saisie (IT Data input) |
| dsi.en.recette@samsecure.test | Manager DSI, langue anglaise |
| cumul.recette@samsecure.test | Saisie + profil ajouté « REC Groupe lecture transverse » |
| financier.retire.recette@samsecure.test | Financier privé des montants (exception « retire ») |
| saisie.accorde.recette@samsecure.test | Saisie + lecture des licences (exception « accorde ») |
| dsi.nord.recette@samsecure.test | Manager DSI rattaché à la seule REC Filiale Nord |

### Conventions

- Identifiants stables : SC-ADM (admin_sam), SC-DSI (Manager DSI), SC-FIN
  (Financier), SC-OPS (IT Ops), SC-SAI (Saisie), SC-TRA (transverse).
- Chaque étape nomme l'écran, l'action, puis le résultat attendu, vérifiable
  immédiatement.
- Les objets créés pendant la campagne portent le préfixe « REC TEST », pour
  les distinguer des objets « REC » du jeu de recette.
- Les durées de référence valent pour un passage manuel attentif ; elles
  serviront de base de comparaison en supervision.
- Les menus Rapports et la recherche globale fonctionnent encore sur des
  données de démonstration : ils sont hors campagne.

### Ordre de passage et dépendances

L'ordre recommandé est celui du document : SC-ADM, puis SC-DSI, SC-FIN,
SC-OPS, SC-SAI, SC-TRA. Dépendances explicites :

- SC-ADM-03 crée le compte « REC TEST Testeur Un », utilisé ensuite par
  SC-ADM-04, SC-TRA-02 et SC-TRA-04.
- SC-ADM-04 crée le profil « REC TEST Profil pilote », utilisé par SC-TRA-04.
- SC-DSI-10 (validation) modifie des balances : il se joue après SC-DSI-09
  (conformité).
- SC-SAI-03 enchaîne volontairement deux comptes (saisie puis valideur) : le
  circuit de validation est un parcours à deux acteurs.

Durée totale de référence de la campagne complète : environ 5 h 30.

---

## 3. Scénarios admin_sam

### SC-ADM-01 : connexion et dashboards de l'administrateur

- **Objectif** : vérifier la connexion, l'accès aux trois dashboards et leur
  alimentation en données réelles.
- **Stories couvertes** : #73, #190.
- **Préconditions** : compte admin.recette, jeu de recette chargé,
  traitement des notifications passé.
- **Étapes** :
  1. Page de connexion : saisir admin.recette@samsecure.test et le mot de
     passe, valider. Attendu : arrivée sur le Dashboard, nom et adresse du
     compte visibles en bas de la barre latérale.
  2. Dashboard : observer l'en-tête. Attendu : un sélecteur propose les trois
     tableaux de bord (Manager DSI, Financier, IT Ops) ; Manager DSI est
     affiché par défaut.
  3. Dashboard Manager DSI : parcourir les widgets. Attendu : données réelles
     du jeu (aucun écran vide ni donnée de démonstration) ; le widget des
     validations en attente affiche 1 (l'affectation « REC Usage en attente
     de validation »).
  4. Basculer sur le dashboard Financier puis IT Ops. Attendu : chaque bascule
     change la composition des widgets ; les montants sont visibles sur les
     trois (l'administrateur porte les droits financiers).
  5. Sur un widget qui la fournit, vérifier l'étiquette de fraîcheur des
     données. Attendu : une date ou heure de dernière mise à jour est affichée.
  6. Cliquer « Personnaliser », masquer un widget, cliquer « Terminé », puis
     recharger la page. Attendu : le widget reste masqué (préférence
     enregistrée) ; le réafficher ensuite à l'identique.
- **Durée de référence** : 5 minutes.

### SC-ADM-02 : sociétés, hiérarchie et cycle de vie

- **Objectif** : vérifier la hiérarchie des sociétés, la terminologie,
  l'archivage réversible et la règle de suppression.
- **Stories couvertes** : #62, #207, #281.
- **Préconditions** : compte admin.recette ; renommage « archivage » des
  sociétés en ligne (migration 109 jouée).
- **Étapes** :
  1. Administration > Organisation. Attendu : trois sociétés du jeu listées ;
     REC Filiale Nord et REC Filiale Sud rattachées à REC Groupe Horizon
     (mère) ; le mot « société » est employé partout (le titre de section
     « Organisation » est la seule exception admise) ; une case « Afficher
     les archivées » est proposée, décochée par défaut.
  2. Créer une société « REC TEST Société témoin », sans rattachement.
     Attendu : création confirmée, société listée active.
  3. Ouvrir sa fiche, cliquer « Archiver ». Attendu : badge « Archivée » et
     mention « Archivée depuis le » avec la date du jour ; la société
     disparaît de la liste par défaut et réapparaît en cochant « Afficher les
     archivées ».
  4. Cliquer « Restaurer ». Attendu : la société redevient active et revient
     dans la liste par défaut.
  5. Sur la même fiche, cliquer « Supprimer » et confirmer. Attendu : la
     suppression passe (société vide) ; elle disparaît de la liste.
  6. Ouvrir la fiche de REC Filiale Nord. Attendu : les compteurs de
     rattachements (utilisateurs, contrats, commandes, licences) sont servis ;
     le bouton « Supprimer » n'est pas proposé tant que des objets s'y
     raccrochent, et le message de refus rappelle que l'archivage reste
     possible ; « Archiver » reste proposé.
  7. Administration > Utilisateurs > onglet Journal : rechercher les traces
     du scénario. Attendu : l'archivage, la restauration et la suppression de
     « REC TEST Société témoin » figurent au journal avec l'acteur et
     l'horodatage.
- **Durée de référence** : 8 minutes.

### SC-ADM-03 : utilisateurs, mots de passe, historique, actions groupées

- **Objectif** : vérifier le cycle de vie d'un compte : création, profils,
  mot de passe, historique, filtres et actions groupées, absence de
  suppression.
- **Stories couvertes** : #14, #62, #78, #247.
- **Préconditions** : compte admin.recette.
- **Étapes** :
  1. Administration > Utilisateurs, onglet Utilisateurs. Attendu : les dix
     comptes de recette sont listés avec leurs profils.
  2. Créer l'utilisateur « REC TEST Testeur Un » (prénom Testeur, nom Un,
     adresse testeur.un.recette@samsecure.test), profil Saisie, rattaché à
     REC Filiale Nord. Attendu : compte créé, visible dans la liste.
  3. Sur sa fiche, ouvrir la gestion du mot de passe et saisir « abc ».
     Attendu : les règles non respectées s'affichent en direct (12 caractères
     minimum, majuscule, minuscule, chiffre, caractère spécial) ; la
     validation est refusée.
  4. Cliquer « Générer ». Attendu : un mot de passe conforme s'affiche une
     seule fois, copiable ; il n'est plus réaffichable ensuite.
  5. Saisir manuellement « Recette#2026-T1 » et valider. Attendu : mot de
     passe accepté (il sert à SC-TRA-02).
  6. Déclencher l'envoi du mail de réinitialisation. Attendu : l'action est
     confirmée à l'écran et tracée dans l'historique du compte ; la réception
     du courriel relève du volet courriel (voir « Écarts constatés »).
  7. Consulter la section d'historique du compte. Attendu : les événements
     sont listés du plus récent au plus ancien, horodatés, avec l'acteur :
     création du compte, mots de passe définis, mail de réinitialisation
     envoyé ; aucun mot de passe n'apparaît ; la profondeur de six mois est
     mentionnée.
  8. Vérifier l'absence de toute action de suppression d'un compte. Attendu :
     seule la désactivation est proposée (immédiate ou planifiée).
  9. Dans la liste, filtrer par date de création « aujourd'hui ». Attendu :
     REC TEST Testeur Un ressort.
  10. Cocher ce compte, puis utiliser l'export CSV de la sélection. Attendu :
      un fichier CSV des lignes cochées est téléchargé.
  11. Cocher son propre compte (admin.recette) et tenter la désactivation
      groupée. Attendu : l'auto-désactivation est refusée avec un message
      explicite.
  12. Désactiver REC TEST Testeur Un par l'action groupée, puis le réactiver
      depuis sa fiche. Attendu : chaque changement d'état est visible dans la
      liste et tracé dans l'historique du compte.
- **Durée de référence** : 12 minutes.

### SC-ADM-04 : profils par défaut et profils ajoutés

- **Objectif** : vérifier que tout est profil : profils par défaut
  inaltérables, création et configuration d'un profil ajouté, matrice par
  défaut et par société, attribution.
- **Stories couvertes** : #205, #206, #249, #269, #276.
- **Préconditions** : compte admin.recette ; SC-ADM-03 joué (compte REC TEST
  Testeur Un).
- **Étapes** :
  1. Administration > Utilisateurs, onglet Profils. Attendu : les profils par
     défaut (Manager DSI, Financier, IT Ops, IT Data input) portent le badge
     « Par défaut », sans bouton de suppression ni de renommage ; le profil
     admin_sam est affiché sans action de modification ; le mot « groupe »
     n'apparaît nulle part dans l'onglet.
  2. Vérifier que « REC Groupe lecture transverse » (ancien groupe du jeu)
     est listé comme profil ajouté, avec ses deux permissions (lecture des
     licences et du budget).
  3. Créer un profil « REC TEST Profil pilote », dashboard de référence
     « Manager DSI ». Attendu : profil créé, listé comme profil ajouté ; sa
     matrice porte déjà la permission du dashboard de référence.
  4. Ouvrir sa matrice par défaut et cocher successivement : consulter les
     contrats, consulter les licences, consulter le journal d'audit, gérer
     les connecteurs. Attendu : chaque coche est prise sans erreur (y compris
     les deux droits d'administration, historiquement en erreur 500) ; la
     position de défilement de la page ne remonte pas entre deux coches.
  5. Décocher « consulter le journal d'audit » et « gérer les connecteurs »,
     enregistrer. Attendu : la matrice enregistrée vaut exactement l'état
     coché (remplacement complet), relue à l'identique après rechargement.
  6. Administration > Organisation > fiche REC Filiale Nord, onglet Profils :
     configurer la matrice de « REC TEST Profil pilote » pour cette société
     (retirer la lecture des licences, enregistrer). Attendu : la société est
     marquée configurée pour ce profil ; la matrice par défaut reste
     inchangée.
  7. Fiche de REC TEST Testeur Un, section Profils : ajouter « REC TEST
     Profil pilote » aux profils du compte, enregistrer. Attendu : le compte
     porte deux profils (Saisie et REC TEST Profil pilote) ; aucun choix de
     « sociétés de diffusion » n'est demandé sur le profil (la portée des
     données suit le rattachement du compte).
- **Durée de référence** : 12 minutes.

### SC-ADM-05 : exceptions de droit

- **Objectif** : vérifier les exceptions individuelles : retrait prioritaire,
  ajout borné, effet immédiat.
- **Stories couvertes** : #249 (modèle des droits : exceptions).
- **Préconditions** : compte admin.recette ; jeu de recette chargé.
- **Étapes** :
  1. Administration > Utilisateurs, onglet Exceptions. Attendu : les deux
     exceptions du jeu sont listées : retrait des montants financiers pour
     financier.retire.recette, lecture des licences accordée à
     saisie.accorde.recette, avec leurs motifs « REC Recette : ... ».
  2. Se connecter dans une fenêtre privée avec financier.retire.recette.
     Ouvrir Droits d'usage > Preuves et la facture « REC Facture commande
     Nord ». Attendu : le montant n'est pas affiché (masqué), alors que le
     compte est Financier : le retrait prime sur le profil.
  3. Toujours avec ce compte, ouvrir le Dashboard. Attendu : les widgets
     financiers n'affichent aucun montant.
  4. Revenir sur admin.recette : créer une exception « retire » sur la
     permission de consulter les contrats pour REC TEST Testeur Un, portée
     tenant, motif « REC TEST Vérification du retrait ». Attendu : exception
     créée et listée.
  5. Supprimer cette exception de test. Attendu : la liste revient à l'état
     initial (les deux exceptions du jeu).
- **Durée de référence** : 8 minutes.

### SC-ADM-06 : seuils du tenant

- **Objectif** : vérifier la personnalisation des seuils de dashboard et le
  retour à la valeur par défaut.
- **Stories couvertes** : #262.
- **Préconditions** : compte admin.recette ; le jeu pose le seuil de taux de
  conformité (échelle 1) à 85, personnalisé (défaut commun : 90). Ne pas
  toucher ce seuil : il conditionne les scénarios de conformité.
- **Étapes** :
  1. Administration > Paramètres, onglet Configuration, bloc « Seuils
     dashboard ». Attendu : les seuils sont groupés par widget et par
     échelle ; le seuil de taux de conformité (échelle 1) vaut 85 avec le
     badge « Personnalisé » ; la valeur par défaut (90) est rappelée sous le
     champ.
  2. Modifier un autre seuil (par exemple l'échelle 2 du même widget) et
     enregistrer. Attendu : la valeur est enregistrée et le badge
     « Personnalisé » apparaît sur ce seuil.
  3. Rétablir ce seuil (action de rétablissement du widget, avec
     confirmation). Attendu : la valeur par défaut revient exactement ; le
     badge « Personnalisé » disparaît ; le seuil de l'étape 1 reste à 85.
  4. Onglet Informations client. Attendu : l'onglet s'affiche ; ses données
     sont encore fictives (limite connue, hors campagne).
- **Durée de référence** : 7 minutes.

### SC-ADM-07 : journal d'audit

- **Objectif** : vérifier que les actions de la campagne et du jeu sont
  tracées et consultables.
- **Stories couvertes** : #62 (conservation à des fins d'audit), #281 (traces
  du cycle de vie des sociétés).
- **Préconditions** : compte admin.recette ; SC-ADM-02 et SC-ADM-03 joués.
- **Étapes** :
  1. Administration > Utilisateurs, onglet Journal. Attendu : le journal
     s'affiche, du plus récent au plus ancien, avec acteur, action, entité et
     horodatage.
  2. Rechercher les traces des scénarios précédents. Attendu : création,
     archivage, restauration et suppression de « REC TEST Société témoin »,
     création de « REC TEST Testeur Un », définitions de mot de passe (sans
     aucune valeur de mot de passe), attribution de profils.
  3. Rechercher la trace « PROLONGATION » du jeu (licence « REC Souscription
     prolongée »). Attendu : l'écriture du jeu est présente avec la date de
     fin avant et après.
- **Durée de référence** : 5 minutes.

### SC-ADM-08 : centre de notifications

- **Objectif** : vérifier la cloche, le contenu des notifications issues du
  traitement planifié, leurs destinataires et le marquage lu.
- **Stories couvertes** : #121, #194, #261, #270.
- **Préconditions** : compte admin.recette ; traitement planifié passé après
  le chargement du jeu.
- **Étapes** :
  1. Cliquer la cloche en haut de l'écran. Attendu : le panneau s'ouvre avec
     deux onglets, « Non lues » et « Toutes » ; le compteur de non lues est
     cohérent avec la liste.
  2. Vérifier la présence des notifications du jeu pour l'administrateur :
     échéance du contrat « REC Contrat échéance 15 jours » (orange) ;
     échéance de la souscription « REC Logiciel Échéance 20 jours » (jaune) ;
     « REC Contrat à faire suivre » (rouge) ; trois dépassements de
     conformité (rouges : REC Logiciel Dépassement 5-7, REC Logiciel
     Souscription échue, REC Logiciel Droits nuls) ; seuil budgétaire de REC
     Filiale Sud engagé à 95 % (orange) ; revalidation échue ; fin de
     maintenance sur la licence « REC Perpétuelle maintenance fin 20 jours ».
  3. Vérifier les silences attendus : aucune notification pour « REC Contrat
     renouvelé (ancien) » ni pour l'ancienne période de « REC Souscription
     renouvelée » (renouvellements dans la continuité) ; aucune pour les
     maintenances poursuivie (« REC Perpétuelle maintenance continue ») ou
     arrêtée (« REC Perpétuelle maintenance arrêtée »).
  4. Cliquer la notification de dépassement « REC Logiciel Dépassement 5-7 ».
     Attendu : l'écran concerné s'ouvre, filtré sur l'objet ; de retour dans
     le panneau, la notification est marquée lue.
  5. Cliquer « Tout marquer comme lu ». Attendu : le compteur de la cloche
     tombe à zéro ; l'onglet « Toutes » conserve l'historique.
- **Durée de référence** : 10 minutes.

### SC-ADM-09 : délégation des droits d'administration

- **Objectif** : vérifier qu'un profil ajouté peut porter la gestion des
  utilisateurs, et que le délégataire n'attribue que ce qu'il détient.
- **Stories couvertes** : #278.
- **Préconditions** : compte admin.recette.
- **Étapes** :
  1. Onglet Profils : créer le profil « REC TEST Délégué », sans dashboard de
     référence. Dans sa matrice, cocher la gestion des utilisateurs et la
     consultation des contrats, enregistrer. Attendu : les permissions
     d'administration (gérer les utilisateurs, gérer les profils) sont bien
     proposées dans la matrice d'un profil ajouté ; l'enregistrement passe.
  2. Onglet Utilisateurs : créer le compte « REC TEST Porteur Délégué »
     (porteur.delegue.recette@samsecure.test), portée tenant, profil
     « REC TEST Délégué », mot de passe « Recette#2026-D1 ». Attendu : compte
     créé.
  3. Se connecter avec ce compte dans une fenêtre privée. Attendu : la
     section Administration de la barre latérale propose « Utilisateurs »
     (onglet Utilisateurs seul : pas d'onglet Profils, Exceptions ni Journal)
     et « Paramètres » (la gestion des utilisateurs emporte l'accès aux
     paramètres du tenant dans cette version, voir « Écarts constatés ») ;
     le Dashboard affiche « Aucun dashboard n'est accessible avec vos droits
     actuels. ».
  4. Avec ce compte, créer l'utilisateur « REC TEST Compte délégué »
     (compte.delegue.recette@samsecure.test) et lui attribuer le profil
     « REC TEST Délégué ». Attendu : création et attribution acceptées (le
     délégataire détient les droits de ce profil).
  5. Tenter d'attribuer en plus le profil « Financier » à ce même compte.
     Attendu : refus avec un message explicite : on ne peut attribuer que des
     droits que l'on détient soi-même.
  6. Tenter de modifier les profils du compte admin.recette. Attendu : refus
     avec un message explicite : seuls les titulaires admin_sam modifient
     admin_sam et ses titulaires.
  7. Revenir sur admin.recette, onglet Journal. Attendu : les actions du
     délégataire (création de compte, attribution) sont tracées avec lui pour
     acteur.
- **Durée de référence** : 12 minutes.

---

## 4. Scénarios Manager DSI

### SC-DSI-01 : dashboard Manager DSI

- **Objectif** : vérifier le dashboard unique du profil et ses données
  réelles.
- **Stories couvertes** : #73, #190.
- **Préconditions** : compte dsi.recette, traitement des notifications passé.
- **Étapes** :
  1. Se connecter avec dsi.recette. Attendu : arrivée sur le dashboard
     Manager DSI ; aucun sélecteur de tableau de bord (un seul profil
     porteur).
  2. Parcourir les widgets. Attendu : validations en attente = 1 ;
     revalidations en retard présentes (l'usage « REC Usage à revalider
     (échu) ») ; l'écart usages-droits et l'indice de conformité reflètent le
     jeu ; les montants sont visibles (le profil porte les indicateurs
     financiers).
  3. Vérifier le widget de qualité des saisies. Attendu : les anomalies
     « usage sans droit » du jeu (souscription échue, licence à droits nuls)
     sont comptées.
  4. Vérifier l'étiquette de fraîcheur sur un widget qui la fournit.
     Attendu : une date ou heure de dernière mise à jour est affichée.
- **Durée de référence** : 5 minutes.

### SC-DSI-02 : référentiels, éditeurs, revendeurs, contacts, logiciels

- **Objectif** : vérifier la gestion des référentiels : suggestion
  anti-doublon, création locale, compléments de catalogue, circuit de
  validation des créations.
- **Stories couvertes** : #173, #177, #181, #185, #221, #263 (création du
  logiciel client).
- **Préconditions** : compte dsi.recette.
- **Étapes** :
  1. Référentiels > Éditeurs. Attendu : la liste mêle le catalogue commun et
     les éditeurs du client (dont « REC Éditions Soleil » et « REC Logiciels
     Lune »), sans donnée de démonstration.
  2. Cliquer « Nouvel éditeur » et taper « REC Édi » dans le nom. Attendu :
     à chaque caractère, les éditeurs existants proches sont proposés (REC
     Éditions Soleil ressort).
  3. Poursuivre avec le nom exact « REC Éditions Soleil » et valider.
     Attendu : l'existant est proposé avant de confirmer ; abandonner la
     création.
  4. Créer l'éditeur « REC TEST Éditeur campagne ». Attendu : création
     acceptée ; l'éditeur porte un statut de validation « En attente »
     (circuit de validation des saisies).
  5. Référentiels > Revendeurs : créer « REC TEST Revendeur campagne » avec
     le SIRET du revendeur « REC Revendeur Central » (lisible sur sa fiche).
     Attendu : le doublon de SIRET déclenche la proposition de l'existant ;
     corriger avec un SIRET distinct, la création passe.
  6. Référentiels > Contacts : créer un contact « REC TEST Contact campagne »
     avec une fonction du référentiel (DSI, DAF, acheteur ou responsable
     technique), rattaché à « REC Éditions Soleil ». Attendu : suggestion sur
     le nom et l'adresse pendant la saisie ; création acceptée et rattachement
     affiché.
  7. Référentiels > Logiciels : vérifier « Adobe Photoshop » (catalogue
     commun) et « REC Logiciel RH interne » (création client, éditeur REC
     Éditions Soleil), chacun avec sa provenance. Attendu : les deux
     cohabitent dans la liste.
  8. Créer le logiciel « REC TEST Logiciel campagne », rattaché à « REC TEST
     Éditeur campagne ». Attendu : création acceptée, statut « En attente ».
  9. Ouvrir la fiche d'« Adobe Photoshop » et ajouter une version « REC TEST
     v9 » depuis la fiche. Attendu : l'ajout passe sans passer par une
     licence ; la version apparaît dans les listes du logiciel (compléments
     du client fusionnés au catalogue).
- **Durée de référence** : 12 minutes.

### SC-DSI-03 : logiciel composé et composition par édition

- **Objectif** : vérifier la règle de couverture du composé et la composition
  différente selon l'édition.
- **Stories couvertes** : #222, #279.
- **Préconditions** : compte dsi.recette ; migrations 100, 101 et 104 jouées
  et API redémarrée (prérequis de la composition par édition).
- **Étapes** :
  1. Référentiels > Logiciels, fiche « REC Suite Bureau (composé) ».
     Attendu : la composition liste « REC Compo Texte (composant) » et
     « REC Compo Tableur (composant) ».
  2. Droits d'usage > Licences : lire la balance du jeu. Attendu : REC Compo
     Texte affiche 12 droits au total (2 propres + 10 hérités du composé),
     5 usages, taux 41,67 %, conforme, écart valorisé 0 ; le composé affiche
     10 droits propres et 1 usage ; REC Compo Tableur n'a aucune ligne de
     conformité (pas de licence propre).
  3. Mettre en place le cas par édition : créer chez un même éditeur les
     logiciels « REC TEST Suite Pack », « REC TEST Pack Texte », « REC TEST
     Pack Base » ; ajouter à REC TEST Suite Pack les éditions « REC TEST
     Standard » et « REC TEST Pro » ; composer REC TEST Suite Pack de REC
     TEST Pack Texte et REC TEST Pack Base. Attendu : chaque étape est
     acceptée ; la fiche du composé affiche la grille « Composition par
     édition », toutes cases cochées.
  4. Dans la grille, décocher la case REC TEST Pack Base pour l'édition REC
     TEST Standard, enregistrer. Attendu : la grille relue montre la seule
     case décochée ; la fiche de REC TEST Pack Base indique qu'il fait partie
     du composé hors édition Standard.
  5. Créer les licences : REC TEST Suite Pack édition Standard, quantité 5 ;
     REC TEST Suite Pack édition Pro, quantité 3 ; REC TEST Pack Texte,
     quantité 1 ; REC TEST Pack Base, quantité 1. Déclarer 4 affectations sur
     REC TEST Pack Base et les valider au fil de la saisie. Attendu :
     créations acceptées.
  6. Droits d'usage > Licences : lire la balance des nouveaux logiciels.
     Attendu : REC TEST Pack Base : 4 droits (1 propre + 3 hérités de la
     seule édition Pro), 4 usages, taux 100 %, statut attention ; REC TEST
     Pack Texte : 9 droits (1 propre + 8 hérités des deux éditions).
  7. Recocher la case Base x Standard dans la grille, enregistrer. Attendu :
     REC TEST Pack Base repasse à 9 droits, recalcul immédiat.
  8. Revenir sur « REC Suite Bureau (composé) » (sans exception). Attendu :
     sa balance est inchangée (un composé sans exception se comporte comme
     avant).
- **Durée de référence** : 15 minutes.

### SC-DSI-04 : contrats de bout en bout

- **Objectif** : vérifier la liste, la hiérarchie, les types, les échéances,
  la société signataire partout et les actions requises d'un contrat.
- **Stories couvertes** : #16, #70, #203, #223, #267, #324 (volet contrat).
- **Préconditions** : compte dsi.recette.
- **Étapes** :
  1. Droits d'usage > Contrat. Attendu : double vue disponible (arborescence
     et tableau) ; l'arborescence montre « REC Contrat applicatif Nord » sous
     « REC Contrat cadre groupe » ; les quatre tuiles KPI (actifs, échéance
     sous 90 jours, à renouveler, cadres) filtrent la liste au clic.
  2. Vérifier les libellés. Attendu : chaque contrat s'affiche « Libellé
     (Société) », par exemple « REC Contrat applicatif Nord (REC Filiale
     Nord) », dans la liste, la hiérarchie et les sélecteurs.
  3. Vérifier les statuts d'échéance du jeu. Attendu : « REC Contrat échéance
     15 jours » est marqué à renouveler ; « REC Contrat à faire suivre » est
     expiré ; un contrat sans date de fin est perpétuel.
  4. Ouvrir « REC Contrat interne Sud ». Attendu : type « Interne »,
     signataire REC Filiale Sud, société prêteuse REC Groupe Horizon, aucun
     revendeur ; le type « Standard » (et non « Simple ») est utilisé pour
     les contrats standards du jeu.
  5. Ouvrir « REC Contrat à faire suivre ». Attendu : bandeau « contrat à
     suivre » (licences renouvelées sur un contrat échu) ; le bloc « Actions
     requises » signale l'échéance passée sans renouvellement ; rien n'a été
     modifié automatiquement.
  6. Ouvrir « REC Contrat renouvelé (ancien) ». Attendu : aucun bandeau ni
     action requise d'échéance : il est renouvelé dans la continuité par
     « REC Contrat renouvelé (nouveau) ».
  7. Créer le contrat « REC TEST Contrat campagne », type Standard,
     signataire REC Filiale Nord, rattaché au parent « REC Contrat cadre
     groupe », dates du jour à un an. Attendu : création acceptée, statut de
     validation « En attente » ; le contrat apparaît sous le cadre dans
     l'arborescence.
  8. Modifier ce contrat (ouvrir le formulaire d'édition). Attendu : tous les
     champs sont préremplis, dates de début et de fin comprises ; enregistrer
     sans changement.
  9. Tenter de rattacher « REC TEST Contrat campagne » comme parent de « REC
     Contrat cadre groupe ». Attendu : le cycle de parenté est refusé avec un
     message explicite.
  10. Supprimer « REC TEST Contrat campagne » puis le recréer à l'identique
      pour la suite de la campagne. Attendu : la suppression d'un contrat
      jamais validé passe ; un contrat porteur de commandes (par exemple
      « REC Contrat applicatif Nord ») ne propose pas la suppression mais
      l'archivage.
- **Durée de référence** : 12 minutes.

### SC-DSI-05 : commandes, montants et période

- **Objectif** : vérifier la saisie d'une commande, ses contrôles, le
  sélecteur de période et la règle du dernier prix.
- **Stories couvertes** : #17, #164 (volet commandes).
- **Préconditions** : compte dsi.recette ; SC-DSI-04 joué (contrat REC TEST
  Contrat campagne).
- **Étapes** :
  1. Droits d'usage > Commandes. Attendu : liste du jeu servie, graphe des
     agrégats visible (le profil porte les indicateurs financiers), sélecteur
     de période présent.
  2. Déplacer le sélecteur de période (année précédente puis courante).
     Attendu : liste, timeline et indicateurs se recalculent ensemble.
  3. Vérifier les deux commandes du logiciel « REC Logiciel Prix dernière
     commande » : « REC Commande prix 1 (ancienne) » et « REC Commande prix 2
     (dernière) ». Attendu : les montants affichés donnent 100 par unité pour
     l'ancienne et 150 pour la dernière.
  4. Créer une commande sans contrat ni société. Attendu : le formulaire
     exige le contrat et la société acheteuse ; un montant nul ou négatif est
     refusé avec un message.
  5. Créer « REC TEST Commande campagne » : contrat « REC TEST Contrat
     campagne », société acheteuse REC Filiale Nord, montant 100,00, date du
     jour. Attendu : création acceptée, statut « En attente » ; la commande
     apparaît à l'identique dans la liste et sur sa fiche.
  6. Depuis sa fiche, cliquer le contrat rattaché. Attendu : la fiche du
     contrat s'ouvre ; la commande y figure dans les rattachements.
  7. Tenter la suppression d'une commande porteuse de licence (« REC Commande
     prix 2 (dernière) »). Attendu : refus avec un message explicite de
     rattachements.
- **Durée de référence** : 8 minutes.

### SC-DSI-06 : preuves et factures, dépôt unifié, manques

- **Objectif** : vérifier le dépôt unifié, les types par objet, la facture
  avec montant et date obligatoires, les preuves externes, le certificat
  d'authenticité et la détection des manques.
- **Stories couvertes** : #18, #204, #208, #224, #244, #246, #264, #265.
- **Préconditions** : compte dsi.recette ; SC-DSI-05 joué (commande REC TEST
  Commande campagne) ; jeu chargé (11 preuves REC, une par type).
- **Étapes** :
  1. Droits d'usage > Preuves. Attendu : une seule liste de documents avec
     une colonne de type ; les tuiles Factures et Preuves filtrent au clic ;
     la facture « REC Facture commande Nord » affiche 1 234,56 et sa date ;
     la colonne date de preuve est triable.
  2. Section « Détection des manques (risque audit) ». Attendu : sur un jeu
     fraîchement chargé, 8 commandes sans facture et 6 sans preuve, plus les
     commandes créées par la campagne (REC TEST Commande campagne) ; chaque
     ligne pointe vers la fiche de la commande concernée.
  3. Ouvrir « REC Preuve externe portail éditeur ». Attendu : la preuve est
     en mode URL ; le lien externe s'ouvre ; aucun téléchargement proposé.
  4. Cliquer « Déposer une preuve » : choisir le rattachement à un contrat.
     Attendu : la liste des types se limite à ceux du contrat (contrat et
     annexes, autre, et les types généraux) ; le type « Certificat
     d'authenticité » n'est pas proposé.
  5. Changer le rattachement vers la licence « REC Licence avec certificat ».
     Attendu : le type « Certificat d'authenticité » devient disponible
     (propre aux licences) ; les champs additionnels du type choisi
     s'affichent depuis la définition en base.
  6. Déposer une preuve « REC TEST Preuve campagne », type bon de commande,
     rattachée à « REC TEST Commande campagne », en mode référence
     « REC-TEST-GED-001 ». Attendu : dépôt accepté, statut « En attente »,
     visible dans la liste sans rechargement.
  7. Déposer une facture sur la même commande en laissant le montant vide.
     Attendu : refus : le montant et la date sont obligatoires pour une
     facture.
  8. Compléter montant 100,00 et date du jour, valider. Attendu : la facture
     est créée (avec sa preuve support, en un seul objet à l'écran) ; la
     commande sort de la détection des manques.
  9. Ouvrir la fiche de la licence « REC Licence avec certificat ».
     Attendu : la section preuves de la licence affiche le certificat
     d'authenticité du jeu.
- **Durée de référence** : 12 minutes.

### SC-DSI-07 : licences, logiciel client, prolongation et succession

- **Objectif** : vérifier la création d'une licence (y compris sur un
  logiciel du client), les types et leurs règles de dates, les métriques, la
  prolongation et la nouvelle période.
- **Stories couvertes** : #102, #209, #210, #242, #263.
- **Préconditions** : compte dsi.recette ; SC-DSI-05 joué (commande REC TEST
  Commande campagne).
- **Étapes** :
  1. Droits d'usage > Licences. Attendu : le patrimoine du jeu est listé avec
     éditions, versions, quantités et échéances ; les montants sont visibles.
  2. Ouvrir « REC Licence logiciel client RH ». Attendu : le logiciel « REC
     Logiciel RH interne » est résolu avec sa version « RH v10 » et son
     édition « RH Entreprise » (créations du client) ; balance du logiciel :
     3 droits, 2 usages, conforme.
  3. Créer une licence sur le logiciel client « REC Logiciel RH interne » :
     type souscription, laisser la date de fin vide. Attendu : le formulaire
     propose bien les logiciels du client ; la date de fin est exigée pour
     une souscription (règle du type).
  4. Compléter la date de fin à un an, quantité 2, unité utilisateur nommé,
     rattachée à « REC TEST Commande campagne », libellé « REC TEST Licence
     campagne ». Attendu : création acceptée ; la fiche affiche le type,
     l'unité de mesure et l'échéance.
  5. Ouvrir « REC Licence essai 45 jours ». Attendu : type « Version
     d'essai », date de fin portée, 5 droits et 1 usage comptés dans la
     balance.
  6. Ouvrir « REC Licence par poste ». Attendu : unité « Device » ; les deux
     affectations du jeu portent la cible « poste » (REC-PC-0042 et
     REC-PC-0043).
  7. Ouvrir « REC Souscription prolongée » et cliquer « Prolonger » : étendre
     la date de fin de 30 jours. Attendu : la nouvelle échéance s'affiche sur
     la fiche ; l'action est tracée au journal.
  8. Sur la même licence, cliquer « Nouvelle période ». Attendu : le
     formulaire s'ouvre prérempli depuis la licence d'origine, liée en
     prédécesseur ; annuler sans créer.
  9. Ouvrir « REC Souscription renouvelée (ancienne période) ». Attendu : la
     licence échue est renouvelée par « REC Souscription nouvelle période »
     (succession) ; le bandeau « contrat à suivre » pointe le contrat « REC
     Contrat à faire suivre » avec sa société signataire ; la balance du
     logiciel ne compte que la nouvelle période (5 droits, 0 usage).
- **Durée de référence** : 14 minutes.

### SC-DSI-08 : maintenances

- **Objectif** : vérifier les périodes de maintenance : rattachement à une
  commande, date de fin obligatoire, enchaînement des versions, arrêt et
  alerte de fin.
- **Stories couvertes** : #243, #267 (sélecteur de commande), #270, #280.
- **Préconditions** : compte dsi.recette ; SC-DSI-07 joué (licence REC TEST
  Licence campagne) ; traitement des notifications passé.
- **Étapes** :
  1. Ouvrir la licence « REC Perpétuelle maintenance continue ». Attendu :
     maintenance active, mainteneur « REC Maintenance Services », fin à
     environ six mois ; version courante « REC v3 » ; l'historique des
     versions affiche trois événements (achat v1, maintenance v1 vers v2,
     maintenance v2 vers v3), du plus récent au plus ancien.
  2. Ajouter une période de maintenance à « REC TEST Licence campagne » en
     laissant la date de fin vide. Attendu : refus : la date de fin est
     obligatoire (plus de « vide = en cours »).
  3. Compléter la date de fin à un an et choisir la commande de rattachement.
     Attendu : les commandes proposées affichent leur contrat avec sa société
     signataire ; aucune saisie de revendeur : il se lit par la commande ;
     création acceptée, maintenance active.
  4. Ouvrir « REC Perpétuelle maintenance arrêtée ». Attendu : statut
     arrêté ; la date de fin affichée est la date d'arrêt ; la version est
     figée (« v2024 (figée) ») ; aucune alerte de fin de maintenance.
  5. Ouvrir « REC Perpétuelle maintenance fin 20 jours ». Attendu : statut
     actif avec fin à 20 jours ; la notification de fin de maintenance de la
     cloche (vue en SC-ADM-08) vise bien cette licence ; aucune alerte sur la
     maintenance continue (période suivante déjà en place) ni sur l'arrêtée
     (arrêt volontaire).
  6. Sur « REC TEST Licence campagne », cliquer « Arrêter la maintenance »
     et confirmer. Attendu : statut arrêté, version figée ; le bouton
     « Reprendre la maintenance » apparaît ; reprendre, le statut redevient
     actif.
- **Durée de référence** : 10 minutes.

### SC-DSI-09 : conformité, seuils et valorisation

- **Objectif** : vérifier la balance droits-usages, les statuts selon le
  seuil personnalisé, les écarts valorisés et les anomalies.
- **Stories couvertes** : #116, #222 (balance du composé), #248.
- **Préconditions** : compte dsi.recette ; migration 096 jouée (taux absent
  sur droits nuls) ; à jouer avant SC-DSI-10, qui modifie les balances.
- **Étapes** :
  1. Droits d'usage > Licences : lire les balances du jeu. Attendu :
     « REC Logiciel Surplus 10-8 » : taux 80 %, conforme, écart +2 valorisé
     +1 000 ; « REC Logiciel Dépassement 5-7 » : taux 140 %, dépassement,
     écart -2 valorisé -12 000 ; « REC Logiciel Équilibre 10-10 » : taux
     100 %, attention.
  2. Vérifier le seuil personnalisé. Attendu : « REC Logiciel Taux 84 »
     (50 droits, 42 usages) est conforme ; « REC Logiciel Taux 86 » (50/43)
     est en attention : le seuil appliqué est celui du tenant (85), pas le
     défaut commun (90).
  3. Ouvrir « REC Logiciel Souscription échue ». Attendu : la souscription
     échue hier est sortie des droits : 0 droit, 3 usages, dépassement,
     aucun taux affiché, écart -3 valorisé -1 200 ; statut d'échéance de la
     licence : expiré ; anomalie « usage sans droit » ouverte.
  4. Ouvrir « REC Logiciel Droits nuls ». Attendu : 0 droit, 2 usages,
     dépassement, aucun taux, écart valorisé absent (aucun prix connu) ;
     anomalie « usage sans droit » ouverte.
  5. Vérifier la règle du dernier prix. Attendu : « REC Logiciel Prix
     dernière commande » : 14 droits, 3 usages, écart +11 valorisé +1 650
     (prix unitaire 150, celui de la dernière commande, jamais une moyenne).
  6. Vérifier l'agrégat valorisé (dashboard ou synthèse de conformité).
     Attendu : valorisation du parc 85 500 ; écart négatif -13 200 soit
     -15,44 % du parc ; écart positif +38 200 (44,68 %) ; total +25 000
     (29,24 %).
  7. Vérifier « REC Logiciel sans licence ». Attendu : présent au
     référentiel, absent de la balance (aucune ligne de conformité).
- **Durée de référence** : 10 minutes.

### SC-DSI-10 : validation des saisies et revalidation

- **Objectif** : vérifier le circuit unique de validation : badge, actions,
  refus motivé, revalidation périodique.
- **Stories couvertes** : #19, #106 (volet validation), #324 (affectation en
  attente).
- **Préconditions** : compte dsi.recette ; jeu chargé (une affectation en
  attente, une refusée, une à revalider) ; à jouer après SC-DSI-09 (la
  validation modifie les balances).
- **Étapes** :
  1. Usage > Affectations. Attendu : chaque ligne porte son badge de statut
     de validation ; « REC Usage en attente de validation » est en attente ;
     « REC Usage refusé (doublon) » est refusé.
  2. Ouvrir « REC Usage refusé (doublon) ». Attendu : le motif du refus est
     affiché sur la fiche : « REC Doublon de saisie : cet usage est déjà
     déclaré sur REC-EQUIPE-F. ».
  3. Ouvrir « REC Usage en attente de validation ». Attendu : les actions
     « Valider » et « Refuser » sont proposées (élément en attente) ; le bloc
     « Actions requises » signale que l'usage n'est pas compté dans la
     balance.
  4. Cliquer « Refuser » sans motif. Attendu : le bouton de confirmation
     reste inactif tant que le motif est vide ; annuler.
  5. Cliquer « Valider ». Attendu : le badge passe à validé ; la balance de
     « REC Logiciel Équilibre 10-10 » passe à 15 usages pour 10 droits
     (dépassement) ; le widget des validations en attente du dashboard
     diminue d'autant.
  6. Ouvrir « REC Usage à revalider (échu) ». Attendu : statut « à
     revalider », revalidation dépassée d'environ 5 jours (délai de 30 jours
     de la société).
  7. Revalider cet usage. Attendu : le cycle repart (jours restants
     recalculés).
  8. Vérifier le comportement sur un contrat et une commande en attente
     (ceux créés par la campagne, par exemple REC TEST Contrat campagne) :
     badge, Valider, Refuser avec motif obligatoire. Attendu : comportement
     strictement identique aux affectations ; après une validation, le motif
     éventuel disparaît.
- **Durée de référence** : 8 minutes.

---

## 5. Scénarios Financier

### SC-FIN-01 : dashboard Financier

- **Objectif** : vérifier le dashboard du profil et la visibilité des
  montants.
- **Stories couvertes** : #73, #190.
- **Préconditions** : compte financier.recette.
- **Étapes** :
  1. Se connecter avec financier.recette. Attendu : dashboard Financier
     affiché, sans sélecteur (profil unique).
  2. Parcourir les widgets financiers. Attendu : montants visibles (le profil
     porte les indicateurs financiers) ; la période budgétaire et les
     engagés-payés reflètent le jeu ; étiquette de fraîcheur présente sur les
     widgets qui la fournissent.
- **Durée de référence** : 4 minutes.

### SC-FIN-02 : budget de bout en bout

- **Objectif** : vérifier la page Budget : périodes, indicateurs, société
  payeuse dérivée, préremplissage, cycle complet d'une ligne.
- **Stories couvertes** : #144, #148, #164.
- **Préconditions** : compte financier.recette ; exercice fiscal du tenant en
  année civile.
- **Étapes** :
  1. Barre latérale : l'entrée Budget est visible. Ouvrir Budget. Attendu :
     onglets Visualisation et Saisie ; sélecteur de période à deux axes
     (année calendaire, trimestre, année fiscale ; courant, précédent,
     suivant) ; six indicateurs CAPEX et OPEX (alloué, engagé, écart), écarts
     en vert si positifs, rouge si négatifs.
  2. Sélectionner REC Filiale Sud sur l'exercice courant. Attendu : alloué
     10 000, engagé 9 500, taux d'engagement 95 %.
  3. Sélectionner REC Filiale Nord sur l'exercice courant. Attendu : alloué
     23 200, engagé 20 634,56, taux 88,94 %.
  4. Passer le sélecteur sur l'exercice précédent (Filiale Sud). Attendu :
     l'alloué de 8 000 apparaît (engagé 0) ; il est invisible sur l'exercice
     courant.
  5. Vérifier la répartition par société. Attendu : la société payeuse de
     chaque ligne est déduite de la chaîne licence, commande, société (par
     exemple REC Groupe Horizon pour la licence de « REC Commande acheteuse
     mère ») ; elle n'est jamais saisie.
  6. Ouvrir le préremplissage pour la licence « REC Perpétuelle maintenance
     continue » (maintenance en cours 2 000 par an). Attendu : la proposition
     calculée vaut 2 070 (inflation 3,5 % sur l'exercice suivant) ; la ligne
     déjà saisie de 2 500 reste affichée dans les lignes existantes et c'est
     elle qui compte dans la synthèse prévisionnelle.
  7. Créer une ligne : une licence du jeu, type alloué, exercice courant,
     1 000 en OPEX. Attendu : la ligne persiste, les indicateurs se
     recalculent.
  8. Modifier la ligne (1 200) puis la supprimer. Attendu : modification
     visible ; la suppression est acceptée (le profil Financier porte le
     droit de suppression du budget) ; les indicateurs reviennent à l'état
     initial.
- **Durée de référence** : 14 minutes.

### SC-FIN-03 : lecture opérationnelle et dépôt de facture

- **Objectif** : vérifier le périmètre du Financier : consultation sans
  saisie opérationnelle, dépôt de facture autorisé.
- **Stories couvertes** : #17, #18, #73, #265.
- **Préconditions** : compte financier.recette.
- **Étapes** :
  1. Droits d'usage > Contrat. Attendu : la liste se charge ; aucun bouton de
     création ni d'édition de contrat (pas de droit de saisie).
  2. Droits d'usage > Commandes. Attendu : liste et graphe des agrégats
     visibles (le profil porte les indicateurs financiers) ; aucun bouton de
     création.
  3. Droits d'usage > Preuves : vérifier la facture « REC Facture commande
     Nord ». Attendu : montant 1 234,56 et date visibles.
  4. Cliquer « Déposer une preuve » : déposer une facture « REC TEST Facture
     financier » sur la commande « REC Commande facturée », montant 50,00,
     date du jour, mode référence. Attendu : le dépôt est accepté (le dépôt
     de pièces fait partie du profil) et part en attente de validation.
  5. Usage > Affectations. Attendu : la liste se charge en lecture ; aucun
     bouton de déclaration d'affectation.
- **Durée de référence** : 7 minutes.

### SC-FIN-04 : notifications du Financier et préférences

- **Objectif** : vérifier les destinataires côté Financier et les préférences
  de notification.
- **Stories couvertes** : #194, #261.
- **Préconditions** : compte financier.recette ; traitement des notifications
  passé.
- **Étapes** :
  1. Ouvrir la cloche. Attendu : la notification de seuil budgétaire est
     présente : « Budget 2026 de REC Filiale Sud engagé à 95 % » (orange),
     avec les montants (le profil les porte).
  2. Vérifier les absences. Attendu : aucune notification de dépassement de
     conformité, d'échéance de contrat ou de souscription, de revalidation ni
     de fin de maintenance : le Financier a été retiré de ces types, il reste
     destinataire du seuil budgétaire.
  3. Paramètres du compte (icône en bas de la barre latérale), onglet
     Notifications. Attendu : les préférences par type sont listées avec
     trois modes (immédiat, récapitulatif quotidien, désactivé).
  4. Passer le type « seuil budgétaire » en désactivé pour le courrier,
     enregistrer, puis le remettre. Attendu : chaque changement est
     enregistré et relu à l'identique ; la notification dans l'application
     reste visible quel que soit le mode courrier.
- **Durée de référence** : 6 minutes.

---

## 6. Scénarios IT Ops

### SC-OPS-01 : dashboard IT Ops et montants masqués

- **Objectif** : vérifier le dashboard du profil et le masquage des montants
  côté serveur.
- **Stories couvertes** : #73, #190, #268.
- **Préconditions** : compte itops.recette.
- **Étapes** :
  1. Se connecter avec itops.recette. Attendu : dashboard IT Ops affiché,
     sans sélecteur.
  2. Parcourir les widgets. Attendu : aucun montant sur les widgets
     financiers (masqués, jamais « 0 ») ; les compteurs opérationnels
     (licences, affectations, écarts) sont servis.
  3. Droits d'usage > Licences. Attendu : la liste se charge en lecture ;
     aucun bouton de création ni d'édition de licence (droits IT Ops :
     lecture seule) ; les coûts sont masqués.
  4. Droits d'usage > Commandes. Attendu : la liste se charge ; le graphe des
     agrégats financiers n'est pas affiché (droit financier absent).
- **Durée de référence** : 6 minutes.

### SC-OPS-02 : affectations, cible poste, décompte

- **Objectif** : vérifier la déclaration d'usage par IT Ops, la cible poste
  et les règles de décompte.
- **Stories couvertes** : #106, #210 (unités), #266.
- **Préconditions** : compte itops.recette.
- **Étapes** :
  1. Usage > Affectations. Attendu : la liste du jeu est servie, avec la
     colonne de cible (utilisateur ou poste) ; les affectations « REC Poste
     PC-0042 (marie.durand) » et « REC Poste PC-0043 (marie.durand) »
     affichent la cible poste.
  2. Vérifier le décompte par poste. Attendu : la balance de « REC Logiciel
     Par poste » compte 2 usages pour 5 droits : deux postes de la même
     personne valent deux usages, sans dédoublonnage nominatif.
  3. Déclarer une affectation : licence « REC Licence par poste », cible
     poste, référence « REC-TEST-PC-0099 », société REC Filiale Nord,
     quantité 1. Attendu : création acceptée, statut « En attente » ; la
     cible poste est visible dans la liste et la fiche.
  4. Vérifier la balance. Attendu : la balance de « REC Logiciel Par poste »
     est inchangée (5 droits, 2 usages) tant que la saisie n'est pas validée.
  5. Vérifier l'absence d'action de validation. Attendu : sur une affectation
     en attente, IT Ops ne voit pas les boutons Valider et Refuser (rôle du
     valideur).
- **Durée de référence** : 8 minutes.

### SC-OPS-03 : inventaire, import et rapprochement

- **Objectif** : vérifier l'import manuel d'un relevé, les écarts dans les
  deux sens et le rapprochement manuel.
- **Stories couvertes** : #111, #268.
- **Préconditions** : compte itops.recette ; préparer un fichier
  `releve_recette.csv` de trois lignes avec les colonnes produit, reference,
  quantite : « REC Logiciel Par poste » avec la référence REC-PC-0042
  (quantité 1, constat aligné sur le déclaré), « REC Logiciel Par poste »
  avec la référence REC-TEST-PC-0050 (constaté non déclaré) et « REC Logiciel
  Perpétuel nu » avec la référence REC-TEST-SRV-01 (constaté non déclaré).
- **Étapes** :
  1. Usage > Inventaire. Attendu : l'écran se charge ; le bouton d'import est
     visible (IT Ops porte l'import depuis la décision D45) ; l'emplacement
     des connecteurs automatiques est présent à titre indicatif.
  2. Importer `releve_recette.csv`. Attendu : verdict affiché : 3 relevés
     importés, aucune ligne en erreur ; l'import est tracé dans l'historique
     des imports.
  3. Consulter les écarts. Attendu : les deux références non déclarées
     ressortent en constaté sans déclaré ; les affectations déclarées sans
     constat (le reste du parc) ressortent dans l'autre sens ; aucune
     affectation n'a été créée automatiquement.
  4. Sur le relevé REC-PC-0042, cliquer « Rapprocher ». Attendu : le relevé
     est rapproché de l'affectation déclarée correspondante ; son statut
     change ; la balance de conformité reste inchangée.
  5. Sur le relevé REC-TEST-PC-0050, choisir « Écart assumé ». Attendu : le
     relevé sort des écarts ouverts avec un statut distinct.
  6. Sur le relevé REC-TEST-SRV-01, choisir « Rejeter » puis « Remettre en
     attente ». Attendu : chaque action est prise et le statut relu à
     l'identique.
- **Durée de référence** : 12 minutes.

### SC-OPS-04 : conformité sans montants et préférences de courrier

- **Objectif** : vérifier que les montants sont masqués pour IT Ops partout,
  notifications comprises, et la préférence de courrier désactivée.
- **Stories couvertes** : #116 (masquage), #194, #265.
- **Préconditions** : compte itops.recette ; traitement des notifications
  passé.
- **Étapes** :
  1. Droits d'usage > Licences : ouvrir « REC Logiciel Dépassement 5-7 ».
     Attendu : quantités et taux visibles (5 droits, 7 usages, 140 %) ;
     aucun écart valorisé ni coût affiché.
  2. Droits d'usage > Preuves : ouvrir « REC Facture commande Nord ».
     Attendu : le montant de la facture n'est pas affiché pour ce profil.
  3. Ouvrir la cloche. Attendu : les trois notifications de dépassement de
     conformité sont présentes, en quantités seules, sans aucun montant ni
     seuil en euros ; la notification de fin de maintenance est présente ;
     aucune notification budgétaire.
  4. Paramètres du compte, onglet Notifications. Attendu : le courrier des
     dépassements de conformité est désactivé pour ce compte (état posé par
     le jeu) ; la notification reste servie dans l'application.
- **Durée de référence** : 6 minutes.

---

## 7. Scénarios Saisie

### SC-SAI-01 : périmètre du profil Saisie

- **Objectif** : vérifier ce que voit et ne voit pas le profil de saisie.
- **Stories couvertes** : #73.
- **Préconditions** : compte saisie.recette.
- **Étapes** :
  1. Se connecter avec saisie.recette. Attendu : la page Dashboard affiche
     « Aucun dashboard n'est accessible avec vos droits actuels. » (le profil
     ne porte aucun dashboard).
  2. Barre latérale. Attendu : ni section Budget ni section Administration ;
     les référentiels, les écrans Droits d'usage et Usage sont proposés.
  3. Ouvrir Droits d'usage > Contrat, Commandes, Preuves, puis Usage >
     Affectations et Inventaire. Attendu : les cinq écrans se chargent en
     données réelles.
  4. Ouvrir Droits d'usage > Licences. Attendu : l'écran répond par le
     message de refus du serveur (accès refusé), affiché tel quel ; aucune
     donnée de licence ne s'affiche.
  5. Droits d'usage > Commandes et Preuves. Attendu : pas de graphe des
     agrégats financiers sur les commandes ; les montants de factures sont
     masqués.
- **Durée de référence** : 6 minutes.

### SC-SAI-02 : saisie d'un contrat et d'une commande

- **Objectif** : vérifier que la saisie produit des éléments en attente de
  validation, sans pouvoir les valider.
- **Stories couvertes** : #16, #17, #19.
- **Préconditions** : compte saisie.recette.
- **Étapes** :
  1. Droits d'usage > Contrat : créer « REC TEST Contrat saisie », type
     Standard, signataire REC Filiale Nord, dates du jour à un an. Attendu :
     création acceptée, badge « En attente » sur la liste et la fiche.
  2. Sur la fiche du contrat créé. Attendu : aucune action Valider ou
     Refuser : le profil saisit mais ne valide pas.
  3. Droits d'usage > Commandes : créer « REC TEST Commande saisie » sur ce
     contrat, société REC Filiale Nord, montant 10,00, date du jour.
     Attendu : création acceptée, badge « En attente ».
  4. Droits d'usage > Preuves : vérifier la détection des manques. Attendu :
     la nouvelle commande ressort sans facture ni preuve.
- **Durée de référence** : 8 minutes.

### SC-SAI-03 : déclarer un usage, refus motivé, correction

- **Objectif** : dérouler le circuit complet : saisie d'un usage,
  notification au valideur, refus motivé, notification à l'auteur, correction
  et validation.
- **Stories couvertes** : #19, #106, #194, #324 (saisie refusée).
- **Préconditions** : comptes saisie.accorde.recette et dsi.recette. Le
  compte saisie.accorde est utilisé parce que la saisie d'une affectation
  exige de choisir une licence : ce compte porte l'exception de lecture des
  licences (voir « Écarts constatés », point 1).
- **Étapes** :
  1. Se connecter avec saisie.accorde.recette. Usage > Affectations :
     déclarer une affectation sur la licence « REC Perpétuelle sans
     maintenance », société REC Filiale Nord, quantité 1, référence
     « REC-FLUX-01 ». Attendu : création acceptée, statut « En attente » ;
     elle ne compte pas dans la balance.
  2. Se connecter avec dsi.recette (autre fenêtre). Attendu : la cloche porte
     une notification « Saisie à valider : REC-FLUX-01 » ; l'auteur, lui, n'a
     pas reçu cette notification.
  3. Cliquer la notification. Attendu : l'écran des affectations s'ouvre
     filtré ; ouvrir REC-FLUX-01 et cliquer « Refuser », motif « REC Refus de
     recette : justificatif manquant. », confirmer. Attendu : statut refusé,
     motif visible sur la fiche.
  4. Revenir sur saisie.accorde.recette. Attendu : notification « Saisie
     refusée : REC-FLUX-01 » (orange) avec le motif dans l'application ; la
     fiche de l'affectation porte le bloc « Actions requises » avec « Saisie
     refusée sans correction » et le bouton « Corriger la saisie ».
  5. Cliquer « Corriger la saisie », passer la quantité à 2, enregistrer.
     Attendu : la saisie repart en attente de validation ; le motif de refus
     disparaît de la fiche.
  6. Avec dsi.recette, valider REC-FLUX-01. Attendu : statut validé ; l'usage
     compte désormais dans la balance de « REC Logiciel Perpétuel nu »
     (3 usages : l'usage du jeu plus la quantité 2 validée).
- **Durée de référence** : 12 minutes.

### SC-SAI-04 : dépôt d'une preuve par la saisie

- **Objectif** : vérifier le dépôt unifié par le profil de saisie.
- **Stories couvertes** : #18, #244.
- **Préconditions** : compte saisie.recette ; SC-SAI-02 joué (commande REC
  TEST Commande saisie).
- **Étapes** :
  1. Droits d'usage > Preuves : cliquer « Déposer une preuve ». Attendu : la
     modale unifiée s'ouvre ; les champs du formulaire suivent le type de
     preuve choisi.
  2. Déposer une preuve type bon de commande, rattachée à « REC TEST Commande
     saisie », mode référence « REC-TEST-GED-SAISIE ». Attendu : dépôt
     accepté, statut « En attente » ; la commande sort de la détection des
     manques côté preuve.
- **Durée de référence** : 5 minutes.

---

## 8. Scénarios transverses

### SC-TRA-01 : refus d'accès

- **Objectif** : vérifier que les accès non autorisés sont refusés : entrée
  masquée, accès direct par l'adresse, message du serveur.
- **Stories couvertes** : #73, #268.
- **Préconditions** : comptes saisie.recette, dsi.recette, itops.recette.
- **Étapes** :
  1. Avec saisie.recette, saisir directement l'adresse `/admin/utilisateurs`.
     Attendu : redirection vers la page « non autorisé », aucune donnée
     d'administration affichée.
  2. Toujours avec saisie.recette, saisir l'adresse `/budget`. Attendu :
     redirection vers la page « non autorisé ».
  3. Avec dsi.recette, vérifier la barre latérale. Attendu : dans la section
     Administration, seule l'entrée Organisation est proposée (le profil gère
     les référentiels) ; ni Utilisateurs, ni Paramètres, ni Connecteurs.
  4. Avec dsi.recette, saisir l'adresse `/admin/utilisateurs`. Attendu :
     redirection vers la page « non autorisé » (l'interdiction ne dépend pas
     du masquage du menu).
  5. Avec itops.recette, ouvrir une licence du jeu. Attendu : aucune action
     de modification n'est proposée (lecture seule) ; les écrans restent
     servis.
  6. Avec saisie.recette, ouvrir Droits d'usage > Licences. Attendu : le
     message de refus du serveur est affiché tel quel ; l'écran ne montre
     aucune donnée.
- **Durée de référence** : 8 minutes.

### SC-TRA-02 : compte à plusieurs profils, multidashboard et union des droits

- **Objectif** : vérifier le cumul de profils : plusieurs dashboards, droits
  en union.
- **Stories couvertes** : #73, #190, #276.
- **Préconditions** : compte admin.recette ; SC-ADM-03 joué (REC TEST Testeur
  Un, mot de passe « Recette#2026-T1 »).
- **Étapes** :
  1. Avec admin.recette, ouvrir la fiche de REC TEST Testeur Un, section
     Profils : remplacer ses profils par Financier et IT Ops, enregistrer.
     Attendu : les deux profils sont relus sur la fiche.
  2. Se connecter avec testeur.un.recette@samsecure.test. Attendu : le
     Dashboard propose un sélecteur à deux entrées, Financier et IT Ops ;
     Financier est affiché par défaut (ordre de préséance).
  3. Basculer sur le dashboard IT Ops puis revenir. Attendu : chaque bascule
     change la composition des widgets.
  4. Vérifier l'union des droits. Attendu : l'entrée Budget est visible et la
     page se charge (droit du Financier) ; les licences sont lisibles (droit
     d'IT Ops) ; les montants sont visibles (indicateurs financiers du profil
     Financier) : l'union prime.
  5. Vérifier l'absence des droits non portés. Attendu : aucune action de
     validation sur les saisies en attente ; pas de section Administration.
  6. Avec cumul.recette (compte du jeu : Saisie plus profil ajouté de lecture
     transverse), se connecter. Attendu : les licences et le budget sont
     lisibles (droits du profil ajouté) en plus des écrans de saisie ; le
     Dashboard reste sans tableau de bord (aucun des deux profils n'en porte).
- **Durée de référence** : 12 minutes.

### SC-TRA-03 : actions requises sur une fiche incomplète

- **Objectif** : vérifier le bloc « Actions requises » : règles, boutons vers
  les bonnes modales, lien depuis les alertes, disparition une fois la fiche
  complète.
- **Stories couvertes** : #324.
- **Préconditions** : compte dsi.recette ; migration 105 jouée et API
  redémarrée ; jouer avant que la campagne ne complète « REC Commande prix 2
  (dernière) » ; relever au préalable les compteurs de manques de la page
  Preuves.
- **Étapes** :
  1. Ouvrir la fiche de la commande « REC Commande prix 2 (dernière) ».
     Attendu : bloc « Actions requises (2) » en tête de fiche, deux lignes
     recommandées : « Aucune facture rattachée à la commande » avec le bouton
     « Déposer une facture », « Aucune preuve rattachée à la commande » avec
     le bouton « Rattacher une preuve » ; aucune ligne bloquante (montant et
     licence présents).
  2. Droits d'usage > Preuves, section détection des manques : cliquer le
     badge « Sans facture » de cette commande. Attendu : la fiche s'ouvre
     avec la ligne correspondante du bloc surlignée et amenée à l'écran, sans
     ouverture automatique de la modale.
  3. Cliquer « Déposer une facture ». Attendu : la modale de dépôt unifiée
     s'ouvre, rattachement prérempli sur la commande, type Facture
     présélectionné, montant et date exigés.
  4. Déposer la facture (montant 600,00, date du jour, mode référence
     « REC-TEST-FAC-324 »). Attendu : le bloc se met à jour sans recharger la
     page ; la facture crée aussi sa preuve support : le bloc disparaît
     entièrement.
  5. Revenir sur la page Preuves. Attendu : les compteurs de manques ont
     diminué d'une commande sans facture et d'une sans preuve par rapport au
     relevé fait en précondition (8 et 6 sur un jeu fraîchement chargé, avant
     les créations de la campagne).
  6. Ouvrir une fiche complète du jeu (par exemple « REC Commande facturée »).
     Attendu : aucun bloc « Actions requises ».
- **Durée de référence** : 10 minutes.

### SC-TRA-04 : corbeille et restauration

- **Objectif** : vérifier la suppression douce des profils ajoutés, la
  corbeille de 90 jours, la restauration, la purge, et l'archivage des
  contrats.
- **Stories couvertes** : #16 (archivage), #64, #276, #282.
- **Préconditions** : compte admin.recette ; SC-ADM-04 joué (REC TEST Profil
  pilote attribué à REC TEST Testeur Un) ; jeu fraîchement chargé pour les
  étapes 4 et 5 (corbeilles du jeu).
- **Étapes** :
  1. Administration > Utilisateurs, onglet Profils : supprimer « REC TEST
     Profil pilote » et confirmer. Attendu : l'écran d'impact annonce les
     attributions concernées ; la suppression passe sans erreur ; le profil
     disparaît de la liste courante.
  2. Ouvrir la corbeille de l'onglet. Attendu : le profil supprimé y figure
     avec environ 90 jours restants et un bouton « Restaurer ».
  3. Cliquer « Restaurer ». Attendu : le profil revient dans la liste avec sa
     matrice ; l'attribution au compte qui le portait est rétablie (visible
     sur la fiche du compte).
  4. Vérifier « REC Groupe corbeille 10 jours » dans la corbeille. Attendu :
     présent avec 80 jours restants.
  5. Vérifier « REC Groupe corbeille 100 jours ». Attendu : absent de la
     corbeille : la purge des 90 jours est appliquée au premier affichage.
  6. Droits d'usage > Contrat : archiver « REC Contrat renouvelé (ancien) ».
     Attendu : le contrat sort de la liste courante, visible avec le filtre
     des archivés, sa hiérarchie reste lisible.
  7. Restaurer ce contrat. Attendu : il revient dans la liste courante, à
     l'identique.
- **Durée de référence** : 10 minutes.

### SC-TRA-05 : langue de l'interface et des notifications

- **Objectif** : vérifier que les notifications suivent la langue de
  l'utilisateur.
- **Stories couvertes** : #260.
- **Préconditions** : compte dsi.en.recette (langue anglaise) ; traitement
  des notifications passé.
- **Étapes** :
  1. Se connecter avec dsi.en.recette. Attendu : le compte est servi en
     anglais pour les contenus traduits.
  2. Ouvrir la cloche. Attendu : les notifications du compte sont en anglais,
     par exemple l'échéance du contrat « REC Contrat échéance 15 jours »
     (« expiring in 15 days »), le dépassement de conformité (« Compliance
     overrun ») et le seuil budgétaire (« 2026 budget of REC Filiale Sud
     committed at 95 % ») ; aucune clé technique ni texte brut n'apparaît.
  3. Paramètres du compte, onglet Préférences : vérifier la langue
     d'interface. Attendu : la langue anglaise est sélectionnée pour ce
     compte.
- **Durée de référence** : 6 minutes.

---

## 9. Matrice de couverture

| Story | Intitulé court | Scénarios |
|---|---|---|
| #14 | Mots de passe utilisateur | SC-ADM-03 |
| #16 | Contrats : hiérarchie et échéances | SC-DSI-04, SC-SAI-02, SC-TRA-04 |
| #17 | Commandes : rattachements et montants | SC-DSI-05, SC-FIN-03, SC-SAI-02 |
| #18 | Factures et preuves, manques | SC-DSI-06, SC-FIN-03, SC-SAI-04 |
| #19 | Circuit de validation | SC-DSI-10, SC-SAI-02, SC-SAI-03 |
| #62 | Pas de suppression utilisateurs et sociétés | SC-ADM-02, SC-ADM-03, SC-ADM-07 |
| #64 | Corbeille des groupes (profils ajoutés) | SC-TRA-04 |
| #65 | simulateurDroits : attributions regroupées | sans scénario (voir section 10) |
| #66 | simulateurDroits : diffusion des groupes | sans scénario (voir section 10) |
| #67 | simulateurDroits : sociétés de rattachement | sans scénario (voir section 10) |
| #70 | Dates préremplies à l'édition d'un contrat | SC-DSI-04 |
| #73 | Dashboards et droits par profil | SC-ADM-01, SC-DSI-01, SC-FIN-01, SC-FIN-03, SC-OPS-01, SC-SAI-01, SC-TRA-01, SC-TRA-02 |
| #78 | Historique d'un compte | SC-ADM-03 |
| #102 | Licences : patrimoine des droits | SC-DSI-07, SC-DSI-09 |
| #106 | Affectations : usage déclaré, revalidation | SC-DSI-10, SC-OPS-02, SC-SAI-03 |
| #111 | Inventaire : import et écarts | SC-OPS-03 |
| #116 | Conformité : balance précalculée | SC-DSI-09, SC-OPS-04 |
| #121 | Alertes et notifications du module 3 | SC-ADM-08 |
| #144 | Budget : socle et API | SC-FIN-02 |
| #148 | Budget : page et fiches | SC-FIN-02 |
| #164 | Sélecteur de période fiscale | SC-FIN-02, SC-DSI-05 |
| #173 | Référentiel Éditeurs | SC-DSI-02 |
| #177 | Référentiel Revendeurs | SC-DSI-02 |
| #181 | Référentiel Contacts | SC-DSI-02 |
| #185 | Référentiel Logiciels | SC-DSI-02 |
| #190 | Dashboards par profil, données réelles | SC-ADM-01, SC-DSI-01, SC-FIN-01, SC-OPS-01, SC-TRA-02 |
| #194 | Notifications application et courrier | SC-ADM-08, SC-FIN-04, SC-OPS-04, SC-SAI-03 |
| #203 | Société dans la hiérarchie des contrats | SC-DSI-04 |
| #204 | Facture et preuve : objet unique | SC-DSI-06 |
| #205 | Position de défilement de la matrice | SC-ADM-04 (équivalent dans l'application) |
| #206 | Erreur 500 sur deux droits de la matrice | SC-ADM-04 (équivalent dans l'application) |
| #207 | Terme société | SC-ADM-02, et en filigrane partout |
| #208 | Types de preuves par objet | SC-DSI-06 |
| #209 | Types de licences et règles de dates | SC-DSI-07 |
| #210 | Métriques de décompte | SC-DSI-07, SC-OPS-02 |
| #221 | Compléments du catalogue depuis Logiciels | SC-DSI-02 |
| #222 | Logiciel composé | SC-DSI-03, SC-DSI-09 |
| #223 | Types de contrat Standard et Interne | SC-DSI-04 |
| #224 | Preuves externes | SC-DSI-06 |
| #242 | Prolongation et succession des licences | SC-DSI-07 |
| #243 | Maintenance rattachée à une commande | SC-DSI-08 |
| #244 | Formulaires de preuve en base, dépôt unifié | SC-DSI-06, SC-SAI-04 |
| #245 | Terminologie logiciel | en filigrane (voir section 10) |
| #246 | Unification des preuves, date de preuve | SC-DSI-06 |
| #247 | Filtres et actions groupées des comptes | SC-ADM-03 |
| #248 | Règles de conformité affinées | SC-DSI-09 |
| #249 | Refonte du modèle des droits | SC-ADM-04, SC-ADM-05 |
| #258 | Courriers sans donnée sensible | SC-SAI-03 (volet application) ; courriels : voir sections 10 et 11 |
| #259 | Relais SMTP et expéditeur | sans scénario (voir section 10) |
| #260 | Notifications dans la langue du compte | SC-TRA-05 |
| #261 | Révision des destinataires | SC-FIN-04, SC-ADM-08 |
| #262 | Seuils du tenant | SC-ADM-06 |
| #263 | Licence sur un logiciel du client | SC-DSI-02, SC-DSI-07 |
| #264 | Certificat d'authenticité | SC-DSI-06 |
| #265 | Facture : montant et date obligatoires | SC-DSI-06, SC-FIN-03, SC-OPS-04 |
| #266 | Affectation à un poste | SC-OPS-02 |
| #267 | Société signataire partout | SC-DSI-04, SC-DSI-07, SC-DSI-08 |
| #268 | Droits IT Ops (D45) | SC-OPS-01, SC-OPS-03, SC-TRA-01 |
| #269 | Profils par défaut non supprimables | SC-ADM-04 |
| #270 | Alerte de fin de maintenance | SC-ADM-08, SC-DSI-08 |
| #276 | Tout est profil | SC-ADM-04, SC-TRA-02, SC-TRA-04 |
| #278 | Délégation en cascade | SC-ADM-09 |
| #279 | Composition par édition | SC-DSI-03 |
| #280 | Maintenance : date de fin obligatoire | SC-DSI-08 |
| #281 | Suppression et archivage d'une société | SC-ADM-02, SC-ADM-07 |
| #282 | Suppression d'un profil ajouté sans erreur | SC-TRA-04 |
| #324 | Actions requises sur chaque fiche | SC-TRA-03, SC-DSI-04, SC-DSI-10, SC-SAI-03 |

## 10. Stories sans scénario

Stories retenues par le filtre (livrées, modules 1 à 4 et vague du 07/10)
mais sans scénario dédié :

- **#65, #66, #67** : écrites contre le simulateur de droits, maquette
  d'administration abandonnée au profit du module de l'application (acte
  posé par la #64). Les comportements équivalents dans l'application sont
  couverts : attributions regroupées sur la fiche du compte (SC-ADM-03 et
  SC-ADM-04), profils sans sociétés de diffusion (SC-ADM-04, étape 7),
  modification des sociétés de rattachement (SC-ADM-03).
- **#245** (terminologie logiciel) : transverse de libellés, sans parcours
  propre ; elle est vérifiée en filigrane par tous les scénarios : toute
  mention « produit » à l'écran est une anomalie à remonter.
- **#259** (relais SMTP local, expéditeur SamSecure) : infrastructure
  d'envoi, non observable depuis le navigateur. À vérifier en exploitation
  (journaux du relais) et en atelier avec une boîte de réception de recette.
- **#258** (courriers sans donnée sensible) : le volet application est
  couvert (SC-SAI-03 : le motif reste dans l'application). Le contenu des
  courriels n'est pas vérifiable sans boîte de réception de recette : point
  à trancher (section 11, écart 4).

Stories exclues du périmètre de la feuille de route, avec leur raison :

- **Non livrées (module 5, données fictives)** : #152, #156, #160 (rapports).
  Le menu Rapports reste visible mais fonctionne sur des données de
  démonstration : hors campagne.
- **Non livrées (en cours ou à venir)** : #277 et #330 (groupes
  d'organisations, portée des données), #283 (alerte contrat à suivre après
  renouvellement : la détection livrée est couverte par SC-DSI-04), #284
  (assistant d'initialisation), #336 et #340 (versions : proposition
  automatique et héritage).
- **À cadrer avant réalisation** : #252 (gratuités), #272 (métriques des
  usages), #343 (saisie depuis la conformité).
- **Différées** : #273 (import en masse et connecteurs), #287 (minimums
  éditeurs), #289 (adresse émettrice par tenant).
- **Internes ou hors produit** : #271, #285, #286, #288, #290, #347, les
  stories de socle technique (#13, #15, #24, #33, #38, #68, #71), ainsi que
  #274 et #275 (authentification MFA et WAF, chantiers de bouclage non
  livrés).

## 11. Écarts constatés

Écarts entre les stories et l'application telle qu'elle est aujourd'hui,
constatés à la lecture du code et du jeu de recette. Rien n'a été modifié :
chaque point est à arbitrer.

1. **Saisie d'affectation sans lecture des licences (profil Saisie).** Le
   profil Saisie porte le droit de déclarer une affectation mais pas celui de
   lire les licences. À l'écran, le sélecteur de licence de la modale
   d'affectation est alors vide : la déclaration n'est pas praticable au
   navigateur avec saisie.recette (le cas correspondant des attendus de
   recette passe par l'API). Le scénario SC-SAI-03 contourne avec
   saisie.accorde.recette. À trancher : ajouter la lecture des licences au
   profil Saisie, ou servir au formulaire une liste dédiée.
2. **Types d'alerte annoncés non livrés.** La story #194 cite une alerte de
   « réserve d'extension » et la #121 un « écart d'inventaire » : aucun de
   ces deux types n'existe au catalogue des notifications (neuf types livrés,
   fin de maintenance comprise). Les scénarios ne les testent pas.
3. **Échéances limitées aux souscriptions.** Le traitement planifié des
   échéances de licence ne considère que le type souscription : une version
   d'essai qui arrive à échéance n'alerte pas (limite déjà notée aux
   attendus, cas de la licence d'essai). La story #209 donne pourtant les
   mêmes règles de dates aux deux types.
4. **Courriels non vérifiables en recette.** Les stories #194, #258 et #259
   portent des exigences sur les courriels (récapitulatif quotidien, absence
   de donnée sensible, expéditeur, objet préfixé du nom du client). Sans
   boîte de réception associée aux comptes de recette, la campagne ne couvre
   que le volet application. Proposition : une boîte de recette dédiée pour
   un passage en atelier.
5. **Dashboard d'un profil ajouté.** Il existe trois tableaux de bord
   (Manager DSI, Financier, IT Ops). Un profil ajouté pointe l'un des trois
   comme dashboard de référence, ou aucun : il n'y a pas de tableau de bord
   propre par profil ajouté. C'est conforme à la cible actée, mais la
   formulation « un dashboard par profil » de la #276 reste à valider
   (point déjà ouvert dans la story).
6. **Délégation et paramètres du tenant.** La permission de gestion des
   utilisateurs emporte aussi l'accès à l'écran Paramètres du tenant (seuils
   de dashboard compris), faute de permission dédiée au paramétrage dans
   cette version. Un délégataire de la #278 peut donc modifier les seuils :
   à confirmer comme voulu, ou à séparer plus tard.
7. **Rapports et recherche globale sur données fictives.** Le menu Rapports
   (trois entrées) et la recherche globale restent alimentés par des données
   de démonstration, visibles par tous les profils connectés. Ce n'est pas
   un écart des stories retenues (module 5 non livré), mais c'est visible
   pendant la campagne : à signaler aux testeurs pour éviter les faux
   positifs.
8. **Prérequis de migrations pour certains cas.** La composition par édition
   (SC-DSI-03), le taux absent sur droits nuls (SC-DSI-09, étapes 3 et 4),
   les actions requises (SC-TRA-03) et le vocabulaire d'archivage des
   sociétés (SC-ADM-02) supposent les migrations 096 à 109 jouées sur
   l'environnement et l'API redémarrée. Tant qu'elles ne le sont pas, ces
   étapes sortent en écart (par exemple un taux affiché 999,99 au lieu
   d'absent, ou des boutons encore libellés Désactiver et Réactiver).

## 12. Points à trancher en atelier

1. Droits du profil Saisie sur la lecture des licences (écart 1).
2. Boîte de réception de recette pour le volet courriel (écart 4).
3. Devenir du profil Saisie dans le modèle « tout est profil » (inaltérable
   ou profil ajouté, question ouverte de la #276), et dashboard de référence
   des profils ajoutés (écart 5).
4. Portée de la délégation : accès du délégataire aux paramètres du tenant
   (écart 6).
5. Gravités des actions requises (#324) : bloquant contre recommandé, à
   ajuster en recette.
6. Sort des lignes de maintenance historiques sans date de fin (servies
   échues depuis la #280) : passe de saisie des dates manquantes.
7. Effet métier d'une société archivée (#281) : sélecteurs, périmètre des
   droits.
8. Modalités de la supervision en production : compte dédié, données
   neutres, seuils d'alerte sur les durées.
