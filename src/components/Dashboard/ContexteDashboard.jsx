// Contexte des dashboards (#192) : configuration servie par l'API
// (GET /dashboards/configuration) et etat du mode personnalisation.
// Les widgets y lisent leurs seuils ; la grille y lit la composition par
// profil et les preferences individuelles (masquage, ordre).
import { createContext, useContext } from 'react';

export const ContexteDashboard = createContext({
  // Configuration API
  seuils: {},            // { widget_code: [{ echelle, valeur, unite, direction }] }
  widgetsParProfil: {},  // { manager_dsi: [{ widget_code, visible_defaut, acces_autorise }], ... }
  preferences: [],       // [{ widget_code, visible, position }]
  // Personnalisation
  personnalisation: false,
  basculerVisibilite: () => {},
  deplacerWidget: () => {},
});

export function useContexteDashboard() {
  return useContext(ContexteDashboard);
}

// Seuils d'un widget donne, tableau vide si aucun n'est configure.
export function useSeuils(widgetCode) {
  const { seuils } = useContexteDashboard();
  return seuils[widgetCode] ?? [];
}
