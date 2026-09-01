// Couleurs de la colorimetrie des dashboards (4 niveaux + cas particuliers).
// Anciennement portees par le fichier de donnees de demonstration des
// dashboards, retire au branchement sur l'API (#192). ConformiteGaugeBar
// (module 3) les consomme aussi : c'est la palette commune des etats de
// conformite.
export const THRESHOLD_GREEN    = '#22C55E';  // niveau 1 - conforme
export const THRESHOLD_YELLOW   = '#EAB308';  // niveau 2 - attention
export const THRESHOLD_ORANGE   = '#F59E0B';  // niveau 3 - problematique
export const THRESHOLD_RED      = '#EF4444';  // niveau 4 - critique
export const THRESHOLD_DARK_RED = '#991B1B';  // depassement (usage > droits)
export const THRESHOLD_BLUE     = '#3B82F6';  // information / sous-utilise

// Niveau de seuil (1 a 4) vers couleur.
export const COULEUR_NIVEAU = {
  1: THRESHOLD_GREEN,
  2: THRESHOLD_YELLOW,
  3: THRESHOLD_ORANGE,
  4: THRESHOLD_RED,
};

// Palette stable pour les series par editeur ou par produit : l'API ne porte
// pas de couleur, l'attribution se fait par ordre d'affichage.
export const PALETTE_SERIES = [
  '#7C6FCD', '#3FC8B8', '#52C97A', '#E07B39', '#1A8CFF',
  '#C74634', '#0070F2', '#1F70C1', '#00A4EF', '#F4C842',
];

export function couleurSerie(index) {
  return PALETTE_SERIES[index % PALETTE_SERIES.length];
}
