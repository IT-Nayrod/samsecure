// État de maintenance d'une licence, dérivé de ses périodes (#201, retour
// client du 16/09/2026) : « sous maintenance » n'est jamais un attribut direct
// de la licence. Les colonnes licence.a_maintenance, date_fin_maintenance et
// id_mainteneur (002) restent en base mais ne sont plus ni écrites ni lues ;
// tout ce que l'écran affiche sur la maintenance se calcule ici, depuis
// maintenance_historique, comme la version suit déjà la période la plus
// récente (D59). Seul l'arrêt de maintenance (date_arret_maintenance, version
// figée) reste un événement porté par la licence : il prime sur les périodes.
//
// Règle pure, sans base ni date implicite : les périodes sont lues par le
// routeur (une requête pour toutes les licences), aujourd'hui est passé en
// option pour les tests. Test : node --test server/utils/maintenanceLicence.test.js
// (hors du npm test racine, comme conformite.test.js).

// Statuts servis sous statut_maintenance, même vocabulaire que le badge et les
// filtres du front ; a_venir s'ajoute aux quatre valeurs antérieures : une
// licence dont la seule période commence plus tard n'est ni active ni sans
// maintenance.
export const STATUTS_MAINTENANCE = ["arretee", "active", "a_venir", "echue", "aucune"];

const jourIso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

// Ordre chronologique des périodes : début, puis ordre de création.
function trier(periodes) {
  return [...periodes].sort((a, b) =>
    String(a.date_debut).localeCompare(String(b.date_debut))
    || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
}

// Période couvrant le jour donné : début atteint, fin nulle ou non dépassée.
export function periodeCouvre(periode, jour) {
  if (!periode?.date_debut) return false;
  const debut = jourIso(periode.date_debut);
  const fin = periode.date_fin ? jourIso(periode.date_fin) : null;
  return debut <= jour && (fin === null || fin >= jour);
}

// Période de référence d'une licence : la période en cours (la plus récente
// si plusieurs se chevauchent), sinon la prochaine à venir, sinon la dernière
// échue (fin la plus tardive). null sans période.
export function periodeReference(periodes = [], { aujourdhui = new Date() } = {}) {
  const jour = jourIso(aujourdhui);
  const triees = trier(periodes);
  const courantes = triees.filter((p) => periodeCouvre(p, jour));
  if (courantes.length) return { statut: "active", periode: courantes[courantes.length - 1] };
  const aVenir = triees.filter((p) => jourIso(p.date_debut) > jour);
  if (aVenir.length) return { statut: "a_venir", periode: aVenir[0] };
  if (triees.length) {
    const echues = [...triees].sort((a, b) => String(jourIso(a.date_fin ?? a.date_debut)).localeCompare(jourIso(b.date_fin ?? b.date_debut)));
    return { statut: "echue", periode: echues[echues.length - 1] };
  }
  return { statut: "aucune", periode: null };
}

// Champs de maintenance servis avec la licence, tous dérivés :
//   statut_maintenance      arretee | active | a_venir | echue | aucune
//   id_maintenance_reference période dont sont lus mainteneur et dates
//   id_mainteneur, mainteneur_label   mainteneur de la période de référence
//   date_debut_maintenance, date_fin_maintenance   bornes de cette période ;
//                           pour une maintenance arrêtée, la fin est la date
//                           d'arrêt (les périodes ont été closes à cette date)
//   nb_periodes_maintenance
// Une licence arrêtée garde comme référence sa période la plus récente, pour
// que le mainteneur reste lisible sur la fiche.
export function etatMaintenance(licence, periodes = [], options = {}) {
  const arretee = !!licence?.date_arret_maintenance;
  const ref = periodeReference(periodes, options);
  let periode = ref.periode;
  if (arretee && periodes.length) {
    const triees = trier(periodes);
    periode = triees[triees.length - 1];
  }
  const dateArret = arretee ? jourIso(licence.date_arret_maintenance) : null;
  return {
    statut_maintenance: arretee ? "arretee" : ref.statut,
    id_maintenance_reference: periode?.id ?? null,
    id_mainteneur: periode?.id_mainteneur ?? null,
    mainteneur_label: periode?.mainteneur_label ?? null,
    date_debut_maintenance: periode?.date_debut ? jourIso(periode.date_debut) : null,
    date_fin_maintenance: arretee
      ? dateArret
      : (periode?.date_fin ? jourIso(periode.date_fin) : null),
    nb_periodes_maintenance: periodes.length,
  };
}

// Échéance prolongeable par la maintenance (POST /licences/:id/prolonger,
// mode « maintenance ») : la fin de la période de référence d'une licence non
// arrêtée, quand cette période porte une fin. Une licence arrêtée, sans
// période ou dont la période est ouverte n'a rien à prolonger par là.
export function echeanceMaintenance(licence, periodes = [], options = {}) {
  if (licence?.date_arret_maintenance) return null;
  const { periode } = periodeReference(periodes, options);
  if (!periode?.date_fin) return null;
  return { id_maintenance: periode.id, date: jourIso(periode.date_fin) };
}
