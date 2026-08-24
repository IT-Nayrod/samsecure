// Jeu de test des affectations (#106, M3-B). Script manuel, jamais joue par
// migrate.js : npm run seed:affectations:dev.
//
// Cree, s'ils n'existent pas, 3 produits de test en BDD Commune (sku
// TEST106-*), 2 societes de test en Tenant (delais de revalidation 30 et 60
// jours), 3 licences et 7 affectations couvrant chaque etat du cycle :
// en attente, refusee, validee a jour, validee en fenetre d'alerte (echeance
// dans 10 jours), validee echeance depassee, et deux affectations validees sur
// la meme reference client (verifie la somme brute sans deduplication).
// Idempotent : reperage par reference_client prefixee "[TEST #106]", rejouable
// sans doublon. Suppression : voir la fin du fichier (SQL de nettoyage).
import { commonPool, tenantPool, APP_ENV } from "../../db.js";

const PREFIXE = "[TEST #106]";

const PRODUITS = [
  ["Microsoft 365 E3 (test #106)", "TEST106-M365"],
  ["Windows Server Standard (test #106)", "TEST106-WINSRV"],
  ["Adobe Creative Cloud (test #106)", "TEST106-ADOBE"],
];

const SOCIETES = [
  ["Test106 Siege", 30],
  ["Test106 Agence Lyon", 60],
];

// [label licence, sku produit, quantite]
const LICENCES = [
  ["Licence M365 E3 x100 (test #106)", "TEST106-M365", 100],
  ["Licence Windows Server x50 (test #106)", "TEST106-WINSRV", 50],
  ["Licence Adobe CC x40 (test #106)", "TEST106-ADOBE", 40],
];

// [reference, licence, societe, quantite, etat]
// etat : en_attente | refuse | a_jour | alerte | depasse
const AFFECTATIONS = [
  [`${PREFIXE} M365 - Pool siege`,        0, 0, 40, "a_jour"],
  [`${PREFIXE} M365 - Pool Lyon`,         0, 1, 35, "en_attente"],
  [`${PREFIXE} WinSrv - Cluster prod`,    1, 0, 20, "alerte"],
  [`${PREFIXE} WinSrv - Cluster test`,    1, 0, 10, "depasse"],
  [`${PREFIXE} Adobe - Studio design`,    2, 0, 25, "refuse"],
  // Meme reference client, deux declarations : sommees sans deduplication.
  [`${PREFIXE} Adobe - Poste partage`,    2, 1, 8,  "a_jour"],
  [`${PREFIXE} Adobe - Poste partage`,    2, 1, 8,  "depasse"],
];

const commun = await commonPool.connect();
const client = await tenantPool.connect();
try {
  await commun.query("BEGIN");
  await client.query("BEGIN");

  const produits = {};
  for (const [label, sku] of PRODUITS) {
    const { rows } = await commun.query(
      `INSERT INTO produit_referentiel (label, sku) VALUES ($1, $2)
       ON CONFLICT (sku) DO UPDATE SET label = EXCLUDED.label
       RETURNING id`, [label, sku]);
    produits[sku] = rows[0].id;
  }

  const societes = [];
  for (const [raison, delai] of SOCIETES) {
    const { rows } = await client.query(
      `SELECT id FROM societe WHERE raison_sociale = $1`, [raison]);
    if (rows.length) { societes.push(rows[0].id); continue; }
    const { rows: [s] } = await client.query(
      `INSERT INTO societe (raison_sociale, delai_revalidation) VALUES ($1, $2) RETURNING id`,
      [raison, delai]);
    societes.push(s.id);
  }

  const licences = [];
  for (const [label, sku, quantite] of LICENCES) {
    const { rows } = await client.query(`SELECT id FROM licence WHERE label = $1`, [label]);
    if (rows.length) { licences.push(rows[0].id); continue; }
    const { rows: [l] } = await client.query(
      `INSERT INTO licence (label, id_produit, quantite, type) VALUES ($1, $2, $3, 'perpetuelle') RETURNING id`,
      [label, produits[sku], quantite]);
    licences.push(l.id);
  }

  const { rows: [auteur] } = await client.query(
    `SELECT id FROM utilisateur ORDER BY created_at LIMIT 1`);
  const idAuteur = auteur?.id || null;

  const { rows: statuts } = await client.query(`SELECT id, code FROM validation_status`);
  const statut = Object.fromEntries(statuts.map((s) => [s.code, s.id]));

  let crees = 0;
  for (const [ref, iL, iS, qte, etat] of AFFECTATIONS) {
    // Reperage sur reference + licence + societe + etat attendu (deux lignes
    // partagent la meme reference, distinguees par leur etat).
    const { rows: existantes } = await client.query(
      `SELECT a.id FROM affectation a
        WHERE a.reference_client = $1 AND a.id_licence = $2 AND a.id_societe = $3
          AND ($4::text = 'depasse') = COALESCE(a.date_revalidation < CURRENT_DATE, false)`,
      [ref, licences[iL], societes[iS], etat]);
    if (existantes.length) continue;

    const { rows: [a] } = await client.query(
      `INSERT INTO affectation (label, id_licence, id_societe, quantite, reference_client)
       VALUES ($1, $2, $3, $4, $1) RETURNING id`, [ref, licences[iL], societes[iS], qte]);

    const codeWorkflow = etat === "en_attente" ? "en_attente" : etat === "refuse" ? "refuse" : "valide";
    await client.query(
      `INSERT INTO workflow_validation (entite_type, entite_id, id_soumis_par, id_traite_par, id_statut, message_refus)
       VALUES ('affectation', $1, $2, $3, $4, $5)`,
      [a.id, idAuteur, codeWorkflow === "en_attente" ? null : idAuteur, statut[codeWorkflow],
       etat === "refuse" ? "Quantite incoherente avec l'inventaire (jeu de test)." : null]);
    await client.query(
      `UPDATE affectation SET id_validation_status = $2 WHERE id = $1`, [a.id, statut[codeWorkflow]]);

    if (codeWorkflow === "valide") {
      // Echeance placee selon l'etat voulu, delai de la societe respecte pour
      // la date de derniere validation.
      const delai = SOCIETES[iS][1];
      const decalage = etat === "a_jour" ? 0 : etat === "alerte" ? delai - 10 : delai + 20;
      await client.query(
        `INSERT INTO revalidation (id_affectation, date_derniere_validation, date_prochaine_revalidation, statut)
         VALUES ($1, CURRENT_DATE - $2::int, CURRENT_DATE - $2::int + $3::int, 'a_jour')`,
        [a.id, decalage, delai]);
      await client.query(
        `UPDATE affectation SET date_revalidation = CURRENT_DATE - $2::int + $3::int WHERE id = $1`,
        [a.id, decalage, delai]);
    }

    await client.query(
      `INSERT INTO historique_declaration (id_societe, id_utilisateur, action, entite_type, detail)
       VALUES ($1, $2, 'CREATE', 'affectation', $3)`,
      [societes[iS], idAuteur, JSON.stringify({ id_affectation: a.id, reference_client: ref, quantite: qte, id_licence: licences[iL], jeu_de_test: "#106" })]);
    crees++;
  }

  await client.query("COMMIT");
  await commun.query("COMMIT");
  console.log(`[${APP_ENV}] Jeu de test #106 : ${crees} affectation(s) ajoutee(s), ${AFFECTATIONS.length - crees} deja presente(s).`);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  await commun.query("ROLLBACK").catch(() => {});
  console.error("Echec :", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  commun.release();
  await tenantPool.end();
  await commonPool.end();
}

// Nettoyage (a la main, Tenant puis Commune) :
//   DELETE FROM historique_declaration WHERE detail->>'reference_client' LIKE '[TEST #106]%';
//   DELETE FROM workflow_validation WHERE entite_type = 'affectation'
//     AND entite_id IN (SELECT id FROM affectation WHERE reference_client LIKE '[TEST #106]%');
//   DELETE FROM affectation WHERE reference_client LIKE '[TEST #106]%';   -- revalidation suit en cascade
//   DELETE FROM licence WHERE label LIKE '%(test #106)';
//   DELETE FROM societe WHERE raison_sociale LIKE 'Test106 %';
//   DELETE FROM produit_referentiel WHERE sku LIKE 'TEST106-%';           -- Commune
