// Complétude des fiches (US #324) : actions requises d'une fiche et résumé
// des compteurs par type. Les règles vivent côté serveur
// (server/utils/completude.js) : le front affiche, il ne recalcule jamais.
import { http } from './http';

export const completudeService = {
  // { type, id, label, manques: [{ regle, gravite, libelle,
  //   action: { code, libelle } }], nb_bloquants, nb_recommandes }
  fiche: (type, id) => http.get(`/completude/${type}/${id}`),
  // { genere_le, types: { commande: { total, avec_manque, bloquants,
  //   recommandes, par_regle }, contrat, licence, logiciel, affectation } }
  resume: () => http.get('/completude/resume'),
};
