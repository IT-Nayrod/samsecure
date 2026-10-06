// Courriers du module notifications (story #121, revus pour la spec v1.1 -
// retours Samuel du 27/09/2026).
//
// Deux voies, toutes deux sur le socle mail existant (server/utils/mail.js,
// gabarit commun, configuration lue dans l'environnement - le relais SMTP
// local et l'expediteur noreply@samsecure.net se reglent par SMTP_* et
// MAIL_FROM, aucune adresse en dur ici) :
//   - immediat : une notification, un courrier, envoye peu apres la creation
//     (delai court et regroupe, pour partir apres le COMMIT de l'appelant) ;
//   - recapitulatif : toutes les notifications "quotidien" en attente d'un
//     utilisateur, regroupees en un seul courrier au passage de 7 h 30.
//
// Confidentialite (v1.1) : les contenus sont composes par regles.js a partir
// des libelles generiques du catalogue, jamais du titre ni du message de la
// notification. Objet prefixe "SamSecure - <nom du tenant>".
//
// Envoi asynchrone, sans file de retry applicative (v1.1) : chaque courrier
// est tente une fois. Un echec est journalise sur la notification
// (courrier_statut = echec), qui reste visible dans l'application ; les
// passages planifies ne le reprennent pas. La relance est un acte volontaire
// (POST /notifications/relancer-courriers, Admin SAM) : relancerCourriers()
// reprend les seuls statuts "echec", sans doublon possible (un courrier
// envoye passe en "envoye" et n'est jamais reselectionne).
import { tenantPool } from "../../db.js";
import { envoyerMail } from "../mail.js";
import { composerCourrier, composerRecapitulatif, dateParis } from "./regles.js";
import { traducteurPour } from "./traductions.js";
import { tracer } from "./trace.js";

const DELAI_IMMEDIAT_MS = 3000;

function urlBase() {
  return process.env.URL_PUBLIQUE || "";
}

// ---------------------------------------------------------------------------
// Nom du tenant (client.raison_sociale), pour le prefixe d'objet. Charge une
// fois puis conserve : le nom du groupe client ne change pas en cours de vie
// du processus. Une lecture en echec laisse le prefixe "SamSecure" seul.
// ---------------------------------------------------------------------------

let nomTenantCache;

export async function nomTenant() {
  if (nomTenantCache !== undefined) return nomTenantCache;
  try {
    const { rows } = await tenantPool.query(
      `SELECT raison_sociale FROM client ORDER BY created_at LIMIT 1`);
    nomTenantCache = rows[0]?.raison_sociale || null;
  } catch (err) {
    console.error("[notifications] nom du tenant illisible", err.message);
    nomTenantCache = null;
  }
  return nomTenantCache;
}

// Resultat lisible d'un envoi, sans detail technique (le motif complet est
// deja dans log_serveur, source mail).
function resultatDe(etat) {
  if (etat.envoye) return "Envoyé";
  return etat.erreur || "Échec d'envoi";
}

async function marquer(ids, etat) {
  if (!ids.length) return;
  await tenantPool.query(
    `UPDATE notification
        SET courrier_statut     = $2,
            courrier_date       = now(),
            courrier_resultat   = $3,
            courrier_tentatives = courrier_tentatives + 1
      WHERE id = ANY($1)`,
    [ids, etat.envoye ? "envoye" : "echec", resultatDe(etat)]
  );
}

// Statuts repris par un passage : l'automatique n'envoie que les courriers
// jamais tentes ; la relance volontaire reprend aussi les echecs.
function statutsRepris(relance) {
  return relance ? ["a_envoyer", "echec"] : ["a_envoyer"];
}

// ---------------------------------------------------------------------------
// Immediat
// ---------------------------------------------------------------------------

let envoiEnCours = false;
let minuterie = null;

// Regroupe les demandes : plusieurs creations rapprochees ne declenchent
// qu'un seul passage, apres le delai (le temps que la transaction appelante
// soit validee : une notification non validee est invisible du passage, elle
// sera prise au suivant). L'action utilisateur n'attend jamais l'envoi.
export function planifierEnvoiImmediat() {
  if (minuterie) return;
  minuterie = setTimeout(() => {
    minuterie = null;
    envoyerImmediats().catch((err) => console.error("[notifications] envoi immediat", err.message));
  }, DELAI_IMMEDIAT_MS);
  if (typeof minuterie.unref === "function") minuterie.unref();
}

export async function envoyerImmediats({ relance = false } = {}) {
  if (envoiEnCours) return { envoyes: 0, echecs: 0, reportes: true };
  envoiEnCours = true;
  const bilan = { envoyes: 0, echecs: 0 };
  try {
    const { rows } = await tenantPool.query(
      `SELECT n.id, n.type, n.lien, u.email, u.langue
         FROM notification n
         JOIN utilisateur u ON u.id = n.id_utilisateur
        WHERE n.courrier_mode = 'immediat'
          AND n.courrier_statut = ANY($1)
        ORDER BY n.created_at
        LIMIT 200`,
      [statutsRepris(relance)]
    );
    const tenant = rows.length ? await nomTenant() : null;
    for (const n of rows) {
      const traduire = await traducteurPour(n.langue);
      const { sujet, contenu } = composerCourrier(n, { urlBase: urlBase(), nomTenant: tenant, traduire });
      const etat = await envoyerMail({ destinataire: n.email, sujet, contenu });
      await marquer([n.id], etat);
      if (etat.envoye) bilan.envoyes += 1; else bilan.echecs += 1;
      // Configuration absente : inutile d'insister sur les suivantes dans ce
      // passage, chacune echouerait pour le meme motif.
      if (!etat.envoye && etat.code === 1001) break;
    }
  } finally {
    envoiEnCours = false;
  }
  if (bilan.envoyes || bilan.echecs) {
    await tracer("info", "Courriers immediats", bilan);
  }
  return bilan;
}

// ---------------------------------------------------------------------------
// Recapitulatif quotidien
// ---------------------------------------------------------------------------

// avant : instant limite (les notifications creees apres ne sont pas reprises,
// elles partiront le lendemain). Par defaut, le debut du passage.
export async function envoyerRecapitulatifs({ avant = new Date(), relance = false } = {}) {
  const bilan = { utilisateurs: 0, envoyes: 0, echecs: 0, notifications: 0 };
  const { rows } = await tenantPool.query(
    `SELECT n.id, n.type, n.lien, n.id_utilisateur, u.email, u.langue
       FROM notification n
       JOIN utilisateur u ON u.id = n.id_utilisateur
      WHERE n.courrier_mode = 'quotidien'
        AND n.courrier_statut = ANY($1)
        AND n.created_at < $2
      ORDER BY n.id_utilisateur, n.created_at`,
    [statutsRepris(relance), avant]
  );
  if (!rows.length) return bilan;

  const parUtilisateur = new Map();
  for (const r of rows) {
    if (!parUtilisateur.has(r.id_utilisateur)) parUtilisateur.set(r.id_utilisateur, { email: r.email, langue: r.langue, liste: [] });
    parUtilisateur.get(r.id_utilisateur).liste.push(r);
  }
  bilan.utilisateurs = parUtilisateur.size;
  bilan.notifications = rows.length;

  const tenant = await nomTenant();
  // Libelle de la veille en toutes lettres, pour l'introduction du courrier,
  // dans la langue du destinataire.
  const veille = new Date(avant.getTime() - 24 * 3600 * 1000);
  const dateLabelPour = (langue) => {
    try {
      return new Intl.DateTimeFormat(langue || "fr", {
        timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", year: "numeric",
      }).format(veille);
    } catch {
      return new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", year: "numeric",
      }).format(veille);
    }
  };

  const groupes = [...parUtilisateur.values()];
  for (let i = 0; i < groupes.length; i += 1) {
    const { email, langue, liste } = groupes[i];
    const traduire = await traducteurPour(langue);
    const { sujet, contenu } = composerRecapitulatif(liste, {
      urlBase: urlBase(), dateLabel: dateLabelPour(langue), nomTenant: tenant, traduire,
    });
    const etat = await envoyerMail({ destinataire: email, sujet, contenu });
    await marquer(liste.map((n) => n.id), etat);
    if (etat.envoye) bilan.envoyes += 1; else bilan.echecs += 1;
    if (!etat.envoye && etat.code === 1001) {
      // Meme regle que l'immediat : configuration absente, on n'insiste pas.
      // Les groupes restants sont marques en echec une seule fois.
      for (const reste of groupes.slice(i + 1)) {
        await marquer(reste.liste.map((n) => n.id), etat);
        bilan.echecs += 1;
      }
      break;
    }
  }
  await tracer("info", `Recapitulatif quotidien du ${dateParis(avant)}`, bilan);
  return bilan;
}

// ---------------------------------------------------------------------------
// Relance volontaire (Admin SAM) : reprend les courriers en echec, immediats
// puis recapitulatifs. Pas de doublon possible : seuls les statuts
// "a_envoyer" et "echec" sont repris, jamais "envoye". Un seul passage a la
// fois.
// ---------------------------------------------------------------------------

let relanceEnCours = false;

export async function relancerCourriers() {
  if (relanceEnCours) return null;
  relanceEnCours = true;
  try {
    const immediats = await envoyerImmediats({ relance: true });
    const recapitulatifs = await envoyerRecapitulatifs({ avant: new Date(), relance: true });
    const bilan = { immediats, recapitulatifs };
    await tracer("info", "Relance volontaire des courriers", bilan);
    return bilan;
  } finally {
    relanceEnCours = false;
  }
}
