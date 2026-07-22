// useRbac - garde RBAC reutilisable au niveau action (au-dela des routes deja gardees par ProtectedRoute)
import useAuth from './useAuth';

export default function useRbac() {
  const { profil } = useAuth();

  const isManagerDsi = profil === 'manager_dsi';
  const isItOps = profil === 'it_ops';
  const isFinancier = profil === 'financier';

  return {
    profil,
    isReadOnly: isFinancier,
    // Creer / editer un editeur, revendeur, contact ou produit client
    canWrite: isManagerDsi || isItOps,
    // Une saisie d'IT Ops passe en attente de validation, celle du Manager DSI est validee directement
    submitsForValidation: isItOps,
    // Valider / refuser une saisie en attente
    canValidate: isManagerDsi,
    // Supprimer une entree de referentiel
    canDelete: isManagerDsi,
    // Le catalogue commun (produits referentiel, versions, editions du catalogue) n'est modifiable par personne
    canEditCatalogue: false,
    // Saisie du budget par licence : activite financiere, ouverte au Financier et au Manager DSI (pas IT Ops)
    canEditBudget: isManagerDsi || isFinancier,
    // Nouvelle page Budget v0.5 : tous les profils peuvent saisir/modifier, seuls Manager DSI et Financier peuvent supprimer
    canWriteBudget: true,
    canDeleteBudget: isManagerDsi || isFinancier,
  };
}
