// Regle de succession entre licences et contrats (story #209, decision de la
// reunion client du 11/09/2026) : le contrat suit les licences.
//
// Un contrat renouvele ne renouvelle pas forcement toutes ses licences, mais
// une licence renouvelee impose que son contrat suive. Pour chaque licence qui
// a un successeur (ou qui est creee comme successeur, licence.id_licence_
// predecesseur, migration 056) : si le contrat de rattachement du successeur
// est le meme que celui du predecesseur, ET que ce contrat est echu ou arrive
// a echeance sans successeur (contrat.id_contrat_predecesseur jamais
// reference), alors une action est requise sur le contrat. Rien n'est modifie
// automatiquement : l'API signale (bandeau sur la fiche du contrat et de la
// licence, notification contrat_a_suivre), l'utilisateur agit.
//
// Module PUR : aucun acces a la base, aucune dependance au serveur. Il est
// teste par successionContrat.test.js (node --test) et consomme par
// licences.js, contrats.js et le planificateur des notifications, qui ne font
// que l'alimenter avec des faits lus en base.
//
// Le contrat se deduit de la commande (licence.id_commande -> commande.
// id_contrat, migration 014) : les appelants passent l'identifiant du contrat
// deja resolu, jamais la commande.

// Horizon de l'echeance, en jours : le meme que le statut a_renouveler des
// contrats (contrats.js, STATUT_ECHEANCE, 90 jours).
export const HORIZON_ECHEANCE_CONTRAT = 90;

// Dates au format AAAA-MM-JJ (projection ::text), lues en UTC : aucun
// decalage de fuseau ne peut faire glisser un jour.
function joursRestants(dateFin, aujourdhui) {
  const fin = Date.parse(String(dateFin).slice(0, 10));
  const jour = Date.parse(String(aujourdhui).slice(0, 10));
  if (!Number.isFinite(fin) || !Number.isFinite(jour)) return null;
  return Math.round((fin - jour) / 86400000);
}

// Un contrat est "sans suite" s'il est echu ou arrive a echeance (date de fin
// dans l'horizon, ou drapeau a_renouveler, meme vocabulaire que
// statut_echeance) et qu'aucun contrat ne le renouvele. Un contrat perpetuel
// (sans date de fin) ou archive n'appelle aucune action.
//   contrat : { date_fin, a_renouveler, nb_successeurs, archive }
export function contratSansSuite(contrat, { aujourdhui, horizonJours = HORIZON_ECHEANCE_CONTRAT } = {}) {
  if (!contrat || contrat.archive) return false;
  if (Number(contrat.nb_successeurs) > 0) return false;
  if (!contrat.date_fin) return false;
  if (contrat.a_renouveler) return true;
  const jours = joursRestants(contrat.date_fin, aujourdhui ?? new Date().toISOString().slice(0, 10));
  return jours !== null && jours <= horizonJours;
}

// Une licence est "renouvelee sur" son contrat si son predecesseur est
// rattache au meme contrat qu'elle (elle est le successeur), ou si l'un de ses
// successeurs est rattache au meme contrat qu'elle (elle est le
// predecesseur). Sans contrat, ou avec un predecesseur sur un autre contrat et
// aucun successeur sur le sien, la licence ne dit rien du contrat.
//   licence : { id_contrat, id_contrat_predecesseur, nb_successeurs_meme_contrat }
export function licenceRenouveleeSurContrat(licence) {
  if (!licence || !licence.id_contrat) return false;
  if (licence.id_contrat_predecesseur && licence.id_contrat_predecesseur === licence.id_contrat) return true;
  return Number(licence.nb_successeurs_meme_contrat) > 0;
}

// Regle complete, vue d'une licence : le contrat doit suivre si la licence a
// ete renouvelee sur lui et qu'il est sans suite.
export function contratDoitSuivre(licence, contrat, options) {
  return licenceRenouveleeSurContrat(licence) && contratSansSuite(contrat, options);
}

// Regle complete, vue d'un contrat : il doit suivre s'il est sans suite et
// qu'au moins une licence a ete renouvelee sur lui (successeur et
// predecesseur tous deux rattaches a ce contrat).
//   contrat : { date_fin, a_renouveler, nb_successeurs, archive, nb_licences_renouvelees }
export function contratASuivre(contrat, options) {
  if (!contrat || !(Number(contrat.nb_licences_renouvelees) > 0)) return false;
  return contratSansSuite(contrat, options);
}
