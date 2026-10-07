// Règles pures du modèle de droits #249 (corrigé multi-profils le
// 06/10/2026), sans dépendance à la base ni à l'environnement : testables par
// node --test (droitsUtilisateur.test.js), même motif que
// notifications/regles.js. Consommées par droitsUtilisateur.js (calcul
// effectif) et droitsEffectifs.js (visionneuse).

// Matrice effective du profil par défaut sur un ensemble de sociétés
// couvertes. matricesParSociete : Map(id_societe -> [codes]) des seules
// sociétés configurées. La matrice par défaut n'entre dans l'union que si au
// moins une société couverte n'est pas configurée, ou si aucune société n'est
// couverte (tenant sans société, compte sans rattachement) : une société
// configurée fige sa matrice, y compris vide (Q2/Q3).
export function matriceProfilEffective({ societesCouvertes, matriceDefaut, matricesParSociete }) {
  const codes = new Set();
  let defautRequis = societesCouvertes.length === 0;
  for (const idSociete of societesCouvertes) {
    const configuree = matricesParSociete.get(idSociete);
    if (configuree) {
      for (const code of configuree) codes.add(code);
    } else {
      defautRequis = true;
    }
  }
  if (defautRequis) {
    for (const code of matriceDefaut) codes.add(code);
  }
  return codes;
}

// Union des permissions apportées par plusieurs profils (correctif
// multi-profils du #249 : un compte porte PLUSIEURS profils par défaut,
// stories #73/#190). Chaque profil contribue sa matrice effective
// (matriceProfilEffective), l'union fait foi : une société configurée pour un
// profil ne masque jamais ce qu'un AUTRE profil apporte, le masquage Q2/Q3
// étant propre à chaque profil.
export function unionPermissions(matrices) {
  const codes = new Set();
  for (const matrice of matrices) {
    for (const code of matrice) codes.add(code);
  }
  return codes;
}

// Exceptions : tous les accorde avant tous les retire, indépendamment de
// l'ordre SQL, c'est ce qui rend le retrait inconditionnellement prioritaire.
// Un retrait borné à une société précise ne masque pas un droit toujours
// acquis ailleurs quand le rattachement couvre tout le tenant (inchangé
// depuis le modèle du 29/07).
export function appliquerExceptions(permissions, exceptions, { isTenantScope, dansPerimetre }) {
  for (const exc of exceptions) {
    if (exc.type === "accorde" && dansPerimetre(exc.id_societe)) permissions.add(exc.code);
  }
  for (const exc of exceptions) {
    if (exc.type !== "retire" || !dansPerimetre(exc.id_societe)) continue;
    const retraitCouvreTout = exc.id_societe === null || !isTenantScope;
    if (retraitCouvreTout) permissions.delete(exc.code);
  }
  return permissions;
}
