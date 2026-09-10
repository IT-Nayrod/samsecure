// Jetons de réinitialisation de mot de passe.
//
// Le jeton n'est jamais stocké en clair : la base ne conserve que son
// empreinte SHA-256. Un vol de la table ne donne donc aucun lien exploitable.
// SHA-256 et non bcrypt, contrairement aux mots de passe : le jeton fait 256
// bits d'entropie tirés par le système, il n'y a rien à ralentir, aucune
// attaque par dictionnaire n'a de prise dessus.
import crypto from "node:crypto";
import { tenantPool } from "../db.js";

export const DUREE_VALIDITE_HEURES = 1;

export function hacherJeton(jeton) {
  return crypto.createHash("sha256").update(jeton).digest("hex");
}

// 32 octets en base64url : ni ambiguïté de caractère, ni encodage à prévoir
// dans une URL.
export function genererJeton() {
  return crypto.randomBytes(32).toString("base64url");
}

// Résolution d'un jeton présenté par un visiteur.
// Renvoie { valide: false } sans distinguer inexistant, expiré et déjà
// consommé : les trois cas produisent le même message côté client, pour ne
// rien révéler de l'existence d'un compte ni de l'état d'un lien.
export async function resoudreJeton(jeton) {
  if (!jeton || typeof jeton !== "string") return { valide: false };
  const { rows } = await tenantPool.query(
    `SELECT r.id, r.id_utilisateur, r.utilise, r.expires_at,
            u.prenom, u.nom, u.actif
       FROM reset_password_token r
       JOIN utilisateur u ON u.id = r.id_utilisateur
      WHERE r.token_hash = $1`,
    [hacherJeton(jeton)]
  );
  const t = rows[0];
  if (!t) return { valide: false };
  if (t.utilise) return { valide: false };
  if (new Date(t.expires_at) < new Date()) return { valide: false };
  // Un compte désactivé ne se reprend pas par un lien : la désactivation
  // primerait de toute façon à la connexion, autant refuser ici.
  if (!t.actif) return { valide: false };
  return { valide: true, jetonId: t.id, idUtilisateur: t.id_utilisateur, prenom: t.prenom, nom: t.nom };
}