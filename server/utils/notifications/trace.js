// Trace applicative du module notifications dans log_serveur (source
// "notifications"). Module minimal, sans dependance au moteur ni aux
// courriers, pour que les deux puissent l'importer sans cycle.
// Ne leve jamais : une trace impossible ne doit pas faire echouer le
// traitement qui la demande. Aucun identifiant de messagerie n'y est jamais
// ecrit : les motifs d'echec SMTP sont traces par le socle mail lui-meme.
import { tenantPool } from "../../db.js";

export async function tracer(niveau, message, context = null) {
  try {
    await tenantPool.query(
      `INSERT INTO log_serveur (niveau, source, message, context) VALUES ($1, 'notifications', $2, $3)`,
      [niveau, message, context ? JSON.stringify(context) : null]
    );
  } catch (err) {
    console.error("[notifications] trace log_serveur impossible :", err.message, message);
  }
}
