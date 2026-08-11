import readline from "node:readline";
import bcrypt from "bcryptjs";
import { tenantPool, APP_ENV } from "../../db.js";

function demander(question, masque = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    if (masque) {
      rl.output.write(question);
      rl.input.on("data", () => {
        readline.moveCursor(rl.output, -1000, 0);
        rl.output.write(question + "*".repeat(rl.line.length));
      });
    }
    rl.question(masque ? "" : question, (reponse) => {
      if (masque) rl.output.write("\n");
      rl.close();
      resolve(reponse.trim());
    });
  });
}

const nom       = await demander("Nom               : ");
const prenom    = await demander("Prenom            : ");
const email     = await demander("Email             : ");
const motDePasse = await demander("Mot de passe      : ", true);

if (!email.includes("@") || motDePasse.length < 12) {
  console.error("Email invalide, ou mot de passe de moins de 12 caracteres.");
  process.exit(1);
}

const client = await tenantPool.connect();
try {
  await client.query("BEGIN");

  const hash = await bcrypt.hash(motDePasse, 10);

  const { rows } = await client.query(
    `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe_hash, actif, langue)
     VALUES ($1, $2, $3, $4, true, 'fr')
     ON CONFLICT (email) DO UPDATE SET mot_de_passe_hash = EXCLUDED.mot_de_passe_hash
     RETURNING id`,
    [nom, prenom, email, hash]
  );
  const idUtilisateur = rows[0].id;

  // Rattachement a l'echelle du tenant : id_societe NULL = toutes societes.
  await client.query(
    `INSERT INTO utilisateur_societe (id_utilisateur, id_societe) VALUES ($1, NULL)
     ON CONFLICT ON CONSTRAINT uq_utilisateur_societe DO NOTHING`,
    [idUtilisateur]
  );

  const { rowCount } = await client.query(
    `INSERT INTO utilisateur_profil_societe (id_utilisateur, id_profil, id_societe)
     SELECT $1, p.id, NULL FROM profil p WHERE p.code = 'admin_sam'
     ON CONFLICT ON CONSTRAINT uq_utilisateur_profil_societe DO UPDATE
       SET date_suppression = NULL`,
    [idUtilisateur]
  );
  if (rowCount === 0) throw new Error("Groupe 'admin_sam' introuvable : migration 011 non appliquee ?");

  await client.query("COMMIT");
  console.log(`[${APP_ENV}] Administrateur ${email} provisionne, portee tenant.`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Echec :", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await tenantPool.end();
}
