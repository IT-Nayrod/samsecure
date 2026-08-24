// Jeu de donnees de test du module licences (US #102). Script manuel, jamais
// joue par migrate.js, idempotent : chaque ligne est identifiee par une cle
// naturelle (sku du produit, libelle de la licence, raison sociale du
// mainteneur) et n'est pas recreee si elle existe.
//
// Il amorce ce que la base dev ne porte pas encore : le catalogue des produits
// en BDD Commune (produit_referentiel, version, edition, vides au 24/08), les
// mainteneurs, puis douze licences mettant en scene chaque etat servi par
// l'API (perpetuelle, souscription active, a renouveler, expiree, maintenance
// active, echue, arretee avec version figee, deux lots d'un meme produit) et
// quelques affectations pour que la balance droits/usage ne soit pas vide.
//
// Prerequis : editeurs et revendeurs amorces (seed-referentiels.js), commandes
// de test existantes ("Commande fev 2026", "Commande juil 2026",
// "Commande 2025", "Test CSV"). Une commande absente laisse la licence sans
// rattachement, le script ne s'arrete pas.
//
//   npm run seed:licences:dev / seed:licences:staging
import { commonPool, tenantPool, APP_ENV } from "../../db.js";

// [sku, label, editeur (raison sociale Tenant), versions, editions]
const PRODUITS = [
  ["MS365-E3",    "Microsoft 365",        "Microsoft Corporation", ["2024", "2025"],            ["E3", "E5", "Business Standard"]],
  ["WINSRV-STD",  "Windows Server",       "Microsoft Corporation", ["2019", "2022", "2025"],    ["Standard", "Datacenter"]],
  ["SQLSRV",      "SQL Server",           "Microsoft Corporation", ["2019", "2022"],            ["Standard", "Enterprise"]],
  ["ACC-ALLAPPS", "Adobe Creative Cloud", "Adobe Systems",         ["2025", "2026"],            ["All Apps", "Single App"]],
  ["ORADB-EE",    "Oracle Database",      "Oracle Corporation",    ["19c", "21c", "23ai"],      ["Standard Edition 2", "Enterprise Edition"]],
  ["SAP-ERP-CC",  "SAP ERP",              "SAP SE",                ["ECC 6.0", "S/4HANA 2023"], ["Professional", "Limited Professional"]],
  ["IBM-DB2",     "IBM Db2",              "IBM Corporation",       ["11.1", "11.5", "12.1"],    ["Standard", "Advanced"]],
  ["ACAD",        "AutoCAD",              "Autodesk",              ["2024", "2025", "2026"],    []],
  ["ATL-JIRA",    "Jira Software",        "Atlassian",             ["Cloud", "Data Center 9"],  ["Standard", "Premium"]],
];

const MAINTENEURS = [
  "Microsoft Corporation", "Adobe Systems", "Oracle Corporation", "SAP SE",
  "IBM Corporation", "Autodesk", "Atlassian",
];

// Licences : la commande est designee par son libelle, le contrat en decoule.
// Les couts sont en euros, les dates en ISO. maintenance = periodes
// d'historique [date_debut, date_fin, cout, mainteneur].
const LICENCES = [
  { label: "Adobe CC, studio design", sku: "ACC-ALLAPPS", edition: "All Apps", version: "2026",
    commande: "Commande fev 2026", revendeur: "SCC France", unite: "utilisateur_nomme",
    type: "souscription", quantite: 80, cout: 56000, date_fin_souscription: "2027-02-04",
    a_maintenance: true, mainteneur: "Adobe Systems", date_fin_maintenance: "2027-02-04",
    maintenance: [["2026-02-05", "2027-02-04", 6000, "Adobe Systems"]] },
  { label: "Adobe CC, renfort ete", sku: "ACC-ALLAPPS", edition: "Single App", version: "2026",
    commande: "Commande juil 2026", revendeur: "SCC France", unite: "utilisateur_nomme",
    type: "souscription", quantite: 20, cout: 14000, date_fin_souscription: "2026-09-15",
    a_maintenance: false },
  { label: "Adobe CC, lot 2025 echu", sku: "ACC-ALLAPPS", edition: "All Apps", version: "2025",
    commande: "Commande 2025", revendeur: "Insight Direct", unite: "utilisateur_nomme",
    type: "souscription", quantite: 15, cout: 9000, date_fin_souscription: "2026-06-30",
    a_maintenance: false },
  { label: "Jira, equipes projets", sku: "ATL-JIRA", edition: "Standard", version: "Cloud",
    commande: "Test CSV", revendeur: "Bechtle France", unite: "utilisateur_nomme",
    type: "souscription", quantite: 100, cout: 12000, date_fin_souscription: "2027-08-01",
    a_maintenance: true, mainteneur: "Atlassian", date_fin_maintenance: "2027-08-01",
    maintenance: [["2026-08-02", "2027-08-01", 2400, "Atlassian"]] },
  { label: "Windows Server, cluster prod", sku: "WINSRV-STD", edition: "Datacenter", version: "2022",
    revendeur: "Computacenter France", unite: "device",
    type: "perpetuelle", quantite: 60, cout: 90000,
    a_maintenance: true, mainteneur: "Microsoft Corporation", date_fin_maintenance: "2026-12-31",
    maintenance: [["2024-01-01", "2026-12-31", 9000, "Microsoft Corporation"]] },
  { label: "SQL Server, instances Lyon", sku: "SQLSRV", edition: "Enterprise", version: "2022",
    revendeur: "Computacenter France", unite: "core",
    type: "perpetuelle", quantite: 50, cout: 150000, a_maintenance: false },
  { label: "SAP ERP, siege", sku: "SAP-ERP-CC", edition: "Professional", version: "S/4HANA 2023",
    revendeur: "Econocom", unite: "utilisateur_nomme",
    type: "perpetuelle", quantite: 80, cout: 160000,
    a_maintenance: true, mainteneur: "SAP SE", date_fin_maintenance: "2027-03-31",
    maintenance: [["2024-04-01", "2027-03-31", 12000, "SAP SE"]] },
  { label: "IBM Db2, entrepot de donnees", sku: "IBM-DB2", edition: "Advanced", version: "11.5",
    revendeur: "Devoteam", unite: "serveur",
    type: "perpetuelle", quantite: 40, cout: 60000,
    a_maintenance: false, mainteneur: "IBM Corporation",
    date_fin_maintenance: "2024-06-30", date_arret_maintenance: "2024-06-30", version_figee: "11.5",
    maintenance: [["2021-09-01", "2024-06-30", 8000, "IBM Corporation"]] },
  { label: "Oracle Database, cluster Lyon", sku: "ORADB-EE", edition: "Enterprise Edition", version: "19c",
    revendeur: "Softchoice France", unite: "cpu",
    type: "perpetuelle", quantite: 60, cout: 300000,
    a_maintenance: true, mainteneur: "Oracle Corporation", date_fin_maintenance: "2026-01-15",
    maintenance: [["2023-01-16", "2026-01-15", 30000, "Oracle Corporation"]] },
  { label: "AutoCAD, bureau d'etudes", sku: "ACAD", version: "2026",
    revendeur: "TD Synnex France", unite: "utilisateur_nomme",
    type: "souscription", quantite: 30, cout: 45000, date_fin_souscription: "2026-11-30",
    a_maintenance: true, mainteneur: "Autodesk", date_fin_maintenance: "2026-11-30",
    maintenance: [["2025-12-01", "2026-11-30", 4500, "Autodesk"]] },
  { label: "Microsoft 365, siege", sku: "MS365-E3", edition: "E3", version: "2025",
    revendeur: "Crayon France", unite: "utilisateur_nomme",
    type: "souscription", quantite: 60, cout: 15000, date_fin_souscription: "2027-06-30",
    a_maintenance: false },
  { label: "Microsoft 365, agence Lyon", sku: "MS365-E3", edition: "E5", version: "2025",
    revendeur: "Crayon France", unite: "utilisateur_nomme",
    type: "souscription", quantite: 40, cout: 12000, date_fin_souscription: "2027-03-31",
    a_maintenance: false },
];

// Affectations (usage declare) : [libelle licence, libelle affectation, quantite]
// Balance attendue : Adobe CC 95 / 100 (le lot echu ne compte plus dans les
// droits) attention ; M365 90 / 100 attention ; Windows Server 50 / 60
// conforme ; Oracle 68 / 60 depassement ; SAP 80 / 80 attention ; Jira 12 / 100
// conforme.
const AFFECTATIONS = [
  ["Adobe CC, studio design", "Adobe CC, studio design, siege", 75],
  ["Adobe CC, renfort ete", "Adobe CC, renfort ete, stagiaires", 20],
  ["Microsoft 365, siege", "M365, S. Durand et equipe", 55],
  ["Microsoft 365, agence Lyon", "M365, pool Lyon", 35],
  ["Windows Server, cluster prod", "WinSrv, cluster prod", 50],
  ["Oracle Database, cluster Lyon", "Oracle DB, cluster Lyon", 68],
  ["SAP ERP, siege", "SAP ERP, siege", 80],
  ["Jira, equipes projets", "Jira, equipe projets", 12],
];

const commun = await commonPool.connect();
const tenant = await tenantPool.connect();
try {
  // Editeurs Tenant, par raison sociale : lien logique porte par le produit.
  const { rows: editeurs } = await tenant.query(`SELECT id, raison_sociale FROM editeur`);
  const editeurParNom = new Map(editeurs.map((e) => [e.raison_sociale, e.id]));

  await commun.query("BEGIN");
  let nbProduits = 0, nbDeclinaisons = 0;
  const produitParSku = new Map(), versionParCle = new Map(), editionParCle = new Map();
  for (const [sku, label, editeur, versions, editions] of PRODUITS) {
    const idEditeur = editeurParNom.get(editeur) ?? null;
    if (!idEditeur) console.warn(`  editeur absent en Tenant : ${editeur} (produit ${label} sans editeur)`);
    const { rowCount } = await commun.query(
      `INSERT INTO produit_referentiel (label, id_editeur, sku)
       SELECT $1::text, $2::uuid, $3::text
       WHERE NOT EXISTS (SELECT 1 FROM produit_referentiel WHERE sku = $3)`,
      [label, idEditeur, sku]);
    nbProduits += rowCount;
    const { rows: [p] } = await commun.query(`SELECT id FROM produit_referentiel WHERE sku = $1`, [sku]);
    produitParSku.set(sku, p.id);
    for (const v of versions) {
      const { rowCount: n } = await commun.query(
        `INSERT INTO version (id_produit, label) VALUES ($1, $2)
         ON CONFLICT ON CONSTRAINT uq_version_produit_label DO NOTHING`, [p.id, v]);
      nbDeclinaisons += n;
      const { rows: [r] } = await commun.query(`SELECT id FROM version WHERE id_produit = $1 AND label = $2`, [p.id, v]);
      versionParCle.set(`${sku}|${v}`, r.id);
    }
    for (const e of editions) {
      const { rowCount: n } = await commun.query(
        `INSERT INTO edition (id_produit, label) VALUES ($1, $2)
         ON CONFLICT ON CONSTRAINT uq_edition_produit_label DO NOTHING`, [p.id, e]);
      nbDeclinaisons += n;
      const { rows: [r] } = await commun.query(`SELECT id FROM edition WHERE id_produit = $1 AND label = $2`, [p.id, e]);
      editionParCle.set(`${sku}|${e}`, r.id);
    }
  }
  await commun.query("COMMIT");

  await tenant.query("BEGIN");
  let nbMainteneurs = 0;
  for (const nom of MAINTENEURS) {
    const { rowCount } = await tenant.query(
      `INSERT INTO mainteneur (raison_sociale) SELECT $1::text
       WHERE NOT EXISTS (SELECT 1 FROM mainteneur WHERE raison_sociale = $1)`, [nom]);
    nbMainteneurs += rowCount;
  }
  const idPar = async (table, colonne, valeur) => {
    if (!valeur) return null;
    const { rows } = await tenant.query(`SELECT id FROM ${table} WHERE ${colonne} = $1 LIMIT 1`, [valeur]);
    if (!rows.length) console.warn(`  ${table} introuvable : ${valeur}`);
    return rows[0]?.id ?? null;
  };

  let nbLicences = 0, nbPeriodes = 0, nbAffectations = 0;
  for (const l of LICENCES) {
    const { rows: deja } = await tenant.query(`SELECT id FROM licence WHERE label = $1`, [l.label]);
    let idLicence = deja[0]?.id;
    if (!idLicence) {
      const { rows: [creee] } = await tenant.query(
        `INSERT INTO licence (label, id_commande, id_produit, id_edition, id_version, id_revendeur,
                              id_unite_mesure, quantite, type, cout_licence, date_fin_souscription,
                              a_maintenance, version_figee_id, date_arret_maintenance, id_mainteneur,
                              date_fin_maintenance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`,
        [l.label,
         await idPar("commande", "label", l.commande),
         produitParSku.get(l.sku),
         l.edition ? editionParCle.get(`${l.sku}|${l.edition}`) ?? null : null,
         l.version ? versionParCle.get(`${l.sku}|${l.version}`) ?? null : null,
         await idPar("revendeur", "raison_sociale", l.revendeur),
         await idPar("unite_mesure", "code", l.unite),
         l.quantite, l.type, l.cout, l.date_fin_souscription ?? null,
         l.a_maintenance === true,
         l.version_figee ? versionParCle.get(`${l.sku}|${l.version_figee}`) ?? null : null,
         l.date_arret_maintenance ?? null,
         await idPar("mainteneur", "raison_sociale", l.mainteneur),
         l.date_fin_maintenance ?? null]);
      idLicence = creee.id;
      nbLicences++;
      for (const [debut, fin, cout, mainteneur] of l.maintenance ?? []) {
        await tenant.query(
          `INSERT INTO maintenance_historique (id_licence, id_mainteneur, id_revendeur, date_debut, date_fin, cout)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [idLicence, await idPar("mainteneur", "raison_sociale", mainteneur),
           await idPar("revendeur", "raison_sociale", l.revendeur), debut, fin, cout]);
        nbPeriodes++;
      }
    }
  }

  const idSociete = await idPar("societe", "raison_sociale", "Acheteur Test SA");
  const { rows: [statutValide] } = await tenant.query(`SELECT id FROM validation_status WHERE code = 'valide'`);
  for (const [licence, label, quantite] of AFFECTATIONS) {
    const idLicence = await idPar("licence", "label", licence);
    if (!idLicence) continue;
    const { rowCount } = await tenant.query(
      `INSERT INTO affectation (label, id_licence, id_societe, quantite, id_validation_status)
       SELECT $1::text, $2::uuid, $3::uuid, $4::int, $5::uuid
       WHERE NOT EXISTS (SELECT 1 FROM affectation WHERE label = $1 AND id_licence = $2)`,
      [label, idLicence, idSociete, quantite, statutValide?.id ?? null]);
    nbAffectations += rowCount;
  }
  await tenant.query("COMMIT");

  console.log(`[${APP_ENV}] Jeu de test licences : ${nbProduits} produit(s) et ${nbDeclinaisons} version(s)/edition(s) en Commune, ` +
    `${nbMainteneurs} mainteneur(s), ${nbLicences} licence(s), ${nbPeriodes} periode(s) de maintenance, ` +
    `${nbAffectations} affectation(s) ajoute(s).`);
} catch (err) {
  await commun.query("ROLLBACK").catch(() => {});
  await tenant.query("ROLLBACK").catch(() => {});
  console.error("Echec :", err.message);
  process.exitCode = 1;
} finally {
  commun.release();
  tenant.release();
  await tenantPool.end();
  await commonPool.end();
}
