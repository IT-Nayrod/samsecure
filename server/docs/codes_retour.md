# Pre-catalogue des codes retour

Fichier transitoire alimente au fil du developpement. La story #68 fera les
INSERT en base a partir de ce tableau et remplacera les retours commentes par
le helper d'enveloppe. Ne pas implementer de resolution de code ici.

Plages : administration 2000-2999 | contrats 3000-3099 |
commandes 3100-3199 | documents 3200-3299 | validation 3300-3399 |
droits 3400-3499

## Administration des comptes, trace probante (#79)

Plage administration 2000-2999. Ces codes ne sont pas des reponses HTTP : ils
identifient un evenement ecrit dans audit_log, la route repondant par ailleurs
son propre code de succes. Ils sont catalogues ici pour que la #68 puisse les
resoudre comme les autres.

| Code | Type | Evenement | Route |
|------|------|-----------|-------|
| 2000 | trace | Compte cree | POST /api/utilisateurs |
| 2001 | trace | Compte modifie | PATCH /api/utilisateurs/:id |
| 2002 | trace | Compte active | PATCH /api/utilisateurs/:id |
| 2003 | trace | Compte desactive | PATCH /api/utilisateurs/:id |
| 2004 | trace | Desactivation planifiee | PATCH /api/utilisateurs/:id |
| 2005 | trace | Planification levee | PATCH /api/utilisateurs/:id |
| 2006 | trace | Mise en fonction planifiee | PATCH /api/utilisateurs/:id |
| 2007 | erreur | Cet email est deja utilise | POST, PATCH /api/utilisateurs |
| 2010 | trace | Mot de passe defini par un administrateur | POST /api/utilisateurs |
| 2011 | reserve | [PREREQUIS] Mail de reinitialisation envoye. Route inexistante | - |
| 2012 | reserve | [PREREQUIS] Mot de passe reinitialise par lien. Route inexistante | - |
| 2020 | trace | Groupe attribue | POST /api/utilisateurs/:id/profils |
| 2021 | trace | Groupe retire | DELETE /api/utilisateurs/:id/profils/:attribId |
| 2030 | trace | Connexion reussie | POST /api/auth/login |
| 2040 | reserve | [PREREQUIS] Execution d'une planification a l'echeance. Aucun ordonnanceur n'existe | - |
| 2041 | reserve | [PREREQUIS] Activation de la double authentification. Aucune route serveur | - |
| 2050 | erreur | Utilisateur introuvable | GET /api/utilisateurs/:id/historique |
| 2051 | erreur | Cet utilisateur n'est pas dans votre perimetre | GET /api/utilisateurs/:id/historique |
| 2052 | succes | Historique du compte | GET /api/utilisateurs/:id/historique |
| 2099 | erreur | Erreur serveur inattendue (module administration) | toutes |

Les champs sensibles ne sont jamais ecrits dans valeur_avant ni valeur_apres :
mot de passe, hash, jetons et secret 2FA sont retires A L'ECRITURE par
filtrerSensibles(), et non masques a la lecture. Une trace ne doit pas contenir
de secret, meme si personne ne la lit : un hash bcrypt reste attaquable hors
ligne, un jeton reste rejouable. La cle est retiree entierement plutot que
caviardee, sa seule presence revelerait deja le changement, et l'action suffit
a le dire.

Les codes 2011, 2012, 2040 et 2041 sont reserves et non emis : les routes
correspondantes n'existent pas. Voir les STOP remontes avec la #79.

## Contrats (#41)

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 3000 | succes | Liste des contrats | GET /api/contrats |
| 3001 | succes | Detail du contrat | GET /api/contrats/:id |
| 3002 | succes | Contrat cree | POST /api/contrats |
| 3003 | succes | Contrat modifie | PATCH /api/contrats/:id |
| 3004 | succes | Contrat supprime | DELETE /api/contrats/:id |
| 3010 | erreur | Contrat introuvable | GET/PATCH/DELETE /api/contrats/:id |
| 3011 | erreur | Le libelle est obligatoire | POST, PATCH /api/contrats |
| 3012 | erreur | Le type de contrat est obligatoire | POST, PATCH /api/contrats |
| 3013 | erreur | La date de debut doit preceder la date de fin | POST, PATCH /api/contrats |
| 3014 | erreur | Type de contrat introuvable | POST, PATCH /api/contrats |
| 3015 | erreur | Editeur introuvable | POST, PATCH /api/contrats |
| 3016 | erreur | Societe signataire introuvable | POST, PATCH /api/contrats |
| 3017 | erreur | Revendeur signataire introuvable | POST, PATCH /api/contrats |
| 3018 | erreur | Contrat parent introuvable | POST, PATCH /api/contrats |
| 3019 | erreur | Ce rattachement creerait un cycle | POST, PATCH /api/contrats |
| 3020 | erreur | Suppression impossible : elements lies | DELETE /api/contrats/:id |
| 3021 | avertissement | Parent non cadre, anomalie qualite enregistree | POST, PATCH /api/contrats |
| 3099 | erreur | Erreur serveur inattendue (module contrats) | toutes |

Le 3021 n'est pas un refus : le rattachement est accepté. Il est réservé pour que la #68 puisse, si Dorian le décide, remonter l'avertissement au front. Signalez-lui ce cas, la consigne ne prévoit de code que pour les refus.

## Commandes (#44)

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 3100 | succes | Liste des commandes | GET /api/commandes |
| 3101 | succes | Detail de la commande | GET /api/commandes/:id |
| 3102 | succes | Commande creee | POST /api/commandes |
| 3103 | succes | Commande modifiee | PATCH /api/commandes/:id |
| 3104 | succes | Commande supprimee | DELETE /api/commandes/:id |
| 3110 | erreur | Commande introuvable | GET/PATCH/DELETE /api/commandes/:id |
| 3111 | erreur | Le libelle est obligatoire | POST, PATCH /api/commandes |
| 3112 | erreur | Le contrat est obligatoire | POST, PATCH /api/commandes |
| 3113 | erreur | Contrat introuvable | POST, PATCH /api/commandes |
| 3114 | erreur | La societe acheteuse est obligatoire | POST, PATCH /api/commandes |
| 3115 | erreur | Societe acheteuse introuvable | POST, PATCH /api/commandes |
| 3116 | erreur | Revendeur introuvable | POST, PATCH /api/commandes |
| 3117 | erreur | Mode de commande introuvable | POST, PATCH /api/commandes |
| 3118 | erreur | Le montant est obligatoire | POST, PATCH /api/commandes |
| 3119 | erreur | Le montant doit etre strictement positif | POST, PATCH /api/commandes |
| 3120 | erreur | La date de commande est obligatoire | POST, PATCH /api/commandes |
| 3121 | erreur | La date de fin doit etre posterieure a la date de commande | POST, PATCH /api/commandes |
| 3130 | erreur | Suppression impossible : elements lies | DELETE /api/commandes/:id |
| 3140 | succes | Agregats financiers | GET /api/commandes/agregats |
| 3141 | erreur | L'endpoint accepte soit annee, soit le couple date_debut / date_fin. Le precalcul etant mensuel, une plage au jour pres est servie au mois pres et les bornes appliquees sont renvoyees dans periode_debut et periode_fin. | GET /api/commandes/agregats |
| 3142 | erreur | Identifiant de societe invalide | GET /api/commandes/agregats |
| 3143 | erreur | Identifiant d'editeur invalide | GET /api/commandes/agregats |
| 3144 | erreur | La periode demandee est invalide | GET /api/commandes/agregats |
| 3199 | erreur | Erreur serveur inattendue (module commandes) | toutes |

Le montant refuse le zero, le negatif et la saisie non numerique sous le meme
code 3119 : dans les trois cas la valeur n'est pas un montant valide, et
distinguer n'apporterait rien a l'utilisateur.

## Documents (#48)

Plage documents 3200-3299, decoupee en preuves 3200-3239, factures 3240-3279,
commun 3280-3299.

### Preuves

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 3200 | succes | Liste des preuves | GET /api/preuves |
| 3201 | succes | Detail de la preuve | GET /api/preuves/:id |
| 3202 | succes | Preuve creee | POST /api/preuves |
| 3203 | succes | Preuve modifiee | PATCH /api/preuves/:id |
| 3204 | succes | Preuve supprimee | DELETE /api/preuves/:id |
| 3210 | erreur | Preuve introuvable | GET/PATCH/DELETE /api/preuves/:id |
| 3211 | erreur | Le libelle est obligatoire | POST, PATCH /api/preuves |
| 3212 | erreur | Le type de preuve est obligatoire | POST, PATCH /api/preuves |
| 3213 | erreur | Type de preuve introuvable | POST, PATCH /api/preuves |
| 3214 | erreur | Une preuve doit etre rattachee a un contrat, a une commande, ou aux deux | POST, PATCH /api/preuves |
| 3215 | erreur | Contrat introuvable | POST, PATCH /api/preuves |
| 3216 | erreur | Commande introuvable | POST, PATCH /api/preuves |
| 3217 | erreur | Le chemin du fichier est obligatoire | POST, PATCH /api/preuves |
| 3218 | erreur | L'empreinte SHA-256 doit comporter 64 caracteres hexadecimaux | POST, PATCH /api/preuves |
| 3219 | erreur | Valeur de filtre invalide | GET /api/preuves |
| 3230 | erreur | Suppression impossible : preuve rattachee a une facture | DELETE /api/preuves/:id |
| 3231 | reserve | [ARBITRAGE D27] lien externe GED refuse. Non emis a ce jour | POST, PATCH /api/preuves |

### Factures

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 3240 | succes | Liste des factures | GET /api/factures |
| 3241 | succes | Detail de la facture | GET /api/factures/:id |
| 3242 | succes | Facture creee | POST /api/factures |
| 3243 | succes | Facture modifiee | PATCH /api/factures/:id |
| 3244 | succes | Facture supprimee | DELETE /api/factures/:id |
| 3250 | erreur | Facture introuvable | GET/PATCH/DELETE /api/factures/:id |
| 3251 | erreur | Le libelle est obligatoire | POST, PATCH /api/factures |
| 3252 | erreur | La commande est obligatoire | POST, PATCH /api/factures |
| 3253 | erreur | Commande introuvable | POST, PATCH /api/factures |
| 3254 | erreur | Preuve introuvable | POST, PATCH /api/factures |
| 3255 | reserve | [ARBITRAGE flux] la preuve est obligatoire des la creation. Non emis a ce jour | POST /api/factures |
| 3259 | erreur | Valeur de filtre invalide | GET /api/factures |

### Commun

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 3299 | erreur | Erreur serveur inattendue (module documents) | toutes |

Deux points restaient en arbitrage au moment de la #48 et ne sont pas codes.
D27, acceptation d'un lien externe GED a la place d'un fichier : aucun controle
de format n'est applique sur url_fichier, la chaine est stockee telle quelle,
et hash_sha256 reste facultatif. Flux de creation de facture : id_preuve suit
le DDL, il est facultatif, seule son existence est verifiee quand il est
fourni. Les codes 3231 et 3255 sont reserves pour ces deux regles.

url_fichier est obligatoire des la #48 et non a partir de la #49 : la colonne
est NOT NULL en base et la decision du 11/08 est de ne pas migrer, les deux
taches partant ensemble sur staging. En #49 le champ sera renseigne par le
module de depot au lieu du client, sans changement du contrat d'API.

### Preuves, depot et telechargement du fichier (#49)

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 3205 | succes | Fichier depose | POST /api/preuves/:id/fichier |
| 3206 | succes | Fichier servi | GET /api/preuves/:id/fichier |
| 3220 | erreur | Aucun fichier n'a ete transmis | POST /api/preuves/:id/fichier |
| 3221 | erreur | Extension non admise, formats acceptes pdf png jpg jpeg | POST /api/preuves/:id/fichier |
| 3222 | erreur | Le fichier depasse la taille maximale de 20 Mo (413) | POST /api/preuves/:id/fichier |
| 3223 | erreur | Le contenu du fichier ne correspond pas a son extension | POST /api/preuves/:id/fichier |
| 3224 | erreur | Aucun fichier n'a ete depose pour cette preuve | GET /api/preuves/:id/fichier |
| 3225 | erreur | Le fichier est introuvable dans le stockage | GET /api/preuves/:id/fichier |
| 3226 | erreur | Chemin de stockage invalide, traversee refusee | GET /api/preuves/:id/fichier |
| 3227 | erreur | Un seul fichier peut etre depose, dans le champ fichier | POST /api/preuves/:id/fichier |
| 3232 | reserve | [ARBITRAGE D27] redirection vers un lien GED externe. Non emis a ce jour | GET /api/preuves/:id/fichier |
| 3245 | succes | Facture et preuve creees en une transaction | POST /api/factures/depot |
| 3256 | erreur | Le fichier justificatif est obligatoire, depot combine | POST /api/factures/depot |

Le 3222 est le seul 413 du projet. Les autres refus de validation restent en
400 : ici le refus ne porte pas sur la forme de la donnee mais sur la taille de
la requete, et le front doit pouvoir le distinguer pour afficher la limite.

Le 3223 verifie la signature binaire du contenu (%PDF, PNG, JPEG) et non le
type MIME annonce par le client, qui n'engage personne : sans lui, le filtre
par extension se contournerait en renommant un executable en .pdf. Ce n'est
pas un antivirus, explicitement hors perimetre de la #49.

Les codes 3224, 3225 et 3226 sont trois causes distinctes cote serveur mais
deux messages seulement : une url_fichier non conforme et une traversee de
chemin refusee renvoient le meme message qu'une preuve sans fichier, pour ne
rien divulguer de l'organisation du stockage. Le detail part dans les logs.

### Detection des manques documentaires (#50)

Plage commune 3280-3289. La ressource est la commande, mais la fonctionnalite
appartient au module documents : les codes restent donc dans la plage 3200-3299
et non dans celle des commandes.

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 3280 | succes | Liste des commandes en manque documentaire | GET /api/commandes/manques |
| 3281 | erreur | Identifiant de societe invalide | GET /api/commandes/manques |
| 3282 | erreur | Identifiant de contrat invalide | GET /api/commandes/manques |
| 3283 | erreur | L'annee demandee est invalide | GET /api/commandes/manques |

Endpoint de lecture seule : aucune ligne n'est ecrite dans anomalie_qualite, la
detection est une vue temps reel et non un stock d'anomalies. Une commande est
en manque si elle n'a aucune facture rattachee par facture.id_commande, ou
aucune preuve rattachee par preuve.id_commande. Les deux conditions sont
testees independamment : depuis la resolution E3, la preuve pointee par
facture.id_preuve n'est pas necessairement rattachee a la commande, et passer
par elle produirait un faux complet.

### Arbitrage du flux facture, rendu le 11/08

Le depot combine POST /api/factures/depot est desormais implemente : fichier,
preuve et facture naissent dans une seule transaction, ou pas du tout. Le
fichier ecrit avant un echec est supprime, aucune preuve orpheline ne subsiste.
La preuve creee est rattachee a la commande et jamais au seul contrat, ce
rattachement direct etant celui que la detection des manques exige.

Le code 3255 reste reserve : POST /api/factures accepte toujours une facture
sans preuve. Durcir cette route interdirait toute saisie de facture hors depot
de fichier, y compris une reprise de donnees, ce qui n'a pas ete demande. A
trancher separement.

## Validation des saisies (#53)

Plage validation 3300-3399. Le statut n'est pas une colonne des tables metier :
il est la derniere entree de workflow_validation designant l'entite. Les quatre
ressources du module 2 se comportent a l'identique.

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 3300 | succes | Saisie validee | POST /api/validation/:entite_type/:entite_id/valider |
| 3301 | succes | Saisie refusee | POST /api/validation/:entite_type/:entite_id/refuser |
| 3310 | erreur | Type d'entite inconnu du workflow de validation | les deux |
| 3311 | erreur | Entite introuvable | les deux |
| 3312 | erreur | Cette saisie ne porte aucune demande de validation | les deux |
| 3313 | erreur | Seule une saisie en attente peut etre traitee | les deux |
| 3314 | erreur | Le motif de refus est obligatoire | POST .../refuser |
| 3399 | erreur | Erreur serveur inattendue (module validation) | toutes |

La soumission automatique n'a pas de code propre : creation et modification
inserent leur entree en_attente dans la transaction de l'ecriture metier et
repondent sous le code de cette ecriture, 3002, 3103, 3242, 3203 et leurs
voisins. Une soumission qui echoue fait echouer l'ecriture, jamais l'inverse.

Le 3312 est residuel depuis la migration 020, qui a rattrape le parc anterieur.
Il subsiste pour le cas d'une entite creee par un chemin qui ne soumet pas :
refus explicite plutot que creation implicite, un traitement ne doit pas
fabriquer la demande qu'il traite.

Le 3313 est le seul refus qui depend de l'etat et non de la saisie : valider une
entite deja validee, refuser une entite deja refusee, ou traiter une entite que
quelqu'un vient de modifier. Il renvoie le statut courant en plus du message,
pour que le front puisse se resynchroniser sans second appel.

Aucun controle de profil dans cette tache, decision de sequencement actee : tout
utilisateur authentifie soumet et traite, y compris ses propres saisies. La
restriction arrive avec la story Droits et se branchera dans traiter(), entre le
chargement de l'entite et la lecture du statut courant.

## Controle des permissions (transverse)

Plage droits 3400-3499. Le controle est central, monte une seule fois dans
index.js apres l'authentification : aucun routeur ne declare de permission, la
table server/config/routesPermissions.js est la seule source.

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 3400 | erreur | Cette action n'est pas permise pour votre niveau de droit. Permission requise : <code>. | toutes les routes protegees |
| 3499 | erreur | Erreur serveur inattendue (calcul des droits) | toutes les routes protegees |

Le 3400 nomme la permission manquante. C'est un choix assume : le support et
l'administrateur qui utilise le simulateur de droits doivent pouvoir dire quelle
permission attribuer sans lire les journaux. Le vocabulaire expose est celui du
referentiel permission, deja visible dans l'ecran d'administration.

Le controle est fail-closed. Une route protegee absente de la table est refusee
avec le meme 3400, et l'anomalie part dans les logs sous le prefixe [rbac]. Une
route ajoutee sans sa ligne de permission se voit donc immediatement, au lieu de
rester ouverte en silence.

Un compte supprime, ou hors de sa periode d'activite, n'a aucune permission
meme porteur d'un jeton encore valide. Sans ce controle le soft delete ne
protegeait rien : l'utilisateur desactive conservait tous ses droits jusqu'a
l'expiration de son jeton, soit quinze minutes, et pouvait les renouveler par
son jeton de rafraichissement.

La variable d'environnement RBAC_STRICT pilote le mode. Absente ou differente
de "false", elle vaut strict et le refus est un 403. A "false", le refus est
journalise sans bloquer, pour observer les refus reels d'un environnement avant
de couper. Un defaut permissif aurait ete un piege : un .env incomplet aurait
silencieusement desactive le controle.
