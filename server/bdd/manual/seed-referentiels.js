// Amorce des referentiels editeur et revendeur. Ces deux tables n'ont pas encore
// de CRUD (module 1 non branche) et restent vides, ce qui laisse les selecteurs
// du formulaire contrat sans source. Script manuel, jamais joue par migrate.js.
// Idempotent : rejouable sans creer de doublon.
import { commonPool, tenantPool, APP_ENV } from "../../db.js";

const EDITEURS = [
  ["Microsoft Corporation", "microsoft"], ["Adobe Systems", "adobe"],
  ["Oracle Corporation", "oracle"], ["SAP SE", "sap"], ["IBM Corporation", "ibm"],
  ["Autodesk", "autodesk"], ["Citrix Systems", "citrix"], ["VMware", "vmware"],
  ["Salesforce", "salesforce"], ["ServiceNow", null], ["Atlassian", "atlassian"],
  ["ESET", null], ["Symantec (Broadcom)", "symantec"],
  ["Dassault Systemes", "dassaultsystemes"], ["Sage", "sage"], ["Cegid", null],
  ["Esker", null], ["Talend", "talend"], ["Slack Technologies", "slack"],
  ["Zoom Video Communications", "zoom"], ["Datadog", "datadog"],
  ["Snowflake", "snowflake"], ["Lansweeper", null],
];

const REVENDEURS = [
  ["SCC France", "33212545600056", "FR7630006000011234567890189", "contact@scc.fr"],
  ["Insight Direct", "40312478900032", "FR7630004000031234567890143", "contact@insight.com"],
  ["Bechtle France", "38456712300048", "FR7612548029981234567890271", "contact@bechtle.fr"],
  ["Econocom", "38972145600061", "FR7630003000401234567890370", "contact@econocom.com"],
  ["Computacenter France", "34256987100025", "FR7620041010050500013M02606", "contact@computacenter.fr"],
  ["Softchoice France", "41258963200017", "FR7617569000901234567890182", "contact@softchoice.com"],
  ["CDW France", "39845712600039", "FR7630007000111234567890211", "contact@cdw.com"],
  ["Crayon France", "50123478900014", "FR7630002005501234567890196", "contact@crayon.com"],
  ["ALSO France", "42698745100052", "FR7630066100011234567890206", "contact@also.com"],
  ["TD Synnex France", "35487912600073", "FR7630001007941234567890138", "contact@tdsynnex.com"],
  ["Dell Technologies France", "38912456700084", "FR7630056009501234567890159", "contact@dell.com"],
  ["HPE France", "32178945600025", "FR7630027082001234567890224", "contact@hpe.com"],
  ["Devoteam", "34896712500066", "FR7630003020201234567890116", "contact@devoteam.com"],
  ["Inetum", "38745961200038", "FR7610907001011234567890192", "contact@inetum.com"],
  ["Sopra Steria", "32692249800012", "FR7630066100021234567890247", "contact@soprasteria.com"],
  ["Cheops Technology", "40325871900057", "FR7630004003001234567890278", "contact@cheops.fr"],
  ["Exclusive Networks", "49887412300046", "FR7630003015101234567890294", "contact@exclusive-networks.com"],
];

const client = await tenantPool.connect();
try {
  await client.query("BEGIN");

  let nbEditeurs = 0;
  for (const [raisonSociale, slug] of EDITEURS) {
    const { rowCount } = await client.query(
      `INSERT INTO editeur (raison_sociale, url_logo_defaut)
       SELECT $1::text, $2::text
       WHERE NOT EXISTS (SELECT 1 FROM editeur WHERE raison_sociale = $1)`,
      [raisonSociale, slug ? `/logos/${slug}.svg` : null]
    );
    nbEditeurs += rowCount;
  }

  let nbRevendeurs = 0;
  for (const [raisonSociale, siret, iban, email] of REVENDEURS) {
    const { rowCount } = await client.query(
      `INSERT INTO revendeur (raison_sociale, siret, iban, email)
       SELECT $1::text, $2::text, $3::text, $4::text
       WHERE NOT EXISTS (SELECT 1 FROM revendeur WHERE raison_sociale = $1)`,
      [raisonSociale, siret, iban, email]
    );
    nbRevendeurs += rowCount;
  }

  await client.query("COMMIT");
  console.log(`[${APP_ENV}] Referentiels amorces : ${nbEditeurs} editeur(s), ${nbRevendeurs} revendeur(s) ajoute(s).`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Echec :", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await tenantPool.end();
  await commonPool.end();
}
