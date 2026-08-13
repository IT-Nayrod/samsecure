// Traduction des entrees d'audit_log en evenements lisibles.
//
// Vit a part de la route : les libelles sont un contrat avec le front et avec
// Samuel, ils doivent se relire d'un bloc sans traverser du SQL. Aucune
// dependance a la base, la fonction est pure et testable telle quelle.
//
// Gabarit acte le 13/08 : l'acteur ferme systematiquement la ligne, apres les
// details eventuels. "par l'utilisateur" quand l'acteur est le titulaire du
// compte lui-meme.
import { filtrerSensibles } from "./audit.js";

// Noms metier des colonnes, pour que le libelle d'une modification nomme des
// champs comprehensibles et non des identifiants techniques.
const NOMS_CHAMPS = {
  nom: "nom",
  prenom: "prénom",
  email: "email",
  langue: "langue",
  actif: "statut",
  date_finale: "date de désactivation",
  date_mise_en_fonction: "date de mise en fonction",
};

// Les dates sont stockees en text ISO (yyyy-mm-jj) depuis le correctif du
// RETURNING. Le repli sur la chaine brute couvre les entrees anterieures, qui
// portent une date au format long : mieux vaut afficher "Fri Aug 14" que rien.
function formatDateFr(valeur) {
  if (!valeur) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valeur));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(valeur);
}

function formatHorodatage(d) {
  const date = new Date(d);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()} ` +
         `${p(date.getHours())}:${p(date.getMinutes())}`;
}

// L'adresse IP arrive souvent en IPv4 mappee IPv6 (::ffff:127.0.0.1) : la
// forme longue n'apporte rien a un lecteur humain.
function formatIp(ip) {
  if (!ip) return null;
  return String(ip).replace(/^::ffff:/, "");
}

export function traduireEvenement(ligne, idCompteCible) {
  const av = filtrerSensibles(ligne.valeur_avant) || {};
  const ap = filtrerSensibles(ligne.valeur_apres) || {};
  // Acteur : le titulaire agissant sur son propre compte devient
  // "l'utilisateur". Un acteur inconnu, cas de la creation reconstituee depuis
  // created_at, ne produit aucune mention plutot qu'un "par null".
  let acteur = null;
  if (ligne.id_acteur && ligne.id_acteur === idCompteCible) acteur = "l'utilisateur";
  else if (ligne.acteur_prenom || ligne.acteur_nom) {
    acteur = `${ligne.acteur_prenom || ""} ${ligne.acteur_nom || ""}`.trim();
  }
  const parActeur = acteur ? ` par ${acteur}` : "";

  const champs = Object.keys(ap).length ? Object.keys(ap) : Object.keys(av);
  const champsLisibles = champs.map((c) => NOMS_CHAMPS[c] || c).join(", ");
  const ip = formatIp(ligne.ip_address);

  let libelle;
  let details = null;

  switch (ligne.action) {
    case "UTILISATEUR_CREE":
      libelle = `Compte créé${parActeur}`;
      break;

    case "MOT_DE_PASSE_DEFINI_PAR_ADMIN":
      // Jamais de valeur ni de hash : l'action porte toute l'information.
      libelle = `Mot de passe défini${parActeur}`;
      break;

    case "UTILISATEUR_MODIFIE":
      libelle = `Compte modifié : ${champsLisibles}${parActeur}`;
      details = { champs_modifies: champs.map((c) => NOMS_CHAMPS[c] || c) };
      break;

    case "UTILISATEUR_ACTIVE":
      libelle = `Compte activé${parActeur}`;
      break;

    case "UTILISATEUR_DESACTIVE":
      libelle = `Compte désactivé${parActeur}`;
      break;

    case "DESACTIVATION_PLANIFIEE":
      libelle = `Désactivation programmée au ${formatDateFr(ap.date_finale)}${parActeur}`;
      details = { date_cible: ap.date_finale ?? null };
      break;

    case "PLANIFICATION_LEVEE":
      libelle = `Programmation de désactivation annulée${parActeur}`;
      details = { date_annulee: av.date_finale ?? null };
      break;

      case "MISE_EN_FONCTION_PLANIFIEE":
      libelle = `Mise en fonction programmée au ${formatDateFr(ap.date_mise_en_fonction)}${parActeur}`;
      details = { date_cible: ap.date_mise_en_fonction ?? null };
      break;

    case "GROUPE_ATTRIBUE":
      libelle = `Groupe "${ap.profil || "inconnu"}" attribué sur ${ap.societe || "tenant"}${parActeur}`;
      details = { groupe: ap.profil ?? null, portee: ap.societe ?? "tenant" };
      break;

    case "GROUPE_RETIRE":
      libelle = `Groupe "${av.profil || "inconnu"}" retiré sur ${av.societe || "tenant"}${parActeur}`;
      details = { groupe: av.profil ?? null, portee: av.societe ?? "tenant" };
      break;

    case "CONNEXION":
      libelle = ip ? `Connexion depuis ${ip}${parActeur}` : `Connexion${parActeur}`;
      details = ip ? { ip } : null;
      break;

    default:
      // Une action inconnue reste lisible plutot que d'etre masquee : une
      // trace probante ne doit jamais disparaitre d'un historique parce que
      // le traducteur n'a pas ete mis a jour.
      libelle = `${ligne.action}${parActeur}`;
  }

  return {
    id: ligne.id,
    horodatage: formatHorodatage(ligne.created_at),
    created_at: ligne.created_at,
    action: ligne.action,
    libelle,
    acteur,
    details,
  };
}