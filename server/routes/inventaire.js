// inventaire - import manuel de releves, consultation, ecarts et rapprochement
// (#111, module 3 C1 a C3).
//
// Doctrine actee : l'outil constate et alerte, il ne cree ni ne modifie jamais
// une affectation. Le rapprochement est manuel : un utilisateur associe une
// ligne constatee a une affectation existante, ou la marque en ecart assume.
//
// Aucune modification du schema v4. Ce que le schema ne modelise pas est porte
// par les tables existantes :
//   - inventaire_raw : une ligne par releve, url_fichier = "<fichier>#L<n>"
//     (pointeur vers le fichier archive et la ligne), contenu relu du fichier
//     (utils/stockageInventaire.js) ;
//   - log_import.type_import = "inventaire_csv:<fichier>" : lien import <->
//     fichier archive, donc import <-> releves ;
//   - anomalie_qualite : une ligne par erreur de ligne (entite log_import).
import express from "express";
import { tenantPool, commonPool } from "../db.js";
import { succes, erreur, erreurPivot } from "../utils/reponse.js";
import { auditer } from "../utils/audit.js";
import {
  recevoirUnFichier, erreurReception, validerFichier, ecrireFichier, supprimerFichier,
  decouperCsv, joindreContenu, pointeur, lirePointeur, NB_LIGNES_MAX,
} from "../utils/stockageInventaire.js";

const router = express.Router();

// Helper de journalisation local au routeur, convention du projet (voir
// preuves.js). id_auteur lu dans req.user, jamais un id arbitraire.
async function log(client, req, action, entite_type, entite_id, description, payload) {
  try {
    await client.query(
      `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, id_auteur, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [action, entite_type, entite_id || null, description, req?.user?.id || null,
       payload ? JSON.stringify(payload) : null]
    );
  } catch (e) {
    console.error("[journal] log failed:", e.message);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIXE_IMPORT = "inventaire_csv:";
const STATUTS = ["en_attente", "rapproche", "ecart_detecte", "rejete"];

// Cle de comparaison des references : insensible a la casse et aux espaces.
// C'est la seule regle de detection de candidate, volontairement stricte :
// un rapprochement approximatif serait une decision, et la decision est
// humaine.
const cleRef = (s) => String(s ?? "").replace(/\s+/g, "").toLowerCase();

const nomFichierImport = (typeImport) =>
  typeImport?.startsWith(PREFIXE_IMPORT) ? typeImport.slice(PREFIXE_IMPORT.length) : null;

// ---------------------------------------------------------------------------
// Resolution des produits. licence.id_produit et la colonne produit d'un
// releve peuvent designer produit_referentiel (BDD Commune) ou produit_client
// (Tenant) : les deux bases sont interrogees, l'API fait le pont.
// ---------------------------------------------------------------------------
async function libellesProduits(ids) {
  const uniques = [...new Set(ids.filter((id) => id && UUID_RE.test(id)))];
  const map = new Map();
  if (!uniques.length) return map;
  const [{ rows: clients }, commune] = await Promise.all([
    tenantPool.query(`SELECT id, label FROM produit_client WHERE id = ANY($1::uuid[])`, [uniques]),
    commonPool.query(`SELECT id, label FROM produit_referentiel WHERE id = ANY($1::uuid[])`, [uniques])
      .catch((e) => { console.error("[inventaire] BDD Commune inaccessible:", e.message); return { rows: [] }; }),
  ]);
  for (const r of [...commune.rows, ...clients]) map.set(r.id, r.label);
  return map;
}

// ---------------------------------------------------------------------------
// Affectations : projection commune a la liste des rapprochables, aux
// candidates et aux ecarts. Une affectation est un usage declare.
// ---------------------------------------------------------------------------
const SELECT_AFFECTATION = `
  SELECT a.id, a.label, a.reference_client, a.quantite, a.id_societe, s.raison_sociale AS societe_label,
         a.id_licence, l.label AS licence_label, l.id_produit, a.created_at,
         (SELECT count(*) FROM inventaire_raw ir
           WHERE ir.id_affectation = a.id AND ir.statut_rapprochement = 'rapproche')::int AS nb_releves_rapproches
  FROM affectation a
  LEFT JOIN licence l ON l.id = a.id_licence
  LEFT JOIN societe s ON s.id = a.id_societe`;

async function chargerAffectations(client = tenantPool) {
  const { rows } = await client.query(`${SELECT_AFFECTATION} ORDER BY a.created_at DESC`);
  const libelles = await libellesProduits(rows.map((r) => r.id_produit));
  for (const r of rows) r.produit_label = libelles.get(r.id_produit) ?? null;
  return rows;
}

function indexParReference(affectations) {
  const index = new Map();
  for (const a of affectations) {
    const k = cleRef(a.reference_client);
    if (!k) continue;
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(a);
  }
  return index;
}

// Un releve porte son affectation rapprochee (id_affectation) et, tant qu'il
// n'est pas rapproche, ses candidates : les affectations de meme reference.
// Les candidates sont calculees a la lecture, jamais ecrites.
function joindreAffectations(lignes, affectations) {
  const parId = new Map(affectations.map((a) => [a.id, a]));
  const parRef = indexParReference(affectations);
  return lignes.map((l) => {
    const affectation = l.id_affectation ? parId.get(l.id_affectation) ?? null : null;
    const candidates = l.id_affectation ? [] : (parRef.get(cleRef(l.reference)) ?? []);
    return {
      ...l,
      affectation_label: affectation?.label ?? affectation?.reference_client ?? null,
      affectation_reference: affectation?.reference_client ?? null,
      affectation_produit_label: affectation?.produit_label ?? null,
      candidates: candidates.map((a) => ({
        id: a.id, label: a.label, reference_client: a.reference_client, quantite: a.quantite,
        produit_label: a.produit_label, licence_label: a.licence_label, societe_label: a.societe_label,
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Releves : projection et enrichissement (contenu relu du fichier, produit
// resolu, affectation et candidates).
// ---------------------------------------------------------------------------
const SELECT_RELEVE = `
  SELECT ir.id, ir.id_societe, s.raison_sociale AS societe_label,
         ir.url_fichier, ir.format_source, ir.statut_rapprochement, ir.id_affectation, ir.created_at,
         li.id AS id_import, li.created_at AS date_import
  FROM inventaire_raw ir
  LEFT JOIN societe s ON s.id = ir.id_societe
  LEFT JOIN log_import li ON li.type_import = '${PREFIXE_IMPORT}' || split_part(ir.url_fichier, '#', 1)`;

async function enrichirReleves(rows, affectations) {
  const avecContenu = await joindreContenu(rows);
  const libelles = await libellesProduits(avecContenu.map((l) => l.produit));
  for (const l of avecContenu) {
    l.produit_label = l.produit && UUID_RE.test(l.produit)
      ? libelles.get(l.produit) ?? l.produit
      : l.produit;
  }
  return joindreAffectations(avecContenu, affectations ?? await chargerAffectations());
}

const FILTRES = {
  id_societe: "ir.id_societe",
  id_affectation: "ir.id_affectation",
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
  if (query.statut !== undefined && query.statut !== "") {
    if (!STATUTS.includes(query.statut)) return { erreur: "Valeur de filtre invalide pour statut." };
    params.push(query.statut);
    clauses.push(`ir.statut_rapprochement = $${params.length}`);
  }
  if (query.id_import !== undefined && query.id_import !== "") {
    if (!UUID_RE.test(query.id_import)) return { erreur: "Valeur de filtre invalide pour id_import." };
    params.push(query.id_import);
    clauses.push(`li.id = $${params.length}::uuid`);
  }
  return { clause: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

// ---------------------------------------------------------------------------
// C1 : import d'un fichier de releve
// ---------------------------------------------------------------------------
const SELECT_IMPORT = `
  SELECT li.id, li.type_import, li.nb_lignes_total, li.statut, li.created_at,
         li.id_utilisateur, u.nom AS auteur_nom, u.prenom AS auteur_prenom, u.email AS auteur_email,
         (SELECT count(*) FROM anomalie_qualite aq
           WHERE aq.entite_type = 'log_import' AND aq.entite_id = li.id)::int AS nb_erreurs,
         (SELECT count(*) FROM inventaire_raw ir
           WHERE ir.url_fichier LIKE substr(li.type_import, ${PREFIXE_IMPORT.length + 1}) || '#%')::int AS nb_releves
  FROM log_import li
  LEFT JOIN utilisateur u ON u.id = li.id_utilisateur
  WHERE li.type_import LIKE '${PREFIXE_IMPORT}%'`;

function projeterImport(r) {
  return { ...r, fichier: nomFichierImport(r.type_import) };
}

router.post("/inventaire/imports", (req, res) => {
  recevoirUnFichier("fichier")(req, res, async (err) => {
    if (err) {
      const pivot = erreurReception(err);
      if (pivot) return erreurPivot(res, pivot);
      console.error(err);
      return erreur(res, 4099, { status: 500, message: "Erreur serveur" });
    }
    if (!req.file) return erreur(res, 4022, { status: 400, message: "Aucun fichier n'a ete transmis." });
    const invalide = validerFichier(req.file);
    if (invalide) return erreurPivot(res, invalide);

    const decoupe = decouperCsv(req.file.buffer);
    if (decoupe.erreur) return erreurPivot(res, decoupe.erreur);
    if (decoupe.releves.length > NB_LIGNES_MAX)
      return erreur(res, 4036, { status: 400, message: `Le fichier depasse le nombre maximal de lignes (${NB_LIGNES_MAX}).` });

    const client = await tenantPool.connect();
    let nomPhysique = null;
    try {
      // Societe par defaut de l'import (champ de formulaire, optionnel). Une
      // colonne societe du csv prime ligne a ligne.
      const idSocieteDefaut = (req.body?.id_societe || "").trim() || null;
      if (idSocieteDefaut && !UUID_RE.test(idSocieteDefaut))
        return erreur(res, 4029, { status: 400, message: "Societe introuvable." });
      const { rows: societes } = await client.query(`SELECT id, raison_sociale FROM societe`);
      if (idSocieteDefaut && !societes.some((s) => s.id === idSocieteDefaut))
        return erreur(res, 4029, { status: 400, message: "Societe introuvable." });
      const societeParId = new Map(societes.map((s) => [s.id, s]));
      const societeParNom = new Map(societes.map((s) => [cleRef(s.raison_sociale), s]));

      const affectations = await chargerAffectations(client);
      const parRef = indexParReference(affectations);

      // Jugement ligne a ligne. Les references sont dedoublonnees dans le
      // fichier : deux lignes identiques seraient deux ecarts pour un seul
      // constat.
      const acceptees = [];
      const erreurs = [];
      const refsVues = new Set();
      for (const r of decoupe.releves) {
        const motifs = [];
        if (!r.produit) motifs.push("produit absent");
        if (!r.reference) motifs.push("reference absente");
        const qte = Number(r.quantite.replace(",", "."));
        if (!r.quantite || !Number.isInteger(qte) || qte <= 0) motifs.push("quantite invalide (entier strictement positif attendu)");
        let idSociete = idSocieteDefaut;
        if (r.societe) {
          const s = UUID_RE.test(r.societe) ? societeParId.get(r.societe.toLowerCase()) : societeParNom.get(cleRef(r.societe));
          if (!s) motifs.push(`societe inconnue (${r.societe})`);
          else idSociete = s.id;
        }
        const k = `${cleRef(r.produit)}|${cleRef(r.reference)}`;
        if (!motifs.length && refsVues.has(k)) motifs.push("doublon dans le fichier (meme produit et meme reference)");
        if (motifs.length) {
          erreurs.push({ ligne: r.ligne, motif: motifs.join(" ; ") });
          continue;
        }
        refsVues.add(k);
        const candidates = parRef.get(cleRef(r.reference)) ?? [];
        acceptees.push({
          ligne: r.ligne, idSociete,
          // Constat, pas decision : une candidate laisse la ligne en attente
          // de rapprochement manuel ; aucune candidate = ecart detecte.
          statut: candidates.length ? "en_attente" : "ecart_detecte",
        });
      }

      const statut = !acceptees.length ? "echec" : erreurs.length ? "succes_partiel" : "succes";

      await client.query("BEGIN");
      const { rows: [imp] } = await client.query(
        `INSERT INTO log_import (id_utilisateur, type_import, nb_lignes_total, statut)
         VALUES ($1, $2, $3, 'en_cours') RETURNING id`,
        [req.user.id, PREFIXE_IMPORT, decoupe.releves.length]
      );

      // Le fichier n'atteint le disque qu'une fois les controles passes ; la
      // base porte son nom dans la meme transaction.
      const ecrit = await ecrireFichier(req.file);
      nomPhysique = ecrit.nomPhysique;
      await client.query(`UPDATE log_import SET type_import = $2, statut = $3 WHERE id = $1`,
        [imp.id, PREFIXE_IMPORT + nomPhysique, statut]);

      for (const a of acceptees) {
        await client.query(
          `INSERT INTO inventaire_raw (id_societe, url_fichier, format_source, statut_rapprochement)
           VALUES ($1, $2, 'csv', $3)`,
          [a.idSociete, pointeur(nomPhysique, a.ligne), a.statut]
        );
      }
      for (const e of erreurs) {
        await client.query(
          `INSERT INTO anomalie_qualite (entite_type, entite_id, type_anomalie, description, gravite)
           VALUES ('log_import', $1, 'ligne_import', $2, 'attention')`,
          [imp.id, `Ligne ${e.ligne} : ${e.motif}`.slice(0, 2000)]
        );
      }

      const resume = {
        fichier: nomPhysique, nom_origine: ecrit.nomOrigine, hash_sha256: ecrit.hash,
        nb_lignes_total: decoupe.releves.length, nb_acceptees: acceptees.length, nb_erreurs: erreurs.length,
        nb_en_attente: acceptees.filter((a) => a.statut === "en_attente").length,
        nb_ecart_detecte: acceptees.filter((a) => a.statut === "ecart_detecte").length,
        statut,
      };
      await log(client, req, "import", "log_import", imp.id,
        `Import inventaire ${ecrit.nomOrigine} : ${statut}, ${acceptees.length} releve(s), ${erreurs.length} erreur(s)`, resume);
      await auditer(client, req, {
        action: "INVENTAIRE_IMPORTE", entiteType: "log_import", entiteId: imp.id, apres: resume,
      });
      await client.query("COMMIT");

      const { rows: [detail] } = await tenantPool.query(`${SELECT_IMPORT} AND li.id = $1`, [imp.id]);
      const code = statut === "succes" ? 4002 : statut === "succes_partiel" ? 4011 : 4028;
      if (statut === "echec")
        return erreur(res, 4028, {
          status: 422, message: "Aucune ligne exploitable : import en echec, erreurs jointes.",
          details: { import: projeterImport(detail), erreurs },
        });
      return succes(res, code, { import: projeterImport(detail), erreurs }, { status: 201 });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      if (nomPhysique) await supprimerFichier(nomPhysique);
      console.error(e);
      return erreur(res, 4099, { status: 500, message: "Erreur serveur" });
    } finally {
      client.release();
    }
  });
});

router.get("/inventaire/imports", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(`${SELECT_IMPORT} ORDER BY li.created_at DESC`);
    return succes(res, 4000, rows.map(projeterImport));
  } catch (e) {
    console.error(e);
    return erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

router.get("/inventaire/imports/:id", async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return erreur(res, 4020, { status: 404, message: "Import introuvable." });
  try {
    const { rows } = await tenantPool.query(`${SELECT_IMPORT} AND li.id = $1`, [id]);
    if (!rows.length) return erreur(res, 4020, { status: 404, message: "Import introuvable." });
    const imp = projeterImport(rows[0]);
    const [{ rows: erreurs }, { rows: releves }] = await Promise.all([
      tenantPool.query(
        `SELECT id, description, gravite, resolu, created_at FROM anomalie_qualite
         WHERE entite_type = 'log_import' AND entite_id = $1 ORDER BY created_at, id`, [id]),
      imp.fichier
        ? tenantPool.query(`${SELECT_RELEVE} WHERE ir.url_fichier LIKE $1 ORDER BY ir.url_fichier`, [`${imp.fichier}#%`])
        : { rows: [] },
    ]);
    const enrichis = await enrichirReleves(releves);
    enrichis.sort((a, b) => (a.ligne ?? 0) - (b.ligne ?? 0));
    // Les erreurs sont rendues dans l'ordre du fichier, pas dans l'ordre
    // d'insertion (meme horodatage) ni alphabetique ("Ligne 10" avant "Ligne 4").
    const numero = (e) => Number(/^Ligne (\d+)/.exec(e.description)?.[1] ?? 0);
    erreurs.sort((a, b) => numero(a) - numero(b));
    return succes(res, 4001, { ...imp, erreurs, releves: enrichis });
  } catch (e) {
    console.error(e);
    return erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

// ---------------------------------------------------------------------------
// Consultation des releves
// ---------------------------------------------------------------------------
router.get("/inventaire/releves", async (req, res) => {
  const filtres = construireFiltres(req.query);
  if (filtres.erreur) return erreur(res, 4030, { status: 400, message: filtres.erreur });
  try {
    const { rows } = await tenantPool.query(
      `${SELECT_RELEVE} ${filtres.clause} ORDER BY ir.created_at DESC, ir.url_fichier`, filtres.params);
    return succes(res, 4003, await enrichirReleves(rows));
  } catch (e) {
    console.error(e);
    return erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

// Affectations rapprochables : liste servie a l'ecran de rapprochement pour le
// choix manuel. Lecture seule, sous consulter_inventaire.
router.get("/inventaire/affectations", async (req, res) => {
  try {
    return succes(res, 4010, await chargerAffectations());
  } catch (e) {
    console.error(e);
    return erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

// ---------------------------------------------------------------------------
// C2 : ecarts dans les deux sens, listes et compteurs
// ---------------------------------------------------------------------------
router.get("/inventaire/ecarts", async (req, res) => {
  try {
    const [affectations, { rows: releves }, { rows: licences }] = await Promise.all([
      chargerAffectations(),
      tenantPool.query(`${SELECT_RELEVE} ORDER BY ir.created_at DESC`),
      tenantPool.query(`SELECT id, label, id_produit, quantite FROM licence`),
    ]);
    const enrichis = await enrichirReleves(releves, affectations);
    const libellesLic = await libellesProduits(licences.map((l) => l.id_produit));

    const compteurs = { releves_total: enrichis.length };
    for (const s of STATUTS) compteurs[s] = enrichis.filter((r) => r.statut_rapprochement === s).length;

    // Sens 1 : usage constate sans affectation declaree.
    const constates_sans_affectation = enrichis.filter(
      (r) => !r.id_affectation && r.statut_rapprochement !== "rejete");
    // Sens 2 : affectation declaree jamais constatee (aucun releve rapproche).
    // nb_candidats : releves en attente de meme reference, a rapprocher.
    const parRef = new Map();
    for (const r of constates_sans_affectation) {
      const k = cleRef(r.reference);
      parRef.set(k, (parRef.get(k) ?? 0) + 1);
    }
    const affectations_non_constatees = affectations
      .filter((a) => a.nb_releves_rapproches === 0)
      .map((a) => ({ ...a, nb_candidats: parRef.get(cleRef(a.reference_client)) ?? 0 }));

    compteurs.constates_sans_affectation = constates_sans_affectation.length;
    compteurs.affectations_total = affectations.length;
    compteurs.affectations_non_constatees = affectations_non_constatees.length;

    // Synthese par produit : droits (licences), declare (affectations),
    // constate (releves non rejetes). Cle = identifiant produit resolu en
    // libelle, sinon libelle normalise.
    const synthese = new Map();
    const entree = (cle, label) => {
      if (!synthese.has(cle)) synthese.set(cle, { produit: label, droits: 0, declare: 0, constate: 0 });
      return synthese.get(cle);
    };
    for (const l of licences) {
      if (!l.id_produit) continue;
      const label = libellesLic.get(l.id_produit) ?? l.label ?? l.id_produit;
      entree(cleRef(label), label).droits += l.quantite ?? 0;
    }
    for (const a of affectations) {
      const label = a.produit_label ?? a.licence_label ?? a.id_produit;
      if (!label) continue;
      entree(cleRef(label), label).declare += a.quantite ?? 0;
    }
    for (const r of enrichis) {
      if (r.statut_rapprochement === "rejete" || !r.produit_label) continue;
      entree(cleRef(r.produit_label), r.produit_label).constate += r.quantite ?? 0;
    }
    const synthese_produits = [...synthese.values()]
      .map((s) => ({ ...s, ecart_declare_constate: s.constate - s.declare }))
      .sort((a, b) => a.produit.localeCompare(b.produit));

    return succes(res, 4005, {
      compteurs, constates_sans_affectation, affectations_non_constatees, synthese_produits,
    });
  } catch (e) {
    console.error(e);
    return erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

router.get("/inventaire/releves/:id", async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return erreur(res, 4021, { status: 404, message: "Releve introuvable." });
  try {
    const { rows } = await tenantPool.query(`${SELECT_RELEVE} WHERE ir.id = $1`, [id]);
    if (!rows.length) return erreur(res, 4021, { status: 404, message: "Releve introuvable." });
    const [releve] = await enrichirReleves(rows);
    return succes(res, 4004, releve);
  } catch (e) {
    console.error(e);
    return erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

// ---------------------------------------------------------------------------
// C2 : rapprochement manuel. Quatre transitions, chacune tracee en journal et
// en audit (valeur avant / apres). Aucune n'ecrit dans affectation.
//   rapprocher   : en_attente | ecart_detecte -> rapproche (id_affectation)
//   ecart-assume : en_attente | rapproche     -> ecart_detecte
//   rejeter      : en_attente | ecart_detecte -> rejete (motif obligatoire)
//   reouvrir     : rapproche | ecart_detecte | rejete -> en_attente
// ---------------------------------------------------------------------------
const TRANSITIONS = {
  rapprocher:     { depuis: ["en_attente", "ecart_detecte"], vers: "rapproche",     code: 4006, action: "RELEVE_RAPPROCHE",     journal: "rapprochement" },
  "ecart-assume": { depuis: ["en_attente", "rapproche"],     vers: "ecart_detecte", code: 4007, action: "RELEVE_ECART_ASSUME",  journal: "ecart_assume" },
  rejeter:        { depuis: ["en_attente", "ecart_detecte"], vers: "rejete",        code: 4008, action: "RELEVE_REJETE",        journal: "rejet" },
  reouvrir:       { depuis: ["rapproche", "ecart_detecte", "rejete"], vers: "en_attente", code: 4009, action: "RELEVE_REOUVERT", journal: "reouverture" },
};

async function transition(req, res, nom) {
  const regle = TRANSITIONS[nom];
  const { id } = req.params;
  if (!UUID_RE.test(id)) return erreur(res, 4021, { status: 404, message: "Releve introuvable." });
  const motif = (req.body?.motif || "").trim() || null;
  const idAffectation = (req.body?.id_affectation || "").trim() || null;

  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id, url_fichier, statut_rapprochement, id_affectation FROM inventaire_raw WHERE id = $1 FOR UPDATE`, [id]);
    if (!rows.length) {
      await client.query("ROLLBACK");
      return erreur(res, 4021, { status: 404, message: "Releve introuvable." });
    }
    const avant = rows[0];
    if (!regle.depuis.includes(avant.statut_rapprochement)) {
      await client.query("ROLLBACK");
      return erreur(res, 4033, {
        status: 409,
        message: `Transition non permise : le releve est ${avant.statut_rapprochement}.`,
        details: { statut_rapprochement: avant.statut_rapprochement, transition: nom },
      });
    }
    let affectation = null;
    if (nom === "rapprocher") {
      if (!idAffectation) {
        await client.query("ROLLBACK");
        return erreur(res, 4031, { status: 400, message: "L'affectation est obligatoire." });
      }
      if (UUID_RE.test(idAffectation)) {
        const r = await client.query(`SELECT id, label, reference_client FROM affectation WHERE id = $1`, [idAffectation]);
        affectation = r.rows[0] ?? null;
      }
      if (!affectation) {
        await client.query("ROLLBACK");
        return erreur(res, 4032, { status: 400, message: "Affectation introuvable." });
      }
    }
    if (nom === "rejeter" && !motif) {
      await client.query("ROLLBACK");
      return erreur(res, 4034, { status: 400, message: "Le motif de rejet est obligatoire." });
    }

    const apres = {
      statut_rapprochement: regle.vers,
      id_affectation: nom === "rapprocher" ? affectation.id : null,
    };
    await client.query(
      `UPDATE inventaire_raw SET statut_rapprochement = $2, id_affectation = $3 WHERE id = $1`,
      [id, apres.statut_rapprochement, apres.id_affectation]);

    const p = lirePointeur(avant.url_fichier);
    const description = {
      rapprocher: `Releve ${p?.nomPhysique ?? ""} ligne ${p?.ligne ?? "?"} rapproche de l'affectation ${affectation?.reference_client ?? affectation?.id}`,
      "ecart-assume": `Releve ligne ${p?.ligne ?? "?"} marque en ecart assume`,
      rejeter: `Releve ligne ${p?.ligne ?? "?"} rejete`,
      reouvrir: `Releve ligne ${p?.ligne ?? "?"} remis en attente`,
    }[nom] + (motif ? ` : ${motif}` : "");
    await log(client, req, regle.journal, "inventaire_raw", id, description,
      { avant: { statut_rapprochement: avant.statut_rapprochement, id_affectation: avant.id_affectation }, apres, motif });
    await auditer(client, req, {
      action: regle.action, entiteType: "inventaire_raw", entiteId: id,
      avant: { statut_rapprochement: avant.statut_rapprochement, id_affectation: avant.id_affectation },
      apres: { ...apres, motif },
    });
    await client.query("COMMIT");

    const { rows: rel } = await tenantPool.query(`${SELECT_RELEVE} WHERE ir.id = $1`, [id]);
    const [releve] = await enrichirReleves(rel);
    return succes(res, regle.code, releve);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(e);
    return erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
}

for (const nom of Object.keys(TRANSITIONS)) {
  router.post(`/inventaire/releves/:id/${nom}`, (req, res) => transition(req, res, nom));
}

export default router;
