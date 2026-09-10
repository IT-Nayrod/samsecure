// Cibles de drill-down des widgets (#192) : chaque widget mène à l'écran
// concerné, avec les filtres présélectionnés que les pages savent déjà lire
// dans l'URL (paramètres constatés dans les pages des modules 2 et 3 :
// contrats ?editeur ?societe, commandes ?societe ?contrat, factures ?contrat
// ?commande, licences ?produit, affectations ?produit ?societe, inventaire
// ?produit, budget ?tab ?licence ?contrat). Les identifiants sont des UUID.
export const ROUTES_DRILL = {
  contrats:     (params = {}) => avecParams('/contrats/liste', params),
  commandes:    (params = {}) => avecParams('/contrats/commandes', params),
  factures:     (params = {}) => avecParams('/contrats/factures', params),
  licences:     (params = {}) => avecParams('/conformite/licences', params),
  affectations: (params = {}) => avecParams('/conformite/affectations', params),
  inventaire:   (params = {}) => avecParams('/conformite/inventaire', params),
  budget:       (params = {}) => avecParams('/budget', params),
  editeur:      (id) => (id ? `/referentiels/editeurs/${id}` : '/referentiels/editeurs'),
};

function avecParams(chemin, params) {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return q ? `${chemin}?${q}` : chemin;
}

// Fiche de l'entité du workflow de validation : mêmes types que le catalogue
// serveur ENTITES_VALIDABLES.
export function routeEntite(entiteType, entiteId) {
  switch (entiteType) {
    case 'contrat':        return entiteId ? `/contrats/liste/${entiteId}` : '/contrats/liste';
    case 'commande':       return entiteId ? `/contrats/commandes/${entiteId}` : '/contrats/commandes';
    case 'facture':
    case 'preuve':         return entiteId ? `/contrats/factures/${entiteId}` : '/contrats/factures';
    case 'licence':        return entiteId ? `/conformite/licences/${entiteId}` : '/conformite/licences';
    case 'affectation':    return entiteId ? `/conformite/affectations/${entiteId}` : '/conformite/affectations';
    case 'editeur':        return entiteId ? `/referentiels/editeurs/${entiteId}` : '/referentiels/editeurs';
    case 'produit_client': return entiteId ? `/referentiels/logiciels/${entiteId}` : '/referentiels/logiciels';
    default:               return '/contrats/liste';
  }
}
