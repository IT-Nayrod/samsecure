// Règles pures de l'édition des seuils de dashboard (chantier seuils, 10/2026).
//
// Convention partagée avec la migration 050 et src/components/Dashboard/seuils.js :
// un widget porte jusqu'à 4 lignes { echelle, valeur, direction }, échelle N
// étant la valeur d'entrée du niveau N (1 vert, 2 jaune, 3 orange, 4 rouge).
//   - direction 'haut' : une valeur croissante dégrade le niveau, les valeurs
//     doivent donc croître avec l'échelle (au sens large) ;
//   - direction 'bas'  : une valeur décroissante dégrade, les valeurs doivent
//     décroître avec l'échelle (au sens large) ;
//   - toute autre direction ('max' des seuils métier à échelle unique) : pas
//     de contrainte d'ordre, il n'y a qu'une ligne.
// La cohérence est vérifiée par l'API avant écriture (commentaire de la table
// seuil_dashboard : « Cohérence seuil N <= seuil N+1 vérifiée par l'API »).

// Plafond du DECIMAL(12,2) de seuil_dashboard.valeur.
const VALEUR_MAX = 9999999999.99;

// Valide la valeur seule. Retourne un message d'erreur rendu à l'écran,
// ou null quand la valeur est admissible.
export function validerValeurSeuil(valeur) {
  if (typeof valeur !== "number" || !Number.isFinite(valeur))
    return "La valeur du seuil doit être un nombre.";
  if (valeur < 0)
    return "La valeur du seuil ne peut pas être négative.";
  if (valeur > VALEUR_MAX)
    return "La valeur du seuil dépasse le maximum admis.";
  return null;
}

// Vérifie la cohérence d'une nouvelle valeur avec les autres échelles du
// widget. lignes : les lignes effectives du widget ({ echelle, valeur,
// direction }), y compris éventuellement l'échelle modifiée (sa valeur
// actuelle est remplacée par la candidate). Retourne un message d'erreur
// rendu, ou null.
export function verifierCoherenceSeuil(lignes, echelle, valeur) {
  const autres = (Array.isArray(lignes) ? lignes : []).filter((l) => l.echelle !== echelle);
  if (!autres.length) return null;

  const direction = (lignes.find((l) => l.direction) || {}).direction;
  if (direction !== "haut" && direction !== "bas") return null;

  const candidates = [...autres, { echelle, valeur }].sort((a, b) => a.echelle - b.echelle);
  for (let i = 1; i < candidates.length; i += 1) {
    const prec = candidates[i - 1];
    const cour = candidates[i];
    const incoherent = direction === "haut"
      ? cour.valeur < prec.valeur
      : cour.valeur > prec.valeur;
    if (incoherent) {
      const sens = direction === "haut" ? "croître" : "décroître";
      return `Seuil incohérent : les valeurs doivent ${sens} avec l'échelle `
        + `(échelle ${prec.echelle} : ${prec.valeur}, échelle ${cour.echelle} : ${cour.valeur}).`;
    }
  }
  return null;
}
