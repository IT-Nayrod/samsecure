// Socle d'envoi de mails, story #15 (tache #87).
//
// Point de passage unique : aucun autre module du serveur n'importe nodemailer
// ni ne construit de transport. Tout mail de l'application passe par
// envoyerMail(), qui applique le gabarit commun SamSecure (en-tete, corps,
// pied) et centralise le traitement des echecs.
//
// Configuration lue EXCLUSIVEMENT dans l'environnement : SMTP_HOST, SMTP_PORT,
// SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_FROM_NAME, MAIL_REPLY_TO.
// Aucune valeur de repli, aucune adresse en dur : une configuration absente
// est un etat d'erreur explicite (code 1001), pas un envoi vers un defaut.
//
// Contrat d'echec : envoyerMail() ne leve JAMAIS. Un echec (configuration,
// adresse, transport) est trace dans log_serveur avec son motif et renvoye
// sous la forme { envoye: false, erreur } que l'appelant peut afficher tel
// quel. L'action metier qui a demande le mail ne doit pas echouer parce que le
// mail n'est pas parti : un lien de reinitialisation existe en base meme si
// le message n'a pas ete remis, et l'administrateur voit qu'il doit le
// renvoyer.
import nodemailer from "nodemailer";
import { tenantPool } from "../db.js";

const VARIABLES = [
  "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS",
  "MAIL_FROM", "MAIL_FROM_NAME", "MAIL_REPLY_TO",
];

// Messages d'etat renvoyes a l'appelant. Pas de detail technique : le motif
// precis (code SMTP, refus d'authentification) va dans log_serveur, pas a
// l'ecran, ou il ne servirait qu'a renseigner un visiteur mal intentionne.
const ERREURS = {
  // code_retour: 1001
  configuration: "L'envoi de mails n'est pas configuré sur ce serveur.",
  // code_retour: 1002
  destinataire: "Adresse de destinataire absente ou invalide.",
  // code_retour: 1003
  transport: "Le mail n'a pas pu être envoyé. L'incident a été journalisé.",
};

let transport = null;

// Le transport est construit a la premiere demande, pas au demarrage : un
// serveur sans SMTP doit demarrer et servir tout le reste de l'application.
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
// elle les reponses vont a MAIL_FROM, ce qui est un comportement sain.
function variablesManquantes() {
  return VARIABLES.filter((v) => v !== "MAIL_REPLY_TO" && !process.env[v]);
}

// Trace d'echec dans log_serveur. Cette ecriture ne doit pas non plus faire
// echouer l'appelant : si la base est injoignable, la console garde la trace.
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

// Gabarit commun a tout envoi : en-tete SamSecure, corps, pied. Le corps est
// recu en texte brut, decoupe en paragraphes sur les lignes vides ; les URL
// deviennent des liens cliquables. Aucun HTML n'est accepte de l'appelant,
// ce qui ferme la porte a une injection par un champ saisi (prenom, nom).
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

// Fonction unique exposee au reste de l'application.
//   destinataire : adresse mail du titulaire
//   sujet        : ligne d'objet, reprise en titre du corps
//   contenu      : texte brut, paragraphes separes par une ligne vide
// Renvoie { envoye: true, messageId } ou { envoye: false, erreur, code }.
// Ne leve jamais.
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
    // Le motif complet va dans log_serveur, jamais dans la reponse. Le
    // destinataire y figure : il faut pouvoir dire a qui un mail n'est pas
    // parti, et une adresse n'est pas un secret au sens de l'audit.
    await tracerEchec("Echec d'envoi SMTP", {
      destinataire, sujet, motif: err.message, code_smtp: err.code || null, reponse: err.response || null,
    });
    return { envoye: false, code: 1003, erreur: ERREURS.transport };
  }
}
