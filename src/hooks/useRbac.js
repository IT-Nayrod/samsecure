// useRbac - garde RBAC au niveau action, adossee aux permissions reelles.
//
// Les permissions viennent de GET /api/auth/mes-droits, chargees par
// AuthContext au login et a la restauration de session. C'est exactement le
// meme calcul que le middleware serveur, les deux consomment
// server/utils/droitsUtilisateur.js : un bouton affiche ne peut donc pas mener
// a un refus, ni une action autorisee rester invisible.
//
// Appele SANS argument, le hook reste permissif pour tout utilisateur
// authentifie. Ce n'est pas un oubli : les modules non branches sur l'API ne
// sont soumis a aucun controle serveur, y masquer des boutons donnerait une
// impression de securite sans rien proteger. Ils passeront au controle reel au
// fur et a mesure de leur branchement.
//
// Appele AVEC des codes, il evalue les droits reels :
//   useRbac({ write: 'saisir_contrat', validate: 'valider_saisie' })
import useAuth from './useAuth';

export default function useRbac(codes = {}) {
  const { isAuthenticated, hasPermission } = useAuth();

  // Pas de code fourni : comportement historique, permissif.
  const peut = (code) => (code ? hasPermission(code) : isAuthenticated);

  return {
    canWrite:    peut(codes.write),
    // La suppression suit le droit d'ecriture sauf mention contraire : aucune
    // permission "supprimer" distincte n'existe au referentiel.
    canDelete:   peut(codes.delete ?? codes.write),
    canValidate: peut(codes.validate),
    isReadOnly:  codes.write ? !hasPermission(codes.write) : false,

    // Modules non branches sur l'API : inchanges tant qu'aucune route ne les
    // protege cote serveur.
    submitsForValidation: false,
    canEditCatalogue: false,
    canEditBudget: isAuthenticated,
    canWriteBudget: isAuthenticated,
    canDeleteBudget: isAuthenticated,
  };
}
