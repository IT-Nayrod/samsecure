// Consommation publique d'un lien de réinitialisation.
//
// Ce routeur est le seul du projet, avec /api/auth, à être monté AVANT
// authMiddleware : par construction, son visiteur n'a pas de session, c'est
// tout l'objet du lien. Il ne traverse donc ni l'authentification ni le
// contrôle des permissions, et ne figure pas dans routesPermissions.js.
//
// Règle de discrétion : invalide, expiré et déjà consommé renvoient le même
// message. Distinguer les cas dirait à un visiteur qu'un compte existe, ou
// qu'un lien a servi.
import express from "express";
import bcrypt from "bcryptjs";
import { tenantPool } from "../db.js";
import { resoudreJeton } from "../utils/reinitialisation.js";
import { verifierPolitique } from "../utils/motDePasse.js";
import { auditer } from "../utils/audit.js";

const router = express.Router();

const LIEN_INVALIDE = "Ce lien n'est plus valide. Demandez un nouveau lien à votre administrateur.";

// GET : la page de saisie interroge cet endpoint avant d'afficher son
// formulaire. Aucune donnée du compte n'est renvoyée, pas même l'email : le
// prénom seul, pour que la page puisse dire à qui elle s'adresse.
router.get("/mot-de-passe/reinitialisation/:jeton", async (req, res) => {
  try {
    const r = await resoudreJeton(req.params.jeton);
    // code_retour: 2027
    if (!r.valide) return res.status(410).json({ error: LIEN_INVALIDE });
    // code_retour: 2025
    res.json({ valide: true, prenom: r.prenom });
  } catch (err) {
    console.error("GET /mot-de-passe/reinitialisation/:jeton error", err);
    // code_retour: 2099
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST : consommation effective.
router.post("/mot-de-passe/reinitialisation/:jeton", async (req, res) => {
  const { mot_de_passe } = req.body || {};

  // code_retour: 2016
  if (!mot_de_passe || typeof mot_de_passe !== "string") {
    return res.status(400).json({ error: "Le mot de passe est obligatoire." });
  }
  // Même politique que la définition par un administrateur : une seule règle,
  // dans un seul module, quel que soit le chemin emprunté.
  const manques = verifierPolitique(mot_de_passe);
  // code_retour: 2015
  if (manques.length) {
    return res.status(400).json({
      error: `Le mot de passe doit comporter ${manques.join(", ")}.`,
      exigences_non_satisfaites: manques,
    });
  }

  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const r = await resoudreJeton(req.params.jeton);
    // code_retour: 2027
    if (!r.valide) { await client.query("ROLLBACK"); return res.status(410).json({ error: LIEN_INVALIDE }); }

    // Marquage AVANT le reste, et conditionné à utilise = false : deux appels
    // simultanés avec le même lien ne peuvent pas aboutir tous les deux, le
    // second ne trouve plus de ligne à mettre à jour.
    const { rowCount } = await client.query(
      `UPDATE reset_password_token SET utilise = true
        WHERE id = $1 AND utilise = false`, [r.jetonId]);
    if (!rowCount) { await client.query("ROLLBACK"); return res.status(410).json({ error: LIEN_INVALIDE }); }

    const hash = await bcrypt.hash(mot_de_passe, 10);
    await client.query(`UPDATE utilisateur SET mot_de_passe_hash = $2 WHERE id = $1`,
      [r.idUtilisateur, hash]);

      // Toutes les sessions du compte tombent : reprendre la main sur un compte
    // implique de chasser ce qui y était déjà connecté.
    const { rowCount: sessions } = await client.query(
      `UPDATE session_token SET revoked = true
        WHERE id_utilisateur = $1 AND revoked = false`, [r.idUtilisateur]);

    // L'acteur est le titulaire lui-même : il agit sans session, d'où acteurId
    // passe explicitement. L'historique affichera "par l'utilisateur".
    // code_retour: 2029
    await auditer(client, req, {
      action: "MOT_DE_PASSE_REINITIALISE",
      entiteId: r.idUtilisateur,
      acteurId: r.idUtilisateur,
      apres: { sessions_revoquees: sessions },
    });

    await client.query("COMMIT");
    // code_retour: 2026
    res.json({ message: "Mot de passe réinitialisé. Vous pouvez vous connecter." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /mot-de-passe/reinitialisation/:jeton error", err);
    // code_retour: 2099
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;