// validationService - traitement du workflow de validation des saisies (#53).
// Une seule paire d'endpoints sert les quatre ressources, l'entite_type est
// polymorphe cote API : le front n'a donc qu'un service, pas un par bloc.
// Meme convention que les autres services : aucun fetch direct, http.js porte
// le Bearer, le refresh sur 401 et la normalisation des erreurs en ApiError
// dont le message est le champ "error" du serveur, affiche tel quel.
import { http } from './http';

export const validationService = {
  valider: (entiteType, id) => http.post(`/validation/${entiteType}/${id}/valider`),
  refuser: (entiteType, id, motif) =>
    http.post(`/validation/${entiteType}/${id}/refuser`, { message_refus: motif }),
};

// Report de la reponse de traitement sur l'entite affichee. Les trois champs
// sont exactement ceux que les GET liste et detail renvoient : appliquer la
// reponse suffit, aucun rechargement n'est necessaire.
export function appliquerStatut(entite, reponse) {
  return {
    ...entite,
    statut_validation: reponse.statut_validation,
    statut_validation_label: reponse.statut_validation_label,
    message_refus: reponse.message_refus,
  };
}
