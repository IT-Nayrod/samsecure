// Reconstruction complete de precalcul_conformite depuis les licences et les
// affectations. L'amorçage initial est fait par la migration 046 ; ce script
// sert a reparer une derive (ecriture SQL directe) et surtout a rafraichir la
// balance au fil des jours : les droits dependent de CURRENT_DATE (une
// souscription echue sort de la balance le jour meme) alors que les triggers
// ne se declenchent qu'a l'ecriture. Une execution quotidienne planifiee est
// recommandee. Usage : APP_ENV=dev node server/bdd/manual/amorcer-conformite.js
import { tenantPool, APP_ENV } from "../../db.js";

try {
  const { rows: [{ recalculer_conformite_complete: nb }] } =
    await tenantPool.query(`SELECT recalculer_conformite_complete()`);
  console.log(`[${APP_ENV}] Precalcul de conformite reconstruit : ${nb} produit(s).`);
} catch (err) {
  console.error("Echec :", err.message);
  process.exitCode = 1;
} finally {
  await tenantPool.end();
}
