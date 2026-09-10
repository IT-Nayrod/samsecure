// validationService - traitement du workflow de validation des saisies (#53).
// Une seule paire d'endpoints sert les quatre ressources, l'entite_type est
// polymorphe côté API : le front n'a donc qu'un service, pas un par bloc.
// Même convention que les autres services : aucun fetch direct, http.js porte
// le Bearer, le refresh sur 401 et la normalisation des erreurs en ApiError
// (message = champ "error" affiché tel quel, code = code_retour, #68) et le
// déballage de l'enveloppe { code, type, libelle, data }.
import { http } from './http';

export const validationService = {
  valider: (entiteType, id) => http.post(`/validation/${entiteType}/${id}/valider`),
  refuser: (entiteType, id, motif) =>
    http.post(`/validation/${entiteType}/${id}/refuser`, { message_refus: motif }),
};

// Report de la réponse de traitement sur l'entité affichée. Les trois champs
// sont exactement ceux que les GET liste et détail renvoient : appliquer la
// réponse suffit, aucun rechargement n'est nécessaire.
export function appliquerStatut(entite, reponse) {
  return {
    ...entite,
    statut_validation: reponse.statut_validation,
    statut_validation_label: reponse.statut_validation_label,
    message_refus: reponse.message_refus,
  };
}
