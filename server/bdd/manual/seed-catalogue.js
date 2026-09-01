// Amorce du catalogue de produits.
// Script manuel, jamais joue par migrate.js. Idempotent : rejouable sans creer
// de doublon ni ecraser une saisie client.
//
// Sans lui, l'ecran Referentiels > Logiciels s'affiche vide : le catalogue
// global (produit_referentiel, version, edition, BDD Commune) n'a jamais recu
// que des produits de test, et produit_client (BDD Tenant) n'a jamais recu
// aucune ligne. Les donnees reprises ici sont celles que le front portait en
// dur dans src/data/mockReferentiels.js.
//
// Le script ecrit dans les deux bases, et c'est la seule facon de le faire :
// produit_referentiel.id_editeur designe un editeur qui vit en BDD Tenant,
// sans FK possible (001_commune_schema.sql:30). L'editeur est donc resolu ici,
// par sa raison sociale, avant d'etre ecrit en Commune. Un editeur absent du
// Tenant laisse le produit sans editeur plutot que d'echouer : jouer
// seed-referentiels.js d'abord evite ce cas.
import { commonPool, tenantPool, APP_ENV } from "../../db.js";

// sku, libelle, raison sociale de l'editeur, sku du produit parent.
// Le sku est la cle metier du catalogue : il porte uq_produit_referentiel_sku
// et sert de point de rattrapage a chaque rejeu.
const CATALOGUE = [
  ["MS365-E3",    "Microsoft 365",       "Microsoft Corporation", null],
  ["MS365-EXO",   "Exchange Online",     "Microsoft Corporation", "MS365-E3"],
  ["MS365-TEAMS", "Microsoft Teams",     "Microsoft Corporation", "MS365-E3"],
  ["WINSRV-STD",  "Windows Server",      "Microsoft Corporation", null],
  ["SQLSRV",      "SQL Server",          "Microsoft Corporation", null],
  ["AZURE-CONSO", "Azure",               "Microsoft Corporation", null],
  ["ACC-ALLAPPS", "Adobe Creative Cloud", "Adobe Systems",        null],
  ["ACC-PS",      "Photoshop",           "Adobe Systems",         "ACC-ALLAPPS"],
  ["ACC-AI",      "Illustrator",         "Adobe Systems",         "ACC-ALLAPPS"],
  ["ACRO-PRO-DC", "Adobe Acrobat",       "Adobe Systems",         null],
  ["ORADB-EE",    "Oracle Database",     "Oracle Corporation",    null],
  ["ORA-MW",      "Oracle Middleware",   "Oracle Corporation",    null],
  ["ORA-JSE",     "Oracle Java SE",      "Oracle Corporation",    null],
  ["SAP-ERP-CC",  "SAP ERP",             "SAP SE",                null],
  ["SAP-BO",      "SAP BusinessObjects", "SAP SE",                null],
  ["IBM-DB2",     "IBM Db2",             "IBM Corporation",       null],
  ["IBM-MQ",      "IBM MQ",              "IBM Corporation",       null],
  ["IBM-WS",      "IBM WebSphere",       "IBM Corporation",       null],
  ["ACAD",        "AutoCAD",             "Autodesk",              null],
  ["REVIT",       "Revit",               "Autodesk",              null],
  ["JIRA-CLOUD",  "Jira",                "Atlassian",             null],
  ["CONF-CLOUD",  "Confluence",          "Atlassian",             null],
  ["CTX-VAD",     "Citrix Virtual Apps and Desktops", "Citrix Systems", null],
  ["VMW-VSPH",    "VMware vSphere",      "VMware",                null],
];

// sku du produit, libelles des versions puis des editions.
const DECLINAISONS = [
  ["MS365-E3",    ["2024", "2021"],   ["E3", "E5"]],
  ["WINSRV-STD",  ["2022", "2019"],   ["Standard", "Datacenter"]],
  ["SQLSRV",      ["2022", "2019"],   ["Express", "Standard", "Enterprise"]],
  ["ACC-ALLAPPS", ["2024"],           []],
  ["ACRO-PRO-DC", ["DC"],             []],
  ["ORADB-EE",    ["19c", "21c"],     ["Standard", "Enterprise"]],
  ["ORA-JSE",     ["17", "21"],       []],
  ["SAP-ERP-CC",  ["6.0 EHP8"],       ["Standard", "Professional", "Enterprise"]],
  ["ACAD",        ["2024", "2023"],   []],
  ["IBM-DB2",     ["11.5"],           []],
];

// Logiciels propres au client, en BDD Tenant. Libelle et statut de validation :
// ils sont saisis par le client, contrairement au catalogue qui lui est livre.
const PRODUITS_CLIENT = [
  ["Outil de paie interne Acme", "valide"],
  ["Portail RH Acme Lyon", "en_attente"],
  ["Connecteur EDI fournisseurs", "en_attente"],
];

const clientTenant = await tenantPool.connect();
const clientCommun = await commonPool.connect();
try {
  // ---- Resolution des editeurs, en BDD Tenant --------------------------------
  const { rows: editeurs } = await clientTenant.query(
    `SELECT id, raison_sociale FROM editeur`);
  const idEditeur = new Map(editeurs.map((e) => [e.raison_sociale, e.id]));
  const manquants = [...new Set(CATALOGUE.map((p) => p[2]))].filter((r) => !idEditeur.has(r));
  if (manquants.length) {
    console.warn(
      `Attention : ${manquants.length} editeur(s) absent(s) du Tenant, ` +
      `les produits correspondants resteront sans editeur : ${manquants.join(", ")}. ` +
      `Jouez seed-referentiels.js d'abord.`);
  }

  // ---- Catalogue global, en BDD Commune --------------------------------------
  await clientCommun.query("BEGIN");

  let nbProduits = 0;
  for (const [sku, label, editeur] of CATALOGUE) {
    const { rowCount } = await clientCommun.query(
      `INSERT INTO produit_referentiel (label, sku, id_editeur)
       VALUES ($1, $2, $3) ON CONFLICT (sku) DO NOTHING`,
      [label, sku, idEditeur.get(editeur) ?? null]);
    nbProduits += rowCount;
  }

  // Rattrapage de l'editeur des produits inseres avant que le Tenant ne soit
  // amorce. Un editeur deja renseigne n'est jamais touche.
  let nbEditeursRattrapes = 0;
  for (const [sku, , editeur] of CATALOGUE) {
    const id = idEditeur.get(editeur);
    if (!id) continue;
    const { rowCount } = await clientCommun.query(
      `UPDATE produit_referentiel SET id_editeur = $2 WHERE sku = $1 AND id_editeur IS NULL`,
      [sku, id]);
    nbEditeursRattrapes += rowCount;
  }

  // Hierarchie en seconde passe : le parent doit exister avant d'etre vise.
  const { rows: crees } = await clientCommun.query(
    `SELECT id, sku FROM produit_referentiel WHERE sku IS NOT NULL`);
  const idParSku = new Map(crees.map((p) => [p.sku, p.id]));

  let nbParents = 0;
  for (const [sku, , , skuParent] of CATALOGUE) {
    if (!skuParent) continue;
    const { rowCount } = await clientCommun.query(
      `UPDATE produit_referentiel SET id_produit_parent = $2
        WHERE sku = $1 AND id_produit_parent IS DISTINCT FROM $2`,
      [sku, idParSku.get(skuParent) ?? null]);
    nbParents += rowCount;
  }

  let nbVersions = 0;
  let nbEditions = 0;
  for (const [sku, versions, editions] of DECLINAISONS) {
    const idProduit = idParSku.get(sku);
    if (!idProduit) continue;
    for (const label of versions) {
      const { rowCount } = await clientCommun.query(
        `INSERT INTO version (id_produit, label) VALUES ($1, $2)
         ON CONFLICT ON CONSTRAINT uq_version_produit_label DO NOTHING`,
        [idProduit, label]);
      nbVersions += rowCount;
    }
    for (const label of editions) {
      const { rowCount } = await clientCommun.query(
        `INSERT INTO edition (id_produit, label) VALUES ($1, $2)
         ON CONFLICT ON CONSTRAINT uq_edition_produit_label DO NOTHING`,
        [idProduit, label]);
      nbEditions += rowCount;
    }
  }

  await clientCommun.query("COMMIT");

  // ---- Logiciels client, en BDD Tenant ---------------------------------------
  await clientTenant.query("BEGIN");

  let nbClient = 0;
  for (const [label] of PRODUITS_CLIENT) {
    const { rowCount } = await clientTenant.query(
      `INSERT INTO produit_client (label)
       SELECT $1::text
       WHERE NOT EXISTS (SELECT 1 FROM produit_client WHERE label = $1)`,
      [label]);
    nbClient += rowCount;
  }

  // Statut de validation : sans entree, l'ecran n'afficherait aucun statut et le
  // traitement refuserait la ligne (validation.js, code 3312).
  let nbWorkflow = 0;
  for (const [label, statut] of PRODUITS_CLIENT) {
    const { rowCount } = await clientTenant.query(
      `INSERT INTO workflow_validation (entite_type, entite_id, id_statut)
       SELECT 'produit_client', p.id, vs.id
         FROM produit_client p
         CROSS JOIN validation_status vs
        WHERE p.label = $1 AND vs.code = $2
          AND NOT EXISTS (
            SELECT 1 FROM workflow_validation w
             WHERE w.entite_type = 'produit_client' AND w.entite_id = p.id)`,
      [label, statut]);
    nbWorkflow += rowCount;
  }

  await clientTenant.query("COMMIT");

  console.log(
    `[${APP_ENV}] Catalogue amorce : ${nbProduits} produit(s) du catalogue, ` +
    `${nbEditeursRattrapes} editeur(s) rattrape(s), ${nbParents} rattachement(s), ` +
    `${nbVersions} version(s), ${nbEditions} edition(s), ` +
    `${nbClient} logiciel(s) client, ${nbWorkflow} statut(s) de validation pose(s).`);
} catch (err) {
  await clientCommun.query("ROLLBACK").catch(() => {});
  await clientTenant.query("ROLLBACK").catch(() => {});
  console.error("Echec :", err.message);
  process.exitCode = 1;
} finally {
  clientTenant.release();
  clientCommun.release();
  await tenantPool.end();
  await commonPool.end();
}
