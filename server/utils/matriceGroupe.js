// Règles pures de la matrice groupe x permission (#170), sans base.
//
// profil_permission cumule une contrainte unique pleine (uq_profil_permission
// sur id_profil, id_permission, migration 002) et un retrait logique
// (date_suppression, migration 008) : une ligne retirée reste en table, c'est
// voulu (la 021 s'appuie dessus pour qu'un rejeu de la 011 ne ressuscite pas un
// droit retiré). Conséquence : pour un couple déjà retiré une fois, l'ajout
// n'est pas une insertion mais une réactivation. L'INSERT nu d'origine levait
// une violation d'unicité (23505), rendue en 500, sur tout droit décoché puis
// recoché. Même défaut, même remède que uq_utilisateur_profil_societe dans
// utilisateurProfils.js.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Garde-fou des identifiants : un texte quelconque dans l'URL ou le corps doit
// donner un refus lisible, pas l'erreur 22P02 de PostgreSQL rendue en 500.
export function estUuid(valeur) {
  return typeof valeur === "string" && UUID_RE.test(valeur);
}

// État d'un couple (groupe, permission) d'après sa ligne profil_permission,
// lue avant écriture : undefined ou null si le couple n'a jamais existé.
export function etatLigne(ligne) {
  if (!ligne) return "absente";
  return ligne.date_suppression ? "retiree" : "active";
}

// Ajout d'un droit à un groupe. Un droit déjà actif n'est pas une erreur
// (double clic, deux administrateurs sur la même fiche) : la route répond 200
// avec la ligne existante, sans écrire ni journaliser.
export function deciderAjout(ligne) {
  const etat = etatLigne(ligne);
  if (etat === "active") return { ecriture: "aucune", status: 200 };
  return { ecriture: etat === "retiree" ? "reactiver" : "inserer", status: 201 };
}

// Retrait d'un droit. Seule une ligne active se retire ; un couple absent ou
// déjà retiré est un refus 404, comme avant, pour que l'écran se resynchronise.
export function deciderRetrait(ligne) {
  if (etatLigne(ligne) !== "active") return { ecriture: "aucune", status: 404 };
  return { ecriture: "retirer", status: 204 };
}
