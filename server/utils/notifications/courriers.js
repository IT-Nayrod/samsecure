// Courriers du module notifications (story #121).
//
// Deux voies, toutes deux sur le socle mail existant (server/utils/mail.js,
// gabarit commun, configuration lue dans l'environnement, aucun identifiant
// manipule ici) :
//   - immediat : une notification, un courrier, envoye peu apres la creation
//     (delai court et regroupe, pour partir apres le COMMIT de l'appelant) ;
//   - recapitulatif : toutes les notifications "quotidien" en attente d'un
//     utilisateur, regroupees en un seul courrier au passage de 7 h 30.
//
// Chaque envoi est journalise sur la notification (courrier_statut,
// courrier_date, courrier_resultat, courrier_tentatives). Un echec est
// retente au passage suivant, jusqu'a MAX_TENTATIVES : sans serveur de
// messagerie configure (developpement), le socle refuse proprement (code
// 1001) et les tentatives s'epuisent sans bloquer le reste.
import { tenantPool } from "../../db.js";
import { envoyerMail } from "../mail.js";
import { composerCourrier, composerRecapitulatif, dateParis } from "./regles.js";
import { tracer } from "./trace.js";

export const MAX_TENTATIVES = 5;
const DELAI_IMMEDIAT_MS = 3000;

function urlBase() {
  return process.env.URL_PUBLIQUE || "";
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

// ---------------------------------------------------------------------------
// Immediat
// ---------------------------------------------------------------------------

let envoiEnCours = false;
let minuterie = null;

// Regroupe les demandes : plusieurs creations rapprochees ne declenchent
// qu'un seul passage, apres le delai (le temps que la transaction appelante
// soit validee : une notification non validee est invisible du passage, elle
// sera prise au suivant).
export function planifierEnvoiImmediat() {
  if (minuterie) return;
  minuterie = setTimeout(() => {
    minuterie = null;
    envoyerImmediats().catch((err) => console.error("[notifications] envoi immediat", err.message));
  }, DELAI_IMMEDIAT_MS);
  if (typeof minuterie.unref === "function") minuterie.unref();
}

export async function envoyerImmediats() {
  if (envoiEnCours) return { envoyes: 0, echecs: 0, reportes: true };
  envoiEnCours = true;
  const bilan = { envoyes: 0, echecs: 0 };
  try {
    const { rows } = await tenantPool.query(
      `SELECT n.id, n.titre, n.message, n.lien, u.email
         FROM notification n
         JOIN utilisateur u ON u.id = n.id_utilisateur
        WHERE n.courrier_mode = 'immediat'
          AND n.courrier_statut IN ('a_envoyer', 'echec')
          AND n.courrier_tentatives < $1
        ORDER BY n.created_at
        LIMIT 200`,
      [MAX_TENTATIVES]
    );
    for (const n of rows) {
      const { sujet, contenu } = composerCourrier(n, { urlBase: urlBase() });
      const etat = await envoyerMail({ destinataire: n.email, sujet, contenu });
      await marquer([n.id], etat);
      if (etat.envoye) bilan.envoyes += 1; else bilan.echecs += 1;
      // Configuration absente : inutile d'insister sur les suivantes dans ce
      // passage, chacune consommerait une tentative pour le meme motif.
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
export async function envoyerRecapitulatifs({ avant = new Date() } = {}) {
  const bilan = { utilisateurs: 0, envoyes: 0, echecs: 0, notifications: 0 };
  const { rows } = await tenantPool.query(
    `SELECT n.id, n.type, n.titre, n.message, n.lien, n.id_utilisateur, u.email
       FROM notification n
       JOIN utilisateur u ON u.id = n.id_utilisateur
      WHERE n.courrier_mode = 'quotidien'
        AND n.courrier_statut IN ('a_envoyer', 'echec')
        AND n.courrier_tentatives < $1
        AND n.created_at < $2
      ORDER BY n.id_utilisateur, n.created_at`,
    [MAX_TENTATIVES, avant]
  );
  if (!rows.length) return bilan;

  const parUtilisateur = new Map();
  for (const r of rows) {
    if (!parUtilisateur.has(r.id_utilisateur)) parUtilisateur.set(r.id_utilisateur, { email: r.email, liste: [] });
    parUtilisateur.get(r.id_utilisateur).liste.push(r);
  }
  bilan.utilisateurs = parUtilisateur.size;
  bilan.notifications = rows.length;

  // Libelle de la veille en toutes lettres, pour l'introduction du courrier.
  const veille = new Date(avant.getTime() - 24 * 3600 * 1000);
  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(veille);

  const groupes = [...parUtilisateur.values()];
  for (let i = 0; i < groupes.length; i += 1) {
    const { email, liste } = groupes[i];
    const { sujet, contenu } = composerRecapitulatif(liste, { urlBase: urlBase(), dateLabel });
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
