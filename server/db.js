import { Pool } from "pg";
import dotenv from "dotenv";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));

// Une seule variable non sensible pilote la cible. Défaut sur dev : une
// erreur de configuration doit toucher la base de test, jamais le staging.
export const APP_ENV = process.env.APP_ENV || "dev";

const envFile = path.join(SERVER_DIR, `.env.${APP_ENV}`);
if (!fs.existsSync(envFile)) {
  throw new Error(
    `APP_ENV="${APP_ENV}" : fichier ${envFile} introuvable. Valeurs attendues : dev, staging.`
  );
}

// Premier fichier gagnant : .env.<APP_ENV> prime, .env sert de socle commun.
dotenv.config({ path: [envFile, path.join(SERVER_DIR, ".env")], quiet: true });

// Refus de démarrer sur une configuration incomplète : un placeholder oublié
// ne doit jamais produire une erreur différée (28P01, JWT signé à vide).
const CLES_REQUISES = [
  "PGHOST", "PGPORT", "PGUSER", "PGPASSWORD",
  "PGDATABASE_COMMON", "PGDATABASE_TENANT",
  "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET",
];
const PLACEHOLDER = "A_RENSEIGNER";

const manquantes = CLES_REQUISES.filter(
  (cle) => !process.env[cle] || process.env[cle] === PLACEHOLDER
);
if (manquantes.length) {
  throw new Error(
    `Configuration incomplete pour APP_ENV="${APP_ENV}". ` +
    `Cles absentes ou laissees a "${PLACEHOLDER}" : ${manquantes.join(", ")}. ` +
    `Voir server/.env.example et server/.env.${APP_ENV}.example.`
  );
}

const base = {
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: 5,
};

export const commonPool = new Pool({ ...base, database: process.env.PGDATABASE_COMMON });
export const tenantPool = new Pool({ ...base, database: process.env.PGDATABASE_TENANT });

// Une connexion idle tuée côté serveur (redémarrage de Postgres,
// pg_terminate_backend) émet 'error' sur le pool ; sans écouteur, Node abat
// tout le process (panne dev du 23/09/2026). On trace et on laisse le pool
// recréer ses connexions à la requête suivante.
function surErreurPool(nom) {
  return (err) => {
    console.error(`[db] connexion perdue sur le pool ${nom} : ${err.message}`);
  };
}
commonPool.on("error", surErreurPool("commun"));
tenantPool.on("error", surErreurPool("tenant"));
