// attributionScope - réplique fidèle de refreshAttributionSocietes (sandbox
// Antonin, index.html) : une attribution groupe/utilisateur n'est valide que
// sur l'intersection du rattachement de l'utilisateur et de la diffusion du
// groupe. Portée NULL (tenant) des deux côtés = "toutes sociétés".
// Utilisé aux deux points d'entrée (fiche utilisateur, fiche groupe).
import { attributionsService } from '../services/adminService';

export function isTenantScope(societeIds) {
  return societeIds.length === 0 || societeIds.includes(null);
}

// Calcule la portée valide : { tenant: true } si les deux côtés sont à
// l'échelle tenant (l'attribution devra porter id_societe = NULL), sinon
// { tenant: false, societeIds } = liste exacte des sociétés sur lesquelles
// l'attribution doit être créée (une ligne par société).
export function computeIntersection(userSocieteIds, groupSocieteIds) {
  const userTenant = isTenantScope(userSocieteIds);
  const groupTenant = isTenantScope(groupSocieteIds);
  if (userTenant && groupTenant) return { tenant: true, societeIds: [] };
  if (userTenant) return { tenant: false, societeIds: groupSocieteIds.filter(Boolean) };
  if (groupTenant) return { tenant: false, societeIds: userSocieteIds.filter(Boolean) };
  const groupSet = new Set(groupSocieteIds.filter(Boolean));
  return { tenant: false, societeIds: userSocieteIds.filter((id) => id && groupSet.has(id)) };
}

// Un groupe est cochable pour un utilisateur si l'intersection de leurs
// portées est non vide (ou si l'un des deux est à l'échelle tenant).
export function isGroupAssignable(userSocieteIds, groupSocieteIds) {
  if (isTenantScope(userSocieteIds) || isTenantScope(groupSocieteIds)) return true;
  const groupSet = new Set(groupSocieteIds.filter(Boolean));
  return userSocieteIds.some((id) => id && groupSet.has(id));
}

// Crée l'attribution (ou les attributions, une par société de l'intersection)
// couvrant l'intégralité du périmètre valide.
export async function attribuerGroupe(userId, groupId, userSocieteIds, groupSocieteIds) {
  const { tenant, societeIds } = computeIntersection(userSocieteIds, groupSocieteIds);
  if (tenant) {
    await attributionsService.create(userId, { id_profil: groupId, id_societe: null });
    return;
  }
  for (const societeId of societeIds) {
    await attributionsService.create(userId, { id_profil: groupId, id_societe: societeId });
  }
}

// Retire toutes les attributions existantes pour ce couple utilisateur/groupe.
export async function retirerGroupe(userId, groupId, attributions) {
  const rows = attributions.filter((a) => a.id_utilisateur === userId && a.id_profil === groupId);
  for (const row of rows) {
    await attributionsService.remove(userId, row.id);
  }
}
