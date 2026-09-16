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
conformite 4300-4399 (module 3, #116) | budget 5100-5199 (module 4, partie A, #146) |
qualite des saisies et confiance 5400-5449 (module 3, #116)
budget 5100-5199 (module 4, partie A, #146) |
referentiels editeurs 5200-5299 et logiciels 5300-5399 (module 1, migration 041,
traces editeurs deplacees en 5290-5292 par la 043) |
revendeurs 5220-5239 (module 1, migrations 043 a 045) |
contacts 5240-5259 (module 4, #181, migrations 048 et 049)
qualite des saisies et confiance 5400-5449 (module 3, #116) |
notifications 5500-5549 (M3-notifications, #121)

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
| 2000 | trace | Compte créé | POST /api/utilisateurs |
| 2001 | trace | Compte modifié | PATCH /api/utilisateurs/:id |
| 2002 | trace | Compte activé | PATCH /api/utilisateurs/:id |
| 2003 | trace | Compte désactivé | PATCH /api/utilisateurs/:id |
| 2004 | trace | Désactivation planifiée | PATCH /api/utilisateurs/:id |
| 2005 | trace | Planification levée | PATCH /api/utilisateurs/:id |
| 2006 | trace | Mise en fonction planifiée | PATCH /api/utilisateurs/:id |
| 2007 | erreur | Cet email est déjà utilisé | POST, PATCH /api/utilisateurs |
| 2010 | trace | Mot de passe défini par un administrateur | POST /api/utilisateurs |
| 2011 | trace | Mail de réinitialisation envoyé via le socle #87 (état 1000 à 1003 joint) | POST /api/utilisateurs/:id/mot-de-passe/reinitialisation |
| 2012 | reserve | [PREREQUIS] Mot de passe réinitialisé par lien. Route inexistante | - |
| 2013 | succes | Mot de passe défini | PUT /api/utilisateurs/:id/mot-de-passe |
| 2014 | succes | Mot de passe généré | POST /api/utilisateurs/:id/mot-de-passe/generer |
| 2015 | erreur | Le mot de passe ne respecte pas la politique | PUT /api/utilisateurs/:id/mot-de-passe |
| 2016 | erreur | Le mot de passe est obligatoire | PUT /api/utilisateurs/:id/mot-de-passe |
| 2017 | erreur | Cette action doit être effectuée depuis l'interface | les deux |
| 2018 | trace | Mot de passe généré par un administrateur | POST /api/utilisateurs/:id/mot-de-passe/generer |
| 2019 | succes | Mail de réinitialisation envoyé, ou lien généré mais mail non envoyé (mail_envoye, erreur_mail, code_mail) | POST /api/utilisateurs/:id/mot-de-passe/reinitialisation |
| 2020 | trace | Groupe attribué | POST /api/utilisateurs/:id/profils |
| 2021 | trace | Groupe retiré | DELETE /api/utilisateurs/:id/profils/:attribId |
| 2022 | trace | Exception de droit ajoutée | POST /api/utilisateurs/:id/exceptions |
| 2023 | trace | Exception de droit modifiée | PATCH /api/utilisateurs/:id/exceptions/:excId |
| 2024 | trace | Exception de droit supprimée | DELETE /api/utilisateurs/:id/exceptions/:excId |
| 2025 | succes | Lien de réinitialisation valide | GET /api/mot-de-passe/reinitialisation/:jeton |
| 2026 | succes | Mot de passe réinitialisé | POST /api/mot-de-passe/reinitialisation/:jeton |
| 2027 | erreur | Ce lien n'est plus valide | GET, POST /api/mot-de-passe/reinitialisation/:jeton |
| 2028 | trace | Lien de réinitialisation émis par un administrateur | POST /api/utilisateurs/:id/mot-de-passe/reinitialisation |
| 2029 | erreur | Compte désactivé, réactivation requise | POST /api/utilisateurs/:id/mot-de-passe/reinitialisation |
| 2030 | trace | Connexion réussie | POST /api/auth/login |
| 2040 | reserve | [PREREQUIS] Exécution d'une planification à l'échéance. Aucun ordonnanceur n'existe | - |
| 2041 | reserve | [PREREQUIS] Activation de la double authentification. Aucune route serveur | - |
| 2050 | erreur | Utilisateur introuvable | GET /api/utilisateurs/:id/historique |
| 2051 | erreur | Cet utilisateur n'est pas dans votre périmètre | GET /api/utilisateurs/:id/historique |
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
| 3001 | succes | Détail du contrat | GET /api/contrats/:id |
| 3002 | succes | Contrat créé | POST /api/contrats |
| 3003 | succes | Contrat modifié | PATCH /api/contrats/:id |
| 3004 | succes | Contrat supprimé | DELETE /api/contrats/:id |
| 3005 | succes | Contrat archivé | POST /api/contrats/:id/archiver (#96) |
| 3006 | succes | Contrat restauré | POST /api/contrats/:id/restaurer (#96) |
| 3007 | succes | Liste des contrats, archivés inclus | GET /api/contrats?inclure_archives=1 (#96) |
| 3010 | erreur | Contrat introuvable | GET/PATCH/DELETE /api/contrats/:id |
| 3011 | erreur | Le libellé est obligatoire | POST, PATCH /api/contrats |
| 3012 | erreur | Le type de contrat est obligatoire | POST, PATCH /api/contrats |
| 3013 | erreur | La date de début doit précéder la date de fin | POST, PATCH /api/contrats |
| 3014 | erreur | Type de contrat introuvable | POST, PATCH /api/contrats |
| 3015 | erreur | Éditeur introuvable | POST, PATCH /api/contrats |
| 3016 | erreur | Société signataire introuvable | POST, PATCH /api/contrats |
| 3017 | erreur | Revendeur signataire introuvable | POST, PATCH /api/contrats |
| 3018 | erreur | Contrat parent introuvable | POST, PATCH /api/contrats (aussi "Contrat renouvele introuvable" sur id_contrat_predecesseur, D35, decision du 11/09/2026) |
| 3019 | erreur | Ce rattachement créerait un cycle | POST, PATCH /api/contrats (409, aussi sur une boucle de succession par id_contrat_predecesseur) |
| 3020 | erreur | Suppression impossible : éléments liés | DELETE /api/contrats/:id (409, details = commandes, preuves, sous-contrats, successeurs) |
| 3021 | avertissement | Parent non cadré, anomalie qualité enregistrée | POST, PATCH /api/contrats |
| 3022 | erreur | L'éditeur est obligatoire | POST, PATCH /api/contrats (#95) |
| 3023 | erreur | La société signataire est obligatoire | POST, PATCH /api/contrats (#95) |
| 3024 | erreur | Le revendeur signataire est obligatoire | POST, PATCH /api/contrats (#95) |
| 3025 | erreur | La date de début est obligatoire | POST, PATCH /api/contrats (#95) |
| 3026 | erreur | Contrat archivé : modification impossible, restaurez-le d'abord | PATCH /api/contrats/:id (#96) |
| 3027 | erreur | Suppression impossible : contrat déjà validé, archivez-le | DELETE /api/contrats/:id (#96) |
| 3028 | erreur | Contrat déjà archivé | POST /api/contrats/:id/archiver (#96) |
| 3029 | erreur | Contrat non archivé | POST /api/contrats/:id/restaurer (#96) |
| 3099 | erreur | Erreur serveur inattendue (module contrats) | toutes |

Archivage (#96, migrations 037 et 038) : GET /api/contrats exclut les
contrats archives sauf `?inclure_archives=1` (repond alors 3007) ; le detail
sert toujours un contrat archive et porte `supprimable` (aucune entree
workflow_validation au statut valide ou a_revalider ; en_attente et refuse
ne bloquent pas). Un contrat archive refuse toute modification (3026) ;
la suppression physique n'est possible que pour un contrat jamais entre en
valide ni a revalider (sinon 3027), le garde-fou 3020 sur les rattachements reste.
Archiver et restaurer tracent CONTRAT_ARCHIVE et CONTRAT_RESTAURE dans
audit_log et ARCHIVE / RESTAURE dans journal_ecriture.

Le 3021 n'est pas un refus : le rattachement est accepté. Il est réservé pour que la #68 puisse, si Dorian le décide, remonter l'avertissement au front. Signalez-lui ce cas, la consigne ne prévoit de code que pour les refus.

## Commandes (#44)

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 3100 | succes | Liste des commandes | GET /api/commandes |
| 3101 | succes | Détail de la commande | GET /api/commandes/:id |
| 3102 | succes | Commande créée | POST /api/commandes |
| 3103 | succes | Commande modifiée | PATCH /api/commandes/:id |
| 3104 | succes | Commande supprimée | DELETE /api/commandes/:id |
| 3110 | erreur | Commande introuvable | GET/PATCH/DELETE /api/commandes/:id |
| 3111 | erreur | Le libellé est obligatoire | POST, PATCH /api/commandes |
| 3112 | erreur | Le contrat est obligatoire | POST, PATCH /api/commandes |
| 3113 | erreur | Contrat introuvable | POST, PATCH /api/commandes |
| 3114 | erreur | La société acheteuse est obligatoire | POST, PATCH /api/commandes |
| 3115 | erreur | Société acheteuse introuvable | POST, PATCH /api/commandes |
| 3116 | erreur | Revendeur introuvable | POST, PATCH /api/commandes |
| 3117 | erreur | Mode de commande introuvable | POST, PATCH /api/commandes |
| 3118 | erreur | Le montant est obligatoire | POST, PATCH /api/commandes |
| 3119 | erreur | Le montant doit être strictement positif | POST, PATCH /api/commandes |
| 3120 | erreur | La date de commande est obligatoire | POST, PATCH /api/commandes |
| 3121 | erreur | La date de fin doit être postérieure à la date de commande | POST, PATCH /api/commandes |
| 3130 | erreur | Suppression impossible : éléments liés | DELETE /api/commandes/:id |
| 3140 | succes | Agrégats financiers | GET /api/commandes/agregats |
| 3141 | erreur | L'endpoint accepte soit annee, soit le couple date_debut / date_fin. Le précalcul étant mensuel, une plage au jour près est servie au mois près et les bornes appliquées sont renvoyées dans periode_debut et periode_fin. | GET /api/commandes/agregats |
| 3142 | erreur | Identifiant de société invalide | GET /api/commandes/agregats |
| 3143 | erreur | Identifiant d'éditeur invalide | GET /api/commandes/agregats |
| 3144 | erreur | La période demandée est invalide | GET /api/commandes/agregats |
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
| 3201 | succes | Détail de la preuve | GET /api/preuves/:id |
| 3202 | succes | Preuve créée | POST /api/preuves |
| 3203 | succes | Preuve modifiée | PATCH /api/preuves/:id |
| 3204 | succes | Preuve supprimée | DELETE /api/preuves/:id |
| 3210 | erreur | Preuve introuvable | GET/PATCH/DELETE /api/preuves/:id |
| 3211 | erreur | Le libellé est obligatoire | POST, PATCH /api/preuves |
| 3212 | erreur | Le type de preuve est obligatoire | POST, PATCH /api/preuves |
| 3213 | erreur | Type de preuve introuvable | POST, PATCH /api/preuves |
| 3214 | erreur | Une preuve doit etre rattachee a un contrat, a une commande ou a une licence (libelle aligne par la 054, #208) | POST, PATCH /api/preuves |
| 3215 | erreur | Contrat introuvable | POST, PATCH /api/preuves |
| 3216 | erreur | Commande introuvable | POST, PATCH /api/preuves |
| 3217 | erreur | Le chemin du fichier est obligatoire | POST, PATCH /api/preuves |
| 3218 | erreur | L'empreinte SHA-256 doit comporter 64 caracteres hexadecimaux | POST, PATCH /api/preuves |
| 3219 | erreur | Valeur de filtre invalide (id_type_preuve, id_contrat, id_commande, id_licence depuis la #208) | GET /api/preuves |
| 3228 | erreur | Licence introuvable (#208, migration 054) | POST, PATCH /api/preuves |
| 3230 | erreur | Suppression impossible : preuve rattachee a une facture | DELETE /api/preuves/:id |
| 3231 | reserve | [ARBITRAGE D27] lien externe GED refuse. Non emis a ce jour | POST, PATCH /api/preuves |
| 3214 | erreur | Une preuve doit être rattachée à un contrat, à une commande, ou aux deux | POST, PATCH /api/preuves |
| 3215 | erreur | Contrat introuvable | POST, PATCH /api/preuves |
| 3216 | erreur | Commande introuvable | POST, PATCH /api/preuves |
| 3217 | erreur | Le chemin du fichier est obligatoire | POST, PATCH /api/preuves |
| 3218 | erreur | L'empreinte SHA-256 doit comporter 64 caractères hexadécimaux | POST, PATCH /api/preuves |
| 3219 | erreur | Valeur de filtre invalide | GET /api/preuves |
| 3230 | erreur | Suppression impossible : preuve rattachée à une facture | DELETE /api/preuves/:id |
| 3231 | reserve | [ARBITRAGE D27] lien externe GED refusé. Non émis à ce jour | POST, PATCH /api/preuves |

### Factures

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 3240 | succes | Liste des factures | GET /api/factures |
| 3241 | succes | Détail de la facture | GET /api/factures/:id |
| 3242 | succes | Facture créée | POST /api/factures |
| 3243 | succes | Facture modifiée | PATCH /api/factures/:id |
| 3244 | succes | Facture supprimée | DELETE /api/factures/:id |
| 3250 | erreur | Facture introuvable | GET/PATCH/DELETE /api/factures/:id |
| 3251 | erreur | Le libellé est obligatoire | POST, PATCH /api/factures |
| 3252 | erreur | La commande est obligatoire | POST, PATCH /api/factures |
| 3253 | erreur | Commande introuvable | POST, PATCH /api/factures |
| 3254 | erreur | Preuve introuvable | POST, PATCH /api/factures |
| 3255 | reserve | [ARBITRAGE flux] la preuve est obligatoire dès la création. Non émis à ce jour | POST /api/factures |
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
| 3205 | succes | Fichier déposé | POST /api/preuves/:id/fichier |
| 3206 | succes | Fichier servi | GET /api/preuves/:id/fichier |
| 3220 | erreur | Aucun fichier n'a été transmis | POST /api/preuves/:id/fichier |
| 3221 | erreur | Extension non admise, formats acceptés pdf png jpg jpeg | POST /api/preuves/:id/fichier |
| 3222 | erreur | Le fichier dépasse la taille maximale de 20 Mo (413) | POST /api/preuves/:id/fichier |
| 3223 | erreur | Le contenu du fichier ne correspond pas à son extension | POST /api/preuves/:id/fichier |
| 3224 | erreur | Aucun fichier n'a été déposé pour cette preuve | GET /api/preuves/:id/fichier |
| 3225 | erreur | Le fichier est introuvable dans le stockage | GET /api/preuves/:id/fichier |
| 3226 | erreur | Chemin de stockage invalide, traversée refusée | GET /api/preuves/:id/fichier |
| 3227 | erreur | Un seul fichier peut être déposé, dans le champ fichier | POST /api/preuves/:id/fichier |
| 3232 | reserve | [ARBITRAGE D27] redirection vers un lien GED externe. Non émis à ce jour | GET /api/preuves/:id/fichier |
| 3245 | succes | Facture et preuve créées en une transaction | POST /api/factures/depot |
| 3256 | erreur | Le fichier justificatif est obligatoire, dépôt combiné | POST /api/factures/depot |

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
| 3281 | erreur | Identifiant de société invalide | GET /api/commandes/manques |
| 3282 | erreur | Identifiant de contrat invalide | GET /api/commandes/manques |
| 3283 | erreur | L'année demandée est invalide | GET /api/commandes/manques |

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

### Rattachement a une licence et liste ferme des types (#208, migrations 053 et 054)

Une preuve se rattache desormais a un contrat, a une commande ou a une
licence : colonne preuve.id_licence (FK nullable, 053), filtre id_licence sur
GET /api/preuves, projection id_licence et licence_label. La regle 3214 exige
au moins un des trois rattachements ; l'API tolere le cumul contrat + commande
des preuves anterieures, le formulaire n'envoie qu'un seul rattachement. Le
3228 est le pendant du 3215 et du 3216 pour la licence.

Le referentiel type_preuve passe a sept valeurs (liste ferme du client :
bon_commande, bon_livraison, certificat, clefs_licence, contrat_annexes,
facture, autre), seedees en ON CONFLICT sans retrait des types existants. Le
filtrage des types par objet de rattachement est porte par le formulaire
(PreuveFormModal, TYPES_PAR_RATTACHEMENT) et non par l'API : aucun code
retour n'est emis pour un type hors liste, les preuves anterieures restant
valides telles quelles.

### Objet unique facture = preuve (#204, migration 053)

Le depot combine POST /api/factures/depot cree toujours une preuve et une
facture liees par facture.id_preuve, mais l'utilisateur ne voit plus qu'un
objet : la ligne de type facture. Consequences, sans nouveau code :
- id_type_preuve devient facultatif sur POST /api/factures/depot : a defaut,
  le type de code `facture` (053) est applique ; un type explicite reste
  accepte et verifie (3213). Une base sans le type `facture` fait echouer le
  depot en 3299, comme un referentiel de validation absent ;
- seule la facture est soumise au workflow (3245 inchange) : la preuve
  support ne porte aucune demande, elle n'est jamais 3312 depuis l'ecran
  puisqu'elle n'y apparait plus. La 053 retire les demandes en_attente
  residuelles des preuves support deja creees ;
- GET /api/preuves (3200) ne sert que les preuves libres, hors preuves
  referencees par une facture ; GET /api/preuves/:id reste accessible ;
- PATCH /api/preuves/:id et POST /api/preuves/:id/fichier sur une preuve
  support resoumettent la ou les factures qui la referencent (3203, 3205
  inchanges), jamais la preuve ;
- DELETE /api/factures/:id (3244) supprime aussi la preuve support et son
  fichier quand aucune autre facture ne la reference, sinon elle
  reapparaitrait seule dans la liste. Le 3230 continue d'interdire la
  suppression directe d'une preuve referencee par une facture ;
- projection GET /api/factures enrichie de preuve_nom_origine,
  preuve_hash_sha256 et preuve_type_code, pour que la fiche facture porte le
  justificatif sans second appel.

## Validation des saisies (#53)

Plage validation 3300-3399. Le statut n'est pas une colonne des tables metier :
il est la derniere entree de workflow_validation designant l'entite. Les quatre
ressources du module 2 se comportent a l'identique.

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 3300 | succes | Saisie validée | POST /api/validation/:entite_type/:entite_id/valider |
| 3301 | succes | Saisie refusée | POST /api/validation/:entite_type/:entite_id/refuser |
| 3310 | erreur | Type d'entité inconnu du workflow de validation | les deux |
| 3311 | erreur | Entité introuvable | les deux |
| 3312 | erreur | Cette saisie ne porte aucune demande de validation | les deux |
| 3313 | erreur | Seule une saisie en attente peut être traitée | les deux |
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
| 4101 | succes | Détail de l'affectation | GET /api/affectations/:id |
| 4102 | succes | Affectation déclarée et soumise à validation | POST /api/affectations (201) |
| 4103 | succes | Affectation modifiée et resoumise à validation | PATCH /api/affectations/:id |
| 4104 | succes | Affectation supprimée | DELETE /api/affectations/:id (200, data null) |
| 4105 | succes | Affectation revalidée, nouveau cycle ouvert | POST /api/affectations/:id/revalider |
| 4106 | succes | Décompte des usages déclarés pour la conformité | GET /api/affectations/decompte |
| 4107 | succes | Historique des déclarations | GET /api/affectations/historique |
| 4110 | erreur | Affectation introuvable | routes /affectations/:id (404) |
| 4111 | erreur | La licence est obligatoire | POST, PATCH |
| 4112 | erreur | Licence introuvable | POST, PATCH |
| 4113 | erreur | La société est obligatoire | POST, PATCH |
| 4114 | erreur | Société introuvable | POST, PATCH |
| 4115 | erreur | La quantité doit être un entier strictement positif | POST, PATCH |
| 4116 | erreur | La référence client est obligatoire | POST, PATCH |
| 4117 | erreur | Identifiant de société invalide | filtres GET |
| 4118 | erreur | Identifiant de produit invalide | filtres GET |
| 4119 | erreur | Identifiant de licence invalide | filtre GET /affectations |
| 4130 | erreur | Seule une affectation validée peut être revalidée | POST .../revalider (409, `details.statut_validation`) |
| 4132 | erreur | Suppression impossible : affectation rapprochée d'un inventaire | DELETE (409, `details.inventaires`) |
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

## Conformite (#116, module 3)

Plage 4300-4399, seedee par la migration Commune 047. Routeur
`server/routes/conformite.js`. Source nominale : `precalcul_conformite`,
alimentee par les triggers de la migration Tenant 046 sur licence et
affectation (insert, update, delete), amorcee par
`recalculer_conformite_complete()` en fin de 046 et rejouable par
`server/bdd/manual/amorcer-conformite.js` (execution quotidienne recommandee :
les droits dependent de CURRENT_DATE, les triggers ne partent qu'a
l'ecriture). Le filtre `id_societe` et la synthese par societe sont calcules a
la volee avec les memes regles, le precalcul n'ayant pas d'axe societe.

Lecture sur `consulter_licences` ; `prix_unitaire`, `ecart_valorise` et les
agregats `ecart_valorise_negatif` / `_positif` (sommes signees) servis a null
avec `montants_masques: true` sans `consulter_kpi_financiers`, comme les couts
du module licences.

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 4300 | succes | État de conformité par produit | GET /api/conformite |
| 4301 | succes | Synthèse de conformité | GET /api/conformite/synthese |
| 4310 | erreur | Identifiant de société invalide | GET /api/conformite |
| 4311 | erreur | Identifiant d'éditeur invalide | GET /api/conformite |
| 4312 | erreur | Identifiant de produit invalide | GET /api/conformite |
| 4313 | erreur | Le niveau demandé doit être global, editeur ou societe | GET /api/conformite/synthese |
| 4399 | erreur | Erreur serveur inattendue (module conformité) | toutes |

Regles #116 (validees), revisees par les decisions du 10/09/2026 (#190,
migration Tenant 058, `server/utils/conformite.js`) :
- droits = quantites des licences perpetuelles + licences a echeance
  (souscriptions et, D44 etendu, versions d'essai : constante
  `TYPES_A_ECHEANCE`) dont date de fin >= date du jour (sortie le lendemain
  de la date de fin, regle #102 conservee ; le code `version_essai` est celui
  attendu du referentiel type_licence de la migration 055, la regle se
  replie d'elle-meme sur les seules souscriptions tant qu'aucune licence ne
  le porte) ;
- usages = quantites des affectations dont la derniere entree du workflow
  est `valide` (le `a_revalider` de lecture en fait partie), `en_attente` et
  `refuse` exclus, sans deduplication par reference ;
- ecart = droits - usages ;
- D53 : `ecart_pct` = usages / droits x 100, borne a 999.99 (colonne
  DECIMAL(5,2) du DDL v4), et null quand les droits sont nuls : aucun
  pourcentage sans droit. La ligne porte `usage_sans_droit` (vrai avec des
  usages et zero droit) ; le statut est alors `depassement` et une anomalie
  qualite `usage_sans_droit` est ouverte par le trigger (une seule ouverte
  par produit, entite `produit`, close automatiquement des que la situation
  cesse) ;
- D52 : prix unitaire = cout / quantite de la ligne de licence la plus
  recente du produit sur le perimetre observe, par date de commande puis
  par date de creation, parmi les lignes a cout renseigne et quantite > 0
  (toutes lignes confondues, echues comprises : dernier prix paye), jamais
  une moyenne ; null sans ligne exploitable ; ecart valorise = ecart x prix
  unitaire ; un changement de `commande.date_commande` recalcule les
  produits de ses licences (trigger 058) ;
- statut = `depassement` si usages > droits, `attention` si taux >= seuil
  ou ecart valorise negatif au-dela du seuil en montant, `conforme` sinon ;
  droits et usages nuls = produit non compte (ligne a zero, filtree) ;
- D54 : chaque bloc d'agregats (`agregats` de GET /conformite, lignes de la
  synthese) porte `valorisation_parc` (somme des couts des licences actives
  des produits du perimetre filtre), `ecart_valorise` (somme signee des
  ecarts valorises), `ecart_valorise_negatif`, `ecart_valorise_positif` et
  leurs pourcentages `ecart_valorise_pct`, `ecart_valorise_negatif_pct`,
  `ecart_valorise_positif_pct` rapportes a `valorisation_parc` (null sans
  parc valorise). L'ecart valorise se lit toujours en relatif au parc
  observe, jamais en absolu seul. Chaque ligne porte `cout_actif` (cout des
  licences actives du produit). Les montants (`valorisation_parc`,
  `ecart_valorise*` hors pourcentages, `cout_actif`, `prix_unitaire`) sont
  masques sans `consulter_kpi_financiers` ; les pourcentages et le statut
  restent servis.
Seuils lus dans `seuil_dashboard` (tenant, echelle 1) puis
`default_seuil_dashboard` (Commune) : `conformite_taux` (90, pourcent) et
`conformite_ecart_valorise` (10000, euros, seuil en montant sur l'ecart
valorise negatif ; branche aujourd'hui couverte par le depassement, conservee
telle que la regle l'enonce).

## Qualite des saisies et indice de confiance (#116, module 3)

Plage 5400-5449, seedee par la migration Commune 047. Routeur
`server/routes/qualite.js`, calcul pur de l'indice dans
`server/utils/indiceConfiance.js` (teste au node:test).

GET /api/qualite (permission `consulter_inventaire`) : detection a la volee,
sans precalcul, croisee avec `anomalie_qualite`. Types produits :
`licence_sans_contrat`, `contrat_sans_justificatif`, `commande_sans_preuve`,
`doublon_affectation`, `doublon_produit`, `champ_obligatoire_vide` et, depuis
le 10/09/2026 (D53, #190), `usage_sans_droit` (gravite `critique`, entite
`produit`, produits du precalcul a usages validees et zero droit ; l'anomalie
est ouverte par le trigger de la migration 058 et redetectee ici pour etre
servie avec le libelle du produit, resolu en BDD Commune). Une anomalie
`resolu = true` (resolution ou faux positif, la table ne distingue pas) exclut
l'element meme s'il est encore detecte ; une anomalie ouverte est servie sans
doublon ; une detection nouvelle est inseree avec type, gravite et
description dans la transaction de la lecture. Les types des autres
producteurs (`incoherence`, `hors_plage_parent`, `ligne_import`) ne sont pas
reservis ici.

GET /api/confiance (permission `consulter_licences`) : note sur 100 par
perimetre (tenant, ou societe par `id_societe`), formule revisee le
10/09/2026 (#190, `server/utils/indiceConfiance.js`, testee au node:test) :
- poids d'un objet = max(sa valeur, plancher), plancher = max(1, 1 pour cent
  de la valeur totale des licences actives du perimetre). Un objet non
  valorise pese donc toujours une part plancher : aucun perimetre ne peut
  afficher 100 avec un defaut ouvert (une composante porteuse d'un defaut et
  l'indice lui-meme sont bornes a 99,9 apres arrondi) ;
- exhaustivite (poids 40) : 4 liens par licence active (commande, facture ou
  preuve, contrat, societe signataire), note = somme(poids x liens presents
  / 4) / somme(poids) x 100 ;
- coherence (poids 30) : objets = licences actives + tout autre objet
  porteur d'une anomalie ouverte, toutes anomalies confondues : stock
  `anomalie_qualite` (tous producteurs) et detections a la volee de /qualite
  (lues sans ecriture), y compris sur des objets sans licence reliee. Une
  anomalie sur une licence, sa commande ou son contrat marque la licence ;
  toute autre anomalie designe un objet propre pese une fois quel que soit
  le nombre d'anomalies qui le visent ; note = somme(poids des objets sains)
  / somme(poids) x 100. Sur une societe, seules comptent les anomalies
  portees par ses contrats, commandes, licences payees, affectations
  declarees et produits sur lesquels elle declare des usages ;
- fraicheur (poids 30) : somme(poids des affectations validees a echeance
  de revalidation non depassee) / somme(poids des affectations) x 100 ;
- indice = 0,4 x exhaustivite + 0,3 x coherence + 0,3 x fraicheur.
La reponse porte `plancher`, `nb_objets_anomalie` et les malus par
composante (`entite_type` par type d'objet). `valeur_totale` est masquee sans
`consulter_kpi_financiers`.

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 5400 | succes | État de la qualité des saisies | GET /api/qualite |
| 5401 | succes | Indice de confiance | GET /api/confiance |
| 5410 | erreur | Identifiant de société invalide | GET /api/confiance |
| 5449 | erreur | Erreur serveur inattendue (module qualité et confiance) | les deux |

Les libelles de la 047 et de la 052 sont accentues (consigne #116 : textes
destines a l'ecran en francais accentue). Les douze migrations 025, 028, 029,
030, 034, 037, 041, 042, 043, 045, 048 et 050 les avaient seedes en ASCII :
la migration Commune 057 (#171) les reecrit en francais accentue, alignes sur
les tableaux de ce fichier, sans toucher ni au code, ni au type, ni a la
formulation. Les valeurs d'enumeration techniques citees dans un libelle
(perpetuelle, souscription, previsionnel, alloue, immediat, quotidien,
desactive, noms de colonnes CSV, parametres de requete) restent en ASCII.

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
| 4001 | succes | Détail de la licence | GET /api/licences/:id |
| 4002 | succes | Licence créée | POST /api/licences |
| 4003 | succes | Licence modifiée | PATCH /api/licences/:id |
| 4004 | succes | Licence supprimée | DELETE /api/licences/:id |
| 4005 | succes | Historique de maintenance de la licence | GET /api/licences/:id/maintenance |
| 4006 | succes | Periode de maintenance ajoutee | POST /api/licences/:id/maintenance |
| 4007 | succes | Periode de maintenance modifiee | PATCH /api/licences/:id/maintenance/:mid |
| 4008 | succes | Periode de maintenance supprimee | DELETE /api/licences/:id/maintenance/:mid |
| 4009 | succes | Maintenance arretee, version figee | POST /api/licences/:id/arret-maintenance |
| 4010 | erreur | Licence introuvable | GET/PATCH/DELETE /api/licences/:id et sous-routes (400 sur un filtre invalide de la liste ; 400 "Licence renouvelee introuvable" et 409 boucle de succession sur id_licence_predecesseur, #209) |
| 4011 | erreur | Le produit est obligatoire | POST, PATCH /api/licences |
| 4012 | erreur | Produit introuvable au catalogue | POST, PATCH /api/licences |
| 4013 | erreur | Edition introuvable ou etrangere au produit | POST, PATCH /api/licences |
| 4014 | erreur | Version introuvable ou etrangere au produit | POST, PATCH /api/licences ; POST, PATCH .../maintenance (id_version de la periode, #209) |
| 4015 | erreur | Commande introuvable | POST, PATCH /api/licences ; POST, PATCH .../maintenance (id_commande de la periode, migration 062, decision du 11/09/2026) |
| 4016 | erreur | Revendeur introuvable | POST, PATCH /api/licences et maintenance (sur une periode, id_revendeur n'est plus envoye par le formulaire : le revendeur se lit par la commande) |
| 4017 | erreur | Unite de mesure introuvable | POST, PATCH /api/licences |
| 4018 | erreur | Le type de licence doit etre perpetuelle ou souscription | POST, PATCH /api/licences, GET /api/licences?type= (message rendu depuis #209 : "Type de licence inconnu.", le type est valide contre type_licence) |
| 4019 | erreur | La quantite doit etre un entier positif ou nul | POST, PATCH /api/licences |
| 4020 | erreur | Le cout doit etre un montant positif ou nul | POST, PATCH /api/licences |
| 4021 | erreur | La date de fin de souscription est obligatoire pour une souscription | POST, PATCH /api/licences (message rendu depuis #209 : "La date de fin est obligatoire pour une licence de type <label>.", selon type_licence.regle_date_fin) |
| 4022 | erreur | Mainteneur introuvable | POST, PATCH /api/licences et maintenance |
| 4023 | erreur | Suppression impossible : elements lies | DELETE /api/licences/:id (409, details = compteurs affectations, budgets et successeurs) |
| 4024 | erreur | Date invalide | POST, PATCH /api/licences et maintenance |
| 4030 | erreur | Periode de maintenance introuvable | PATCH/DELETE /api/licences/:id/maintenance/:mid |
| 4031 | erreur | La date de debut est obligatoire | POST, PATCH .../maintenance ; POST, PATCH /api/licences (message rendu : "La date de debut est obligatoire pour une licence de type <label>.", selon type_licence.regle_date_debut, #209) |
| 4032 | erreur | La date de fin doit etre posterieure a la date de debut | POST, PATCH .../maintenance ; POST, PATCH /api/licences (date_debut et date_fin_souscription, #209) |
| 4033 | erreur | Le cout de maintenance doit etre un montant positif ou nul | POST, PATCH .../maintenance |
| 4040 | erreur | La maintenance de cette licence est deja arretee | POST .../arret-maintenance (409) |
| 4041 | erreur | La date d'arret est invalide | POST .../arret-maintenance |
| 4042 | erreur | Version a figer introuvable ou etrangere au produit | POST .../arret-maintenance |
| 4043 | erreur | Cette licence ne porte aucune maintenance a arreter | POST .../arret-maintenance (409) |
| 4044 | succes | Maintenance reprise, version liberee | POST .../reprise-maintenance |
| 4045 | erreur | La maintenance de cette licence n'est pas arretee | POST .../reprise-maintenance (409) |
| 4025 | succes | Licence prolongée | POST /api/licences/:id/prolonger (decision du 11/09/2026 : date de fin de la periode en cours etendue, souscription ou essai par date_fin_souscription, perpetuelle par la fin de sa maintenance en cours ; alerte d'echeance liberee pour la nouvelle date) |
| 4026 | erreur | Cette licence ne porte aucune échéance à prolonger | POST /api/licences/:id/prolonger (409 : ni date de fin, ni maintenance en cours non arretee) |
| 4027 | erreur | La nouvelle date de fin doit être postérieure à l'échéance actuelle | POST /api/licences/:id/prolonger (400, message rendu avec l'echeance actuelle ; 4024 sur un format invalide) |
| 4034 | succes | Version ajoutée au produit | POST /api/produits/:id/versions (201, complement Tenant du catalogue, migration 063 ; 4012 en 404 sur un produit inconnu du catalogue) |
| 4035 | succes | Édition ajoutée au produit | POST /api/produits/:id/editions (201, idem) |
| 4036 | erreur | Le libellé de la version ou de l'édition est obligatoire | POST /api/produits/:id/versions et editions (400, aussi au-dela de 100 caracteres) |
| 4037 | erreur | Cette version ou édition existe déjà pour ce produit | POST /api/produits/:id/versions et editions (409, doublon a la casse et aux accents pres, contre le catalogue Commune et les complements ; details = id, label, source) |
| 4038 | succes | Compléments du catalogue (versions et éditions ajoutées par le client) | GET /api/produits/complements |
| 4050 | succes | Catalogue des produits (versions et editions incluses) | GET /api/produits |
| 4051 | succes | Liste des unites de mesure | GET /api/unites-mesure |
| 4006 | succes | Période de maintenance ajoutée | POST /api/licences/:id/maintenance |
| 4007 | succes | Période de maintenance modifiée | PATCH /api/licences/:id/maintenance/:mid |
| 4008 | succes | Période de maintenance supprimée | DELETE /api/licences/:id/maintenance/:mid |
| 4009 | succes | Maintenance arrêtée, version figée | POST /api/licences/:id/arret-maintenance |
| 4010 | erreur | Licence introuvable | GET/PATCH/DELETE /api/licences/:id et sous-routes (400 sur un filtre invalide de la liste) |
| 4011 | erreur | Le produit est obligatoire | POST, PATCH /api/licences |
| 4012 | erreur | Produit introuvable au catalogue | POST, PATCH /api/licences |
| 4013 | erreur | Édition introuvable ou étrangère au produit | POST, PATCH /api/licences |
| 4014 | erreur | Version introuvable ou étrangère au produit | POST, PATCH /api/licences |
| 4015 | erreur | Commande introuvable | POST, PATCH /api/licences |
| 4016 | erreur | Revendeur introuvable | POST, PATCH /api/licences et maintenance |
| 4017 | erreur | Unité de mesure introuvable | POST, PATCH /api/licences |
| 4018 | erreur | Le type de licence doit etre perpetuelle ou souscription | POST, PATCH /api/licences, GET /api/licences?type= |
| 4019 | erreur | La quantité doit être un entier positif ou nul | POST, PATCH /api/licences |
| 4020 | erreur | Le coût doit être un montant positif ou nul | POST, PATCH /api/licences |
| 4021 | erreur | La date de fin de souscription est obligatoire pour une souscription | POST, PATCH /api/licences |
| 4022 | erreur | Mainteneur introuvable | POST, PATCH /api/licences et maintenance |
| 4023 | erreur | Suppression impossible : éléments liés | DELETE /api/licences/:id (409, details = compteurs affectations et budgets) |
| 4024 | erreur | Date invalide | POST, PATCH /api/licences et maintenance |
| 4030 | erreur | Période de maintenance introuvable | PATCH/DELETE /api/licences/:id/maintenance/:mid |
| 4031 | erreur | La date de début est obligatoire | POST, PATCH .../maintenance |
| 4032 | erreur | La date de fin doit être postérieure à la date de début | POST, PATCH .../maintenance |
| 4033 | erreur | Le coût de maintenance doit être un montant positif ou nul | POST, PATCH .../maintenance |
| 4040 | erreur | La maintenance de cette licence est déjà arrêtée | POST .../arret-maintenance (409) |
| 4041 | erreur | La date d'arrêt est invalide | POST .../arret-maintenance |
| 4042 | erreur | Version à figer introuvable ou étrangère au produit | POST .../arret-maintenance |
| 4043 | erreur | Cette licence ne porte aucune maintenance à arrêter | POST .../arret-maintenance (409) |
| 4044 | succes | Maintenance reprise, version libérée | POST .../reprise-maintenance |
| 4045 | erreur | La maintenance de cette licence n'est pas arrêtée | POST .../reprise-maintenance (409) |
| 4050 | succes | Catalogue des produits (versions et éditions incluses) | GET /api/produits |
| 4051 | succes | Liste des unités de mesure | GET /api/unites-mesure |
| 4052 | succes | Liste des mainteneurs | GET /api/mainteneurs |
| 4059 | erreur | Erreur serveur inattendue (référentiels du module licences) | les trois |
| 4099 | erreur | Erreur serveur inattendue (module licences) | toutes |

Regles v0.5 assumees : une licence portant une date de fin (souscription,
essai) est `expire` le jour meme de cette date, sans tolerance, et sort de la
balance droits/usage ; l'arret de maintenance fige `version_figee_id` (par
defaut la version courante) et `date_arret_maintenance` sans retirer de droit
quantitatif ; les licences ne passent pas par le workflow de validation (#53).

Decisions de la reunion client du 11/09/2026 (migrations 062 et 063, chantier
successions et maintenance) : huit codes nouveaux dans les plages libres du
module (4025 a 4027, 4034 a 4038), consignes ci-dessus. Le catalogue
code_retour vit en BDD Commune et les deux numeros reserves au chantier sont
Tenant : ces codes ne sont pas encore seedes. L'enveloppe les sert avec
`libelle` a null et `error` porte le message rendu par la route (aucune
reponse cassee, ecart signale en console au premier usage, reponse.js). Le
seed Commune est a prevoir dans la prochaine migration Commune libre, avec
les libelles de ce tableau. Autres projections sans code nouveau : chaque
licence et chaque contrat servent `contrat_a_suivre` (regle pure
server/utils/successionContrat.js : le contrat suit les licences) ; une
periode de maintenance sert `id_commande`, `commande_label`,
`commande_revendeur_label` ; GET /api/contrats accepte et sert
`id_contrat_predecesseur` (3018 renouvele introuvable, 3019 boucle, 3020
successeurs bloquants a la suppression) ; nouveau type de notification
`contrat_a_suivre` dans le pre-catalogue applicatif (aucun code : le type
est un texte controle par catalogue.js, regle 8).

Stories #209 et #210 (migrations 055 et 056, 10/09/2026) : aucun nouveau
code. Les regles de dates par type (type_licence), la version portee par la
maintenance (D59), l'historique des versions (D60, servi dans
`historique_versions` de GET /api/licences/:id, code 4001) et le lien de
succession (D35, `id_licence_predecesseur`) reutilisent les codes existants
avec un message rendu (`error`) interpole par la route, comme 3020 ou 3130 :
4018 (type inconnu), 4021 et 4031 (date de fin ou de debut obligatoire pour
le type), 4032 (fin anterieure au debut), 4014 (version d'une periode de
maintenance), 4010 (licence renouvelee introuvable ou boucle), 4023
(successeurs bloquants). Les libelles seedes par la 028 restent ceux du
catalogue ; leur realignement (par exemple 4018 "Type de licence inconnu")
demande une migration Commune ulterieure, hors des numeros 055 et 056
reserves au chantier.

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
| 4201 | succes | Détail de l'import | GET /api/inventaire/imports/:id |
| 4202 | succes | Import d'inventaire effectué | POST /api/inventaire/imports (201, statut succes) |
| 4203 | succes | Liste des relevés d'inventaire | GET /api/inventaire/releves |
| 4204 | succes | Détail du relevé | GET /api/inventaire/releves/:id |
| 4205 | succes | Écarts d'inventaire | GET /api/inventaire/ecarts |
| 4206 | succes | Relevé rapproché de l'affectation | POST /api/inventaire/releves/:id/rapprocher |
| 4207 | succes | Relevé marqué en écart assumé | POST /api/inventaire/releves/:id/ecart-assume |
| 4208 | succes | Relevé rejeté | POST /api/inventaire/releves/:id/rejeter |
| 4209 | succes | Relevé remis en attente | POST /api/inventaire/releves/:id/reouvrir |
| 4210 | succes | Liste des affectations rapprochables | GET /api/inventaire/affectations |
| 4211 | avertissement | Import effectué avec des lignes en erreur | POST /api/inventaire/imports (201, statut succes_partiel, erreurs jointes) |
| 4220 | erreur | Import introuvable | GET /api/inventaire/imports/:id |
| 4221 | erreur | Relevé introuvable | GET, POST /api/inventaire/releves/:id/... |
| 4222 | erreur | Aucun fichier n'a été transmis | POST /api/inventaire/imports |
| 4223 | erreur | Extension non admise, format accepté csv | POST /api/inventaire/imports |
| 4224 | erreur | Le fichier dépasse la taille maximale de 20 Mo (413) | POST /api/inventaire/imports |
| 4225 | erreur | Un seul fichier peut être déposé | POST /api/inventaire/imports |
| 4226 | erreur | Fichier vide ou illisible, encodage UTF-8 attendu | POST /api/inventaire/imports |
| 4227 | erreur | Colonnes obligatoires absentes : produit, reference, quantite (details.colonnes_manquantes) | POST /api/inventaire/imports |
| 4228 | erreur | Aucune ligne exploitable, import en échec (422, import trace en echec, erreurs dans details) | POST /api/inventaire/imports |
| 4229 | erreur | Société introuvable | POST /api/inventaire/imports |
| 4230 | erreur | Valeur de filtre invalide | GET /api/inventaire/releves |
| 4231 | erreur | L'affectation est obligatoire | POST .../rapprocher |
| 4232 | erreur | Affectation introuvable | POST .../rapprocher |
| 4233 | erreur | Transition de statut non permise pour ce relevé (409, details.statut_rapprochement) | POST .../rapprocher, ecart-assume, rejeter, reouvrir |
| 4234 | erreur | Le motif de rejet est obligatoire | POST .../rejeter |
| 4235 | reserve | Fichier archivé introuvable, contenu du relevé indisponible. Non emis : la liste sert la ligne avec fichier_absent true | GET /api/inventaire/releves |
| 4236 | erreur | Le fichier dépasse le nombre maximal de lignes (10000) | POST /api/inventaire/imports |
| 4250 | trace | Inventaire importé (audit_log INVENTAIRE_IMPORTE) | POST /api/inventaire/imports |
| 4251 | trace | Relevé rapproché (audit_log RELEVE_RAPPROCHE) | POST .../rapprocher |
| 4252 | trace | Relevé marqué en écart assumé (audit_log RELEVE_ECART_ASSUME) | POST .../ecart-assume |
| 4253 | trace | Relevé rejeté (audit_log RELEVE_REJETE) | POST .../rejeter |
| 4254 | trace | Relevé remis en attente (audit_log RELEVE_REOUVERT) | POST .../reouvrir |
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
preremplissage `saisir_budget` (Admin, Manager DSI, Financier, et IT Ops par
la matrice 011 conservee telle quelle), suppression `supprimer_budget`
(nouvelle permission, 035 Commune et 036 Tenant : Admin, Manager DSI,
Financier). Ecart avec la US, qui place IT Ops en lecture : la matrice 011
validee reste la reference tant que Samuel n'a pas tranche la question "IT
Ops et le financier" (saisir_licence, saisir_affectation, saisir_budget,
visibilite des montants via consulter_budget). A valider, pas de retrait
code.

Doctrine : l'organisation payeuse n'est jamais stockee ni saisie sur la ligne,
elle se deduit de licence -> commande (d'origine) -> societe ; l'editeur est
celui du contrat de cette commande. Le previsionnel vient de la table budget,
l'engage vient des commandes reelles (precalcul_financier, 016 et 017) et n'y
touche jamais : pas de double previsionnel.

| Code | Type | Libelle propose | Route |
|------|------|-----------------|-------|
| 5100 | succes | Liste des lignes budgétaires | GET /api/budget |
| 5101 | succes | Détail de la ligne budgétaire | GET /api/budget/:id |
| 5102 | succes | Ligne budgétaire créée | POST /api/budget (201) |
| 5103 | succes | Ligne budgétaire modifiée | PATCH /api/budget/:id |
| 5104 | succes | Ligne budgétaire supprimée | DELETE /api/budget/:id (200, data null) |
| 5105 | succes | Projection prévisionnelle préremplie depuis la maintenance en cours | GET /api/budget/preremplissage |
| 5106 | succes | Engagé calculé depuis les commandes | GET /api/budget/engage |
| 5107 | succes | Synthèse budgétaire : prévisionnel, alloué, engagé | GET /api/budget/synthese |
| 5110 | erreur | Ligne budgétaire introuvable | GET/PATCH/DELETE /api/budget/:id (404) |
| 5111 | erreur | La licence est obligatoire | POST, PATCH /api/budget, GET /api/budget/preremplissage |
| 5112 | erreur | Licence introuvable | POST, PATCH /api/budget (400), GET /api/budget/preremplissage (404) |
| 5113 | erreur | Le type doit être previsionnel ou alloue | POST, PATCH /api/budget, GET /api/budget?type= |
| 5114 | erreur | La date de début est obligatoire | POST, PATCH /api/budget |
| 5115 | erreur | La date de fin est obligatoire | POST, PATCH /api/budget |
| 5116 | erreur | La date de fin doit être postérieure ou égale à la date de début | POST, PATCH /api/budget |
| 5117 | erreur | Date invalide | POST, PATCH /api/budget |
| 5118 | erreur | Le montant CAPEX doit être un montant positif ou nul | POST, PATCH /api/budget |
| 5119 | erreur | La quantité CAPEX doit être un nombre positif ou nul | POST, PATCH /api/budget |
| 5120 | erreur | Le montant OPEX doit être un montant positif ou nul | POST, PATCH /api/budget |
| 5121 | erreur | La quantité OPEX doit être un nombre positif ou nul | POST, PATCH /api/budget |
| 5122 | erreur | Une ligne budgétaire porte au moins un montant, CAPEX ou OPEX | POST, PATCH /api/budget |
| 5123 | erreur | Identifiant de filtre invalide | GET /api/budget, /engage, /synthese |
| 5124 | erreur | L'exercice demandé est invalide | GET /api/budget, /engage, /synthese, /preremplissage |
| 5125 | erreur | La période demandée est invalide | GET /api/budget, /engage, /synthese |
| 5126 | erreur | Société introuvable | GET /api/budget, /engage, /synthese (bornes d'exercice) |
| 5130 | avertissement | Aucune maintenance en cours sur cette licence, projection vide | GET /api/budget/preremplissage (200, montant_opex 0, base vide) |
| 5131 | avertissement | Licence sans commande, organisation payeuse indéterminée, exercice du tenant appliqué | GET /api/budget/preremplissage (200) |
| 5150 | trace | Ligne budgétaire créée (audit_log BUDGET_CREE) | POST /api/budget |
| 5151 | trace | Ligne budgétaire modifiée (audit_log BUDGET_MODIFIE) | PATCH /api/budget/:id |
| 5152 | trace | Ligne budgétaire supprimée (audit_log BUDGET_SUPPRIME) | DELETE /api/budget/:id |
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
  projection est faite pour etre POSTee et expose les couts de maintenance.
  Les codes 5130 et 5131 (avertissement) sont emis par l'enveloppe de succes,
  comme le 4211 de l'inventaire ;
- synthese : CAPEX impute au mois de COALESCE(date_capex, date_debut), OPEX
  lisse a parts egales sur les mois de [date_debut, date_fin] ; totaux derives
  des mois, arrondis au centime ;
- les montants ne sont pas masques dans ce module (la US donne la lecture a IT
  Ops sans reserve) : IT Ops lit donc l'engage agrege par GET /api/budget/engage
  et /synthese sur consulter_budget, alors que GET /api/commandes/agregats exige
  consulter_kpi_financiers. A valider.

## Referentiels editeurs et logiciels (module 1)

Deux plages, seedees par la migration Commune 041 : 5200-5299 pour les
editeurs, 5300-5399 pour les logiciels. Meme decoupage dans les deux :
x00-x09 succes, x10-x29 erreurs de validation et de reference, x30-x39 traces
audit_log, x99 erreur serveur du module.

Routeurs `server/routes/editeurs.js` et `server/routes/logiciels.js`. Socle
Tenant : migrations 039 (editeur.pays, unicite de la raison sociale) et 040
(produit_client.updated_at et son trigger, tables version_client et
edition_client). Permissions : lecture `consulter_referentiels`, ecriture
`gerer_referentiels`, deja seedees par 007 et sans ajout. La validation passe
par le circuit unique de la #53, avec ses propres codes 3300-3314.

| Code | Type | Libelle | Emis par |
|---|---|---|---|
| 5200 | succes | Liste des éditeurs | GET /api/editeurs |
| 5201 | succes | Détail de l'éditeur | GET /api/editeurs/:id |
| 5202 | succes | Éditeur créé | POST /api/editeurs |
| 5203 | succes | Éditeur modifié | PATCH /api/editeurs/:id |
| 5204 | succes | Éditeur supprimé | DELETE /api/editeurs/:id |
| 5205 | succes | Suggestions d'éditeurs | GET /api/editeurs/recherche |
| 5210 | erreur | Éditeur introuvable | GET/PATCH/DELETE /api/editeurs/:id |
| 5211 | erreur | La raison sociale est obligatoire | POST, PATCH /api/editeurs |
| 5212 | erreur | Un éditeur porte déjà cette raison sociale | POST, PATCH /api/editeurs |
| 5213 | erreur | Suppression impossible : cet éditeur porte des rattachements | DELETE /api/editeurs/:id |
| 5290 | trace | Éditeur créé | POST /api/editeurs |
| 5291 | trace | Éditeur modifié | PATCH /api/editeurs/:id |
| 5292 | trace | Éditeur supprimé | DELETE /api/editeurs/:id |
| 5299 | erreur | Erreur serveur inattendue (référentiel éditeurs) | toutes |
| 5300 | succes | Liste des logiciels | GET /api/logiciels |
| 5301 | succes | Détail du logiciel | GET /api/logiciels/:id |
| 5302 | succes | Logiciel créé | POST /api/logiciels |
| 5303 | succes | Logiciel modifié | PATCH /api/logiciels/:id |
| 5304 | succes | Logiciel supprimé | DELETE /api/logiciels/:id |
| 5305 | succes | Version ajoutée | POST /api/logiciels/:id/versions |
| 5306 | succes | Version supprimée | DELETE /api/logiciels/:id/versions/:idDecl |
| 5307 | succes | Édition ajoutée | POST /api/logiciels/:id/editions |
| 5308 | succes | Édition supprimée | DELETE /api/logiciels/:id/editions/:idDecl |
| 5310 | erreur | Logiciel introuvable | GET/PATCH/DELETE /api/logiciels/:id |
| 5311 | erreur | Le libellé est obligatoire | POST, PATCH /api/logiciels |
| 5312 | erreur | Éditeur introuvable | POST, PATCH /api/logiciels |
| 5313 | erreur | Produit parent introuvable | POST, PATCH /api/logiciels |
| 5314 | erreur | Un produit ne peut pas être son propre parent | PATCH /api/logiciels/:id |
| 5315 | erreur | Ce rattachement fermerait une boucle dans la hiérarchie | PATCH /api/logiciels/:id |
| 5316 | erreur | Le catalogue commun n'est pas modifiable | PATCH/DELETE et declinaisons |
| 5317 | erreur | Suppression impossible : rattachements | DELETE /api/logiciels/:id |
| 5318 | erreur | Le libellé de la version est obligatoire | POST /api/logiciels/:id/versions |
| 5319 | erreur | Cette version existe déjà pour ce logiciel | POST /api/logiciels/:id/versions |
| 5320 | erreur | Le libellé de l'édition est obligatoire | POST /api/logiciels/:id/editions |
| 5321 | erreur | Cette édition existe déjà pour ce logiciel | POST /api/logiciels/:id/editions |
| 5322 | erreur | Version introuvable | DELETE /api/logiciels/:id/versions/:idDecl |
| 5323 | erreur | Édition introuvable | DELETE /api/logiciels/:id/editions/:idDecl |
| 5330 | trace | Logiciel créé | POST /api/logiciels |
| 5331 | trace | Logiciel modifié | PATCH /api/logiciels/:id |
| 5332 | trace | Logiciel supprimé | DELETE /api/logiciels/:id |
| 5399 | erreur | Erreur serveur inattendue (référentiel logiciels) | toutes |

Points de lecture :

- GET /api/editeurs a change de forme : servi jusqu'ici en reponse nue par
  `referentiels.js`, il sort desormais sous enveloppe normalisee. La projection
  conserve id, raison_sociale, url_logo_defaut et url_logo_custom ; `deballer()`
  dans src/services/http.js rend le changement transparent pour le selecteur du
  formulaire contrat ;
- nb_produits et la conformite d'un editeur ne sont pas calculables en SQL : le
  catalogue vit en BDD Commune et l'editeur en Tenant, aucune jointure ne
  traverse les deux bases. Le regroupement est applicatif, en une requete par
  reponse et jamais par ligne ;
- conformite vaut null quand aucun produit de l'editeur ne porte de licence :
  il n'y a alors rien a rapprocher, et un niveau conforme laisserait croire a un
  controle qui n'a pas eu lieu. La balance elle-meme est celle du module 3
  (`server/utils/conformite.js`), pas la table precalcul_conformite, qu'aucun
  trigger, aucune route et aucun script n'alimente ;
- GET /api/logiciels sert le catalogue global (produit_referentiel, Commune) et
  les logiciels client (produit_client, Tenant) sous une forme unique. Chaque
  ligne porte source et modifiable. Toute ecriture visant un identifiant du
  catalogue rend 5316 en 409, et non 404 : le produit existe, c'est l'ecriture
  qui n'a pas lieu d'etre depuis un espace client ;
- GET /api/produits (`referentielsLicences.js`, code 4050) est inchange et
  continue de servir le seul catalogue global au selecteur du formulaire
  licence ;
- a_maintenir a disparu de l'ecran Logiciels : le modele ne le porte plus sur le
  produit depuis la modif 12, la maintenance est un choix client porte par la
  licence.

Recherche incrementale des editeurs (code 5205, migration Commune 042) :

- `GET /api/editeurs/recherche?q=&exclure=&limite=` sert les editeurs deja
  references qui correspondent au texte saisi, au fil de la frappe. Le
  referentiel peut compter des milliers de lignes : personne ne peut verifier de
  visu qu'un editeur en est absent, et le doublon nait de cette impossibilite,
  pas d'une inattention. Les suggestions se montrent donc pendant la saisie, la
  ou l'erreur se commet, et non a l'enregistrement ou l'unicite ne rendrait
  qu'un 5212 apres coup ;
- reponse `{ suggestions, total }`. Volontairement pauvre : ni compteurs ni
  conformite, contrairement a 5200, qui interroge les deux bases. Une frappe ne
  doit couter qu'une requete bornee. `total` porte le nombre de correspondances
  au-dela des `limite` servies (8 par defaut, 25 au plus) ;
- `exclure` ecarte l'editeur en cours de modification, qui ne se signale pas a
  lui-meme comme un doublon de lui-meme ; `exact` marque la correspondance a la
  casse pres, celle que la base refusera ;
- les jokers ILIKE (`%`, `_`) sont echappes : un client tapant "100%" cherche ce
  texte, il n'interroge pas le referentiel avec un joker ;
- route litterale declaree avant `/editeurs/:id`, qui capturerait sinon
  "recherche" comme un identifiant, cote routeur comme cote
  routesPermissions.js.


## Referentiel revendeurs (module 1)

Plage 5220-5239, seedee par la migration Commune 045 et rendue continue par la
043, qui a deplace les trois traces editeurs vers 5290-5292. Decoupage :
5220-5226 succes, 5227-5236 erreurs, 5237-5239 traces audit_log. La plage n'a
pas de x99 : l'erreur serveur du module est 5236.

Routeur `server/routes/revendeurs.js`. Socle Tenant : migration 044 (colonne
actif, updated_at et son trigger, fonctions normaliser_texte et
cle_rapprochement, index, unicite partielle du SIRET). Permissions : lecture
`consulter_referentiels`, ecriture `gerer_referentiels` (admin_sam, manager_dsi
et it_ops par la matrice 011 ; financier en est exclu). Aucune permission
nouvelle.

| Code | Type | Libelle | Emis par |
|---|---|---|---|
| 5220 | succes | Liste des revendeurs | GET /api/revendeurs |
| 5221 | succes | Détail du revendeur | GET /api/revendeurs/:id |
| 5222 | succes | Revendeur créé | POST /api/revendeurs |
| 5223 | succes | Revendeur modifié | PATCH /api/revendeurs/:id |
| 5224 | succes | Revendeur désactivé | POST /api/revendeurs/:id/desactiver |
| 5225 | succes | Revendeur réactivé | POST /api/revendeurs/:id/reactiver |
| 5226 | succes | Suggestions de revendeurs | GET /api/revendeurs/recherche |
| 5227 | erreur | Revendeur introuvable | GET/PATCH /api/revendeurs/:id, changements d'etat |
| 5228 | erreur | La raison sociale est obligatoire | POST, PATCH /api/revendeurs |
| 5229 | erreur | Le SIRET doit contenir 14 chiffres | POST, PATCH /api/revendeurs |
| 5230 | erreur | Un revendeur porte déjà ce SIRET | POST, PATCH /api/revendeurs |
| 5231 | erreur | Un revendeur au nom très proche existe déjà | POST, PATCH /api/revendeurs |
| 5232 | erreur | IBAN invalide | POST, PATCH /api/revendeurs |
| 5233 | erreur | Adresse email invalide | POST, PATCH /api/revendeurs |
| 5234 | erreur | Ce revendeur est déjà désactivé | POST /api/revendeurs/:id/desactiver |
| 5235 | erreur | Ce revendeur est déjà actif | POST /api/revendeurs/:id/reactiver |
| 5236 | erreur | Erreur serveur inattendue (référentiel revendeurs) | toutes |
| 5237 | trace | Revendeur créé | POST /api/revendeurs |
| 5238 | trace | Revendeur modifié | PATCH /api/revendeurs/:id |
| 5239 | trace | Statut du revendeur modifié | POST /api/revendeurs/:id/desactiver et /reactiver |

Points de lecture :

- pas de suppression : quatre tables referencent un revendeur (contrat,
  commande, licence, maintenance_historique) et doivent continuer de le nommer.
  Le retrait est une desactivation reversible, sur le modele acte par la
  migration 022 pour utilisateur. `date_suppression` n'est pas reprise, la 022
  l'ayant justement abandonnee ;
- GET /revendeurs masque les desactives par defaut : cette route sert aussi de
  selecteur aux formulaires contrat et commande. `inclure_inactifs=1` les sert
  avec les autres, la colonne `actif` permettant de les distinguer ;
- la route a change de forme : servie jusqu'ici en reponse nue par
  `referentiels.js`, elle sort desormais sous enveloppe normalisee. Elle
  conserve id et raison_sociale, et `deballer()` dans src/services/http.js rend
  le changement transparent pour ses appelants ;
- 5230 et 5231 portent l'existant dans `details.existant`, avec `details.motif`
  a `siret` ou `raison_sociale`. Ce n'est pas un simple refus : l'ecran doit
  pouvoir ouvrir la fiche existante, ou proposer sa reactivation si elle est
  desactivee. Un refus sec conduirait a recreer le meme revendeur sous un
  troisieme nom ;
- le rapprochement des noms passe par `cle_rapprochement()` (migration 044), qui
  retire accents, casse, ponctuation et forme juridique : "SCC France",
  "S.C.C. FRANCE" et "SCC France SAS" ont la meme cle. Aucune extension n'est
  requise, pg_trgm et fuzzystrmatch n'etant pas installes ;
- la recherche est insensible a la casse et aux accents par `normaliser_texte()`
  applique des deux cotes de la comparaison. Les jokers LIKE (`%`, `_`) sont
  echappes ;
- l'unicite du SIRET (index partiel, migration 044) n'est qu'un garde-fou de
  derniere ligne : elle n'attrape que la course entre deux creations
  simultanees, la detection applicative faisant le travail avant.
## Referentiel contacts (module 4, #181)

Plage 5240-5259, a la suite des revendeurs, seedee par la migration Commune
048. Meme decoupage compact que la 045, la plage n'ayant pas de x99 :
5240-5246 succes, 5247-5256 erreurs (dont 5256, erreur serveur du module),
5257-5259 traces audit_log.

Routeur `server/routes/contacts.js`. Socle Tenant : migration 049
(rattachements id_societe, id_editeur, id_revendeur avec au plus un renseigne,
dates de debut et de fin, updated_at et son trigger, index sur le nom complet
normalise et sa cle de rapprochement, unicite partielle de l'adresse email).
Les fonctions normaliser_texte() et cle_rapprochement() viennent de la 044.
Permissions : lecture `consulter_referentiels`, ecriture `gerer_contacts`, le
code dedie du module organisation (seede par 007, detenu par admin_sam et
manager_dsi dans la matrice 011/021). Aucune permission nouvelle.

| Code | Type | Libelle | Emis par |
|---|---|---|---|
| 5240 | succes | Liste des contacts | GET /api/contacts |
| 5241 | succes | Détail du contact | GET /api/contacts/:id |
| 5242 | succes | Contact créé | POST /api/contacts (201) |
| 5243 | succes | Contact modifié | PATCH /api/contacts/:id |
| 5244 | succes | Contact supprimé | DELETE /api/contacts/:id (200, data null) |
| 5245 | succes | Suggestions de contacts | GET /api/contacts/recherche |
| 5246 | succes | Liste des fonctions | GET /api/fonctions |
| 5247 | erreur | Contact introuvable | GET/PATCH/DELETE /api/contacts/:id (404) |
| 5248 | erreur | Le nom est obligatoire | POST, PATCH /api/contacts |
| 5249 | erreur | Saisie invalide (message surchargé : adresse email ou téléphone) | POST, PATCH /api/contacts |
| 5250 | erreur | Fonction introuvable | POST, PATCH /api/contacts |
| 5251 | erreur | Rattachement introuvable (message surchargé : société, éditeur ou revendeur) | POST, PATCH /api/contacts |
| 5252 | erreur | Un contact porte au plus un rattachement | POST, PATCH /api/contacts |
| 5253 | erreur | Dates invalides (message surchargé : format, ou fin antérieure au début) | POST, PATCH /api/contacts |
| 5254 | erreur | Un contact porte déjà cette adresse email | POST, PATCH /api/contacts (409, details.existant) |
| 5255 | erreur | Un contact au nom très proche existe déjà | POST, PATCH /api/contacts (409, details.existant) |
| 5256 | erreur | Erreur serveur inattendue (référentiel contacts) | toutes |
| 5257 | trace | Contact créé (audit_log CONTACT_CREE) | POST /api/contacts |
| 5258 | trace | Contact modifié (audit_log CONTACT_MODIFIE) | PATCH /api/contacts/:id |
| 5259 | trace | Contact supprimé (audit_log CONTACT_SUPPRIME) | DELETE /api/contacts/:id |

Points de lecture :

- pas de colonne actif : l'etat se deduit de date_fin, une fin echue vaut
  contact inactif. Un contact parti se retire en posant sa date de fin, par
  PATCH ; la suppression reelle reste possible pour une fiche creee par
  erreur, aucune table ne referencant le contact ;
- le rattachement est une FK parmi trois (societe du groupe, editeur,
  revendeur), au plus une renseignee (ck_contact_rattachement_unique). L'API
  sert `type_rattachement` et `rattachement_label` derives, le front n'a pas a
  connaitre la forme en base. Le rattachement est optionnel ;
- 5254 et 5255 portent l'existant dans `details.existant`, avec
  `details.motif` a `email` ou `nom`, comme 5230 et 5231 pour les revendeurs :
  l'ecran propose d'ouvrir la fiche existante plutot que de refuser a sec ;
- le rapprochement des noms passe par `cle_rapprochement()` sur le nom complet,
  compare dans les deux ordres cote recherche : "Lemoine Henri",
  "henri lemoine" et "Henri Lemoine" se retrouvent ;
- la recherche incrementale (5245) porte sur le nom complet dans les deux
  ordres et sur l'adresse email, insensible a la casse et aux accents par
  `normaliser_texte()` applique des deux cotes. Jokers LIKE echappes ;
- l'unicite de l'adresse email (index partiel uq_contact_email, migration 049)
  n'est qu'un garde-fou de derniere ligne contre la course entre deux
  creations simultanees, la detection applicative faisant le travail avant ;
- pas de workflow de validation : comme le revendeur, le contact est un tiers,
  hors du circuit de la #53 ;
- GET /fonctions (5246) sert le referentiel des fonctions (copy-on-write,
  seede par 003) au selecteur du formulaire.

## Notifications (#121, M3-notifications)

Plage 5500-5549, seedee par la migration Commune 052. Routeur
`server/routes/notifications.js`, moteur `server/utils/notifications/`
(catalogue, regles pures, moteur, courriers, planificateur). Socle Tenant :
migration 051 (colonnes sur `notification`, table `preference_notification`,
index d'anti-doublon, verrou journalier, seuil `budget_taux_engagement`,
fonction `purger_notifications()`). Les tables `alerte` et `notification` du
schema 002 sont reutilisees, pas recreees.

Permissions : toutes les routes sont personnelles (bornees a `req.user.id`
dans le routeur) et declarees PUBLIC_AUTHENTIFIE, sauf le declenchement manuel
du traitement planifie, reserve au profil Administrateur SAM par
`gerer_connecteurs` (meme convention que /mails/test). Aucune permission
nouvelle.

| Code | Type | Libelle | Emis par |
|---|---|---|---|
| 5500 | succes | Liste des notifications | GET /api/notifications (filtre `lu`, `page`, `limite`) |
| 5501 | succes | Compteur des notifications non lues | GET /api/notifications/compteur |
| 5502 | succes | Notification marquée comme lue | PATCH /api/notifications/:id/lu |
| 5503 | succes | Toutes les notifications ont été marquées comme lues | POST /api/notifications/tout-lu |
| 5504 | succes | Préférences de notification | GET /api/notifications/preferences |
| 5505 | succes | Préférences de notification enregistrées | PUT /api/notifications/preferences |
| 5506 | succes | Traitement planifié des notifications exécuté | POST /api/notifications/executer-planification |
| 5510 | erreur | Notification introuvable | PATCH /api/notifications/:id/lu (404, y compris celle d'un autre utilisateur) |
| 5511 | erreur | Identifiant de notification invalide | PATCH /api/notifications/:id/lu (400) |
| 5512 | erreur | Le filtre lu doit valoir true ou false | GET /api/notifications |
| 5513 | erreur | Pagination invalide | GET /api/notifications (`page` >= 1, `limite` de 1 a 200) |
| 5514 | erreur | Type de notification inconnu | PUT /api/notifications/preferences (`details.type`) |
| 5515 | erreur | Le réglage du courrier doit valoir immediat, quotidien ou desactive | PUT /api/notifications/preferences |
| 5516 | erreur | Un traitement planifié est déjà en cours | POST /api/notifications/executer-planification (409) |
| 5517 | erreur | Les préférences doivent être transmises sous forme de liste | PUT /api/notifications/preferences |
| 5549 | erreur | Erreur serveur inattendue (module notifications) | toutes |

Points de lecture :

- huit types au pre-catalogue applicatif (`catalogue.js`) : echeance_contrat,
  echeance_souscription, depassement_conformite, budget_seuil,
  validation_en_attente, saisie_traitee, revalidation_echue ; le huitieme est
  la reserve de structure (type en texte controle par le catalogue, un
  nouveau type ne demande aucune migration) ;
- la notification en application est toujours creee ; le courrier suit la
  preference de l'utilisateur par type (immediat, quotidien, desactive),
  defauts du catalogue sinon. Un refus de saisie force l'immediat sauf si le
  courrier est desactive ;
- anti-doublon : index unique (id_utilisateur, cle_evenement), insertion en
  ON CONFLICT DO NOTHING ; une cle par contrat et palier, par licence, par
  produit et jour de recalcul, par societe et exercice, par soumission, par
  cycle de revalidation ;
- destinataires par droits et portee : permissions effectives
  (`permissionsEffectives`) et rattachement (`getAdminScope`) ; les profils de
  la specification sont reconnus par leur permission signature (droits de
  dashboard, `gerer_connecteurs` pour l'administrateur) ; sans
  `consulter_kpi_financiers`, aucun montant dans le texte ni dans le
  courrier (IT Ops recoit les quantites seules) ;
- evenementiel : `soumettre()` du workflow (validation_en_attente) et le
  traitement de `validation.js` (saisie_traitee), dans la transaction de
  l'appelant sous SAVEPOINT, jamais bloquant ; planifie : 7 h Paris
  (echeances, revalidations, conformite, budget, purge) et 7 h 30
  (recapitulatif), rattrapage au demarrage, verrou journalier dans
  `tache_asynchrone` ;
- envois journalises sur la notification (statut, date, resultat, tentatives),
  echec retente au passage suivant jusqu'a 5 tentatives ; sans SMTP configure,
  le socle mail refuse (1001) et le passage n'insiste pas ;
- les codes 1001 a 1003 du socle mail restent les etats d'envoi, ils ne sont
  pas repris dans cette plage.

