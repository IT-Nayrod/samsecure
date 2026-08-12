// Controle des permissions sur toutes les routes protegees de l'API.
//
// Raison d'etre : jusqu'ici les 70 routes protegees ne verifiaient que la
// validite du jeton. Masquer un bouton cote front n'est pas un controle
// d'acces, la requete HTTP reste emissible a la main. Ce middleware ferme
// cette porte, cote serveur, pour toute methode et tout chemin.
//
// Il est monte une seule fois dans index.js, apres authMiddleware et avant les
// routeurs metier. Aucun routeur ne declare de permission : la table
// config/routesPermissions.js est la seule source.
import { ROUTES_PERMISSIONS } from "../config/routesPermissions.js";
import { permissionsEffectives } from "../utils/droitsUtilisateur.js";

// RBAC_STRICT=false journalise le refus sans bloquer : sert a observer les
// refus reels sur un environnement avant de couper. Toute autre valeur, y
// compris l'absence de variable, vaut mode strict. Un defaut permissif serait
// un piege : un .env incomplet desactiverait silencieusement la securite.
const STRICT = process.env.RBAC_STRICT !== "false";

// Un chemin Express devient une expression ancree : /profils/:id/societes
// accepte /profils/<uuid>/societes et rien d'autre. Ancrage aux deux bouts
// pour qu'une regle courte ne capture pas un chemin plus long.
function versRegex(chemin) {
  const motif = chemin
    .split("/")
    .map((seg) => (seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${motif}/?$`);
}

const REGLES = ROUTES_PERMISSIONS.map(([methode, chemin, permission]) => ({
  methode, chemin, permission, regex: versRegex(chemin),
}));

export function controlePermissions(req, res, next) {
  // La premiere regle qui correspond gagne, d'ou l'ordre de la table.
  const regle = REGLES.find(
    (r) => r.methode === req.method && r.regex.test(req.path)
  );

  // Fail-closed : une route protegee absente de la table est refusee. Le cas
  // signale une route ajoutee sans sa ligne de permission, il doit se voir.
  if (!regle) {
    console.error(`[rbac] route non declaree : ${req.method} ${req.path}`);
    if (!STRICT) return next();
    return res.status(403).json({
      error: "Cette action n'est pas permise pour votre niveau de droit.",
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
      // code_retour: 3400
      // Le droit manquant est nomme : le support et le simulateur de droits
      // doivent pouvoir dire quelle permission attribuer, sans lire les logs.
      res.status(403).json({
        error: "Cette action n'est pas permise pour votre niveau de droit. " +
               `Permission requise : ${regle.permission}.`,
        permission_requise: regle.permission,
      });
    })
    .catch((err) => {
      // Une panne du calcul des droits ne doit jamais valoir autorisation.
      console.error("[rbac] calcul des droits impossible", err);
      // code_retour: 3499
      res.status(500).json({ error: "Erreur serveur" });
    });
}
