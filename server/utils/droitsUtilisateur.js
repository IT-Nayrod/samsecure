// Calcul des permissions effectives d'un utilisateur.
//
// Source unique du RBAC serveur : ce module est consomme par le middleware
// exigerPermission (controle des actions) et par GET /api/auth/mes-droits
// (affichage cote front). Les deux doivent repondre exactement la meme chose,
// sinon un bouton visible mene a un refus, ou l'inverse.
//
// Modele acte le 29/07 : union des permissions des groupes attribues sur le
// perimetre de rattachement, plus les exceptions accordees, moins les
// exceptions retirees. Le retrait est prioritaire sur l'ajout.
import { tenantPool } from "../db.js";

export async function permissionsEffectives(idUtilisateur) {
  const aujourdhui = new Date().toISOString().slice(0, 10);

  // Un compte desactive ou hors de sa periode d'activite n'a aucun droit, meme
  // porteur d'un jeton encore valide. Sans ce controle, un utilisateur retire
  // conserve ses permissions jusqu'a l'expiration de son jeton.
  // actif = false est le seul etat de retrait : la colonne date_suppression a
  // ete supprimee par la migration 023.
  const { rows: actif } = await tenantPool.query(
    `SELECT 1 FROM utilisateur
      WHERE id = $1 AND actif = true
        AND (date_finale            IS NULL OR date_finale            >= CURRENT_DATE)
        AND (date_mise_en_fonction  IS NULL OR date_mise_en_fonction  <= CURRENT_DATE)`,
    [idUtilisateur]
  );
  if (!actif.length) return { permissions: new Set(), isTenantScope: false, compteInactif: true };

  const { rows: ratt } = await tenantPool.query(
    `SELECT id_societe FROM utilisateur_societe
      WHERE id_utilisateur = $1 AND date_suppression IS NULL`,
    [idUtilisateur]
  );
  // Un rattachement a NULL vaut portee tenant : toutes societes.
  const isTenantScope = ratt.some((r) => r.id_societe === null);
  const societeIds = ratt.map((r) => r.id_societe).filter(Boolean);
  const dansPerimetre = (idSociete) =>
    isTenantScope || idSociete === null || societeIds.includes(idSociete);

  const { rows: attribs } = await tenantPool.query(
    `SELECT id_profil, id_societe FROM utilisateur_profil_societe
      WHERE id_utilisateur = $1 AND date_suppression IS NULL`,
    [idUtilisateur]
  );
  // Intersection rattachement x diffusion : une attribution hors perimetre ne
  // produit aucun droit, tout ou rien.
  const profilIds = [...new Set(
    attribs.filter((a) => dansPerimetre(a.id_societe)).map((a) => a.id_profil)
  )];

  let permissions = new Set();
  if (profilIds.length) {
    const { rows } = await tenantPool.query(
      `SELECT DISTINCT p.code
         FROM profil_permission pp
         JOIN permission p ON p.id = pp.id_permission
        WHERE pp.id_profil = ANY($1) AND pp.date_suppression IS NULL`,
      [profilIds]
    );
    permissions = new Set(rows.map((r) => r.code));
  }

  const { rows: exceptions } = await tenantPool.query(
    `SELECT ed.id_societe, ed.type, p.code
       FROM exception_droit ed
       JOIN permission p ON p.id = ed.id_permission
      WHERE ed.id_utilisateur = $1 AND ed.date_suppression IS NULL
        AND (ed.date_debut IS NULL OR ed.date_debut <= $2)
        AND (ed.date_fin   IS NULL OR ed.date_fin   >= $2)`,
    [idUtilisateur, aujourdhui]
  );

  // Tous les accorde avant tous les retire, independamment de l'ordre SQL :
  // c'est ce qui rend le retrait inconditionnellement prioritaire.
  for (const exc of exceptions) {
    if (exc.type === "accorde" && dansPerimetre(exc.id_societe)) permissions.add(exc.code);
  }
  for (const exc of exceptions) {
    if (exc.type !== "retire" || !dansPerimetre(exc.id_societe)) continue;
    // Le retrait ne prime que sur son propre perimetre : un retrait limite a une
    // societe precise ne doit pas masquer un droit toujours acquis ailleurs.
    const retraitCouvreTout = exc.id_societe === null || !isTenantScope;
    if (retraitCouvreTout) permissions.delete(exc.code);
  }

  return { permissions, isTenantScope };
}
