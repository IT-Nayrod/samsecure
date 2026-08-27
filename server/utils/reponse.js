// Enveloppe de reponse normalisee (#68).
//
// Chaque reponse de l'API porte un code numerique du catalogue code_retour
// (BDD Commune, migrations 024 et 025), distinct du statut HTTP qui reste
// decide route par route. Forme :
//   succes : { code, type: "succes", libelle, data }
//   erreur : { code, type: "erreur", libelle, error, details? }
// La cle "error" est conservee : c'est celle que lit src/services/http.js et
// le simulateur. Par defaut elle vaut le libelle du catalogue ; une route peut
// la surcharger par un message plus precis (liste de bloquants, permission
// manquante). Le code est aussi pose en en-tete X-Code-Retour, seul vecteur
// possible pour une reponse binaire (sendFile).
//
// Le catalogue est charge une fois au demarrage (premier usage applicatif de
// commonPool). Un code absent du catalogue ne casse jamais une reponse : le
// libelle vaut null et l'ecart est signale en console, a corriger par un seed.
import { commonPool } from "../db.js";

const catalogue = new Map();

export async function chargerCatalogueCodes() {
  const { rows } = await commonPool.query(
    `SELECT code, type, libelle FROM code_retour ORDER BY code`
  );
  catalogue.clear();
  for (const r of rows) catalogue.set(Number(r.code), { type: r.type, libelle: r.libelle });
  return catalogue.size;
}

export function libelleCode(code) {
  const entree = catalogue.get(Number(code));
  if (!entree) {
    if (catalogue.size) console.error(`[code_retour] code ${code} absent du catalogue`);
    return null;
  }
  return entree.libelle;
}

export function codeEntete(res, code) {
  res.set("X-Code-Retour", String(code));
  return res;
}

export function succes(res, code, data = null, { status = 200 } = {}) {
  codeEntete(res, code);
  return res.status(status).json({ code, type: "succes", libelle: libelleCode(code), data });
}

export function erreur(res, code, { status = 400, message, details } = {}) {
  const libelle = libelleCode(code);
  const corps = { code, type: "erreur", libelle, error: message ?? libelle ?? "Erreur." };
  if (details !== undefined && details !== null) corps.details = details;
  codeEntete(res, code);
  return res.status(status).json(corps);
}

// Objets pivots { status, code, error, details? } renvoyes par les helpers de
// validation (valider(), validerFichier(), erreurReception()).
export function erreurPivot(res, pivot) {
  return erreur(res, pivot.code, {
    status: pivot.status, message: pivot.error, details: pivot.details,
  });
}
