// Indice de confiance des données (US #116, module 3).
//
// Fonction pure, sans accès base : qualite.js lit les faits (licences actives
// avec leurs liens et leur valeur, affectations avec leur fraîcheur) et ce
// module ne fait que le calcul. Isolé pour être testable au node:test sans
// serveur ni base (indiceConfiance.test.js).
//
// Règles #116, note sur 100, pondération par la valeur (coût des licences
// actives) :
//   exhaustivité (poids 40) : par licence active, 4 liens attendus (commande,
//     facture ou preuve, contrat, société signataire) ;
//     note = somme(valeur x liens présents / 4) / valeur totale x 100 ;
//   cohérence (poids 30) : valeur des objets sans anomalie ouverte / valeur
//     totale x 100 ; un objet multi-anomalies compte une fois ;
//   fraîcheur (poids 30) : valeur des affectations à revalidation non
//     dépassée / valeur totale des affectations x 100 ;
//   indice = 0,4 x exhaustivité + 0,3 x cohérence + 0,3 x fraîcheur.
//
// Un périmètre sans valeur pondérable (aucun coût saisi) rend des notes à
// 100 : il n'y a rien à peser, et un zéro accuserait un parc simplement non
// valorisé. Les objets concernés restent listés dans les malus, à zéro point.

const arrondi1 = (v) => Math.round(v * 10) / 10;

// Les 4 liens d'exhaustivité d'une licence active. Libellés destinés à
// l'affichage des malus.
export const LIENS_EXHAUSTIVITE = [
  { cle: "a_commande", libelle: "Licences sans commande rattachée" },
  { cle: "a_justificatif", libelle: "Licences sans facture ni preuve" },
  { cle: "a_contrat", libelle: "Licences sans contrat" },
  { cle: "a_societe_signataire", libelle: "Licences sans société signataire" },
];

// licences : [{ id, valeur, a_commande, a_justificatif, a_contrat,
//               a_societe_signataire, a_anomalie }] (licences actives).
// affectations : [{ id, valeur, fraiche }] (affectations validées, échéance
//                opposable).
// Renvoie { indice, exhaustivite, coherence, fraicheur, valeur_totale,
//           malus: [{ composante, libelle, points, entite_type, entite_ids }] }.
export function calculerIndiceConfiance({ licences = [], affectations = [] }) {
  const valeurLicences = licences.reduce((s, l) => s + (l.valeur || 0), 0);
  const valeurAffectations = affectations.reduce((s, a) => s + (a.valeur || 0), 0);
  const malus = [];

  // Exhaustivité : chaque lien manquant coûte (valeur / 4) sur la note.
  let exhaustivite = 100;
  if (valeurLicences > 0) {
    const acquis = licences.reduce((s, l) => {
      const presents = LIENS_EXHAUSTIVITE.filter(({ cle }) => l[cle]).length;
      return s + (l.valeur || 0) * (presents / 4);
    }, 0);
    exhaustivite = (acquis / valeurLicences) * 100;
  }
  for (const { cle, libelle } of LIENS_EXHAUSTIVITE) {
    const manquantes = licences.filter((l) => !l[cle]);
    if (!manquantes.length) continue;
    const valeur = manquantes.reduce((s, l) => s + (l.valeur || 0), 0);
    malus.push({
      composante: "exhaustivite",
      libelle,
      points: valeurLicences > 0
        ? arrondi1(0.4 * ((valeur / 4) / valeurLicences) * 100) : 0,
      entite_type: "licence",
      entite_ids: manquantes.map((l) => l.id),
    });
  }

  // Cohérence : un objet porteur d'anomalies ouvertes sort en entier de la
  // valeur saine, quel que soit leur nombre.
  let coherence = 100;
  const enAnomalie = licences.filter((l) => l.a_anomalie);
  if (valeurLicences > 0) {
    const valeurAnomalie = enAnomalie.reduce((s, l) => s + (l.valeur || 0), 0);
    coherence = ((valeurLicences - valeurAnomalie) / valeurLicences) * 100;
  }
  if (enAnomalie.length) {
    malus.push({
      composante: "coherence",
      libelle: "Licences porteuses d'une anomalie ouverte",
      points: arrondi1(0.3 * (100 - coherence)),
      entite_type: "licence",
      entite_ids: enAnomalie.map((l) => l.id),
    });
  }

  // Fraîcheur : une affectation à revalidation dépassée ne compte plus.
  let fraicheur = 100;
  const depassees = affectations.filter((a) => !a.fraiche);
  if (valeurAffectations > 0) {
    const valeurFraiche = affectations
      .filter((a) => a.fraiche)
      .reduce((s, a) => s + (a.valeur || 0), 0);
    fraicheur = (valeurFraiche / valeurAffectations) * 100;
  }
  if (depassees.length) {
    malus.push({
      composante: "fraicheur",
      libelle: "Affectations à revalidation dépassée",
      points: arrondi1(0.3 * (100 - fraicheur)),
      entite_type: "affectation",
      entite_ids: depassees.map((a) => a.id),
    });
  }

  return {
    indice: arrondi1(0.4 * exhaustivite + 0.3 * coherence + 0.3 * fraicheur),
    exhaustivite: arrondi1(exhaustivite),
    coherence: arrondi1(coherence),
    fraicheur: arrondi1(fraicheur),
    valeur_totale: Math.round(valeurLicences * 100) / 100,
    malus,
  };
}
