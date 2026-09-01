// Resolution des seuils de colorimetrie servis par l'API (#191).
//
// Convention partagee avec la migration 050 et le routeur dashboards :
// un widget porte jusqu'a 4 lignes { echelle, valeur, unite, direction },
// echelle N etant la valeur d'entree du niveau N (1 vert, 2 jaune, 3 orange,
// 4 rouge).
//   - direction 'haut' : une valeur croissante degrade le niveau. Le niveau
//     est la plus haute echelle dont la valeur est inferieure ou egale a la
//     valeur mesuree (defaut : 1).
//   - direction 'bas' : une valeur decroissante degrade. Le niveau est la
//     premiere echelle dont la valeur est inferieure ou egale a la valeur
//     mesuree, la quatrieme sinon.
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

// Valeur d'entree d'une echelle donnee, pour construire legendes et libelles
// a partir de la configuration reelle et non de constantes locales.
export function borneSeuil(seuilsWidget, echelle, defaut = null) {
  const s = Array.isArray(seuilsWidget)
    ? seuilsWidget.find((x) => x.echelle === echelle) : null;
  return s ? s.valeur : defaut;
}
