import express from "express";
import { tenantPool } from "../db.js";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const router = express.Router();

// Convention du projet : helper de journalisation local a chaque routeur.
async function log(client, action, entite_type, entite_id, description, payload) {
  try {
    await client.query(
      `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [action, entite_type, entite_id || null, description, payload ? JSON.stringify(payload) : null]
    );
  } catch (e) {
    console.error("[journal] log failed:", e.message);
  }
}

// Garde-fou : un :id non UUID part sinon en Postgres et ressort en 500 illisible
// la ou la preuve est simplement introuvable.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Empreinte SHA-256 : 64 caracteres hexadecimaux, soit exactement la taille de
// la colonne VARCHAR(64). Sans ce controle, une saisie plus longue produirait
// une 22001 brute remontee en 500.
const SHA256_RE = /^[0-9a-f]{64}$/i;

// Projection identique en liste et en detail : garantit qu'aucun champ
// n'apparaisse dans un ecran et pas dans l'autre.
// nb_factures est servi des la liste, et non seulement sur le detail : c'est le
// compteur qui bloque la suppression, le front doit pouvoir griser l'action
// sans une requete par ligne.
const SELECT_PREUVE = `
  SELECT p.id, p.label,
         p.id_type_preuve, tp.code AS type_code, tp.label AS type_label,
         p.id_contrat,     ct.label AS contrat_label,
         p.id_commande,    cm.label AS commande_label,
         p.url_fichier, p.hash_sha256, p.nom_origine, p.created_at,
         (SELECT count(*) FROM facture f WHERE f.id_preuve = p.id)::int AS nb_factures
  FROM preuve p
  LEFT JOIN type_preuve tp ON tp.id = p.id_type_preuve
  LEFT JOIN contrat     ct ON ct.id = p.id_contrat
  LEFT JOIN commande    cm ON cm.id = p.id_commande`;

// nom_origine en est volontairement absent : il n'est pas saisissable, seul
// le depot de la #49 le renseigne, en meme temps que url_fichier et le hash.
// Ordre identique aux $n de l'INSERT et de l'UPDATE.
const CHAMPS = [
  "label", "id_type_preuve", "id_contrat", "id_commande", "url_fichier", "hash_sha256",
];

// Filtres de liste : premier usage de query params dans les CRUD du projet.
// Forme reprise de GET /commandes/agregats, validation UUID puis clause
// construite, pour garder une requete unique quel que soit le nombre de
// filtres actifs.
const FILTRES = {
  id_type_preuve: "p.id_type_preuve",
  id_contrat: "p.id_contrat",
  id_commande: "p.id_commande",
};

function construireFiltres(query) {
  const clauses = [];
  const params = [];
  for (const [param, colonne] of Object.entries(FILTRES)) {
    const valeur = query[param];
    if (valeur === undefined || valeur === "") continue;
    if (!UUID_RE.test(valeur)) return { erreur: `Valeur de filtre invalide pour ${param}.` };
    params.push(valeur);
    clauses.push(`${colonne} = $${params.length}::uuid`);
  }
  return { clause: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

// Verifie l'existence d'une reference. Evite qu'un UUID inconnu remonte en
// 23503 brute transformee en 500 illisible. Un id absent est valide : c'est
// la validation de presence qui tranche, pas celle d'existence.
async function existe(client, table, id) {
  if (!id) return true;
  // Une reference malformee ne doit pas partir en Postgres : elle ressortirait
  // en 22P02 brute remontee en 500, la ou la reference est simplement
  // introuvable. Meme doctrine que le garde-fou UUID sur les :id de route.
  if (!UUID_RE.test(id)) return false;
  const { rowCount } = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return rowCount > 0;
}

// Un select vide envoie "" et non null. Sans cette normalisation, "" part sur
// une colonne UUID et produit une 22P02 brute remontee en 500.
function normaliserCorps(body = {}) {
  const vide = (v) => (v === "" || v === undefined ? null : v);
  return {
    label: body.label ?? "",
    id_type_preuve: vide(body.id_type_preuve),
    id_contrat: vide(body.id_contrat),
    id_commande: vide(body.id_commande),
    url_fichier: vide(body.url_fichier),
    hash_sha256: vide(body.hash_sha256),
  };
}

async function validerPreuve(client, body) {
  const { label, id_type_preuve, id_contrat, id_commande, url_fichier, hash_sha256 } = body;

  // code_retour: 3211
  if (!label || !label.trim())
    return { status: 400, error: "Le libelle est obligatoire." };
  // code_retour: 3212
  if (!id_type_preuve)
    return { status: 400, error: "Le type de preuve est obligatoire." };
  // code_retour: 3213
  if (!(await existe(client, "type_preuve", id_type_preuve)))
    return { status: 400, error: "Type de preuve introuvable." };
  // code_retour: 3214
  // Regle metier de la #48 : une preuve sans rattachement est orpheline, elle
  // ne serait atteignable ni par un contrat ni par une commande. Le DDL laisse
  // les deux colonnes nullables, c'est l'API qui porte la contrainte.
  if (!id_contrat && !id_commande)
    return { status: 400, error: "Une preuve doit etre rattachee a un contrat, a une commande, ou aux deux." };
  // code_retour: 3215
  if (!(await existe(client, "contrat", id_contrat)))
    return { status: 400, error: "Contrat introuvable." };
  // code_retour: 3216
  if (!(await existe(client, "commande", id_commande)))
    return { status: 400, error: "Commande introuvable." };
  // code_retour: 3217
  // url_fichier est NOT NULL en base (002_tenant_schema.sql:351). Decision du
  // 11/08 : on ne migre pas, le champ est donc obligatoire des la #48. En #49
  // il sera renseigne par le module de depot et non plus par le client, sans
  // changement de ce contrat d'API.
  // [ARBITRAGE D27] en attente : aucun controle de format n'est applique ici,
  // ni exigence d'un chemin de stockage, ni acceptation explicite d'une URL
  // http/https de GED. La chaine est stockee telle quelle. La regle viendra se
  // brancher a cet endroit precis, code 3231 reserve.
  if (!url_fichier || !url_fichier.trim())
    return { status: 400, error: "Le chemin du fichier est obligatoire." };
  // code_retour: 3218
  // Le hash reste facultatif : le rendre obligatoire prejugerait de D27, qui
  // prevoit justement un hash NULL pour un lien externe. Seul son format est
  // verifie quand il est fourni.
  if (hash_sha256 && !SHA256_RE.test(hash_sha256))
    return { status: 400, error: "L'empreinte SHA-256 doit comporter 64 caracteres hexadecimaux." };
  return null;
}

router.get("/preuves", async (req, res) => {
  try {
    const filtres = construireFiltres(req.query);
    // code_retour: 3219
    if (filtres.erreur) return res.status(400).json({ error: filtres.erreur });

    const { rows } = await tenantPool.query(
      `${SELECT_PREUVE} ${filtres.clause} ORDER BY p.created_at DESC, p.label`,
      filtres.params
    );
    // code_retour: 3200
    res.json(rows);
  } catch (err) {
    console.error("GET /preuves error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/preuves/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // code_retour: 3210
    if (!UUID_RE.test(id)) return res.status(404).json({ error: "Preuve introuvable." });

    const { rows } = await tenantPool.query(`${SELECT_PREUVE} WHERE p.id = $1`, [id]);
    // code_retour: 3210
    if (!rows.length) return res.status(404).json({ error: "Preuve introuvable." });

    // code_retour: 3201
    res.json(rows[0]);
  } catch (err) {
    console.error("GET /preuves/:id error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/preuves", async (req, res) => {
  const corps = normaliserCorps(req.body);
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const invalide = await validerPreuve(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return res.status(invalide.status).json({ error: invalide.error });
    }

    const label = corps.label.trim();
    const { rows: [creee] } = await client.query(
      `INSERT INTO preuve (${CHAMPS.join(", ")})
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [label, corps.id_type_preuve, corps.id_contrat, corps.id_commande,
       corps.url_fichier, corps.hash_sha256]
    );

    await log(client, "CREATE", "preuve", creee.id, `Creation de la preuve "${label}"`, corps);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_PREUVE} WHERE p.id = $1`, [creee.id]);
    // code_retour: 3202
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /preuves error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/preuves/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    // code_retour: 3210
    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Preuve introuvable." });
    }

    const { rows: existant } = await client.query(
      `SELECT label, id_type_preuve, id_contrat, id_commande, url_fichier, hash_sha256
       FROM preuve WHERE id = $1`, [id]);
    // code_retour: 3210
    if (!existant.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Preuve introuvable." });
    }

    // Fusion avant validation : un PATCH partiel ne doit pas echouer sur un
    // champ obligatoire qui n'a simplement pas ete transmis. hasOwnProperty
    // distingue le champ absent du champ volontairement mis a null.
    const patch = normaliserCorps(req.body);
    const corps = { ...existant[0] };
    for (const champ of CHAMPS) {
      if (Object.prototype.hasOwnProperty.call(req.body, champ)) corps[champ] = patch[champ];
    }

    const invalide = await validerPreuve(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return res.status(invalide.status).json({ error: invalide.error });
    }

    // Pas de updated_at : la table preuve n'en porte pas (002_tenant_schema.sql:344).
    const label = corps.label.trim();
    await client.query(
      `UPDATE preuve
          SET label = $1, id_type_preuve = $2, id_contrat = $3, id_commande = $4,
              url_fichier = $5, hash_sha256 = $6
        WHERE id = $7`,
      [label, corps.id_type_preuve, corps.id_contrat, corps.id_commande,
       corps.url_fichier, corps.hash_sha256, id]
    );

    await log(client, "UPDATE", "preuve", id, `Modification de la preuve "${label}"`, patch);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_PREUVE} WHERE p.id = $1`, [id]);
    // code_retour: 3203
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /preuves/:id error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/preuves/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    // code_retour: 3210
    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Preuve introuvable." });
    }

    const { rows: existant } = await client.query(`SELECT label, url_fichier FROM preuve WHERE id = $1`, [id]);
    // code_retour: 3210
    if (!existant.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Preuve introuvable." });
    }

    // Seule FK entrante de preuve dans le DDL v4 : facture.id_preuve. Supprimer
    // la preuve laisserait la facture sans justificatif, ce que la #50 compte
    // precisement detecter comme un manque.
    const { rows: [liens] } = await client.query(
      `SELECT count(*)::int AS factures FROM facture WHERE id_preuve = $1`, [id]);

    if (liens.factures) {
      await client.query("ROLLBACK");
      // code_retour: 3230
      return res.status(409).json({
        error: `Suppression impossible : cette preuve est rattachee a ${liens.factures} facture(s).`,
        details: liens,
      });
    }

    await client.query(`DELETE FROM preuve WHERE id = $1`, [id]);
    await log(client, "DELETE", "preuve", id, `Suppression de la preuve "${existant[0].label}"`, null);
    await client.query("COMMIT");

    // Le fichier physique ne survit pas a sa preuve : sans cela le stockage
    // accumulerait des orphelins qu'aucune ligne ne reference plus. Supprime
    // apres le COMMIT, pour ne pas le perdre si la transaction echouait.
    await supprimerFichier(existant[0].url_fichier);
    // code_retour: 3204
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /preuves/:id error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Depot et telechargement du fichier de preuve (#49)
// ---------------------------------------------------------------------------

// Repertoire de stockage. Il doit rester hors de l'arborescence servie par
// NGINX et hors du repertoire synchronise par le rsync --delete des workflows :
// un fichier depose sous /var/www/samsecure serait efface au prochain
// deploiement, ou expose en HTTP par un alias. Configurable pour que le poste
// de developpement et le staging ne partagent pas le meme stockage.
const PREUVES_DIR = process.env.PREUVES_DIR || "/var/lib/samsecure/preuves";

// Extensions admises et type MIME de sortie. La table sert dans les deux sens :
// filtrage a l'entree, en-tete Content-Type au telechargement.
const TYPES_ADMIS = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const TAILLE_MAX = 20 * 1024 * 1024;

// Signature binaire attendue en tete de fichier. Le filtrage par extension seul
// se contourne en renommant un .exe en .pdf : on verifie donc que le contenu
// est bien du type annonce. Ce n'est pas un antivirus, explicitement hors
// perimetre de la tache.
const SIGNATURES = {
  ".pdf": [0x25, 0x50, 0x44, 0x46],
  ".png": [0x89, 0x50, 0x4e, 0x47],
  ".jpg": [0xff, 0xd8, 0xff],
  ".jpeg": [0xff, 0xd8, 0xff],
};

function signatureValide(buffer, extension) {
  const attendue = SIGNATURES[extension];
  if (!attendue || buffer.length < attendue.length) return false;
  return attendue.every((octet, i) => buffer[i] === octet);
}

// Nom physique neutre et unique : jamais le nom d'origine, qui porterait des
// collisions, des accents, des espaces et d'eventuelles sequences de traversee
// de chemin. Le nom d'origine est conserve en base dans preuve.nom_origine
// (migration 019). Ce motif sert aussi de garde-fou en lecture : il distingue
// un fichier reellement depose d'une valeur d'url_fichier saisie librement par
// le POST /preuves de la #48.
const NOM_PHYSIQUE_RE = /^[0-9a-f-]{36}\.(pdf|png|jpe?g)$/i;

// multer en memoire : le fichier n'atteint le disque qu'une fois toutes les
// validations passees, ce qui evite les fichiers orphelins quand un controle
// echoue. La limite de taille est appliquee par multer avant meme que le corps
// soit entierement lu.
const recevoirFichier = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAILLE_MAX, files: 1 },
  // Sans cela multer decode le nom du fichier en latin1, defaut de busboy : un
  // nom accentue arriverait en mojibake et serait stocke tel quel en base puis
  // renvoye au telechargement.
  defParamCharset: "utf8",
}).single("fichier");

// Trace probante, distincte du journal fonctionnel : audit_log porte
// l'utilisateur, l'adresse IP et les valeurs avant et apres, que
// journal_ecriture ne modelise pas.
// Contrairement a log(), cette fonction n'avale pas ses erreurs : une trace
// probante manquante doit faire echouer le depot, pas passer inapercue.
async function audit(client, req, action, entiteId, avant, apres) {
  await client.query(
    `INSERT INTO audit_log (id_utilisateur, action, entite_type, entite_id,
                            valeur_avant, valeur_apres, ip_address)
     VALUES ($1, $2, 'preuve', $3, $4, $5, $6)`,
    [req.user?.id || null, action, entiteId,
     avant ? JSON.stringify(avant) : null,
     apres ? JSON.stringify(apres) : null,
     (req.ip || "").slice(0, 45)]
  );
}

// Suppression toleree : un fichier deja absent ne doit pas faire echouer
// l'operation metier, la base restant la reference.
async function supprimerFichier(nomPhysique) {
  if (!NOM_PHYSIQUE_RE.test(nomPhysique || "")) return;
  try {
    await fsp.unlink(path.join(PREUVES_DIR, nomPhysique));
  } catch (e) {
    if (e.code !== "ENOENT") console.error("[stockage] suppression impossible:", e.message);
  }
}

async function deposerFichier(req, res) {
  const { id } = req.params;
  // code_retour: 3210
  if (!UUID_RE.test(id)) return res.status(404).json({ error: "Preuve introuvable." });
  // code_retour: 3220
  if (!req.file) return res.status(400).json({ error: "Aucun fichier n'a ete transmis." });

  const extension = path.extname(req.file.originalname || "").toLowerCase();
  // code_retour: 3221
  if (!TYPES_ADMIS[extension])
    return res.status(400).json({ error: "Extension non admise. Formats acceptes : pdf, png, jpg, jpeg." });
  // code_retour: 3223
  if (!signatureValide(req.file.buffer, extension))
    return res.status(400).json({ error: "Le contenu du fichier ne correspond pas a son extension." });

  // Hash calcule sur le contenu recu, avant toute ecriture : c'est la valeur
  // probante d'audit du schema, elle doit correspondre au fichier servi.
  const hash = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
  const nomPhysique = `${crypto.randomUUID()}${extension}`;
  const nomOrigine = (req.file.originalname || "").slice(0, 255);

  const client = await tenantPool.connect();
  let ecritSurDisque = false;
  try {
    await client.query("BEGIN");

    const { rows: existant } = await client.query(
      `SELECT label, url_fichier, hash_sha256, nom_origine FROM preuve WHERE id = $1`, [id]);
    // code_retour: 3210
    if (!existant.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Preuve introuvable." });
    }
    const avant = existant[0];
    const remplacement = NOM_PHYSIQUE_RE.test(avant.url_fichier || "");

    await fsp.mkdir(PREUVES_DIR, { recursive: true });
    await fsp.writeFile(path.join(PREUVES_DIR, nomPhysique), req.file.buffer, { mode: 0o640 });
    ecritSurDisque = true;

    await client.query(
      `UPDATE preuve SET url_fichier = $1, hash_sha256 = $2, nom_origine = $3 WHERE id = $4`,
      [nomPhysique, hash, nomOrigine, id]);

    await audit(client, req, remplacement ? "REMPLACEMENT_FICHIER" : "DEPOT_FICHIER", id,
      remplacement
        ? { url_fichier: avant.url_fichier, hash_sha256: avant.hash_sha256, nom_origine: avant.nom_origine }
        : null,
      { url_fichier: nomPhysique, hash_sha256: hash, nom_origine: nomOrigine, taille: req.file.size });

    await log(client, "UPDATE", "preuve", id,
      `${remplacement ? "Remplacement" : "Depot"} du fichier de la preuve "${avant.label}"`,
      { nom_origine: nomOrigine, hash_sha256: hash });

    await client.query("COMMIT");

    // L'ancien fichier n'est supprime qu'apres le COMMIT : le supprimer avant
    // le ferait perdre si la transaction echouait.
    if (remplacement && avant.url_fichier !== nomPhysique) await supprimerFichier(avant.url_fichier);

    const { rows } = await tenantPool.query(`${SELECT_PREUVE} WHERE p.id = $1`, [id]);
    // code_retour: 3205
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    // Le fichier ecrit avant l'echec ne doit pas rester orphelin sur le disque.
    if (ecritSurDisque) await supprimerFichier(nomPhysique);
    console.error("POST /preuves/:id/fichier error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
}

// multer est appele en fonction et non en middleware : c'est le seul moyen de
// traduire ses erreurs, notamment le depassement de taille, dans le format de
// reponse du projet plutot que de les laisser filer au handler global.
router.post("/preuves/:id/fichier", (req, res) => {
  recevoirFichier(req, res, (err) => {
    if (err) {
      // code_retour: 3222
      if (err.code === "LIMIT_FILE_SIZE")
        return res.status(413).json({ error: "Le fichier depasse la taille maximale de 20 Mo." });
      // code_retour: 3227
      if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE")
        return res.status(400).json({ error: "Un seul fichier peut etre depose, dans le champ fichier." });
      console.error("POST /preuves/:id/fichier multipart error", err);
      // code_retour: 3220
      return res.status(400).json({ error: "Aucun fichier n'a ete transmis." });
    }
    deposerFichier(req, res);
  });
});

router.get("/preuves/:id/fichier", async (req, res) => {
  const { id } = req.params;
  try {
    // code_retour: 3210
    if (!UUID_RE.test(id)) return res.status(404).json({ error: "Preuve introuvable." });

    const { rows } = await tenantPool.query(
      `SELECT url_fichier, nom_origine FROM preuve WHERE id = $1`, [id]);
    // code_retour: 3210
    if (!rows.length) return res.status(404).json({ error: "Preuve introuvable." });

    const { url_fichier, nom_origine } = rows[0];

    // [ARBITRAGE D27] en attente : si le lien GED externe est retenu, c'est ici
    // qu'une url_fichier en http/https donnera lieu a une redirection plutot
    // qu'a un acces disque, code 3232 reserve au pre-catalogue. Dans l'attente,
    // seul un fichier depose par cette tache est servi.
    // code_retour: 3224
    if (!NOM_PHYSIQUE_RE.test(url_fichier || ""))
      return res.status(404).json({ error: "Aucun fichier n'a ete depose pour cette preuve." });

    // Garde-fou de traversee de chemin : url_fichier a pu etre saisi librement
    // par le POST /preuves de la #48. Le motif ci-dessus l'interdit deja, la
    // resolution le verifie une seconde fois avant tout acces disque.
    const racine = path.resolve(PREUVES_DIR);
    const chemin = path.resolve(racine, url_fichier);
    // code_retour: 3226
    if (!chemin.startsWith(racine + path.sep))
      return res.status(404).json({ error: "Aucun fichier n'a ete depose pour cette preuve." });

    if (!fs.existsSync(chemin)) {
      console.error(`[stockage] fichier absent du disque pour la preuve ${id} : ${url_fichier}`);
      // code_retour: 3225
      return res.status(404).json({ error: "Le fichier est introuvable dans le stockage." });
    }

    const extension = path.extname(url_fichier).toLowerCase();
    const nom = nom_origine || `preuve${extension}`;
    // Repli ASCII pour les clients anciens, filename* en RFC 5987 pour que les
    // accents du nom d'origine survivent sur les clients modernes.
    const nomAscii = nom.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");

    res.setHeader("Content-Type", TYPES_ADMIS[extension] || "application/octet-stream");
    // Disposition inline : le PDF s'ouvre dans le lecteur natif du navigateur,
    // apercu et bouton de telechargement compris, sans visionneuse a ecrire.
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${nomAscii}"; filename*=UTF-8''${encodeURIComponent(nom)}`
    );
    // sendFile avec root plutot qu'un chemin absolu : send() applique sa
    // politique dotfiles a l'integralite d'un chemin absolu et refuserait un
    // repertoire de stockage situe sous un dossier commencant par un point.
    // Avec root, seule la partie relative est examinee, et send verifie lui
    // meme qu'elle ne sort pas de la racine : le garde-fou de traversee est
    // ainsi double. Le callback est indispensable, l'erreur d'envoi etant
    // asynchrone elle echapperait au try/catch et finirait au handler global.
    // code_retour: 3206
    res.sendFile(url_fichier, { root: racine }, (err) => {
      if (!err) return;
      if (res.headersSent) return console.error("GET /preuves/:id/fichier interrompu", err.message);
      console.error("GET /preuves/:id/fichier envoi impossible", err);
      // code_retour: 3225
      res.status(404).json({ error: "Le fichier est introuvable dans le stockage." });
    });
  } catch (err) {
    console.error("GET /preuves/:id/fichier error", err);
    // code_retour: 3299
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
