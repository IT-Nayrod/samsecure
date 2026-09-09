// useRbac - garde RBAC au niveau action, adossée aux permissions réelles.
//
// Les permissions viennent de GET /api/auth/mes-droits, chargées par
// AuthContext au login et à la restauration de session. C'est exactement le
// même calcul que le middleware serveur, les deux consomment
// server/utils/droitsUtilisateur.js : un bouton affiché ne peut donc pas mener
// à un refus, ni une action autorisée rester invisible.
//
// Appelé SANS argument, le hook reste permissif pour tout utilisateur
// authentifié. Ce n'est pas un oubli : les modules non branchés sur l'API ne
// sont soumis à aucun contrôle serveur, y masquer des boutons donnerait une
// impression de sécurité sans rien protéger. Ils passeront au contrôle réel au
// fur et à mesure de leur branchement.
//
// Appelé AVEC des codes, il évalue les droits réels :
//   useRbac({ write: 'saisir_contrat', validate: 'valider_saisie' })
import useAuth from './useAuth';

export default function useRbac(codes = {}) {
  const { isAuthenticated, hasPermission } = useAuth();

  // Pas de code fourni : comportement historique, permissif.
  const peut = (code) => (code ? hasPermission(code) : isAuthenticated);

  return {
    canWrite:    peut(codes.write),
    // La suppression suit le droit d'écriture sauf mention contraire : aucune
    // permission "supprimer" distincte n'existe au référentiel.
    canDelete:   peut(codes.delete ?? codes.write),
    canValidate: peut(codes.validate),
    isReadOnly:  codes.write ? !hasPermission(codes.write) : false,

    // Modules non branchés sur l'API : inchangés tant qu'aucune route ne les
    // protège côté serveur.
    submitsForValidation: false,
    canEditCatalogue: false,
    canEditBudget: isAuthenticated,
    canWriteBudget: isAuthenticated,
    canDeleteBudget: isAuthenticated,
  };
}
