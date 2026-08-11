# Pre-catalogue des codes retour

Fichier transitoire alimente au fil du developpement. La story #68 fera les
INSERT en base a partir de ce tableau et remplacera les retours commentes par
le helper d'enveloppe. Ne pas implementer de resolution de code ici.

Plages : contrats 3000-3099 | commandes 3100-3199 | documents 3200-3299 |
validation 3300-3399

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
| 3141 | erreur | L'annee demandee est invalide | GET /api/commandes/agregats |
| 3142 | erreur | Identifiant de societe invalide | GET /api/commandes/agregats |
| 3143 | erreur | Identifiant d'editeur invalide | GET /api/commandes/agregats |
| 3199 | erreur | Erreur serveur inattendue (module commandes) | toutes |

Le montant refuse le zero, le negatif et la saisie non numerique sous le meme
code 3119 : dans les trois cas la valeur n'est pas un montant valide, et
distinguer n'apporterait rien a l'utilisateur.
