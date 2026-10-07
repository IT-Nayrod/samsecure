// Règle de suppression d'une société (#281, issue 60 — règle du ticket #62) :
// les utilisateurs et les sociétés ne se suppriment pas, ils se désactivent
// avec une date ; la suppression n'est possible que si aucun objet ne se
// raccroche à la société, et même alors l'objet reste conservé en base à des
// fins d'audit (suppression douce).
//
// Module pur, sans accès base : la route DELETE /societes/:id et la projection
// de GET /societes fournissent les compteurs, la règle rend les libellés. Les
// clés suivent les alias SQL (nb_*) ; l'ordre et les termes sont ceux du
// ticket. Testé par societeSuppression.test.js.

const RATTACHEMENTS = [
  ["nb_utilisateurs", (n) => `${n} utilisateur${n > 1 ? "s" : ""} rattaché${n > 1 ? "s" : ""}`],
  ["nb_filiales", (n) => `${n} filiale${n > 1 ? "s" : ""}`],
  ["nb_contrats", (n) => `${n} contrat${n > 1 ? "s" : ""}`],
  ["nb_commandes", (n) => `${n} commande${n > 1 ? "s" : ""}`],
  ["nb_licences", (n) => `${n} licence${n > 1 ? "s" : ""}`],
  ["nb_affectations", (n) => `${n} affectation${n > 1 ? "s" : ""}`],
  ["nb_lignes_budget", (n) => `${n} ligne${n > 1 ? "s" : ""} de budget`],
];

// compteurs : objet portant les clés nb_* (entiers, ou chaînes rendues par
// pg sur les agrégats). Rend la liste des blocages libellés, vide si la
// société est supprimable. Un compteur absent vaut zéro : la règle ne bloque
// que sur un rattachement constaté.
export function blocagesSuppression(compteurs) {
  const blocages = [];
  for (const [cle, libelle] of RATTACHEMENTS) {
    const n = Number(compteurs?.[cle]) || 0;
    if (n > 0) blocages.push(libelle(n));
  }
  return blocages;
}

// Message rendu du refus (code 2090), au gabarit « Suppression impossible :
// ... ». Énumération française : virgules, puis « et » avant le dernier terme.
export function messageSuppressionImpossible(raisonSociale, blocages) {
  const liste = blocages.length > 1
    ? `${blocages.slice(0, -1).join(", ")} et ${blocages[blocages.length - 1]}`
    : blocages[0];
  return `Suppression impossible : la société "${raisonSociale}" porte encore ${liste}. La désactivation reste possible.`;
}
