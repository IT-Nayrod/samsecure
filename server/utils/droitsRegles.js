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

// ---------------------------------------------------------------------------
// Delegation des droits d'administration (#278, decisions du 06/10/2026).
// ---------------------------------------------------------------------------

// Les deux permissions qui portent la delegation en cascade : les tracer
// explicitement rend la delegation lisible dans l'audit (PROFIL_DELEGATION_*).
export const PERMISSIONS_DELEGATION = ["gerer_utilisateurs", "gerer_profils"];

// Types traites comme « profil ajoute » (#276) : 'ajoute' (097) et 'groupe'
// tant que la bascule n'est pas jouee sur toutes les bases. Source unique,
// partagee par les routeurs profils, profilPermissions et utilisateurProfils.
export const TYPES_PROFIL_AJOUTE = ["groupe", "ajoute"];

// On n'attribue que des droits que l'on detient soi-meme : codes demandes
// absents des permissions detenues (Set ou tableau), tries pour des messages
// et des traces stables. Un acteur admin_sam est exempte par l'appelant.
export function permissionsManquantes(codesDemandes, permissionsDetenues) {
  const detenues = permissionsDetenues instanceof Set
    ? permissionsDetenues
    : new Set(permissionsDetenues);
  return [...new Set(codesDemandes)].filter((code) => !detenues.has(code)).sort();
}

// Delta de deux matrices (listes de codes) : ce qui est ajoute et retire.
// Sert au garde-fou (seuls les ajouts exigent la detention) et aux traces de
// delegation (PERMISSIONS_DELEGATION croisees avec ajoutes/retires).
export function deltaMatrice(avant, apres) {
  const a = new Set(avant);
  const b = new Set(apres);
  return {
    ajoutes: [...b].filter((code) => !a.has(code)).sort(),
    retires: [...a].filter((code) => !b.has(code)).sort(),
  };
}

// ---------------------------------------------------------------------------
// Groupes d'utilisateurs (#277/#330, decisions client du 08/10/2026, issue #213).
// ---------------------------------------------------------------------------

// Garde-fou de composition : « on ne compose un groupe qu'avec des profils et
// des societes que l'on detient ». Rend les societes demandees hors du
// perimetre de l'acteur (scope au sens de scopeAdministration : admin_sam et
// rattachement tenant voient tout), triees pour des messages et traces
// stables. La detention des profils passe, elle, par permissionsManquantes.
export function societesNonDetenues(societeIds, scope) {
  if (scope.isTenantScope) return [];
  const detenues = new Set(scope.societeIds || []);
  return [...new Set(societeIds)].filter((id) => !detenues.has(id)).sort();
}

// Societes couvertes par profil depuis les lignes d'acces des groupes d'un
// compte ([{ id_profil, societes }]) : union des societes par profil. Une
// ligne dont le groupe d'organisations n'a aucune societe active ne confere
// RIEN - pas de repli sur la matrice par defaut, contrairement a un
// rattachement vide : la portee d'une ligne est exactement celle de son
// groupe. L'union par profil est exacte : la matrice effective d'un profil
// sur S1 u S2 (matriceProfilEffective) est l'union de ses matrices effectives
// sur S1 et sur S2, le defaut n'entrant que s'il reste une societe non
// configuree de part et d'autre.
export function societesParProfilDesGroupes(lignes) {
  const parProfil = new Map();
  for (const ligne of lignes) {
    const societes = (ligne.societes || []).filter(Boolean);
    if (!societes.length) continue;
    let ensemble = parProfil.get(ligne.id_profil);
    if (!ensemble) { ensemble = new Set(); parProfil.set(ligne.id_profil, ensemble); }
    for (const id of societes) ensemble.add(id);
  }
  return parProfil;
}
