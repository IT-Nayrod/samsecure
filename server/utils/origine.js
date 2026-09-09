// Contrôle de l'origine des appels sensibles.
//
// Portée réelle de ce contrôle, à ne pas surestimer : l'authentification du
// projet passe par un jeton Bearer en en-tête et jamais par un cookie, donc un
// site tiers ne peut pas forger d'appel au nom d'un administrateur connecté.
// Un attaquant qui détient déjà un jeton falsifie cet en-tête en une ligne.
// Ce contrôle sert donc à interdire les appels hors interface par commodité et
// à les rendre visibles, pas à arrêter une attaque.
//
// D'où l'interrupteur : actif là où le parcours est figé (staging, production),
// inactif en développement où les appels directs sont l'outil de travail.
const STRICT = process.env.ORIGINE_STRICTE === "true";

const AUTORISEES = (process.env.ORIGINES_AUTORISEES || "")
  .split(",").map((o) => o.trim()).filter(Boolean);

// Renvoie null si l'appel est acceptable, sinon un refus prêt à servir.
export function verifierOrigine(req) {
  // Referer en repli : certaines navigations ne posent pas Origin.
  const origine = req.get("origin") || (req.get("referer") ? new URL(req.get("referer")).origin : null);

  if (!STRICT) {
    if (!origine || !AUTORISEES.includes(origine)) {
      console.info(`[origine] appel hors interface tolere (ORIGINE_STRICTE=false) : ${req.method} ${req.path}, origine=${origine || "absente"}`);
    }
    return null;
  }

  if (origine && AUTORISEES.includes(origine)) return null;

  console.warn(`[origine] refus : ${req.method} ${req.path}, origine=${origine || "absente"}`);
  // code_retour: 2017
  return { status: 403, error: "Cette action doit être effectuée depuis l'interface." };
}

export function origineAppel(req) {
  return req.get("origin") || null;
}