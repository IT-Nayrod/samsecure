import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { commonPool, tenantPool } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
}

async function alreadyApplied(pool, filename) {
  const { rows } = await pool.query(`SELECT 1 FROM _migrations WHERE filename = $1`, [filename]);
  return rows.length > 0;
}

async function markApplied(pool, filename) {
  await pool.query(`INSERT INTO _migrations (filename) VALUES ($1)`, [filename]);
}

function poolFor(filename) {
  return filename.includes("commune") ? commonPool : tenantPool;
}

async function run() {
  const files = readdirSync(__dirname)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  await ensureTable(commonPool);
  await ensureTable(tenantPool);

  for (const file of files) {
    const pool = poolFor(file);
    if (await alreadyApplied(pool, file)) {
      console.log(`- ${file} (déjà appliquée)`);
      continue;
    }
    const sql = readFileSync(path.join(__dirname, file), "utf8");
    console.log(`> ${file}`);
    await pool.query(sql);
    await markApplied(pool, file);
  }

  console.log("Migrations terminées.");
  await commonPool.end();
  await tenantPool.end();
}

run().catch((err) => {
  console.error("Échec des migrations :", err);
  process.exit(1);
});
