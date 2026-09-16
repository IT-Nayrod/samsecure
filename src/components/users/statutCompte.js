// statutCompte - règles pures de l'état d'un compte utilisateur (#211).
//
// Partagées par la liste des utilisateurs (filtres, badge de statut,
// atténuation des lignes) et testées sans React (statutCompte.test.js).
//
// Champs réels du compte (table utilisateur, migrations 002, 009 et 023) :
//   actif                  booléen, seul état de retrait ; false = désactivé.
//   date_finale            DATE ou NULL : dernier jour d'activité, inclus. Une
//                          désactivation immédiate y pose aussi la date du
//                          jour (StatutCompteModal), c'est la « date de
//                          désactivation » affichée : aucune colonne distincte
//                          n'existe pour cela.
//   date_mise_en_fonction  DATE ou NULL : premier jour d'activité.
//
// Règle serveur, reprise ici à l'identique (auth.js au login,
// droitsUtilisateur.js à chaque calcul des droits) : un compte n'a accès que
// si actif = true, date_finale >= aujourd'hui ou NULL, et
// date_mise_en_fonction <= aujourd'hui ou NULL. Aucun ordonnanceur n'existe :
// les dates sont évaluées à chaque appel, l'écran fait de même.

const JOUR_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Aujourd'hui au format ISO jour, en UTC : c'est la convention historique de
// l'écran, et celle du serveur (CURRENT_DATE d'une instance en UTC).
export function aujourdhuiIso() {
  return new Date().toISOString().slice(0, 10);
}

// Ramène une date servie par l'API au format ISO jour (AAAA-MM-JJ).
// GET /utilisateurs sert ses colonnes DATE en texte depuis #211 ; un
// horodatage complet (objet Date sérialisé par pg, ancien format) est ramené
// au jour local du navigateur, celui que formatDate affiche.
export function dateIso(valeur) {
  if (!valeur) return null;
  if (typeof valeur === 'string' && JOUR_ISO.test(valeur)) return valeur;
  const d = valeur instanceof Date ? valeur : new Date(valeur);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Inactif au sens du serveur : actif = false, ou échéance dépassée. Le login
// et le calcul des droits refusent ces deux cas de la même façon.
export function estInactif(u, aujourdhui = aujourdhuiIso()) {
  const fin = dateIso(u.date_finale);
  return !u.actif || (fin !== null && fin < aujourdhui);
}

// Mise en fonction programmée et pas encore atteinte : la connexion est
// refusée jusqu'à la date, incluse dans la période d'activité.
export function estEnAttenteDeMiseEnFonction(u, aujourdhui = aujourdhuiIso()) {
  const debut = dateIso(u.date_mise_en_fonction);
  return debut !== null && debut > aujourdhui;
}

// Compte qui peut se connecter aujourd'hui : les trois conditions du serveur.
export function estActifAujourdhui(u, aujourdhui = aujourdhuiIso()) {
  return !estInactif(u, aujourdhui) && !estEnAttenteDeMiseEnFonction(u, aujourdhui);
}

// Filtres historiques de la liste. « Utilisateurs actifs » garde sa définition
// d'origine, le contraire d'inactif : un compte dont la mise en fonction est à
// venir y figure encore, avec son badge d'avertissement.
export const FILTRES_STATUT = [
  { valeur: 'actifs',   libelle: 'Utilisateurs actifs',   predicat: (u, j) => !estInactif(u, j) },
  { valeur: 'inactifs', libelle: 'Utilisateurs inactifs', predicat: (u, j) => estInactif(u, j) },
  { valeur: 'tous',     libelle: 'Tous les utilisateurs', predicat: () => true },
];

// Filtres calculés depuis les dates du compte (#211). « Actif » y signifie
// actif aujourd'hui au sens du serveur : un compte en attente de mise en
// fonction n'est pas actif, il relève du troisième filtre.
export const FILTRES_DATES = [
  {
    valeur: 'actif_sans_limite',
    libelle: 'Actif sans date limite',
    predicat: (u, j) => estActifAujourdhui(u, j) && dateIso(u.date_finale) === null,
  },
  {
    valeur: 'actif_avec_limite',
    libelle: 'Actif avec date limite définie',
    predicat: (u, j) => estActifAujourdhui(u, j) && dateIso(u.date_finale) !== null,
  },
  {
    // Inactif ou pas encore actif, avec une date d'activation à venir. Couvre
    // l'activation programmée (actif = true, date future, cas produit par
    // StatutCompteModal) et un compte laissé à actif = false avec une date
    // future (possible par le formulaire ou l'API : il ne s'activera pas seul,
    // le compte restant désactivé).
    valeur: 'inactif_activation_future',
    libelle: "Inactif avec date d'activation future définie",
    predicat: (u, j) => !estActifAujourdhui(u, j) && estEnAttenteDeMiseEnFonction(u, j),
  },
];

const TOUS_LES_FILTRES = [...FILTRES_STATUT, ...FILTRES_DATES];

// Une valeur inconnue ne filtre rien : mieux vaut la liste entière qu'une
// liste vide sans explication.
export function filtrerParStatut(utilisateurs, valeur, aujourdhui = aujourdhuiIso()) {
  const filtre = TOUS_LES_FILTRES.find((f) => f.valeur === valeur);
  if (!filtre) return utilisateurs;
  return utilisateurs.filter((u) => filtre.predicat(u, aujourdhui));
}
