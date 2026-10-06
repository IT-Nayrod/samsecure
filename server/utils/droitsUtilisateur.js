// Calcul des permissions effectives d'un utilisateur.
//
// Source unique du RBAC serveur : ce module est consommé par le middleware
// exigerPermission (contrôle des actions) et par GET /api/auth/mes-droits
// (affichage côté front). Les deux doivent répondre exactement la même chose,
// sinon un bouton visible mène à un refus, ou l'inverse.
//
// Modèle refondu par le #249 (remplace le modèle du 29/07) :
// 1. Profil par défaut du compte (utilisateur.id_profil, un seul) : pour
//    chaque société couverte par le rattachement, la matrice configurée pour
//    (profil, société) fait foi intégralement si elle existe (Q2/Q3), sinon la
//    matrice par défaut du tenant. Le contrôle par route porte sur l'union de
//    ces matrices (Q4) ; le filtrage fin par société reste une limite connue.
// 2. Groupes personnalisés attribués (utilisateur_profil_societe, type
//    'groupe') : union de leurs permissions. Plus aucune condition de
//    diffusion (#57), la portée d'un groupe suit le rattachement ; la colonne
//    id_societe de la table n'est plus lue.
// 3. Exceptions individuelles, bornées au périmètre : tous les accords puis
//    tous les retraits, le retrait restant inconditionnellement prioritaire.
import { tenantPool } from "../db.js";
import { matriceProfilEffective, appliquerExceptions } from "./droitsRegles.js";

// Les règles pures (matrice effective, exceptions) vivent dans droitsRegles.js,
// sans dépendance à la base : node --test les exécute sans .env (même motif
// que notifications/regles.js). Ré-exportées ici pour les consommateurs.
export { matriceProfilEffective, appliquerExceptions } from "./droitsRegles.js";

// ---------------------------------------------------------------------------
// Lecture en base et assemblage.
// ---------------------------------------------------------------------------

// Permissions issues du profil par défaut, selon la règle Q2/Q3/Q4. Exposée
// pour droitsEffectifs.js (visionneuse et simulateur), qui résout la même
// matrice pour une société donnée.
export async function permissionsDuProfil(idProfil, societesCouvertes) {
  const { rows: defaut } = await tenantPool.query(
    `SELECT p.code
       FROM profil_permission pp
       JOIN permission p ON p.id = pp.id_permission
      WHERE pp.id_profil = $1 AND pp.date_suppression IS NULL`,
    [idProfil]
  );

  const matricesParSociete = new Map();
  if (societesCouvertes.length) {
    const { rows: configurees } = await tenantPool.query(
      `SELECT id_societe FROM profil_societe_configuration
        WHERE id_profil = $1 AND id_societe = ANY($2)`,
      [idProfil, societesCouvertes]
    );
    if (configurees.length) {
      const ids = configurees.map((r) => r.id_societe);
      // Une société configurée sans ligne de matrice est une matrice vidée
      // volontairement : elle doit exister dans la Map, vide (Q3).
      for (const id of ids) matricesParSociete.set(id, []);
      const { rows: matrices } = await tenantPool.query(
        `SELECT psp.id_societe, p.code
           FROM profil_societe_permission psp
           JOIN permission p ON p.id = psp.id_permission
          WHERE psp.id_profil = $1 AND psp.id_societe = ANY($2)`,
        [idProfil, ids]
      );
      for (const m of matrices) matricesParSociete.get(m.id_societe).push(m.code);
    }
  }

  return matriceProfilEffective({
    societesCouvertes,
    matriceDefaut: defaut.map((r) => r.code),
    matricesParSociete,
  });
}

export async function permissionsEffectives(idUtilisateur) {
  const aujourdhui = new Date().toISOString().slice(0, 10);

  // Un compte désactivé ou hors de sa période d'activité n'a aucun droit, même
  // porteur d'un jeton encore valide. Sans ce contrôle, un utilisateur retiré
  // conserve ses permissions jusqu'à l'expiration de son jeton.
  // actif = false est le seul état de retrait : la colonne date_suppression a
  // été supprimée par la migration 023.
  const { rows: actif } = await tenantPool.query(
    `SELECT id_profil FROM utilisateur
      WHERE id = $1 AND actif = true
        AND (date_finale            IS NULL OR date_finale            >= CURRENT_DATE)
        AND (date_mise_en_fonction  IS NULL OR date_mise_en_fonction  <= CURRENT_DATE)`,
    [idUtilisateur]
  );
  if (!actif.length) return { permissions: new Set(), isTenantScope: false, compteInactif: true };
  const idProfil = actif[0].id_profil;

  const { rows: ratt } = await tenantPool.query(
    `SELECT id_societe FROM utilisateur_societe
      WHERE id_utilisateur = $1 AND date_suppression IS NULL`,
    [idUtilisateur]
  );
  // Un rattachement à NULL vaut portée tenant : toutes sociétés.
  const isTenantScope = ratt.some((r) => r.id_societe === null);
  const societeIds = ratt.map((r) => r.id_societe).filter(Boolean);
  const dansPerimetre = (idSociete) =>
    isTenantScope || idSociete === null || societeIds.includes(idSociete);

  const permissions = new Set();

  // 1. Profil par défaut. Sociétés couvertes : le rattachement, ou toutes les
  // sociétés actives du tenant pour une portée tenant (les sociétés
  // configurées du profil y contribuent alors toutes, Q4).
  if (idProfil) {
    let societesCouvertes = societeIds;
    if (isTenantScope) {
      const { rows } = await tenantPool.query(
        `SELECT id FROM societe WHERE date_suppression IS NULL`
      );
      societesCouvertes = rows.map((r) => r.id);
    }
    for (const code of await permissionsDuProfil(idProfil, societesCouvertes)) {
      permissions.add(code);
    }
  }

  // 2. Groupes personnalisés attribués (#57) : l'attribution suffit, sans
  // condition de diffusion ni lecture de id_societe.
  const { rows: groupes } = await tenantPool.query(
    `SELECT DISTINCT perm.code
       FROM utilisateur_profil_societe ups
       JOIN profil g ON g.id = ups.id_profil
                    AND g.type = 'groupe' AND g.date_suppression IS NULL
       JOIN profil_permission pp ON pp.id_profil = g.id AND pp.date_suppression IS NULL
       JOIN permission perm ON perm.id = pp.id_permission
      WHERE ups.id_utilisateur = $1 AND ups.date_suppression IS NULL`,
    [idUtilisateur]
  );
  for (const r of groupes) permissions.add(r.code);

  // 3. Exceptions, retrait prioritaire (règle pure appliquerExceptions).
  const { rows: exceptions } = await tenantPool.query(
    `SELECT ed.id_societe, ed.type, p.code
       FROM exception_droit ed
       JOIN permission p ON p.id = ed.id_permission
      WHERE ed.id_utilisateur = $1 AND ed.date_suppression IS NULL
        AND (ed.date_debut IS NULL OR ed.date_debut <= $2)
        AND (ed.date_fin   IS NULL OR ed.date_fin   >= $2)`,
    [idUtilisateur, aujourdhui]
  );
  appliquerExceptions(permissions, exceptions, { isTenantScope, dansPerimetre });

  return { permissions, isTenantScope };
}
