// stockageInventaire - archivage et relecture des fichiers de releve
// d'inventaire (#111). Meme pattern documentaire que les preuves
// (stockagePreuves.js) : reception multer en memoire, nom physique neutre,
// hash SHA-256, mode 0640, garde-fou de nom en lecture. Le fichier archive est
// la donnee brute de reference : inventaire_raw ne porte qu'un pointeur
// (commentaire du DDL, revue Samuel), le contenu des lignes est relu ici.
import multer from "multer";
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import { PREUVES_DIR, TAILLE_MAX } from "./stockagePreuves.js";

// Sous-repertoire du volume des preuves : meme sauvegarde, meme exclusion de
// l'arborescence servie par NGINX et du rsync --delete. Les releves ne sont
// pas melanges aux preuves pour que la route de telechargement des preuves
// (NOM_PHYSIQUE_RE restreint a pdf/png/jpg) ne puisse jamais servir un csv.
export const INVENTAIRE_DIR =
  process.env.INVENTAIRE_DIR || path.join(PREUVES_DIR, "inventaire");

export const NB_LIGNES_MAX = 10000;

// Nom physique neutre : jamais le nom d'origine (collisions, accents,
// traversee de chemin). Sert aussi de garde-fou en lecture.
export const NOM_PHYSIQUE_RE = /^[0-9a-f-]{36}\.csv$/i;

// Pointeur porte par inventaire_raw.url_fichier : "<nom physique>#L<n>", n
// etant le numero de ligne physique du releve dans le fichier (l'en-tete est
// en ligne 1). Le pointeur est le seul lien entre la ligne en base et son
// contenu, d'ou une forme stricte et parsee en un seul endroit.
const POINTEUR_RE = /^([0-9a-f-]{36}\.csv)#L(\d+)$/i;

export function pointeur(nomPhysique, ligne) {
  return `${nomPhysique}#L${ligne}`;
}

export function lirePointeur(urlFichier) {
  const m = POINTEUR_RE.exec(urlFichier || "");
  return m ? { nomPhysique: m[1], ligne: Number(m[2]) } : null;
}

export function recevoirUnFichier(champ) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: TAILLE_MAX, files: 1 },
    defParamCharset: "utf8",
  }).single(champ);
}

export function erreurReception(err) {
  if (err.code === "LIMIT_FILE_SIZE")
    return { status: 413, code: 4224, error: "Le fichier depasse la taille maximale de 20 Mo." };
  if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE")
    return { status: 400, code: 4225, error: "Un seul fichier peut etre depose." };
  return null;
}

// Controles de forme : extension csv et contenu decodable en UTF-8. Un csv n'a
// pas de signature binaire ; le controle porte sur l'encodage, un fichier
// binaire renomme en .csv echoue au decodage strict.
export function validerFichier(file) {
  const extension = path.extname(file?.originalname || "").toLowerCase();
  if (extension !== ".csv")
    return { status: 400, code: 4223, error: "Extension non admise. Format accepte : csv." };
  if (!file.buffer.length)
    return { status: 400, code: 4226, error: "Le fichier est vide." };
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(file.buffer);
  } catch {
    return { status: 400, code: 4226, error: "Le fichier n'est pas lisible : encodage UTF-8 attendu." };
  }
  return null;
}

export async function ecrireFichier(file) {
  const nomPhysique = `${crypto.randomUUID()}.csv`;
  const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");
  await fsp.mkdir(INVENTAIRE_DIR, { recursive: true });
  await fsp.writeFile(path.join(INVENTAIRE_DIR, nomPhysique), file.buffer, { mode: 0o640 });
  return { nomPhysique, hash, nomOrigine: (file.originalname || "").slice(0, 255) };
}

export async function supprimerFichier(nomPhysique) {
  if (!NOM_PHYSIQUE_RE.test(nomPhysique || "")) return;
  try {
    await fsp.unlink(path.join(INVENTAIRE_DIR, nomPhysique));
  } catch (e) {
    if (e.code !== "ENOENT") console.error("[stockage] suppression impossible:", e.message);
  }
}

// ---------------------------------------------------------------------------
// Lecture du CSV
// ---------------------------------------------------------------------------

// Colonnes reconnues. Les en-tetes sont normalises (minuscules, accents et
// ponctuation retires) avant comparaison, pour accepter "Quantité",
// "quantite" ou "QTE" indifferemment.
const ALIAS = {
  produit:   ["produit", "id_produit", "libelle", "libelle_produit", "logiciel", "product", "software"],
  reference: ["reference", "reference_constatee", "ref", "reference_client", "identifiant", "cle", "serial"],
  quantite:  ["quantite", "qte", "quantity", "nombre", "nb"],
  societe:   ["societe", "id_societe", "raison_sociale", "entite", "site"],
};

export const COLONNES_OBLIGATOIRES = ["produit", "reference", "quantite"];

function normaliserEntete(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// Delimiteur devine sur la ligne d'en-tete : celui qui la decoupe en le plus
// de colonnes. Un csv francais est en ";", un export anglo-saxon en ",".
function devinerDelimiteur(entete) {
  let meilleur = ";", max = -1;
  for (const d of [";", ",", "\t", "|"]) {
    const n = entete.split(d).length;
    if (n > max) { max = n; meilleur = d; }
  }
  return meilleur;
}

// Analyseur csv minimal, sans dependance : guillemets doubles, guillemet
// double echappe par redoublement, champs multi-lignes entre guillemets,
// fins de ligne CRLF ou LF. Renvoie les enregistrements avec le numero de la
// ligne physique ou chacun commence.
function analyser(texte, delimiteur) {
  const enregistrements = [];
  let champs = [], champ = "", entreGuillemets = false;
  let ligne = 1, debut = 1;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') { champ += '"'; i++; }
        else entreGuillemets = false;
      } else {
        if (c === "\n") ligne++;
        champ += c;
      }
      continue;
    }
    if (c === '"') { entreGuillemets = true; continue; }
    if (c === delimiteur) { champs.push(champ); champ = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") {
      champs.push(champ);
      enregistrements.push({ ligne: debut, champs });
      champs = []; champ = ""; ligne++; debut = ligne;
      continue;
    }
    champ += c;
  }
  if (champ !== "" || champs.length) {
    champs.push(champ);
    enregistrements.push({ ligne: debut, champs });
  }
  return enregistrements;
}

// Decoupe un buffer csv en releves. Renvoie { erreur } (fichier inexploitable
// dans son ensemble) ou { colonnes, releves } avec, par releve :
//   { ligne, produit, reference, quantite (chaine brute), societe }
// Aucune validation de valeur ici : c'est le routeur qui juge ligne a ligne,
// pour que le motif de rejet soit trace dans anomalie_qualite.
export function decouperCsv(buffer) {
  let texte = buffer.toString("utf8");
  if (texte.charCodeAt(0) === 0xfeff) texte = texte.slice(1);
  const premiereLigne = texte.split(/\r?\n/, 1)[0] || "";
  if (!premiereLigne.trim())
    return { erreur: { status: 400, code: 4226, error: "Le fichier est vide." } };

  const delimiteur = devinerDelimiteur(premiereLigne);
  const enregistrements = analyser(texte, delimiteur);
  const entete = (enregistrements.shift()?.champs || []).map(normaliserEntete);

  const colonnes = {};
  for (const [cle, alias] of Object.entries(ALIAS)) {
    const idx = entete.findIndex((h) => alias.includes(h));
    if (idx >= 0) colonnes[cle] = idx;
  }
  const manquantes = COLONNES_OBLIGATOIRES.filter((c) => colonnes[c] === undefined);
  if (manquantes.length)
    return { erreur: {
      status: 400, code: 4227,
      error: `Colonnes obligatoires absentes : ${manquantes.join(", ")}. ` +
             "Attendu : produit (identifiant ou libelle), reference, quantite.",
      details: { colonnes_manquantes: manquantes, entete },
    } };

  const releves = [];
  for (const { ligne, champs } of enregistrements) {
    // Ligne entierement vide : ignoree sans erreur, c'est le cas de la ligne
    // finale apres le dernier retour chariot.
    if (champs.every((v) => !String(v).trim())) continue;
    const lire = (cle) => (colonnes[cle] === undefined ? "" : String(champs[colonnes[cle]] ?? "").trim());
    releves.push({
      ligne,
      produit: lire("produit"),
      reference: lire("reference"),
      quantite: lire("quantite"),
      societe: lire("societe"),
    });
  }
  return { colonnes, delimiteur, releves };
}

// Relecture d'un fichier archive, indexee par numero de ligne physique. Les
// fichiers archives sont immuables (jamais reecrits sous le meme nom) : un
// cache borne evite de reparser le meme fichier a chaque affichage de liste.
const cache = new Map();
const CACHE_MAX = 32;

export async function lireFichierArchive(nomPhysique) {
  if (!NOM_PHYSIQUE_RE.test(nomPhysique || "")) return null;
  if (cache.has(nomPhysique)) return cache.get(nomPhysique);
  let buffer;
  try {
    buffer = await fsp.readFile(path.join(INVENTAIRE_DIR, nomPhysique));
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
  const resultat = decouperCsv(buffer);
  const parLigne = new Map();
  for (const r of resultat.releves || []) parLigne.set(r.ligne, r);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(nomPhysique, parLigne);
  return parLigne;
}

// Enrichit des lignes inventaire_raw avec le contenu relu du fichier. Une
// ligne dont le fichier a disparu ressort avec contenu null et
// fichier_absent true : la base reste la reference, l'ecran signale le trou.
export async function joindreContenu(lignes) {
  const fichiers = new Map();
  for (const l of lignes) {
    const p = lirePointeur(l.url_fichier);
    if (p && !fichiers.has(p.nomPhysique)) fichiers.set(p.nomPhysique, null);
  }
  await Promise.all([...fichiers.keys()].map(async (nom) => {
    fichiers.set(nom, await lireFichierArchive(nom));
  }));
  return lignes.map((l) => {
    const p = lirePointeur(l.url_fichier);
    const contenu = p ? fichiers.get(p.nomPhysique)?.get(p.ligne) ?? null : null;
    return {
      ...l,
      fichier: p?.nomPhysique ?? null,
      ligne: p?.ligne ?? null,
      fichier_absent: !!p && !fichiers.get(p.nomPhysique),
      produit: contenu?.produit ?? null,
      reference: contenu?.reference ?? null,
      quantite: contenu ? Number(contenu.quantite) : null,
      societe_csv: contenu?.societe || null,
    };
  });
}
