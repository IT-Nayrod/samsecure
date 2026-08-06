import { tenantPool } from "../db.js";

// Périmètre d'un administrateur : ses propres sociétés de rattachement.
// isTenantScope=true (rattachement NULL) => voit tout, sans restriction.
export async function getAdminScope(userId) {
  const { rows } = await tenantPool.query(
    `SELECT id_societe FROM utilisateur_societe WHERE id_utilisateur = $1 AND date_suppression IS NULL`,
    [userId]
  );
  return {
    isTenantScope: rows.some((r) => r.id_societe === null),
    societeIds: rows.map((r) => r.id_societe).filter(Boolean),
  };
}

// Un utilisateur cible n'est dans le périmètre que si son rattachement
// recoupe explicitement une société de l'administrateur. Un administrateur
// à portée société ne voit pas les utilisateurs à portée tenant (NULL) :
// choix conservateur pour éviter qu'un admin restreint gère un admin global.
export async function isUserInScope(targetUserId, scope) {
  if (scope.isTenantScope) return true;
  if (!scope.societeIds.length) return false;
  const { rows } = await tenantPool.query(
    `SELECT 1 FROM utilisateur_societe
     WHERE id_utilisateur = $1 AND date_suppression IS NULL AND id_societe = ANY($2)
     LIMIT 1`,
    [targetUserId, scope.societeIds]
  );
  return rows.length > 0;
}

// Clause SQL + paramètres à ajouter à une requête listant des utilisateurs
// (alias attendu : u). $n correspond au prochain paramètre disponible.
export function scopeWhereClause(scope, paramIndex) {
  if (scope.isTenantScope) return { clause: "TRUE", params: [] };
  if (!scope.societeIds.length) return { clause: "FALSE", params: [] };
  return {
    clause: `EXISTS (
      SELECT 1 FROM utilisateur_societe us
      WHERE us.id_utilisateur = u.id AND us.date_suppression IS NULL AND us.id_societe = ANY($${paramIndex})
    )`,
    params: [scope.societeIds],
  };
}
