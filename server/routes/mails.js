// Test du socle d'envoi de mails (tache #87).
//
// Une seule route, reservee a l'administration : envoyer un mail de test pour
// verifier la configuration SMTP d'un environnement sans passer par un
// parcours metier. Le destinataire par defaut est l'administrateur qui appelle,
// son adresse vient de la session, jamais d'une constante.
//
// Permission exigee : gerer_connecteurs (voir routesPermissions.js). Elle n'est
// detenue que par le groupe admin_sam dans la matrice 011/021, ce qui reserve
// la route au profil administrateur sans coder un nom de profil ici.
import express from "express";
import { envoyerMail } from "../utils/mail.js";

const router = express.Router();

router.post("/mails/test", async (req, res) => {
  const destinataire = (req.body && req.body.destinataire) || req.user.email;
  try {
    const etat = await envoyerMail({
      destinataire,
      sujet: "Test d'envoi SamSecure",
      contenu:
        "Ce message confirme que l'envoi de mails est correctement configuré sur ce serveur SamSecure.\n\n" +
        `Il a été demandé par ${req.user.email || "un administrateur"}. Aucune action n'est attendue de votre part.`,
    });

    // L'echec d'envoi est un etat, pas une erreur HTTP : la route a fait son
    // travail, c'est le transport qui a refuse. 200 avec envoye = false, et le
    // message propre du socle a afficher tel quel.
    // code_retour: 1010 (envoye) / 1011 (non envoye)
    res.json({
      envoye: etat.envoye,
      destinataire,
      message: etat.envoye ? `Mail de test envoyé à ${destinataire}.` : etat.erreur,
      code: etat.code ?? 1000,
    });
  } catch (err) {
    console.error("POST /mails/test error", err);
    // code_retour: 1099
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
