// Traduction des entrées d'audit_log en événements lisibles.
//
// Vit à part de la route : les libellés sont un contrat avec le front et avec
// Samuel, ils doivent se relire d'un bloc sans traverser du SQL. Aucune
// dépendance à la base, la fonction est pure et testable telle quelle.
//
// Gabarit acté le 13/08 : l'acteur ferme systématiquement la ligne, après les
// détails éventuels. "par l'utilisateur" quand l'acteur est le titulaire du
// compte lui-même.
import { filtrerSensibles } from "./audit.js";

// Noms métier des colonnes, pour que le libellé d'une modification nomme des
// champs compréhensibles et non des identifiants techniques.
const NOMS_CHAMPS = {
  nom: "nom",
  prenom: "prénom",
  email: "email",
  langue: "langue",
  description: "description",
  actif: "statut",
  date_finale: "date de désactivation",
  date_mise_en_fonction: "date de mise en fonction",
  raison_sociale: "raison sociale",
  siret: "SIRET",
  iban: "IBAN",
  telephone: "téléphone",
  id_fonction: "fonction",
  id_societe: "société de rattachement",
  societes: "sociétés du groupe",
  id_editeur: "éditeur de rattachement",
  id_revendeur: "revendeur de rattachement",
  date_debut: "date de début",
  date_fin: "date de fin",
};

// Les dates sont stockées en text ISO (yyyy-mm-jj) depuis le correctif du
// RETURNING. Le repli sur la chaîne brute couvre les entrées antérieures, qui
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

// L'adresse IP arrive souvent en IPv4 mappée IPv6 (::ffff:127.0.0.1) : la
// forme longue n'apporte rien a un lecteur humain.
function formatIp(ip) {
  if (!ip) return null;
  return String(ip).replace(/^::ffff:/, "");
}

export function traduireEvenement(ligne, idCompteCible) {
  const av = filtrerSensibles(ligne.valeur_avant) || {};
  const ap = filtrerSensibles(ligne.valeur_apres) || {};
  // Acteur : le titulaire agissant sur son propre compte devient
  // "l'utilisateur". Un acteur inconnu, cas de la création reconstituée depuis
  // created_at, ne produit aucune mention plutôt qu'un "par null".
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

    case "MOT_DE_PASSE_GENERE_PAR_ADMIN":
      libelle = `Mot de passe généré${parActeur}`;
      break;
    
    case "REINITIALISATION_DEMANDEE":
      // mail_envoye absent sur les traces antérieures au socle mail (#87) :
      // le libellé historique reste "envoyé", seul un échec explicite le change.
      libelle = ap.mail_envoye === false
        ? `Lien de réinitialisation émis, mail non envoyé${parActeur}`
        : `Lien de réinitialisation envoyé${parActeur}`;
      details = { expiration_heures: ap.expiration_heures ?? null };
      break;

    case "MOT_DE_PASSE_REINITIALISE":
      libelle = `Mot de passe réinitialisé${parActeur}`;
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
    case "PROFIL_ATTRIBUE":
      // GROUPE_ATTRIBUE : traces historiques (vocabulaire abandonné le
      // 06/10/2026, tout est profil #276) ; le libellé rendu dit "profil",
      // l'action en base reste intacte. Les traces antérieures au #249
      // portent une portée (societe) : elle reste affichée. Les nouvelles
      // n'en ont plus (#57), le profil suit le rattachement.
      libelle = `Profil "${ap.profil || "inconnu"}" attribué${ap.societe ? ` sur ${ap.societe}` : ""}${parActeur}`;
      details = { profil: ap.profil ?? null, ...(ap.societe ? { portee: ap.societe } : {}) };
      break;

    case "GROUPE_RETIRE":
    case "PROFIL_RETIRE":
      libelle = `Profil "${av.profil || "inconnu"}" retiré${av.societe ? ` sur ${av.societe}` : ""}${parActeur}`;
      details = { profil: av.profil ?? null, ...(av.societe ? { portee: av.societe } : {}) };
      break;

    case "PROFILS_DEFAUT_MODIFIES": {
      // #249 corrigé multi-profils (06/10/2026), étendu "tout est profil"
      // (#276) : l'ensemble des profils du compte, profils ajoutés compris,
      // est remplacé d'un bloc, l'avant/après porte les libellés. Trois
      // formes : attribués (depuis rien), remplacés, retirés. L'action garde
      // son nom en base, le libellé ne dit plus "par défaut".
      const avantProfils = Array.isArray(av.profils) ? av.profils : [];
      const apresProfils = Array.isArray(ap.profils) ? ap.profils : [];
      const citer = (liste) => liste.map((p) => `"${p}"`).join(", ");
      const s = (liste) => (liste.length > 1 ? "s" : "");
      if (apresProfils.length && avantProfils.length) {
        libelle = `Profil${s(apresProfils)} du compte remplacé${s(apresProfils)} par ${citer(apresProfils)}${parActeur}`;
      } else if (apresProfils.length) {
        libelle = `Profil${s(apresProfils)} ${citer(apresProfils)} attribué${s(apresProfils)}${parActeur}`;
      } else {
        libelle = `Profil${s(avantProfils)} du compte retiré${s(avantProfils)}${parActeur}`;
      }
      details = { profils_avant: avantProfils, profils_apres: apresProfils };
      break;
    }

    // --- Cycle de vie des profils ajoutés (#276) et délégation (#278). ---
    // Traces portées par l'entité profil : absentes de l'historique d'un
    // compte, mais le gabarit existe pour tout écran d'audit qui les lira.

    case "PROFIL_AJOUTE_CREE":
      libelle = `Profil "${ap.label || "inconnu"}" créé${ap.dashboard_reference ? ` (dashboard de référence : ${ap.dashboard_reference})` : ""}${parActeur}`;
      details = { profil: ap.label ?? null, dashboard_reference: ap.dashboard_reference ?? null };
      break;

    case "PROFIL_MODIFIE":
      libelle = `Profil modifié : ${champsLisibles}${parActeur}`;
      details = { champs_modifies: champs.map((c) => NOMS_CHAMPS[c] || c) };
      break;

    case "PROFIL_MIS_EN_CORBEILLE":
      libelle = `Profil "${av.label || "inconnu"}" placé dans la corbeille${parActeur}`;
      details = { profil: av.label ?? null };
      break;

    case "PROFIL_RESTAURE":
      libelle = `Profil "${ap.label || "inconnu"}" restauré depuis la corbeille${parActeur}`;
      details = { profil: ap.label ?? null };
      break;

    case "PROFIL_DELEGATION_ACCORDEE": {
      const codes = Array.isArray(ap.permissions) ? ap.permissions.join(", ") : "";
      libelle = `Délégation accordée au profil "${ap.profil || "inconnu"}" : ${codes}${parActeur}`;
      details = { profil: ap.profil ?? null, permissions: ap.permissions ?? null };
      break;
    }

    case "PROFIL_DELEGATION_RETIREE": {
      const codes = Array.isArray(av.permissions) ? av.permissions.join(", ") : "";
      libelle = `Délégation retirée du profil "${av.profil || "inconnu"}" : ${codes}${parActeur}`;
      details = { profil: av.profil ?? null, permissions: av.permissions ?? null };
      break;
    }

    case "EXCEPTION_AJOUTEE": {
      // Le type de l'exception est nommé en clair : "accorde" et "retire" sont
      // le vocabulaire de la base, pas celui d'un lecteur.
      const sens = ap.type === "retire" ? "de retrait" : "d'accord";
      libelle = `Exception ${sens} sur "${ap.permission || "inconnue"}" ajoutée sur ${ap.portee || "toutes sociétés"}${parActeur}`;
      details = { permission: ap.permission ?? null, type: ap.type ?? null,
                  portee: ap.portee ?? null, motif: ap.motif ?? null };
      break;
    }

    case "EXCEPTION_MODIFIEE":
      libelle = `Exception sur "${ap.permission || "inconnue"}" modifiée${parActeur}`;
      details = {
        permission: ap.permission ?? null,
        portee: ap.portee ?? null,
        date_debut: ap.date_debut ?? null,
        date_fin: ap.date_fin ?? null,
      };
      break;

    case "EXCEPTION_SUPPRIMEE":
      libelle = `Exception sur "${av.permission || "inconnue"}" supprimée sur ${av.portee || "toutes sociétés"}${parActeur}`;
      details = { permission: av.permission ?? null, portee: av.portee ?? null };
      break;

    // --- Groupes d'organisations et d'utilisateurs (US #277/#330). ---
    // Les traces des groupes portent l'entité groupe ; seules MEMBRE_AJOUTE et
    // MEMBRE_RETIRE visent le compte, pour que l'historique administrateur
    // d'un utilisateur raconte ses appartenances.

    case "GROUPE_ORGANISATION_CREE": {
      const nb = Array.isArray(ap.societes) ? ap.societes.length : 0;
      libelle = `Groupe d'organisations "${ap.nom || "inconnu"}" créé (${nb} société${nb > 1 ? "s" : ""})${parActeur}`;
      details = { nom: ap.nom ?? null, societes: ap.societes ?? null };
      break;
    }

    case "GROUPE_ORGANISATION_MODIFIE":
      libelle = `Groupe d'organisations modifié : ${champsLisibles}${parActeur}`;
      details = { champs_modifies: champs.map((c) => NOMS_CHAMPS[c] || c) };
      break;

    case "GROUPE_ORGANISATION_SUPPRIME":
      libelle = `Groupe d'organisations "${av.nom || "inconnu"}" supprimé${parActeur}`;
      details = { nom: av.nom ?? null };
      break;

    case "GROUPE_UTILISATEUR_CREE":
      libelle = `Groupe d'utilisateurs "${ap.nom || "inconnu"}" créé${parActeur}`;
      details = { nom: ap.nom ?? null };
      break;

    case "GROUPE_UTILISATEUR_MODIFIE":
      libelle = `Groupe d'utilisateurs modifié : ${champsLisibles}${parActeur}`;
      details = { champs_modifies: champs.map((c) => NOMS_CHAMPS[c] || c) };
      break;

    case "GROUPE_UTILISATEUR_SUPPRIME":
      libelle = `Groupe d'utilisateurs "${av.nom || "inconnu"}" supprimé${parActeur}`;
      details = { nom: av.nom ?? null, membres: av.membres ?? null, acces: av.acces ?? null };
      break;

    case "GROUPE_UTILISATEUR_ACCES_AJOUTE":
      libelle = `Accès "${ap.profil || "inconnu"}" × "${ap.groupe_organisation || "inconnu"}" ajouté au groupe d'utilisateurs "${ap.groupe || "inconnu"}"${parActeur}`;
      details = { groupe: ap.groupe ?? null, profil: ap.profil ?? null, groupe_organisation: ap.groupe_organisation ?? null };
      break;

    case "GROUPE_UTILISATEUR_ACCES_RETIRE":
      libelle = `Accès "${av.profil || "inconnu"}" × "${av.groupe_organisation || "inconnu"}" retiré du groupe d'utilisateurs "${av.groupe || "inconnu"}"${parActeur}`;
      details = { groupe: av.groupe ?? null, profil: av.profil ?? null, groupe_organisation: av.groupe_organisation ?? null };
      break;

    case "GROUPE_UTILISATEUR_MEMBRE_AJOUTE":
      libelle = `Ajouté au groupe d'utilisateurs "${ap.groupe || "inconnu"}"${parActeur}`;
      details = { groupe: ap.groupe ?? null };
      break;

    case "GROUPE_UTILISATEUR_MEMBRE_RETIRE":
      libelle = `Retiré du groupe d'utilisateurs "${av.groupe || "inconnu"}"${parActeur}`;
      details = { groupe: av.groupe ?? null };
      break;

    case "CONNEXION":
      libelle = ip ? `Connexion depuis ${ip}${parActeur}` : `Connexion${parActeur}`;
      details = ip ? { ip } : null;
      break;

    case "REVENDEUR_CREE":
      libelle = `Revendeur créé${parActeur}`;
      break;

    case "REVENDEUR_MODIFIE":
      libelle = `Revendeur modifié : ${champsLisibles}${parActeur}`;
      details = { champs_modifies: champs.map((c) => NOMS_CHAMPS[c] || c) };
      break;

    case "REVENDEUR_DESACTIVE":
      libelle = `Revendeur désactivé${parActeur}`;
      break;

    case "REVENDEUR_REACTIVE":
      libelle = `Revendeur réactivé${parActeur}`;
      break;

    case "CONTACT_CREE":
      libelle = `Contact créé${parActeur}`;
      break;

    case "CONTACT_MODIFIE":
      libelle = `Contact modifié : ${champsLisibles}${parActeur}`;
      details = { champs_modifies: champs.map((c) => NOMS_CHAMPS[c] || c) };
      break;

    case "CONTACT_SUPPRIME":
      libelle = `Contact supprimé${parActeur}`;
      break;

    // --- Cycle de vie des sociétés (#281). Traces portées par l'entité
    // société : absentes de l'historique d'un compte, mais le gabarit existe
    // pour tout écran d'audit qui les lira. Décision client du 08/10/2026 :
    // une société ne se désactive pas, elle s'archive (vocabulaire des
    // contrats #96) ; les traces antérieures SOCIETE_DESACTIVEE et
    // SOCIETE_REACTIVEE restent en base et se lisent avec le même gabarit.

    case "SOCIETE_DESACTIVEE":
    case "SOCIETE_ARCHIVEE":
      libelle = `Société "${ap.raison_sociale || av.raison_sociale || "inconnue"}" archivée${parActeur}`;
      details = { societe: ap.raison_sociale ?? av.raison_sociale ?? null,
                  date_fin_activite: ap.date_fin_activite ?? null };
      break;

    case "SOCIETE_REACTIVEE":
    case "SOCIETE_RESTAUREE":
      libelle = `Société "${ap.raison_sociale || av.raison_sociale || "inconnue"}" restaurée${parActeur}`;
      details = { societe: ap.raison_sociale ?? av.raison_sociale ?? null };
      break;

    case "SOCIETE_SUPPRIMEE":
      libelle = `Société "${av.raison_sociale || ap.raison_sociale || "inconnue"}" supprimée (suppression douce)${parActeur}`;
      details = { societe: av.raison_sociale ?? ap.raison_sociale ?? null };
      break;

    default:
      // Une action inconnue reste lisible plutôt que d'être masquée : une
      // trace probante ne doit jamais disparaître d'un historique parce que
      // le traducteur n'a pas été mis à jour.
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