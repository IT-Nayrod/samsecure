// Indice de confiance des données (US #116, module 3), formule révisée le
// 10/09/2026 (#190).
//
// Fonction pure, sans accès base : qualite.js lit les faits (licences actives
// avec leurs liens et leur valeur, affectations avec leur fraîcheur, anomalies
// ouvertes du périmètre) et ce module ne fait que le calcul. Isolé pour être
// testable au node:test sans serveur ni base (indiceConfiance.test.js).
//
// Règles, note sur 100, pondération par la valeur (coût des licences actives)
// avec une part plancher pour les objets sans valorisation :
//   poids d'un objet = max(sa valeur, plancher), avec
//     plancher = max(1, PART_PLANCHER x valeur totale des licences actives).
//     Un objet non valorisé pèse donc toujours quelque chose, et un objet
//     valorisé jamais moins que le plancher : aucun périmètre ne peut
//     afficher 100 avec un défaut ouvert ;
//   exhaustivité (poids 40) : par licence active, 4 liens attendus (commande,
//     facture ou preuve, contrat, société signataire) ;
//     note = somme(poids x liens présents / 4) / somme(poids) x 100 ;
//   cohérence (poids 30) : objets du périmètre = licences actives + tout
//     autre objet porteur d'une anomalie ouverte (stock anomalie_qualite et
//     détection à la volée de /qualite), y compris sans licence reliée.
//     Une licence est en anomalie par elle-même ou par sa chaîne (commande,
//     contrat) ; un objet multi-anomalies compte une fois ;
//     note = somme(poids des objets sains) / somme(poids) x 100 ;
//   fraîcheur (poids 30) : somme(poids des affectations validées à
//     revalidation non dépassée) / somme(poids des affectations) x 100 ;
//   indice = 0,4 x exhaustivité + 0,3 x cohérence + 0,3 x fraîcheur.
//
// Une composante porteuse d'au moins un défaut est bornée à 99,9 après
// arrondi, l'indice de même dès qu'un défaut existe : l'arrondi au dixième ne
// doit jamais rendre un 100 trompeur sur un très grand parc. Un périmètre
// vide rend 100 : il n'y a rien à peser.

const arrondi1 = (v) => Math.round(v * 10) / 10;

// Part plancher : 1 pour cent de la valeur totale des licences actives du
// périmètre, jamais moins d'une unité (périmètre non valorisé).
export const PART_PLANCHER = 0.01;

// Les 4 liens d'exhaustivité d'une licence active. Libellés destinés à
// l'affichage des malus.
export const LIENS_EXHAUSTIVITE = [
  { cle: "a_commande", libelle: "Licences sans commande rattachée" },
  { cle: "a_justificatif", libelle: "Licences sans facture ni preuve" },
  { cle: "a_contrat", libelle: "Licences sans contrat" },
  { cle: "a_societe_signataire", libelle: "Licences sans société signataire" },
];

const LIBELLES_OBJETS = {
  contrat: "Contrats porteurs d'une anomalie ouverte",
  commande: "Commandes porteuses d'une anomalie ouverte",
  facture: "Factures porteuses d'une anomalie ouverte",
  preuve: "Preuves porteuses d'une anomalie ouverte",
  affectation: "Affectations porteuses d'une anomalie ouverte",
  produit: "Produits en usage sans droit",
  produit_client: "Logiciels porteurs d'une anomalie ouverte",
  log_import: "Imports d'inventaire porteurs d'une anomalie ouverte",
};

const somme = (liste, poidsDe) => liste.reduce((s, o) => s + poidsDe(o), 0);

// Note d'une composante : 100 sans rien à peser, sinon la part acquise,
// bornée à 99,9 quand au moins un défaut existe.
function noter(acquis, total, defaut) {
  const brute = total > 0 ? (acquis / total) * 100 : 100;
  const note = arrondi1(brute);
  return defaut ? Math.min(note, 99.9) : note;
}

// licences : [{ id, valeur, id_commande, id_contrat, a_commande,
//               a_justificatif, a_contrat, a_societe_signataire, a_anomalie }]
//            (licences actives ; a_anomalie est un drapeau optionnel, en plus
//            des anomalies transmises).
// affectations : [{ id, valeur, fraiche }] (affectations validées, échéance
//                opposable).
// anomalies : [{ entite_type, entite_id, valeur? }] anomalies ouvertes du
//             périmètre, tous producteurs confondus (doublons admis).
// Renvoie { indice, exhaustivite, coherence, fraicheur, valeur_totale,
//           plancher, nb_objets_anomalie,
//           malus: [{ composante, libelle, points, entite_type, entite_ids }] }.
export function calculerIndiceConfiance({ licences = [], affectations = [], anomalies = [] }) {
  const valeurDe = (o) => (Number(o?.valeur) > 0 ? Number(o.valeur) : 0);
  const valeurLicences = licences.reduce((s, l) => s + valeurDe(l), 0);
  const plancher = Math.max(1, PART_PLANCHER * valeurLicences);
  const poidsDe = (o) => Math.max(valeurDe(o), plancher);
  const malus = [];

  // Exhaustivité : chaque lien manquant coûte (poids / 4) sur la note.
  const totalLicences = somme(licences, poidsDe);
  const presents = (l) => LIENS_EXHAUSTIVITE.filter(({ cle }) => l[cle]).length;
  const acquis = licences.reduce((s, l) => s + poidsDe(l) * (presents(l) / 4), 0);
  let defautExhaustivite = false;
  for (const { cle, libelle } of LIENS_EXHAUSTIVITE) {
    const manquantes = licences.filter((l) => !l[cle]);
    if (!manquantes.length) continue;
    defautExhaustivite = true;
    malus.push({
      composante: "exhaustivite",
      libelle,
      points: arrondi1(0.4 * ((somme(manquantes, poidsDe) / 4) / totalLicences) * 100),
      entite_type: "licence",
      entite_ids: manquantes.map((l) => l.id),
    });
  }
  const exhaustivite = noter(acquis, totalLicences, defautExhaustivite);

  // Cohérence : une anomalie portée par une licence du périmètre, ou par sa
  // commande ou son contrat, marque cette licence ; toute autre anomalie
  // désigne un objet propre, pesé une seule fois quel que soit le nombre
  // d'anomalies qui le visent.
  const parLicence = new Map();
  const parCommande = new Map();
  const parContrat = new Map();
  const licencesAnormales = new Set();
  for (const l of licences) {
    parLicence.set(String(l.id), l);
    if (l.id_commande) {
      if (!parCommande.has(String(l.id_commande))) parCommande.set(String(l.id_commande), []);
      parCommande.get(String(l.id_commande)).push(l);
    }
    if (l.id_contrat) {
      if (!parContrat.has(String(l.id_contrat))) parContrat.set(String(l.id_contrat), []);
      parContrat.get(String(l.id_contrat)).push(l);
    }
    if (l.a_anomalie) licencesAnormales.add(String(l.id));
  }
  const autres = new Map();
  for (const a of anomalies) {
    if (!a || !a.entite_type || a.entite_id == null) continue;
    const id = String(a.entite_id);
    let portees = null;
    if (a.entite_type === "licence" && parLicence.has(id)) portees = [parLicence.get(id)];
    else if (a.entite_type === "commande" && parCommande.has(id)) portees = parCommande.get(id);
    else if (a.entite_type === "contrat" && parContrat.has(id)) portees = parContrat.get(id);
    if (portees) {
      for (const l of portees) licencesAnormales.add(String(l.id));
      continue;
    }
    const cle = `${a.entite_type}|${id}`;
    if (!autres.has(cle)) {
      autres.set(cle, { entite_type: a.entite_type, entite_id: a.entite_id, valeur: valeurDe(a) });
    }
  }
  const objetsAutres = [...autres.values()];
  const enAnomalie = licences.filter((l) => licencesAnormales.has(String(l.id)));
  const totalCoherence = totalLicences + somme(objetsAutres, poidsDe);
  const poidsAnormal = somme(enAnomalie, poidsDe) + somme(objetsAutres, poidsDe);
  const defautCoherence = enAnomalie.length > 0 || objetsAutres.length > 0;
  const coherence = noter(totalCoherence - poidsAnormal, totalCoherence, defautCoherence);
  if (enAnomalie.length) {
    malus.push({
      composante: "coherence",
      libelle: "Licences porteuses d'une anomalie ouverte",
      points: arrondi1(0.3 * (somme(enAnomalie, poidsDe) / totalCoherence) * 100),
      entite_type: "licence",
      entite_ids: enAnomalie.map((l) => l.id),
    });
  }
  const parType = new Map();
  for (const o of objetsAutres) {
    if (!parType.has(o.entite_type)) parType.set(o.entite_type, []);
    parType.get(o.entite_type).push(o);
  }
  for (const [type, objets] of parType) {
    malus.push({
      composante: "coherence",
      libelle: LIBELLES_OBJETS[type] ?? `Objets ${type} porteurs d'une anomalie ouverte`,
      points: arrondi1(0.3 * (somme(objets, poidsDe) / totalCoherence) * 100),
      entite_type: type,
      entite_ids: objets.map((o) => o.entite_id),
    });
  }

  // Fraîcheur : une affectation à revalidation dépassée ne compte plus.
  const totalAffectations = somme(affectations, poidsDe);
  const depassees = affectations.filter((a) => !a.fraiche);
  const fraicheur = noter(
    somme(affectations.filter((a) => a.fraiche), poidsDe), totalAffectations, depassees.length > 0);
  if (depassees.length) {
    malus.push({
      composante: "fraicheur",
      libelle: "Affectations à revalidation dépassée",
      points: arrondi1(0.3 * (somme(depassees, poidsDe) / totalAffectations) * 100),
      entite_type: "affectation",
      entite_ids: depassees.map((a) => a.id),
    });
  }

  const defaut = defautExhaustivite || defautCoherence || depassees.length > 0;
  const indice = arrondi1(0.4 * exhaustivite + 0.3 * coherence + 0.3 * fraicheur);
  return {
    indice: defaut ? Math.min(indice, 99.9) : indice,
    exhaustivite,
    coherence,
    fraicheur,
    valeur_totale: Math.round(valeurLicences * 100) / 100,
    plancher: Math.round(plancher * 100) / 100,
    nb_objets_anomalie: enAnomalie.length + objetsAutres.length,
    malus,
  };
}
