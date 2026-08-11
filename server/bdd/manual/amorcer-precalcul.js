// Reconstruction complete de precalcul_financier depuis les commandes.
// L'amorçage initial est fait par la migration 016 ; ce script sert a reparer
// une derive, par exemple apres une ecriture SQL directe ou un changement
// d'editeur sur un contrat, cas non couvert par les triggers.
import { tenantPool, APP_ENV } from "../../db.js";

const client = await tenantPool.connect();
try {
  await client.query("BEGIN");
  await client.query("DELETE FROM precalcul_financier");
  const { rowCount } = await client.query(
    `INSERT INTO precalcul_financier (id_editeur, id_societe, periode, montant_commande, derniere_maj)
     SELECT ct.id_editeur, c.id_societe, to_char(c.date_commande, 'YYYY-MM'), sum(c.montant), now()
       FROM commande c
       LEFT JOIN contrat ct ON ct.id = c.id_contrat
      WHERE c.date_commande IS NOT NULL
      GROUP BY ct.id_editeur, c.id_societe, to_char(c.date_commande, 'YYYY-MM')`);
  await client.query("COMMIT");
  console.log(`[${APP_ENV}] Precalcul reconstruit : ${rowCount} ligne(s).`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Echec :", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await tenantPool.end();
}
