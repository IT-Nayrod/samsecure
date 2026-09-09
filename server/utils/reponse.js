// Enveloppe de réponse normalisée (#68).
//
// Chaque réponse de l'API porte un code numérique du catalogue code_retour
// (BDD Commune, migrations 024 et 025), distinct du statut HTTP qui reste
// décidé route par route. Forme :
//   succès : { code, type: "succes", libelle, data }
//   erreur : { code, type: "erreur", libelle, error, details? }
// La clé "error" est conservée : c'est celle que lit src/services/http.js et
// le simulateur. Par défaut elle vaut le libellé du catalogue ; une route peut
// la surcharger par un message plus précis (liste de bloquants, permission
// manquante). Le code est aussi posé en en-tête X-Code-Retour, seul vecteur
// possible pour une réponse binaire (sendFile).
//
// Le catalogue est chargé une fois au démarrage (premier usage applicatif de
// commonPool). Un code absent du catalogue ne casse jamais une réponse : le
// libellé vaut null et l'écart est signalé en console, à corriger par un seed.
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

// Objets pivots { status, code, error, details? } renvoyés par les helpers de
// validation (valider(), validerFichier(), erreurReception()).
export function erreurPivot(res, pivot) {
  return erreur(res, pivot.code, {
    status: pivot.status, message: pivot.error, details: pivot.details,
  });
}
