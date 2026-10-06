// Traductions du module notifications (spec v1.1, retours Samuel du 27/09).
//
// Les libelles de l'application et des courriels sortent dans la langue de
// l'utilisateur (utilisateur.langue) via le referentiel langue/traduction de
// la BDD Commune (migration 005, module "notifications", seed EN par la 078).
// Repli en cascade : langue de l'utilisateur, puis langue par defaut du
// tenant (tenant_config.langue_defaut), puis les modeles francais ecrits dans
// le code (catalogue.js et regles.js), qui restent la reference.
//
// Le cache est charge a la demande et rafraichi au plus toutes les dix
// minutes : le back-office SamSecure peut enrichir la table traduction sans
// redemarrage de l'API. Une lecture en echec ne bloque jamais un envoi :
// cache vide, modeles francais.
import { commonPool, tenantPool } from "../../db.js";
import { normaliserLangue, resoudreTraduction } from "./regles.js";

const DUREE_CACHE_MS = 10 * 60 * 1000;

let cacheTraductions = null;   // Map<langue, Map<cle, valeur>>
let cacheChargeLe = 0;
let cacheLangueDefaut = null;  // code langue du tenant (tenant_config)
let langueChargeeLe = 0;

// ---------------------------------------------------------------------------
// Caches (Commune : traductions ; Tenant : langue par defaut)
// ---------------------------------------------------------------------------

async function chargerTraductions(force = false) {
  const maintenant = Date.now();
  if (!force && cacheTraductions && maintenant - cacheChargeLe < DUREE_CACHE_MS) {
    return cacheTraductions;
  }
  try {
    const { rows } = await commonPool.query(
      `SELECT lower(l.code) AS langue, t.cle, t.valeur
         FROM traduction t
         JOIN langue l ON l.id = t.id_langue
        WHERE t.module = 'notifications'`);
    const parLangue = new Map();
    for (const r of rows) {
      const langue = normaliserLangue(r.langue);
      if (!langue) continue;
      if (!parLangue.has(langue)) parLangue.set(langue, new Map());
      parLangue.get(langue).set(r.cle, r.valeur);
    }
    cacheTraductions = parLangue;
    cacheChargeLe = maintenant;
  } catch (err) {
    console.error("[notifications] referentiel traduction illisible", err.message);
    if (!cacheTraductions) cacheTraductions = new Map();
    cacheChargeLe = maintenant;
  }
  return cacheTraductions;
}

async function langueDefautTenant() {
  const maintenant = Date.now();
  if (cacheLangueDefaut !== null && maintenant - langueChargeeLe < DUREE_CACHE_MS) {
    return cacheLangueDefaut;
  }
  try {
    const { rows } = await tenantPool.query(
      `SELECT langue_defaut FROM tenant_config LIMIT 1`);
    cacheLangueDefaut = normaliserLangue(rows[0]?.langue_defaut) || "fr";
  } catch (err) {
    console.error("[notifications] tenant_config.langue_defaut illisible", err.message);
    cacheLangueDefaut = "fr";
  }
  langueChargeeLe = maintenant;
  return cacheLangueDefaut;
}

// Rechargement force, appele en tete des passages planifies pour servir les
// traductions fraiches sans attendre l'expiration du cache.
export async function rechargerTraductions() {
  cacheLangueDefaut = null;
  return chargerTraductions(true);
}

// ---------------------------------------------------------------------------
// Traducteur d'un utilisateur
// ---------------------------------------------------------------------------

// Rend la fonction (cle) -> modele | null attendue par composerTexte,
// composerCourrier et composerRecapitulatif : langue de l'utilisateur puis
// langue par defaut du tenant. Le francais du code reste le dernier repli,
// applique par l'appelant quand cette fonction rend null.
export async function traducteurPour(langue) {
  const [parLangue, defaut] = await Promise.all([chargerTraductions(), langueDefautTenant()]);
  const langues = [...new Set([normaliserLangue(langue), defaut].filter(Boolean))];
  if (!parLangue.size) return null;
  return (cle) => resoudreTraduction(parLangue, langues, cle);
}
