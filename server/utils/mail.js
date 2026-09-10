// Socle d'envoi de mails, story #15 (tâche #87).
//
// Point de passage unique : aucun autre module du serveur n'importe nodemailer
// ni ne construit de transport. Tout mail de l'application passe par
// envoyerMail(), qui applique le gabarit commun SamSecure (en-tête, corps,
// pied) et centralise le traitement des échecs.
//
// Configuration lue EXCLUSIVEMENT dans l'environnement : SMTP_HOST, SMTP_PORT,
// SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_FROM_NAME, MAIL_REPLY_TO.
// Aucune valeur de repli, aucune adresse en dur : une configuration absente
// est un état d'erreur explicite (code 1001), pas un envoi vers un défaut.
//
// Contrat d'échec : envoyerMail() ne lève JAMAIS. Un échec (configuration,
// adresse, transport) est tracé dans log_serveur avec son motif et renvoyé
// sous la forme { envoye: false, erreur } que l'appelant peut afficher tel
// quel. L'action métier qui a demandé le mail ne doit pas échouer parce que le
// mail n'est pas parti : un lien de réinitialisation existe en base même si
// le message n'a pas été remis, et l'administrateur voit qu'il doit le
// renvoyer.
import nodemailer from "nodemailer";
import { tenantPool } from "../db.js";

const VARIABLES = [
  "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS",
  "MAIL_FROM", "MAIL_FROM_NAME", "MAIL_REPLY_TO",
];

// Messages d'état renvoyés à l'appelant. Pas de détail technique : le motif
// précis (code SMTP, refus d'authentification) va dans log_serveur, pas à
// l'écran, où il ne servirait qu'à renseigner un visiteur mal intentionné.
const ERREURS = {
  // code_retour: 1001
  configuration: "L'envoi de mails n'est pas configuré sur ce serveur.",
  // code_retour: 1002
  destinataire: "Adresse de destinataire absente ou invalide.",
  // code_retour: 1003
  transport: "Le mail n'a pas pu être envoyé. L'incident a été journalisé.",
};

let transport = null;

// Le transport est construit à la première demande, pas au démarrage : un
// serveur sans SMTP doit démarrer et servir tout le reste de l'application.
function obtenirTransport() {
  if (transport) return transport;
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transport;
}

// Variables manquantes ou vides. MAIL_REPLY_TO est la seule optionnelle : sans
// elle les réponses vont à MAIL_FROM, ce qui est un comportement sain.
function variablesManquantes() {
  return VARIABLES.filter((v) => v !== "MAIL_REPLY_TO" && !process.env[v]);
}

// Trace d'échec dans log_serveur. Cette écriture ne doit pas non plus faire
// échouer l'appelant : si la base est injoignable, la console garde la trace.
async function tracerEchec(message, context) {
  try {
    await tenantPool.query(
      `INSERT INTO log_serveur (niveau, source, message, context)
       VALUES ('error', 'mail', $1, $2)`,
      [message, JSON.stringify(context)]
    );
  } catch (err) {
    console.error("[mail] trace log_serveur impossible :", err.message, message, context);
  }
}

function echapper(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Gabarit commun à tout envoi : en-tête SamSecure, corps, pied. Le corps est
// reçu en texte brut, découpé en paragraphes sur les lignes vides ; les URL
// deviennent des liens cliquables. Aucun HTML n'est accepté de l'appelant,
// ce qui ferme la porte à une injection par un champ saisi (prenom, nom).
function gabarit(sujet, contenu) {
  const paragraphes = String(contenu ?? "").split(/\n\s*\n/).map((p) => {
    const html = echapper(p.trim()).replace(
      /(https?:\/\/[^\s<]+)/g,
      (url) => `<a href="${url}" style="color:#1e40af;word-break:break-all">${url}</a>`
    ).replace(/\n/g, "<br>");
    return `<p style="margin:0 0 14px 0;line-height:1.5">${html}</p>`;
  }).join("");

  const nomExpediteur = echapper(process.env.MAIL_FROM_NAME);
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${echapper(sujet)}</title></head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:15px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="padding:20px 28px;border-bottom:1px solid #e5e7eb">
      <span style="font-size:22px;font-weight:bold;color:#1e40af">Sam</span><span style="font-size:22px;font-weight:bold;color:#1f2937">Secure</span>
    </td></tr>
    <tr><td style="padding:24px 28px">
      <h1 style="margin:0 0 18px 0;font-size:18px;font-weight:600">${echapper(sujet)}</h1>
      ${paragraphes}
    </td></tr>
    <tr><td style="padding:16px 28px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">
      Ce message a été envoyé automatiquement par ${nomExpediteur}. Merci de ne pas y répondre directement si aucune adresse de réponse n'est indiquée.
    </td></tr>
  </table>
  </td></tr></table>
</body></html>`;

  const texte = `${process.env.MAIL_FROM_NAME}\n\n${sujet}\n\n${String(contenu ?? "").trim()}\n\n--\nMessage envoyé automatiquement par ${process.env.MAIL_FROM_NAME}.`;
  return { html, texte };
}

// Fonction unique exposée au reste de l'application.
//   destinataire : adresse mail du titulaire
//   sujet        : ligne d'objet, reprise en titre du corps
//   contenu      : texte brut, paragraphes séparés par une ligne vide
// Renvoie { envoye: true, messageId } ou { envoye: false, erreur, code }.
// Ne lève jamais.
export async function envoyerMail({ destinataire, sujet, contenu }) {
  const manquantes = variablesManquantes();
  if (manquantes.length) {
    await tracerEchec("Configuration SMTP incomplete", { manquantes, sujet });
    return { envoye: false, code: 1001, erreur: ERREURS.configuration };
  }

  if (!destinataire || typeof destinataire !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinataire)) {
    await tracerEchec("Destinataire absent ou invalide", { sujet });
    return { envoye: false, code: 1002, erreur: ERREURS.destinataire };
  }

  const { html, texte } = gabarit(sujet, contenu);
  try {
    const info = await obtenirTransport().sendMail({
      from: { name: process.env.MAIL_FROM_NAME, address: process.env.MAIL_FROM },
      to: destinataire,
      replyTo: process.env.MAIL_REPLY_TO || undefined,
      subject: sujet,
      text: texte,
      html,
    });
    // code_retour: 1000
    return { envoye: true, messageId: info.messageId };
  } catch (err) {
    // Le motif complet va dans log_serveur, jamais dans la réponse. Le
    // destinataire y figure : il faut pouvoir dire à qui un mail n'est pas
    // parti, et une adresse n'est pas un secret au sens de l'audit.
    await tracerEchec("Echec d'envoi SMTP", {
      destinataire, sujet, motif: err.message, code_smtp: err.code || null, reponse: err.response || null,
    });
    return { envoye: false, code: 1003, erreur: ERREURS.transport };
  }
}
