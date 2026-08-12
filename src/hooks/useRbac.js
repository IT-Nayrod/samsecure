// useRbac - garde RBAC reutilisable au niveau action (au-dela des routes deja gardees par ProtectedRoute)
//
// Règle posée par Dorian (itération courante) : organisation, droits d'usage,
// déploiement, budget et rapports ne sont plus conditionnés par rôle, seuls
// l'administration et les dashboards le sont (gérés ailleurs, via les
// permissions réelles de useAuth). Ce hook reste donc permissif pour tout
// utilisateur authentifié ; sa forme est conservée pour ne pas casser les
// composants qui le consomment.
import useAuth from './useAuth';

export default function useRbac() {
  const { isAuthenticated } = useAuth();

  return {
    isReadOnly: false,
    canWrite: isAuthenticated,
    submitsForValidation: false,
    canValidate: isAuthenticated,
    canDelete: isAuthenticated,
    canEditCatalogue: false,
    canEditBudget: isAuthenticated,
    canWriteBudget: isAuthenticated,
    canDeleteBudget: isAuthenticated,
  };
}
