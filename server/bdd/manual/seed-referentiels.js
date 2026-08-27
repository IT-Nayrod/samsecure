// Amorce des referentiels editeur et revendeur.
// Script manuel, jamais joue par migrate.js. Idempotent : rejouable sans creer
// de doublon ni ecraser une saisie client.
//
// Depuis l'ouverture du referentiel editeurs a la saisie (migrations 039 a 041),
// ce script fait trois choses la ou il n'en faisait qu'une :
//   - il insere les editeurs manquants, comme avant ;
//   - il renseigne le pays des editeurs qui n'en ont pas encore. Uniquement
//     ceux-la : un pays saisi par le client fait foi et n'est jamais ecrase ;
//   - il pose l'entree workflow_validation des editeurs qui n'en ont aucune.
//     Sans elle, l'ecran n'afficherait aucun statut et le traitement de
//     validation refuserait la ligne, une saisie sans demande n'etant pas
//     traitable (validation.js, code 3312). Statut valide : ces editeurs ne
//     sont pas saisis par le client, ils lui sont livres.
import { commonPool, tenantPool, APP_ENV } from "../../db.js";

// raison sociale, slug du logo, pays. Le slug pointe un fichier de public/logos.
const EDITEURS = [
  ["Microsoft Corporation", "microsoft", "États-Unis"],
  ["Adobe Systems", "adobe", "États-Unis"],
  ["Oracle Corporation", "oracle", "États-Unis"],
  ["SAP SE", "sap", "Allemagne"],
  ["IBM Corporation", "ibm", "États-Unis"],
  ["Autodesk", "autodesk", "États-Unis"],
  ["Citrix Systems", "citrix", "États-Unis"],
  ["VMware", "vmware", "États-Unis"],
  ["Salesforce", "salesforce", "États-Unis"],
  ["ServiceNow", null, "États-Unis"],
  ["Atlassian", "atlassian", "Australie"],
  ["ESET", null, "Slovaquie"],
  ["Symantec (Broadcom)", "symantec", "États-Unis"],
  ["Dassault Systemes", "dassaultsystemes", "France"],
  ["Sage", "sage", "France"],
  ["Cegid", null, "France"],
  ["Esker", null, "France"],
  ["Talend", "talend", "France"],
  ["Slack Technologies", "slack", "États-Unis"],
  ["Zoom Video Communications", "zoom", "États-Unis"],
  ["Datadog", "datadog", "États-Unis"],
  ["Snowflake", "snowflake", "États-Unis"],
  ["Lansweeper", null, "Belgique"],
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
  let nbPays = 0;
  for (const [raisonSociale, slug, pays] of EDITEURS) {
    const { rowCount } = await client.query(
      `INSERT INTO editeur (raison_sociale, url_logo_defaut, pays)
       SELECT $1::text, $2::text, $3::text
       WHERE NOT EXISTS (SELECT 1 FROM editeur WHERE raison_sociale = $1)`,
      [raisonSociale, slug ? `/logos/${slug}.svg` : null, pays]
    );
    nbEditeurs += rowCount;

    // Rattrapage des editeurs inseres avant la migration 039, quand la colonne
    // n'existait pas. Le pays saisi par le client n'est jamais touche.
    const { rowCount: majPays } = await client.query(
      `UPDATE editeur SET pays = $2 WHERE raison_sociale = $1 AND pays IS NULL`,
      [raisonSociale, pays]
    );
    nbPays += majPays;
  }

  // Une entree de workflow par editeur qui n'en a aucune. Le SELECT sur
  // validation_status echouerait a zero ligne si le referentiel n'etait pas
  // seede : c'est le cas nominal depuis 003.
  const { rowCount: nbWorkflow } = await client.query(
    `INSERT INTO workflow_validation (entite_type, entite_id, id_statut)
     SELECT 'editeur', e.id, vs.id
       FROM editeur e
       CROSS JOIN validation_status vs
      WHERE vs.code = 'valide'
        AND NOT EXISTS (
          SELECT 1 FROM workflow_validation w
           WHERE w.entite_type = 'editeur' AND w.entite_id = e.id)`
  );

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
  console.log(
    `[${APP_ENV}] Referentiels amorces : ${nbEditeurs} editeur(s) ajoute(s), ` +
    `${nbPays} pays renseigne(s), ${nbWorkflow} statut(s) de validation pose(s), ` +
    `${nbRevendeurs} revendeur(s) ajoute(s).`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Echec :", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await tenantPool.end();
  await commonPool.end();
}
