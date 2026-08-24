// server/index.js
import express from "express";
import cors from "cors";
import { APP_ENV } from "./db.js";
import { chargerCatalogueCodes } from "./utils/reponse.js";

import authRouter from "./routes/auth.js";
import { authMiddleware } from "./middleware/auth.js";
import { controlePermissions } from "./middleware/exigerPermission.js";

import societesRouter from "./routes/societes.js";
import profilsRouter from "./routes/profils.js";
import permissionsRouter from "./routes/permissions.js";
import profilPermissionsRouter from "./routes/profilPermissions.js";
import utilisateursRouter from "./routes/utilisateurs.js";
import utilisateurProfilsRouter from "./routes/utilisateurProfils.js";
import utilisateurExceptionsRouter from "./routes/utilisateurExceptions.js";
import droitsEffectifsRouter from "./routes/droitsEffectifs.js";
import journalRouter from "./routes/journal.js";
import contratsRouter from "./routes/contrats.js";
import commandesRouter from "./routes/commandes.js";
import referentielsRouter from "./routes/referentiels.js";
import preuvesRouter from "./routes/preuves.js";
import facturesRouter from "./routes/factures.js";
import reinitialisationPubliqueRouter from "./routes/reinitialisationPublique.js";
import validationRouter from "./routes/validation.js";
import mailsRouter from "./routes/mails.js";
import inventaireRouter from "./routes/inventaire.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
// Monte AVANT authMiddleware : le visiteur d'un lien de reinitialisation n'a
// par definition aucune session. Ce routeur ne traverse donc ni
// l'authentification ni le controle des permissions, et c'est voulu.
app.use("/api", reinitialisationPubliqueRouter);

app.use("/api", authMiddleware);
// Jeton valide ne vaut pas droit d'agir : le controle des permissions est
// central et couvre toutes les routes metier, y compris celles appelees a la
// main hors de l'interface.
app.use("/api", controlePermissions);
app.use("/api", societesRouter);
app.use("/api", profilsRouter);
app.use("/api", permissionsRouter);
app.use("/api", profilPermissionsRouter);
app.use("/api", utilisateursRouter);
app.use("/api", utilisateurProfilsRouter);
app.use("/api", utilisateurExceptionsRouter);
app.use("/api", droitsEffectifsRouter);
app.use("/api", journalRouter);
app.use("/api", contratsRouter);
app.use("/api", referentielsRouter);
app.use("/api", commandesRouter);
app.use("/api", preuvesRouter);
app.use("/api", facturesRouter);
app.use("/api", validationRouter);
app.use("/api", mailsRouter);
app.use("/api", inventaireRouter);

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Ressource introuvable." });
});

// Filet de sécurité : jamais de 500 brut sans message exploitable.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Erreur serveur inattendue." });
});

const PORT = process.env.PORT || 3001;
// Catalogue code_retour (BDD Commune) : un echec de chargement ne bloque pas
// le demarrage, les reponses sortent alors avec libelle null et l'ecart est
// visible en console.
chargerCatalogueCodes()
  .then((n) => console.log(`Catalogue code_retour charge : ${n} codes`))
  .catch((err) => console.error("[code_retour] chargement impossible :", err.message));
app.listen(PORT, () => {
  console.log(
    `API SamSecure [${APP_ENV}] sur http://localhost:${PORT}` +
    `-> ${process.env.PGDATABASE_TENANT}`
  );
});
