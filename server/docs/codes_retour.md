# Pre-catalogue des codes retour

Fichier transitoire alimente au fil du developpement. Les codes sont en base
(BDD Commune, table code_retour, migrations 024 et 025) et la story #68 a
remplace les retours commentes du module 2 par le helper d'enveloppe
`server/utils/reponse.js` (24/08/2026). Ce fichier reste la source de
redaction des nouveaux codes : tout nouveau code y est ajoute puis seede par
migration avant d'etre emis.

Enveloppe (#68) :
- succes : `{ code, type: "succes", libelle, data }`
- erreur : `{ code, type: "erreur", libelle, error, details? }` ; `error` est
  le message rendu (par defaut le libelle du catalogue, surcharge par la route
  quand le message est interpole : 3020, 3130, 3230, 3313, 3400), `details` le
  complement structure (bloquants, permission_requise, statut_validation).
- en-tete `X-Code-Retour: <code>` sur toute reponse, seul vecteur du 3206
  (telechargement binaire).
- le statut HTTP reste decide route par route ; les suppressions repondent
  200 avec `data: null` (plus de 204 sans corps).
- catalogue charge au demarrage de l'API ; un code absent du catalogue est
  emis avec `libelle: null` et signale en console.

Perimetre enveloppe au 25/08 : contrats, commandes, preuves, factures,
validation, stockagePreuves, controle des permissions (3400, 3499),
inventaire (#111, 4200-4299), budget (#146, 5100-5199). Non
enveloppes : routes d'administration (2000-2999), auth, mails, referentiels,
permissions, droits-effectifs (aucun code au catalogue pour ces trois
derniers), 404 et 500 globaux de index.js.

Plages : transverse 1000-1999 | administration 2000-2999 | contrats 3000-3099 |
commandes 3100-3199 | documents 3200-3299 | validation 3300-3399 |
droits 3400-3499 | licences 4000-4099 (module 3, partie A) |
affectations 4100-4199 (module 3, partie B) | inventaire 4200-4299 (module 3, #111) |
budget 5100-5199 (module 4, partie A, #146)

## Transverse : socle d'envoi de mails (#87)

Plage transverse 1000-1999. Le socle est server/utils/mail.js, point de
passage unique de tout mail de l'application. Les codes 1000 a 1003 sont des
etats renvoyes par envoyerMail() a l'appelant, pas des reponses HTTP : la route
appelante repond son propre code et joint l'etat du mail.

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 1000 | succes | Mail envoye | envoyerMail(), toutes routes appelantes |
| 1001 | erreur | L'envoi de mails n'est pas configure sur ce serveur | envoyerMail(), toutes routes appelantes |
| 1002 | erreur | Adresse de destinataire absente ou invalide | envoyerMail(), toutes routes appelantes |
| 1003 | erreur | Le mail n'a pas pu etre envoye. L'incident a ete journalise | envoyerMail(), toutes routes appelantes |
| 1010 | succes | Mail de test envoye | POST /api/mails/test |
| 1011 | erreur | Mail de test non envoye (etat 1001 a 1003 joint) | POST /api/mails/test |
| 1099 | erreur | Erreur serveur inattendue (module mails) | POST /api/mails/test |

Un echec d'envoi ne fait jamais echouer l'action appelante : envoyerMail() ne
leve pas, elle renvoie { envoye: false, code, erreur } et l'action repond en
succes avec cet etat joint. Le motif technique (code SMTP, reponse du serveur,
variables manquantes) est ecrit dans log_serveur (niveau error, source mail)
et jamais renvoye au client.

La configuration est lue exclusivement dans SMTP_HOST, SMTP_PORT, SMTP_SECURE,
SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_FROM_NAME et MAIL_REPLY_TO (optionnelle).
Aucune adresse ni valeur de repli dans le code : variables absentes = 1001.

POST /api/mails/test exige gerer_connecteurs, detenue par le seul groupe
admin_sam dans la matrice (011, 021) : la route est reservee au profil
administrateur sans qu'un nom de profil soit code dans l'API.

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
| 2011 | trace | Mail de reinitialisation envoye via le socle #87 (etat 1000 a 1003 joint) | POST /api/utilisateurs/:id/mot-de-passe/reinitialisation |
| 2012 | reserve | [PREREQUIS] Mot de passe reinitialise par lien. Route inexistante | - |
| 2013 | succes | Mot de passe defini | PUT /api/utilisateurs/:id/mot-de-passe |
| 2014 | succes | Mot de passe genere | POST /api/utilisateurs/:id/mot-de-passe/generer |
| 2015 | erreur | Le mot de passe ne respecte pas la politique | PUT /api/utilisateurs/:id/mot-de-passe |
| 2016 | erreur | Le mot de passe est obligatoire | PUT /api/utilisateurs/:id/mot-de-passe |
| 2017 | erreur | Cette action doit etre effectuee depuis l'interface | les deux |
| 2018 | trace | Mot de passe genere par un administrateur | POST /api/utilisateurs/:id/mot-de-passe/generer |
| 2019 | succes | Mail de reinitialisation envoye, ou lien genere mais mail non envoye (mail_envoye, erreur_mail, code_mail) | POST /api/utilisateurs/:id/mot-de-passe/reinitialisation |
| 2020 | trace | Groupe attribue | POST /api/utilisateurs/:id/profils |
| 2021 | trace | Groupe retire | DELETE /api/utilisateurs/:id/profils/:attribId |
| 2022 | trace | Exception de droit ajoutee | POST /api/utilisateurs/:id/exceptions |
| 2023 | trace | Exception de droit modifiee | PATCH /api/utilisateurs/:id/exceptions/:excId |
| 2024 | trace | Exception de droit supprimee | DELETE /api/utilisateurs/:id/exceptions/:excId |
| 2025 | succes | Lien de reinitialisation valide | GET /api/mot-de-passe/reinitialisation/:jeton |
| 2026 | succes | Mot de passe reinitialise | POST /api/mot-de-passe/reinitialisation/:jeton |
| 2027 | erreur | Ce lien n'est plus valide | GET, POST /api/mot-de-passe/reinitialisation/:jeton |
| 2028 | trace | Lien de reinitialisation emis par un administrateur | POST /api/utilisateurs/:id/mot-de-passe/reinitialisation |
| 2029 | erreur | Compte desactive, reactivation requise | POST /api/utilisateurs/:id/mot-de-passe/reinitialisation |
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

Les codes 2012, 2040 et 2041 sont reserves et non emis : les routes
correspondantes n'existent pas. Voir les STOP remontes avec la #79. Le 2011
est emis depuis le branchement du socle mail (#87) : la reinitialisation par
lien correspondant au 2012 est portee par le 2026.

Le 2015 renvoie la liste des exigences non satisfaites dans
exigences_non_satisfaites, en plus du message : le front peut ainsi signaler
chaque regle manquante sans reimplementer la politique.

Aucune reponse ne contient de mot de passe ni de hash, a la seule exception du
2014 qui renvoie la valeur generee une fois. Elle n'est stockee nulle part
ailleurs qu'en hash bcrypt et ne peut plus etre relue ensuite.

Le 2017 depend de ORIGINE_STRICTE. Ce controle n'arrete pas un attaquant, un
en-tete Origin se falsifie : l'authentification passant par un jeton Bearer et
non par un cookie, il n'existe pas de scenario ou un site tiers forge cet
appel. Il interdit les appels hors interface et les rend visibles.

Le 2027 est volontairement unique pour trois causes distinctes : jeton
inexistant, expire, deja consomme. Les distinguer indiquerait a un visiteur
qu'un compte existe, ou qu'un lien a deja servi. Il repond 410 et non 404 : la
ressource a existe et n'existe plus, c'est exactement ce que dit ce statut.

La reponse 2019 ne contient plus le lien : depuis le branchement du socle
mail (#87), il ne transite que par le mail du titulaire. Elle porte
mail_envoye, et en cas d'echec erreur_mail et code_mail (1001 a 1003). La
demande reste un succes meme si le mail n'est pas parti : le jeton existe,
l'administrateur voit l'etat et peut relancer, ce qui invalide le precedent.
La trace 2028 porte mail_envoye dans valeur_apres, sans jeton ni lien ; le
motif technique d'un echec est dans log_serveur, jamais dans audit_log.

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

## Affectations, usage declare et revalidation (#106, M3-B)

Plage 4100-4199, deuxieme plage des modules 3 et 4 (reserves par la 024, licences en 4000-4099),
seedee par la migration Commune 029. Les affectations passent par le circuit
de validation unique du module 2 : la validation et le refus repondent sous les
codes 3300 et 3301 de `POST /api/validation/affectation/:id/...`, aucun code
propre. Le hook `apresTraitement` du catalogue ouvre le cycle de revalidation
dans la transaction du traitement.

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 4100 | succes | Liste des affectations | GET /api/affectations |
| 4101 | succes | Detail de l'affectation | GET /api/affectations/:id |
| 4102 | succes | Affectation declaree et soumise a validation | POST /api/affectations (201) |
| 4103 | succes | Affectation modifiee et resoumise a validation | PATCH /api/affectations/:id |
| 4104 | succes | Affectation supprimee | DELETE /api/affectations/:id (200, data null) |
| 4105 | succes | Affectation revalidee, nouveau cycle ouvert | POST /api/affectations/:id/revalider |
| 4106 | succes | Decompte des usages declares pour la conformite | GET /api/affectations/decompte |
| 4107 | succes | Historique des declarations | GET /api/affectations/historique |
| 4110 | erreur | Affectation introuvable | routes /affectations/:id (404) |
| 4111 | erreur | La licence est obligatoire | POST, PATCH |
| 4112 | erreur | Licence introuvable | POST, PATCH |
| 4113 | erreur | La societe est obligatoire | POST, PATCH |
| 4114 | erreur | Societe introuvable | POST, PATCH |
| 4115 | erreur | La quantite doit etre un entier strictement positif | POST, PATCH |
| 4116 | erreur | La reference client est obligatoire | POST, PATCH |
| 4117 | erreur | Identifiant de societe invalide | filtres GET |
| 4118 | erreur | Identifiant de produit invalide | filtres GET |
| 4119 | erreur | Identifiant de licence invalide | filtre GET /affectations |
| 4130 | erreur | Seule une affectation validee peut etre revalidee | POST .../revalider (409, `details.statut_validation`) |
| 4132 | erreur | Suppression impossible : affectation rapprochee d'un inventaire | DELETE (409, `details.inventaires`) |
| 4199 | erreur | Erreur serveur inattendue (module affectations) | toutes |

Statuts servis par les GET : `statut_validation` est la derniere entree
`workflow_validation`, reecrite a la lecture en `a_revalider` quand elle vaut
`valide` et que `date_prochaine_revalidation` est depassee (jamais persistee) ;
`statut_revalidation` vaut `a_jour`, `a_revalider` (echeance a 15 jours ou
moins) ou `depasse`, et n'est servi que sur une affectation validee.

Decompte (4106) : somme brute des quantites des affectations dont la derniere
entree du workflow est `valide` (donc `valide` + `a_revalider` de lecture),
par produit et societe, sans deduplication par reference (hypothese v0.5
assumee), avec `droits_total` par produit (somme `licence.quantite`).

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

## Licences (#102, module 3 partie A)

Plage 4000-4099, seedee par la migration 028. Routeur `server/routes/licences.js`
et referentiels du module `server/routes/referentielsLicences.js`. Lecture sur
`consulter_licences`, ecriture sur `saisir_licence`, montants (cout_licence,
cout de maintenance) servis a null avec `montants_masques: true` sans
`consulter_kpi_financiers`.

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 4000 | succes | Liste des licences | GET /api/licences |
| 4001 | succes | Detail de la licence | GET /api/licences/:id |
| 4002 | succes | Licence creee | POST /api/licences |
| 4003 | succes | Licence modifiee | PATCH /api/licences/:id |
| 4004 | succes | Licence supprimee | DELETE /api/licences/:id |
| 4005 | succes | Historique de maintenance de la licence | GET /api/licences/:id/maintenance |
| 4006 | succes | Periode de maintenance ajoutee | POST /api/licences/:id/maintenance |
| 4007 | succes | Periode de maintenance modifiee | PATCH /api/licences/:id/maintenance/:mid |
| 4008 | succes | Periode de maintenance supprimee | DELETE /api/licences/:id/maintenance/:mid |
| 4009 | succes | Maintenance arretee, version figee | POST /api/licences/:id/arret-maintenance |
| 4010 | erreur | Licence introuvable | GET/PATCH/DELETE /api/licences/:id et sous-routes (400 sur un filtre invalide de la liste) |
| 4011 | erreur | Le produit est obligatoire | POST, PATCH /api/licences |
| 4012 | erreur | Produit introuvable au catalogue | POST, PATCH /api/licences |
| 4013 | erreur | Edition introuvable ou etrangere au produit | POST, PATCH /api/licences |
| 4014 | erreur | Version introuvable ou etrangere au produit | POST, PATCH /api/licences |
| 4015 | erreur | Commande introuvable | POST, PATCH /api/licences |
| 4016 | erreur | Revendeur introuvable | POST, PATCH /api/licences et maintenance |
| 4017 | erreur | Unite de mesure introuvable | POST, PATCH /api/licences |
| 4018 | erreur | Le type de licence doit etre perpetuelle ou souscription | POST, PATCH /api/licences, GET /api/licences?type= |
| 4019 | erreur | La quantite doit etre un entier positif ou nul | POST, PATCH /api/licences |
| 4020 | erreur | Le cout doit etre un montant positif ou nul | POST, PATCH /api/licences |
| 4021 | erreur | La date de fin de souscription est obligatoire pour une souscription | POST, PATCH /api/licences |
| 4022 | erreur | Mainteneur introuvable | POST, PATCH /api/licences et maintenance |
| 4023 | erreur | Suppression impossible : elements lies | DELETE /api/licences/:id (409, details = compteurs affectations et budgets) |
| 4024 | erreur | Date invalide | POST, PATCH /api/licences et maintenance |
| 4030 | erreur | Periode de maintenance introuvable | PATCH/DELETE /api/licences/:id/maintenance/:mid |
| 4031 | erreur | La date de debut est obligatoire | POST, PATCH .../maintenance |
| 4032 | erreur | La date de fin doit etre posterieure a la date de debut | POST, PATCH .../maintenance |
| 4033 | erreur | Le cout de maintenance doit etre un montant positif ou nul | POST, PATCH .../maintenance |
| 4040 | erreur | La maintenance de cette licence est deja arretee | POST .../arret-maintenance (409) |
| 4041 | erreur | La date d'arret est invalide | POST .../arret-maintenance |
| 4042 | erreur | Version a figer introuvable ou etrangere au produit | POST .../arret-maintenance |
| 4043 | erreur | Cette licence ne porte aucune maintenance a arreter | POST .../arret-maintenance (409) |
| 4044 | succes | Maintenance reprise, version liberee | POST .../reprise-maintenance |
| 4045 | erreur | La maintenance de cette licence n'est pas arretee | POST .../reprise-maintenance (409) |
| 4050 | succes | Catalogue des produits (versions et editions incluses) | GET /api/produits |
| 4051 | succes | Liste des unites de mesure | GET /api/unites-mesure |
| 4052 | succes | Liste des mainteneurs | GET /api/mainteneurs |
| 4059 | erreur | Erreur serveur inattendue (referentiels du module licences) | les trois |
| 4099 | erreur | Erreur serveur inattendue (module licences) | toutes |

Regles v0.5 assumees : une souscription est `expire` le jour meme de sa date
de fin, sans tolerance, et sort de la balance droits/usage ; l'arret de
maintenance fige `version_figee_id` (par defaut la version courante) et
`date_arret_maintenance` sans retirer de droit quantitatif ; les licences ne
passent pas par le workflow de validation (#53).

## Inventaire, import et ecarts (#111, module 3)

Plage 4200-4299, seedee par la migration 030. Routeur server/routes/inventaire.js,
stockage server/utils/stockageInventaire.js (meme pattern que les preuves :
nom neutre <uuid>.csv, hash SHA-256, mode 0640, sous-repertoire inventaire/
de PREUVES_DIR ou INVENTAIRE_DIR). Aucune modification du schema v4 :
inventaire_raw porte un pointeur "<fichier>#L<n>" vers la ligne du fichier
archive, log_import.type_import vaut "inventaire_csv:<fichier>", les erreurs
ligne a ligne sont des lignes anomalie_qualite (entite log_import).

Doctrine actee : l'outil constate et alerte, il ne cree ni ne modifie jamais
une affectation. Le rapprochement est manuel.

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 4200 | succes | Liste des imports d'inventaire | GET /api/inventaire/imports |
| 4201 | succes | Detail de l'import | GET /api/inventaire/imports/:id |
| 4202 | succes | Import d'inventaire effectue | POST /api/inventaire/imports (201, statut succes) |
| 4203 | succes | Liste des releves d'inventaire | GET /api/inventaire/releves |
| 4204 | succes | Detail du releve | GET /api/inventaire/releves/:id |
| 4205 | succes | Ecarts d'inventaire | GET /api/inventaire/ecarts |
| 4206 | succes | Releve rapproche de l'affectation | POST /api/inventaire/releves/:id/rapprocher |
| 4207 | succes | Releve marque en ecart assume | POST /api/inventaire/releves/:id/ecart-assume |
| 4208 | succes | Releve rejete | POST /api/inventaire/releves/:id/rejeter |
| 4209 | succes | Releve remis en attente | POST /api/inventaire/releves/:id/reouvrir |
| 4210 | succes | Liste des affectations rapprochables | GET /api/inventaire/affectations |
| 4211 | avertissement | Import effectue avec des lignes en erreur | POST /api/inventaire/imports (201, statut succes_partiel, erreurs jointes) |
| 4220 | erreur | Import introuvable | GET /api/inventaire/imports/:id |
| 4221 | erreur | Releve introuvable | GET, POST /api/inventaire/releves/:id/... |
| 4222 | erreur | Aucun fichier n'a ete transmis | POST /api/inventaire/imports |
| 4223 | erreur | Extension non admise, format accepte csv | POST /api/inventaire/imports |
| 4224 | erreur | Le fichier depasse la taille maximale de 20 Mo (413) | POST /api/inventaire/imports |
| 4225 | erreur | Un seul fichier peut etre depose | POST /api/inventaire/imports |
| 4226 | erreur | Fichier vide ou illisible, encodage UTF-8 attendu | POST /api/inventaire/imports |
| 4227 | erreur | Colonnes obligatoires absentes : produit, reference, quantite (details.colonnes_manquantes) | POST /api/inventaire/imports |
| 4228 | erreur | Aucune ligne exploitable, import en echec (422, import trace en echec, erreurs dans details) | POST /api/inventaire/imports |
| 4229 | erreur | Societe introuvable | POST /api/inventaire/imports |
| 4230 | erreur | Valeur de filtre invalide | GET /api/inventaire/releves |
| 4231 | erreur | L'affectation est obligatoire | POST .../rapprocher |
| 4232 | erreur | Affectation introuvable | POST .../rapprocher |
| 4233 | erreur | Transition de statut non permise pour ce releve (409, details.statut_rapprochement) | POST .../rapprocher, ecart-assume, rejeter, reouvrir |
| 4234 | erreur | Le motif de rejet est obligatoire | POST .../rejeter |
| 4235 | reserve | Fichier archive introuvable, contenu du releve indisponible. Non emis : la liste sert la ligne avec fichier_absent true | GET /api/inventaire/releves |
| 4236 | erreur | Le fichier depasse le nombre maximal de lignes (10000) | POST /api/inventaire/imports |
| 4250 | trace | Inventaire importe (audit_log INVENTAIRE_IMPORTE) | POST /api/inventaire/imports |
| 4251 | trace | Releve rapproche (audit_log RELEVE_RAPPROCHE) | POST .../rapprocher |
| 4252 | trace | Releve marque en ecart assume (audit_log RELEVE_ECART_ASSUME) | POST .../ecart-assume |
| 4253 | trace | Releve rejete (audit_log RELEVE_REJETE) | POST .../rejeter |
| 4254 | trace | Releve remis en attente (audit_log RELEVE_REOUVERT) | POST .../reouvrir |
| 4299 | erreur | Erreur serveur inattendue (module inventaire) | toutes |

Transitions de statut (inventaire_raw.statut_rapprochement) :
rapprocher : en_attente ou ecart_detecte vers rapproche (id_affectation ecrit) ;
ecart-assume : en_attente ou rapproche vers ecart_detecte (id_affectation NULL) ;
rejeter : en_attente ou ecart_detecte vers rejete (motif obligatoire) ;
reouvrir : rapproche, ecart_detecte ou rejete vers en_attente.

Permissions (server/config/routesPermissions.js) : consulter_inventaire en
lecture (Admin, Manager DSI, IT Ops, Financier), rapprocher_inventaire sur les
quatre transitions (Admin, Manager DSI, IT Ops), importer_inventaire sur
l'import (Admin, Manager DSI ; migrations 031 Commune et 032 Tenant).

## Budget, socle donnees et API (#146, module 4 partie A)

Plage 5100-5199, reservee a la story et seedee par la migration Commune 034.
Routeur `server/routes/budget.js`. Socle Tenant : migration 033 (table budget
alignee et contrainte, DEFAULT 01/01 sur societe.debut_exercice_fiscal,
fonctions exercice_fiscal_de / _debut / _fin). Permissions : lecture
`consulter_budget` (Admin, Manager DSI, Financier, IT Ops), saisie et
preremplissage `saisir_budget` (Admin, Manager DSI, Financier ; retiree a IT
Ops par les migrations 035 et 036), suppression `supprimer_budget` (nouvelle
permission, 035 Commune et 036 Tenant : Admin, Manager DSI, Financier).

Doctrine : l'organisation payeuse n'est jamais stockee ni saisie sur la ligne,
elle se deduit de licence -> commande (d'origine) -> societe ; l'editeur est
celui du contrat de cette commande. Le previsionnel vient de la table budget,
l'engage vient des commandes reelles (precalcul_financier, 016 et 017) et n'y
touche jamais : pas de double previsionnel.

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 5100 | succes | Liste des lignes budgetaires | GET /api/budget |
| 5101 | succes | Detail de la ligne budgetaire | GET /api/budget/:id |
| 5102 | succes | Ligne budgetaire creee | POST /api/budget (201) |
| 5103 | succes | Ligne budgetaire modifiee | PATCH /api/budget/:id |
| 5104 | succes | Ligne budgetaire supprimee | DELETE /api/budget/:id (200, data null) |
| 5105 | succes | Projection previsionnelle preremplie depuis la maintenance en cours | GET /api/budget/preremplissage |
| 5106 | succes | Engage calcule depuis les commandes | GET /api/budget/engage |
| 5107 | succes | Synthese budgetaire : previsionnel, alloue, engage | GET /api/budget/synthese |
| 5110 | erreur | Ligne budgetaire introuvable | GET/PATCH/DELETE /api/budget/:id (404) |
| 5111 | erreur | La licence est obligatoire | POST, PATCH /api/budget, GET /api/budget/preremplissage |
| 5112 | erreur | Licence introuvable | POST, PATCH /api/budget (400), GET /api/budget/preremplissage (404) |
| 5113 | erreur | Le type doit etre previsionnel ou alloue | POST, PATCH /api/budget, GET /api/budget?type= |
| 5114 | erreur | La date de debut est obligatoire | POST, PATCH /api/budget |
| 5115 | erreur | La date de fin est obligatoire | POST, PATCH /api/budget |
| 5116 | erreur | La date de fin doit etre posterieure ou egale a la date de debut | POST, PATCH /api/budget |
| 5117 | erreur | Date invalide | POST, PATCH /api/budget |
| 5118 | erreur | Le montant CAPEX doit etre un montant positif ou nul | POST, PATCH /api/budget |
| 5119 | erreur | La quantite CAPEX doit etre un nombre positif ou nul | POST, PATCH /api/budget |
| 5120 | erreur | Le montant OPEX doit etre un montant positif ou nul | POST, PATCH /api/budget |
| 5121 | erreur | La quantite OPEX doit etre un nombre positif ou nul | POST, PATCH /api/budget |
| 5122 | erreur | Une ligne budgetaire porte au moins un montant, CAPEX ou OPEX | POST, PATCH /api/budget |
| 5123 | erreur | Identifiant de filtre invalide | GET /api/budget, /engage, /synthese |
| 5124 | erreur | L'exercice demande est invalide | GET /api/budget, /engage, /synthese, /preremplissage |
| 5125 | erreur | La periode demandee est invalide | GET /api/budget, /engage, /synthese |
| 5126 | erreur | Societe introuvable | GET /api/budget, /engage, /synthese (bornes d'exercice) |
| 5130 | avertissement | Aucune maintenance en cours sur cette licence, projection vide | GET /api/budget/preremplissage (200, montant_opex 0, base vide) |
| 5131 | avertissement | Licence sans commande, organisation payeuse indeterminee, exercice du tenant applique | GET /api/budget/preremplissage (200) |
| 5150 | trace | Ligne budgetaire creee (audit_log BUDGET_CREE) | POST /api/budget |
| 5151 | trace | Ligne budgetaire modifiee (audit_log BUDGET_MODIFIE) | PATCH /api/budget/:id |
| 5152 | trace | Ligne budgetaire supprimee (audit_log BUDGET_SUPPRIME) | DELETE /api/budget/:id |
| 5199 | erreur | Erreur serveur inattendue (module budget) | toutes |

Regles v0.5 assumees :
- un exercice est identifie par l'annee civile de son premier jour, calcule
  par exercice_fiscal_de(date, COALESCE(societe.debut_exercice_fiscal,
  tenant_config.debut_exercice_fiscal_defaut)) ; `exercice` sur une ligne est
  l'exercice de la societe payeuse contenant date_debut ;
- preremplissage : base = periodes de maintenance_historique de la licence en
  cours a la date du jour (licence non arretee), cout lu comme un cout annuel,
  exercice cible par defaut = exercice courant + 1, facteur 1,035 puissance
  (cible moins courant, minimum 0), ligne projetee previsionnel OPEX bornee sur
  l'exercice cible ; rien n'est ecrit, les lignes existantes sur l'exercice
  cible sont jointes (lignes_existantes) ;
- engage : precalcul_financier, bornes au mois pres (periode_debut,
  periode_fin renvoyees), filtres id_societe (societe payeuse) et id_editeur
  (editeur du contrat) ; avec id_contrat ou id_licence, lecture directe de
  commande (axes absents du precalcul, meme source de verite) ; l'engage par
  licence est le montant entier des commandes d'origine, non ventile entre
  les licences d'une meme commande (hypothese v0.5, ventilation a arbitrer) ;
- preremplissage reserve aux profils de saisie (`saisir_budget`) : la
  projection est faite pour etre POSTee et expose les couts de maintenance ;
  IT Ops, en lecture seule, n'y accede pas. Les codes 5130 et 5131
  (avertissement) sont emis par l'enveloppe de succes, comme le 4211 de
  l'inventaire ;
- synthese : CAPEX impute au mois de COALESCE(date_capex, date_debut), OPEX
  lisse a parts egales sur les mois de [date_debut, date_fin] ; totaux derives
  des mois, arrondis au centime ;
- les montants ne sont pas masques dans ce module (la US donne la lecture a IT
  Ops sans reserve) : IT Ops lit donc l'engage agrege par GET /api/budget/engage
  et /synthese sur consulter_budget, alors que GET /api/commandes/agregats exige
  consulter_kpi_financiers. A valider.
