// V2 - Seuils paramétrables centralisés — lus par tous les widgets
// Modifier ces valeurs pour ajuster le comportement de colorimétrie

export const THRESHOLDS = {
  // Écart entre droits détenus et usage réel (en %)
  ecart_usage_droits: {
    positif: [10, 20, 30],   // % d'excès de droits  → jaune, orange, rouge
    negatif: [10, 20, 30],   // % de manque de droits → jaune, orange, rouge + dark_red si > 30%
  },

  // Délai avant échéance des contrats (en mois)
  echeances_contrats: {
    mois: [3, 2, 1, 0],      // vert > 3m | jaune 2-3m | orange 1-2m | rouge échu
  },

  // Délai avant échéance des commandes (en mois)
  echeances_commandes: {
    mois: [3, 2, 1, 0],
  },

  // Valorisation des licences non utilisées (en % du total)
  valorisation_licences: {
    pct: [5, 10, 15, 20],    // vert < 5% | jaune 5-10% | orange 10-15% | rouge > 15%
  },

  // Conformité réel vs prévisionnel (en %)
  conformite_reel_previsionnel: {
    pct: [95, 90, 80],       // vert ≥ 95% | jaune 90-95% | orange 80-90% | rouge < 80%
  },

  // Coût des licences manquantes (en % du coût annuel du parc détenu)
  cout_licences_manquantes: {
    pct: [5, 10, 15, 20],    // vert < 5% | jaune 5-10% | orange 10-15% | rouge > 15%
  },
};
