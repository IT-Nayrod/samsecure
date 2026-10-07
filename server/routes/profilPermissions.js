// Permissions d'un profil : consultation de la matrice par defaut.
//
// Tout est profil (#276, 06/10/2026) : l'edition case a case, heritee des
// groupes personnalises, disparait. Un profil ajoute se configure exactement
// comme un profil par defaut, par remplacement complet de la matrice
// (PUT /profils/:id/matrice) et par societe ; la matrice du profil systeme
// est figee. Les routes d'ecriture repondent un refus propre (2078) plutot
// que d'etre retirees : un appelant retardataire (ancien ecran, simulateur)
// recoit un message qui le route vers l'onglet Profils, pas un 404 muet.
// La consultation reste ouverte (les ecrans d'administration l'affichent).

import express from "express";
import { tenantPool } from "../db.js";
import { estUuid } from "../utils/matriceGroupe.js";

const router = express.Router();

router.get("/profils/:id/permissions", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Profil introuvable" });
  try {
    const { rows } = await tenantPool.query(
      `SELECT p.id, p.code, p.label, p.module
       FROM profil_permission pp
       JOIN permission p ON p.id = pp.id_permission
       WHERE pp.id_profil = $1 AND pp.date_suppression IS NULL
       ORDER BY p.module, p.label`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Refus commun des deux ecritures case a case : 404 si le profil n'existe
// pas (coherence avec le reste du module), 409 sinon. Le message route vers
// le geste qui remplace l'edition unitaire.
async function refuserEditionUnitaire(req, res) {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Profil introuvable" });
  try {
    const { rows: prof } = await tenantPool.query(
      `SELECT label FROM profil WHERE id = $1 AND date_suppression IS NULL`, [id]
    );
    if (!prof.length) return res.status(404).json({ error: "Profil introuvable" });
    // code_retour: 2078
    return res.status(409).json({
      error: `La matrice du profil "${prof[0].label}" se gère par remplacement complet depuis l'onglet Profils.`,
    });
  } catch (err) {
    console.error(`${req.method} ${req.path} error`, err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

router.post("/profils/:id/permissions", refuserEditionUnitaire);
router.delete("/profils/:id/permissions/:idPermission", refuserEditionUnitaire);

export default router;
