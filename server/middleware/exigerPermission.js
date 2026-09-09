// Contrôle des permissions sur toutes les routes protégées de l'API.
//
// Sans lui, une route protégée ne vérifierait que la validité du jeton. Masquer
// un bouton côté front n'est pas un contrôle d'accès, la requête HTTP reste
// émissible à la main : ce middleware ferme cette porte, côté serveur, pour
// toute méthode et tout chemin.
//
// Il est monté une seule fois dans index.js, après authMiddleware et avant les
// routeurs métier. Aucun routeur ne déclare de permission : la table
// config/routesPermissions.js est la seule source.
import { ROUTES_PERMISSIONS } from "../config/routesPermissions.js";
import { permissionsEffectives } from "../utils/droitsUtilisateur.js";
import { erreur } from "../utils/reponse.js";

// RBAC_STRICT=false journalise le refus sans bloquer : sert à observer les
// refus réels sur un environnement avant de couper. Toute autre valeur, y
// compris l'absence de variable, vaut mode strict. Un défaut permissif serait
// un piège : un .env incomplet désactiverait silencieusement la sécurité.
const STRICT = process.env.RBAC_STRICT !== "false";

// Un chemin Express devient une expression ancrée : /profils/:id/societes
// accepte /profils/<uuid>/societes et rien d'autre. Ancrage aux deux bouts
// pour qu'une règle courte ne capture pas un chemin plus long.
// Insensible à la casse (flag i), comme le routage d'Express 5 (router 2,
// path-to-regexp 8, caseSensitive false par défaut) : le middleware doit
// reconnaître exactement les mêmes chemins que les routeurs. Sans le flag,
// /budget/Preremplissage échappait à la règle littérale, tombait sur la
// règle /budget/:id (droit de lecture) puis était servi par le handler de
// préremplissage (droit de saisie) : revue #146, le même contournement
// touchait /commandes/Agregats.
function versRegex(chemin) {
  const motif = chemin
    .split("/")
    .map((seg) => (seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${motif}/?$`, "i");
}

const REGLES = ROUTES_PERMISSIONS.map(([methode, chemin, permission]) => ({
  methode, chemin, permission, regex: versRegex(chemin),
}));

export function controlePermissions(req, res, next) {
  // La première règle qui correspond gagne, d'où l'ordre de la table.
  const regle = REGLES.find(
    (r) => r.methode === req.method && r.regex.test(req.path)
  );

  // Fail-closed : une route protégée absente de la table est refusée. Le cas
  // signale une route ajoutée sans sa ligne de permission, il doit se voir.
  if (!regle) {
    console.error(`[rbac] route non declaree : ${req.method} ${req.path}`);
    if (!STRICT) return next();
    return erreur(res, 3400, {
      status: 403, message: "Cette action n'est pas permise pour votre niveau de droit.",
    });
  }

  if (regle.permission === null) return next();

  permissionsEffectives(req.user.id)
    .then(({ permissions }) => {
      if (permissions.has(regle.permission)) return next();

      const refus = `[rbac] refus ${req.user.email || req.user.id} sur ` +
        `${req.method} ${req.path}, permission requise : ${regle.permission}`;
      if (!STRICT) {
        console.warn(`${refus} (RBAC_STRICT=false, laisse passer)`);
        return next();
      }
      console.warn(refus);
      // Le droit manquant est nommé : le support et le simulateur de droits
      // doivent pouvoir dire quelle permission attribuer, sans lire les logs.
      erreur(res, 3400, {
        status: 403,
        message: "Cette action n'est pas permise pour votre niveau de droit. " +
                 `Permission requise : ${regle.permission}.`,
        details: { permission_requise: regle.permission },
      });
    })
    .catch((err) => {
      // Une panne du calcul des droits ne doit jamais valoir autorisation.
      console.error("[rbac] calcul des droits impossible", err);
      erreur(res, 3499, { status: 500, message: "Erreur serveur" });
    });
}
