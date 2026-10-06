// attributionScope - attribution des groupes personnalisés à un utilisateur.
//
// Refonte #249 (#57) : un groupe ne porte plus de sociétés de diffusion, sa
// portée suit le rattachement de l'utilisateur. Les règles d'intersection
// rattachement x diffusion ont disparu avec elle : attribuer, c'est créer la
// ligne (id_societe NULL côté API), retirer, c'est la retirer. retirerGroupe
// couvre aussi les attributions historiques par société (plusieurs lignes
// pour un même couple utilisateur/groupe avant la refonte).
import { attributionsService } from '../services/adminService';

export async function attribuerGroupe(userId, groupId) {
  await attributionsService.create(userId, { id_profil: groupId });
}

// Retire toutes les attributions existantes pour ce couple utilisateur/groupe.
export async function retirerGroupe(userId, groupId, attributions) {
  const rows = attributions.filter((a) => a.id_utilisateur === userId && a.id_profil === groupId);
  for (const row of rows) {
    await attributionsService.remove(userId, row.id);
  }
}
