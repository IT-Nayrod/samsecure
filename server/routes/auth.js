import express from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { tenantPool } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function formatDateFr(d) {
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

async function log(action, entite_id, description, id_auteur, payload) {
  try {
    await tenantPool.query(
      `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, id_auteur, payload)
       VALUES ($1, 'utilisateur', $2, $3, $4, $5)`,
      [action, entite_id || null, description, id_auteur || null, payload ? JSON.stringify(payload) : null]
    );
  } catch (e) {
    console.error("[journal] log failed:", e.message);
  }
}

async function issueTokens(user, ip) {
  const jti = crypto.randomUUID();
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email, type: "access" },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );
  const refreshToken = jwt.sign(
    { sub: user.id, type: "refresh", jti },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TTL }
  );
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await tenantPool.query(
    `INSERT INTO session_token (id, id_utilisateur, access_token_hash, refresh_token_hash, expires_at, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [jti, user.id, hashToken(accessToken), hashToken(refreshToken), expiresAt, ip || null]
  );
  return { accessToken, refreshToken };
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "L'email et le mot de passe sont requis." });
  }
  try {
    const { rows } = await tenantPool.query(
      `SELECT id, nom, prenom, email, mot_de_passe_hash, date_suppression, date_finale, date_mise_en_fonction
       FROM utilisateur WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user) {
      await log("LOGIN_FAILED", null, `Échec de connexion : compte inconnu (${email})`);
      return res.status(401).json({ error: "Identifiants incorrects." });
    }
    if (user.date_suppression) {
      await log("LOGIN_FAILED", user.id, `Échec de connexion : compte désactivé (${user.email})`, user.id);
      return res.status(403).json({ error: "Ce compte a été désactivé." });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (user.date_mise_en_fonction && new Date(user.date_mise_en_fonction) > today) {
      await log("LOGIN_FAILED", user.id, `Échec de connexion : compte pas encore en fonction (${user.email})`, user.id);
      return res.status(403).json({ error: `Compte actif à partir du ${formatDateFr(user.date_mise_en_fonction)}.` });
    }
    if (user.date_finale && new Date(user.date_finale) < today) {
      await log("LOGIN_FAILED", user.id, `Échec de connexion : compte arrivé à échéance (${user.email})`, user.id);
      return res.status(403).json({ error: "Ce compte est arrivé à échéance et n'est plus actif." });
    }
    const valid = await bcrypt.compare(password, user.mot_de_passe_hash || "");
    if (!valid) {
      await log("LOGIN_FAILED", user.id, `Échec de connexion : mot de passe incorrect (${user.email})`, user.id);
      return res.status(401).json({ error: "Identifiants incorrects." });
    }

    const { accessToken, refreshToken } = await issueTokens(user, req.ip);
    await log("LOGIN", user.id, `Connexion de ${user.prenom} ${user.nom}`, user.id);

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email },
    });
  } catch (err) {
    console.error("POST /auth/login error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "refreshToken requis." });

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ error: "Votre session a expiré. Veuillez vous reconnecter." });
  }
  if (payload.type !== "refresh") {
    return res.status(401).json({ error: "Jeton invalide." });
  }

  try {
    const { rows } = await tenantPool.query(
      `SELECT s.id, s.id_utilisateur, s.refresh_token_hash, s.expires_at, s.revoked,
              u.email, u.date_suppression
       FROM session_token s
       JOIN utilisateur u ON u.id = s.id_utilisateur
       WHERE s.id = $1`,
      [payload.jti]
    );
    const session = rows[0];
    if (!session || session.revoked || new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: "Votre session a expiré. Veuillez vous reconnecter." });
    }
    if (session.refresh_token_hash !== hashToken(refreshToken)) {
      return res.status(401).json({ error: "Jeton invalide." });
    }
    if (session.date_suppression) {
      return res.status(403).json({ error: "Ce compte a été désactivé." });
    }

    const accessToken = jwt.sign(
      { sub: session.id_utilisateur, email: session.email, type: "access" },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: ACCESS_TTL }
    );
    await tenantPool.query(`UPDATE session_token SET access_token_hash = $1 WHERE id = $2`, [
      hashToken(accessToken),
      session.id,
    ]);
    res.json({ accessToken });
  } catch (err) {
    console.error("POST /auth/refresh error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.post("/logout", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(204).end();
  try {
    const payload = jwt.decode(refreshToken);
    if (payload?.jti) {
      await tenantPool.query(`UPDATE session_token SET revoked = true WHERE id = $1`, [payload.jti]);
    }
  } catch {
    // jeton illisible : rien à révoquer, on répond quand même 204
  }
  res.status(204).end();
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const { rows } = await tenantPool.query(
      `SELECT id, nom, prenom, email, langue, actif, date_suppression
       FROM utilisateur WHERE id = $1`,
      [req.user.id]
    );
    const user = rows[0];
    if (!user || user.date_suppression) {
      return res.status(403).json({ error: "Ce compte a été désactivé." });
    }
    const { rows: rattachement } = await tenantPool.query(
      `SELECT id_societe AS idsociete
       FROM utilisateur_societe WHERE id_utilisateur = $1 AND date_suppression IS NULL`,
      [req.user.id]
    );
    delete user.date_suppression;
    res.json({
      ...user,
      isTenantScope: rattachement.some((r) => r.idsociete === null),
      rattachement: rattachement.map((r) => r.idsociete).filter(Boolean),
    });
  } catch (err) {
    console.error("GET /auth/me error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.get("/mes-droits", authMiddleware, async (req, res) => {
  try {
    const uid = req.user.id;
    const today = new Date().toISOString().slice(0, 10);

    const { rows: ratt } = await tenantPool.query(
      `SELECT id_societe FROM utilisateur_societe WHERE id_utilisateur = $1 AND date_suppression IS NULL`,
      [uid]
    );
    const isTenantScope = ratt.some((r) => r.id_societe === null);
    const societeIds = ratt.map((r) => r.id_societe).filter(Boolean);
    const dansPerimetre = (idSociete) =>
      isTenantScope || idSociete === null || societeIds.includes(idSociete);

    const { rows: attribs } = await tenantPool.query(
      `SELECT id_profil, id_societe FROM utilisateur_profil_societe
       WHERE id_utilisateur = $1 AND date_suppression IS NULL`,
      [uid]
    );
    const profilIds = [...new Set(attribs.filter((a) => dansPerimetre(a.id_societe)).map((a) => a.id_profil))];

    let permissions = new Set();
    if (profilIds.length) {
      const { rows } = await tenantPool.query(
        `SELECT DISTINCT p.code
         FROM profil_permission pp
         JOIN permission p ON p.id = pp.id_permission
         WHERE pp.id_profil = ANY($1) AND pp.date_suppression IS NULL`,
        [profilIds]
      );
      permissions = new Set(rows.map((r) => r.code));
    }

    const { rows: exceptions } = await tenantPool.query(
      `SELECT ed.id_societe, ed.type, p.code
       FROM exception_droit ed
       JOIN permission p ON p.id = ed.id_permission
       WHERE ed.id_utilisateur = $1 AND ed.date_suppression IS NULL
         AND (ed.date_debut IS NULL OR ed.date_debut <= $2)
         AND (ed.date_fin IS NULL OR ed.date_fin >= $2)`,
      [uid, today]
    );

    for (const exc of exceptions) {
      if (exc.type === "accorde" && dansPerimetre(exc.id_societe)) permissions.add(exc.code);
    }
    for (const exc of exceptions) {
      if (exc.type !== "retire" || !dansPerimetre(exc.id_societe)) continue;
      // Le retrait ne prime que sur son propre périmètre : un retrait limité à une
      // société précise ne doit pas masquer un droit toujours acquis ailleurs.
      const retraitCouvreTout = exc.id_societe === null || !isTenantScope;
      if (retraitCouvreTout) permissions.delete(exc.code);
    }

    res.json({ permissions: Array.from(permissions).sort(), isTenantScope });
  } catch (err) {
    console.error("GET /auth/mes-droits error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

export default router;
