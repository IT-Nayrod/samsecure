// Règles de stockage des fichiers de preuve, partagées par le
// dépôt simple (/api/preuves/:id/fichier) et le dépôt combiné
// (/api/factures/depot). Volontairement pas un helper local à chaque routeur,
// contrairement au journal : une liste d'extensions ou une signature qui
// divergerait entre les deux points d'entrée ouvrirait un contournement.
import multer from "multer";
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";

// Répertoire de stockage. Il doit rester hors de l'arborescence servie par
// NGINX et hors du répertoire synchronisé par le rsync --delete des workflows :
// un fichier déposé sous /var/www/samsecure serait effacé au prochain
// déploiement, ou exposé en HTTP par un alias.
export const PREUVES_DIR = process.env.PREUVES_DIR || "/var/lib/samsecure/preuves";

// Extensions admises et type MIME de sortie. La table sert dans les deux sens :
// filtrage à l'entrée, en-tête Content-Type au téléchargement.
export const TYPES_ADMIS = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export const TAILLE_MAX = 20 * 1024 * 1024;

// Signature binaire attendue en tête de fichier. Le filtrage par extension seul
// se contourne en renommant un .exe en .pdf : on vérifie donc que le contenu
// est bien du type annoncé. Ce n'est pas un antivirus, hors périmètre.
const SIGNATURES = {
  ".pdf": [0x25, 0x50, 0x44, 0x46],
  ".png": [0x89, 0x50, 0x4e, 0x47],
  ".jpg": [0xff, 0xd8, 0xff],
  ".jpeg": [0xff, 0xd8, 0xff],
};

// Nom physique neutre et unique : jamais le nom d'origine, qui porterait des
// collisions, des accents, des espaces et d'éventuelles séquences de traversée
// de chemin. Ce motif sert aussi de garde-fou en lecture : il distingue un
// fichier réellement déposé d'une valeur d'url_fichier saisie librement.
export const NOM_PHYSIQUE_RE = /^[0-9a-f-]{36}\.(pdf|png|jpe?g)$/i;

// multer en mémoire : le fichier n'atteint le disque qu'une fois toutes les
// validations passées, ce qui évite les fichiers orphelins quand un contrôle
// échoue. defParamCharset sinon le nom d'origine est décodé en latin1, défaut
// de busboy, et un nom accentué arrive en mojibake.
export function recevoirUnFichier(champ) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: TAILLE_MAX, files: 1 },
    defParamCharset: "utf8",
  }).single(champ);
}

// Traduit les erreurs multer dans le format de réponse du projet. Renvoyer null
// signifie que l'erreur n'est pas une erreur de réception connue.
export function erreurReception(err) {
  if (err.code === "LIMIT_FILE_SIZE")
    return { status: 413, code: 3222, error: "Le fichier depasse la taille maximale de 20 Mo." };
  if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE")
    return { status: 400, code: 3227, error: "Un seul fichier peut etre depose." };
  return null;
}

// Contrôles de forme du fichier reçu. Renvoie null si tout va bien, sinon
// { status, error } dans la même convention que les validations de corps.
export function validerFichier(file) {
  const extension = path.extname(file?.originalname || "").toLowerCase();
  if (!TYPES_ADMIS[extension])
    return { status: 400, code: 3221, error: "Extension non admise. Formats acceptes : pdf, png, jpg, jpeg." };
  const attendue = SIGNATURES[extension];
  if (!attendue || file.buffer.length < attendue.length ||
      !attendue.every((octet, i) => file.buffer[i] === octet))
    return { status: 400, code: 3223, error: "Le contenu du fichier ne correspond pas a son extension." };
  return null;
}

// Écrit le fichier sous un nom neutre et renvoie de quoi renseigner la preuve.
// Le hash est calculé sur le contenu reçu : c'est la valeur probante d'audit du
// schéma, elle doit correspondre au fichier servi.
export async function ecrireFichier(file) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  const nomPhysique = `${crypto.randomUUID()}${extension}`;
  const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");
  await fsp.mkdir(PREUVES_DIR, { recursive: true });
  await fsp.writeFile(path.join(PREUVES_DIR, nomPhysique), file.buffer, { mode: 0o640 });
  return { nomPhysique, hash, nomOrigine: (file.originalname || "").slice(0, 255) };
}

// Suppression tolérée : un fichier déjà absent ne doit pas faire échouer
// l'opération métier, la base restant la référence.
export async function supprimerFichier(nomPhysique) {
  if (!NOM_PHYSIQUE_RE.test(nomPhysique || "")) return;
  try {
    await fsp.unlink(path.join(PREUVES_DIR, nomPhysique));
  } catch (e) {
    if (e.code !== "ENOENT") console.error("[stockage] suppression impossible:", e.message);
  }
}
