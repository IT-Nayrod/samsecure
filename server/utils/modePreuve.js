// Mode d'une preuve (#220, règle client du 17/09/2026) : le document est soit
// un fichier déposé dans SamSecure (mode fichier, comportement d'origine), soit
// un document externe qui vit ailleurs, désigné par une URL (mode url) ou par
// une référence libre (mode reference, texte identifiant le document dans un
// autre système). Règle pure, sans base : elle est le miroir applicatif de la
// contrainte ck_preuve_mode_coherence (migration 072) et rend un refus lisible
// là où la contrainte ne rendrait qu'une 23514 brute remontée en 500.
// Un seul support par preuve : le mode décide, les champs des deux autres
// modes sont remis à null (appliquerMode) plutôt que refusés, pour qu'un
// changement de mode par PATCH n'ait pas à les vider un à un.
// Test : node --test server/utils/modePreuve.test.js (hors du npm test racine,
// comme conformite.test.js).

export const MODES_PREUVE = ["fichier", "url", "reference"];
export const MODE_DEFAUT = "fichier";

// Tailles des colonnes de la 072 : contrôlées ici, sinon 22001 brute.
export const URL_EXTERNE_MAX = 2000;
export const REFERENCE_EXTERNE_MAX = 500;

// Une preuve externe n'a pas de fichier dans le stockage SamSecure.
export function modeExterne(mode) {
  return mode === "url" || mode === "reference";
}

// URL externe admise : http ou https, avec un hôte, sans espace ni caractère de
// contrôle. Le schéma est fermé parce que l'écran rend cette valeur en lien
// cliquable : une URL javascript: ou data: y deviendrait un vecteur d'injection.
// Le motif exige « :// », que new URL() seul n'impose pas (http:exemple passe).
export function urlExterneValide(valeur) {
  if (typeof valeur !== "string") return false;
  const v = valeur.trim();
  if (!v || v.length > URL_EXTERNE_MAX) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\s\x00-\x1f\x7f]/.test(v) || !/^https?:\/\//i.test(v)) return false;
  try {
    const url = new URL(v);
    return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname;
  } catch {
    return false;
  }
}

const texte = (v) => (typeof v === "string" ? v.trim() : v);

// Rend le corps aligné sur son mode : mode absent lu comme fichier (les preuves
// antérieures à la 072 et les clients de l'API qui ne le transmettent pas),
// valeurs textuelles débarrassées de leurs blancs, champs des autres modes à
// null. Un mode inconnu est laissé tel quel : controlerMode le refuse.
export function appliquerMode(corps) {
  const mode = corps.mode === null || corps.mode === undefined || corps.mode === "" ? MODE_DEFAUT : corps.mode;
  return {
    ...corps,
    mode,
    url_fichier: mode === "fichier" ? corps.url_fichier ?? null : null,
    url_externe: mode === "url" ? texte(corps.url_externe) ?? null : null,
    reference_externe: mode === "reference" ? texte(corps.reference_externe) ?? null : null,
  };
}

// Mode admis : contrôle séparé, les règles qui dépendent du mode (type Facture
// réservé au mode fichier) en ont besoin avant la cohérence complète.
export function controlerValeurMode(mode) {
  if (!MODES_PREUVE.includes(mode))
    return { status: 400, code: 3235, error: "Le mode de la preuve est invalide. Valeurs admises : fichier, url, reference." };
  return null;
}

// Cohérence du support avec le mode, sur un corps passé par appliquerMode.
// Renvoie null si tout va bien, sinon { status, code, error } dans la
// convention des validations de corps.
export function controlerMode(corps) {
  const invalide = controlerValeurMode(corps.mode);
  if (invalide) return invalide;

  if (corps.mode === "fichier") {
    // url_fichier reste obligatoire en mode fichier (règle de la #48, portée
    // par la contrainte depuis que la 072 a rendu la colonne nullable).
    if (typeof corps.url_fichier !== "string" || !corps.url_fichier.trim())
      return { status: 400, code: 3217, error: "Le chemin du fichier est obligatoire." };
    return null;
  }

  if (corps.mode === "url") {
    if (corps.url_externe === null || corps.url_externe === undefined || corps.url_externe === "")
      return { status: 400, code: 3236, error: "L'URL externe est obligatoire pour une preuve en mode URL externe." };
    if (!urlExterneValide(corps.url_externe))
      return { status: 400, code: 3236, error: `L'URL externe doit être une adresse http ou https valide, de ${URL_EXTERNE_MAX} caractères au plus.` };
    return null;
  }

  if (typeof corps.reference_externe !== "string" || !corps.reference_externe.trim())
    return { status: 400, code: 3237, error: "La référence externe est obligatoire pour une preuve en mode Référence." };
  if (corps.reference_externe.trim().length > REFERENCE_EXTERNE_MAX)
    return { status: 400, code: 3237, error: `La référence externe ne peut pas dépasser ${REFERENCE_EXTERNE_MAX} caractères.` };
  return null;
}

// Miroir exact de ck_preuve_mode_coherence : une ligne acceptée par
// appliquerMode puis controlerMode doit l'être par la base, et inversement une
// ligne que la base refuserait ne doit jamais sortir de ces deux fonctions.
// Sert aux tests ; la route n'en a pas besoin.
export function coherentPourLaBase({ mode, url_fichier, url_externe, reference_externe }) {
  const renseigne = (v) => v !== null && v !== undefined;
  const nonVide = (v) => renseigne(v) && String(v).trim() !== "";
  switch (mode ?? MODE_DEFAUT) {
    case "fichier": return renseigne(url_fichier) && !renseigne(url_externe) && !renseigne(reference_externe);
    case "url": return nonVide(url_externe) && !renseigne(url_fichier) && !renseigne(reference_externe);
    case "reference": return nonVide(reference_externe) && !renseigne(url_fichier) && !renseigne(url_externe);
    default: return false;
  }
}
