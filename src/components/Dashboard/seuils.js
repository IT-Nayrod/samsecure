// Résolution des seuils de colorimétrie servis par l'API (#191).
//
// Convention partagée avec la migration 050 et le routeur dashboards :
// un widget porte jusqu'à 4 lignes { echelle, valeur, unite, direction },
// échelle N étant la valeur d'entrée du niveau N (1 vert, 2 jaune, 3 orange,
// 4 rouge).
//   - direction 'haut' : une valeur croissante dégrade le niveau. Le niveau
//     est la plus haute échelle dont la valeur est inférieure ou égale à la
//     valeur mesurée (défaut : 1).
//   - direction 'bas' : une valeur décroissante dégrade. Le niveau est la
//     première échelle dont la valeur est inférieure ou égale à la valeur
//     mesurée, la quatrième sinon.
// Sans seuils connus pour le widget, le niveau vaut 1 : ne jamais alarmer
// sur une configuration absente.
import { COULEUR_NIVEAU } from './couleurs';

export function niveauSeuil(valeur, seuilsWidget) {
  if (!Array.isArray(seuilsWidget) || !seuilsWidget.length || valeur == null
      || Number.isNaN(valeur)) return 1;
  const tries = [...seuilsWidget].sort((a, b) => a.echelle - b.echelle);
  const direction = tries[0].direction === 'bas' ? 'bas' : 'haut';

  if (direction === 'haut') {
    let niveau = 1;
    for (const s of tries) if (valeur >= s.valeur) niveau = s.echelle;
    return niveau;
  }
  for (const s of tries) if (valeur >= s.valeur) return s.echelle;
  return 4;
}

export function couleurSeuil(valeur, seuilsWidget) {
  return COULEUR_NIVEAU[niveauSeuil(valeur, seuilsWidget)];
}

// Valeur d'entrée d'une échelle donnée, pour construire légendes et libellés
// à partir de la configuration réelle et non de constantes locales.
export function borneSeuil(seuilsWidget, echelle, defaut = null) {
  const s = Array.isArray(seuilsWidget)
    ? seuilsWidget.find((x) => x.echelle === echelle) : null;
  return s ? s.valeur : defaut;
}
