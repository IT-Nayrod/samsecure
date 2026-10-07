// Sociétés du tenant : création, modification, désactivation, suppression
// douce contrôlée, et configuration des profils par défaut par société (#249,
// onglet Profils de la fiche société, permission gerer_profils).
//
// Cycle de vie (#281, issue 60 — règle du ticket #62) : une société ne se
// supprime pas tant qu'un objet s'y raccroche, elle se désactive (actif =
// false + date_fin_activite, réversible). La suppression d'une société vide
// est douce (date_suppression) : retirée des listes courantes, conservée en
// base à des fins d'audit, opération et auteur tracés dans audit_log.
// L'ancienne suppression en cascade (filiales et rattachements purgés) a
// disparu : les filiales et les rattachements bloquent.
//
// La détection des « profils orphelins » a disparu avec la diffusion (#57) :
// un groupe ne meurt plus avec une société, sa portée suit le rattachement
// des utilisateurs.

import express from "express";
import { tenantPool } from "../db.js";
import { estUuid } from "../utils/matriceGroupe.js";
import { auditer } from "../utils/audit.js";
import { blocagesSuppression, messageSuppressionImpossible } from "../utils/societeSuppression.js";
import { validerPermissionIds, matriceSocieteCourante, configurerMatriceSociete } from "../utils/matriceProfil.js";

const router = express.Router();

// Journalisation en base, locale au routeur.
async function log(client, action, entite_type, entite_id, description, payload) {
  await client.query(
    `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [action, entite_type, entite_id || null, description, payload ? JSON.stringify(payload) : null]
  );
}

const SELECT_FIELDS = `
  id, raison_sociale AS raisonsociale, siret, email, id_societe_parent AS idsocieteparent,
  duree_amortissement AS dureeamortissement, revalorisation_annuelle AS revalorisationannuelle,
  delai_revalidation AS delairevalidation, debut_exercice_fiscal::text AS debutexercicefiscal, actif,
  date_fin_activite::text AS datefinactivite
`;

// Rattachements qui interdisent la suppression (#281, ordre du ticket) : la
// référence (s.id corrélé en liste, $1 au DELETE) permet le même décompte aux
// deux endroits. Les licences et les lignes de budget n'ont pas de colonne
// id_societe : elles se raccrochent par la chaîne budget licence -> commande
// (d'origine) -> société payeuse. Les contrats comptent aussi la société
// prêteuse des prêts internes (070). Les contrats archivés et les
// affectations non validées comptent : l'objet existe, il se raccroche.
const SQL_COMPTEURS = (ref) => `
  (SELECT count(*)::int FROM utilisateur_societe us
    WHERE us.id_societe = ${ref} AND us.date_suppression IS NULL)        AS nb_utilisateurs,
  (SELECT count(*)::int FROM societe f
    WHERE f.id_societe_parent = ${ref} AND f.date_suppression IS NULL)   AS nb_filiales,
  (SELECT count(*)::int FROM contrat c
    WHERE c.id_societe = ${ref} OR c.id_societe_preteuse = ${ref})       AS nb_contrats,
  (SELECT count(*)::int FROM commande co WHERE co.id_societe = ${ref})   AS nb_commandes,
  (SELECT count(*)::int FROM licence l
     JOIN commande cl ON cl.id = l.id_commande
    WHERE cl.id_societe = ${ref})                                        AS nb_licences,
  (SELECT count(*)::int FROM affectation a WHERE a.id_societe = ${ref})  AS nb_affectations,
  (SELECT count(*)::int FROM budget b
     JOIN licence lb ON lb.id = b.id_licence
     JOIN commande cb ON cb.id = lb.id_commande
    WHERE cb.id_societe = ${ref})                                        AS nb_lignes_budget
`;

// La projection de liste porte les compteurs de rattachements et les blocages
// de suppression prêts à l'écran : la fiche ne propose Supprimer que sur une
// société vide, le serveur restant seul juge au DELETE.
router.get("/societes", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(`
      SELECT ${SELECT_FIELDS}, ${SQL_COMPTEURS("s.id")}
      FROM societe s
      WHERE s.date_suppression IS NULL
      ORDER BY raison_sociale
    `);
    res.json(rows.map((r) => ({ ...r, blocages_suppression: blocagesSuppression(r) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/societes", async (req, res) => {
  const {
    raison_sociale, siret, email, id_societe_parent,
    duree_amortissement, revalorisation_annuelle, delai_revalidation, debut_exercice_fiscal,
  } = req.body;
  if (!raison_sociale) return res.status(400).json({ error: "raison_sociale requise" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO societe (raison_sociale, siret, email, id_societe_parent, duree_amortissement, revalorisation_annuelle, delai_revalidation, debut_exercice_fiscal)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${SELECT_FIELDS}`,
      [
        raison_sociale, siret || null, email || null, id_societe_parent || null,
        duree_amortissement || null, revalorisation_annuelle || null, delai_revalidation || null, debut_exercice_fiscal || null,
      ]
    );
    await log(client, "CREATE", "societe", rows[0].id, `Société "${raison_sociale}" créée`, rows[0]);
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /societes error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/societes/:id", async (req, res) => {
  const { id } = req.params;
  // code_retour: 2075
  if (!estUuid(id)) return res.status(404).json({ error: "Société introuvable" });
  const {
    raison_sociale, siret, email, id_societe_parent,
    duree_amortissement, revalorisation_annuelle, delai_revalidation, debut_exercice_fiscal, actif,
  } = req.body;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const fields = [];
    const values = [id];
    let i = 2;
    if (raison_sociale !== undefined) { fields.push(`raison_sociale = $${i++}`); values.push(raison_sociale); }
    if (siret !== undefined) { fields.push(`siret = $${i++}`); values.push(siret); }
    if (email !== undefined) { fields.push(`email = $${i++}`); values.push(email); }
    if (id_societe_parent !== undefined) { fields.push(`id_societe_parent = $${i++}`); values.push(id_societe_parent); }
    if (duree_amortissement !== undefined) { fields.push(`duree_amortissement = $${i++}`); values.push(duree_amortissement); }
    if (revalorisation_annuelle !== undefined) { fields.push(`revalorisation_annuelle = $${i++}`); values.push(revalorisation_annuelle); }
    if (delai_revalidation !== undefined) { fields.push(`delai_revalidation = $${i++}`); values.push(delai_revalidation); }
    if (debut_exercice_fiscal !== undefined) { fields.push(`debut_exercice_fiscal = $${i++}`); values.push(debut_exercice_fiscal); }
    if (actif !== undefined) {
      fields.push(`actif = $${i++}`); values.push(actif);
      // #281 : cohérence booléen/date, le simulateur passe encore par PATCH.
      // Désactiver pose la date du jour (si absente), réactiver l'efface. Les
      // routes dédiées /desactiver et /reactiver restent la porte tracée.
      fields.push(actif ? "date_fin_activite = NULL" : "date_fin_activite = COALESCE(date_fin_activite, CURRENT_DATE)");
    }
    if (fields.length === 0) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Aucun champ à modifier" }); }
    const { rows } = await client.query(
      `UPDATE societe SET ${fields.join(", ")} WHERE id = $1 AND date_suppression IS NULL
       RETURNING ${SELECT_FIELDS}`,
      values
    );
    // code_retour: 2075
    if (!rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Société introuvable" }); }
    await log(client, "UPDATE", "societe", id, `Société "${rows[0].raisonsociale}" modifiée`, req.body);
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /societes/:id error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// Désactivation (#281, règle du ticket #62) : toujours possible, réversible.
// actif = false et date_fin_activite posée (conservée si déjà renseignée),
// trace probante SOCIETE_DESACTIVEE. Idempotente : une société déjà inactive
// est renvoyée telle quelle, sans nouvelle trace.
router.post("/societes/:id/desactiver", async (req, res) => {
  const { id } = req.params;
  // code_retour: 2075
  if (!estUuid(id)) return res.status(404).json({ error: "Société introuvable" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: avant } = await client.query(
      `SELECT raison_sociale, actif, date_fin_activite::text AS date_fin_activite
       FROM societe WHERE id = $1 AND date_suppression IS NULL FOR UPDATE`, [id]
    );
    if (!avant.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Société introuvable" }); }
    const { rows } = await client.query(
      `UPDATE societe SET actif = false, date_fin_activite = COALESCE(date_fin_activite, CURRENT_DATE)
       WHERE id = $1 RETURNING ${SELECT_FIELDS}`, [id]
    );
    if (avant[0].actif) {
      await log(client, "UPDATE", "societe", id, `Société "${avant[0].raison_sociale}" désactivée`, { actif: false, date_fin_activite: rows[0].datefinactivite });
      // code_retour: 2092
      await auditer(client, req, {
        action: "SOCIETE_DESACTIVEE", entiteType: "societe", entiteId: id,
        avant: { raison_sociale: avant[0].raison_sociale, actif: true, date_fin_activite: avant[0].date_fin_activite },
        apres: { raison_sociale: avant[0].raison_sociale, actif: false, date_fin_activite: rows[0].datefinactivite },
      });
    }
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /societes/:id/desactiver error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// Réactivation : pendant de la désactivation (un compte comme une société se
// réactive, migration 022), même permission. Efface date_fin_activite, trace
// probante SOCIETE_REACTIVEE, idempotente.
router.post("/societes/:id/reactiver", async (req, res) => {
  const { id } = req.params;
  // code_retour: 2075
  if (!estUuid(id)) return res.status(404).json({ error: "Société introuvable" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: avant } = await client.query(
      `SELECT raison_sociale, actif, date_fin_activite::text AS date_fin_activite
       FROM societe WHERE id = $1 AND date_suppression IS NULL FOR UPDATE`, [id]
    );
    if (!avant.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Société introuvable" }); }
    const { rows } = await client.query(
      `UPDATE societe SET actif = true, date_fin_activite = NULL
       WHERE id = $1 RETURNING ${SELECT_FIELDS}`, [id]
    );
    if (!avant[0].actif) {
      await log(client, "UPDATE", "societe", id, `Société "${avant[0].raison_sociale}" réactivée`, { actif: true });
      // code_retour: 2093
      await auditer(client, req, {
        action: "SOCIETE_REACTIVEE", entiteType: "societe", entiteId: id,
        avant: { raison_sociale: avant[0].raison_sociale, actif: false, date_fin_activite: avant[0].date_fin_activite },
        apres: { raison_sociale: avant[0].raison_sociale, actif: true, date_fin_activite: null },
      });
    }
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /societes/:id/reactiver error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// Suppression (#281, issue 60, règle du ticket #62) : refusée tant qu'un
// objet se raccroche à la société (409, message rendu listant les blocages),
// douce sinon. Plus aucune cascade : les filiales bloquent. La société
// supprimée quitte les listes (WHERE date_suppression IS NULL) mais reste en
// base à des fins d'audit ; ses configurations de profils (#249) deviennent
// inertes d'elles-mêmes (les lectures joignent les sociétés non supprimées).
router.delete("/societes/:id", async (req, res) => {
  const { id } = req.params;
  // code_retour: 2075
  if (!estUuid(id)) return res.status(404).json({ error: "Société introuvable" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: soc } = await client.query(
      `SELECT raison_sociale, actif FROM societe WHERE id = $1 AND date_suppression IS NULL FOR UPDATE`, [id]
    );
    if (!soc.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Société introuvable" }); }
    const { rows: [compteurs] } = await client.query(`SELECT ${SQL_COMPTEURS("$1::uuid")}`, [id]);
    const blocages = blocagesSuppression(compteurs);
    if (blocages.length > 0) {
      await client.query("ROLLBACK");
      // code_retour: 2090
      return res.status(409).json({ error: messageSuppressionImpossible(soc[0].raison_sociale, blocages) });
    }
    // Société vide : les exceptions de droit encore posées dessus (vestiges
    // d'anciens rattachements, bornées au rattachement donc déjà inertes)
    // partent avec elle, comme avant.
    await client.query(`UPDATE exception_droit SET date_suppression = now() WHERE id_societe = $1 AND date_suppression IS NULL`, [id]);
    const { rows: [apres] } = await client.query(
      `UPDATE societe SET date_suppression = now() WHERE id = $1 RETURNING date_suppression`, [id]
    );
    await log(client, "SOFT_DELETE", "societe", id, `Société "${soc[0].raison_sociale}" supprimée (suppression douce, aucun objet rattaché)`, null);
    // code_retour: 2091
    await auditer(client, req, {
      action: "SOCIETE_SUPPRIMEE", entiteType: "societe", entiteId: id,
      avant: { raison_sociale: soc[0].raison_sociale, actif: soc[0].actif, supprimee: false },
      apres: { raison_sociale: soc[0].raison_sociale, supprimee: true, date_suppression: apres.date_suppression },
    });
    await client.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /societes/:id error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});


// ---------------------------------------------------------------------------
// Profils par défaut de la société (#249), permission gerer_profils (Q5).
// Onglet Profils de la fiche société : état « suit le défaut » ou
// « configuré », matrice en remplacement complet (Q2), retour au défaut.
// ---------------------------------------------------------------------------

// État des quatre profils par défaut pour la société : marqueur de
// configuration (Q3) et matrice effective (configurée si marqueur, sinon la
// matrice par défaut du tenant). Le profil système admin_sam n'est pas servi :
// sa matrice est figée et ne se configure pas par société.
router.get("/societes/:id/profils", async (req, res) => {
  const { id } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Société introuvable" });
  try {
    const { rows: soc } = await tenantPool.query(
      `SELECT id, raison_sociale FROM societe WHERE id = $1 AND date_suppression IS NULL`, [id]
    );
    // code_retour: 2075
    if (!soc.length) return res.status(404).json({ error: "Société introuvable" });

    const { rows: profils } = await tenantPool.query(
      `SELECT p.id, p.code, p.label, p.description,
              (psc.id IS NOT NULL) AS configure,
              psc.configure_le,
              TRIM(COALESCE(u.prenom, '') || ' ' || COALESCE(u.nom, '')) AS configure_par_label
         FROM profil p
         LEFT JOIN profil_societe_configuration psc
                ON psc.id_profil = p.id AND psc.id_societe = $1
         LEFT JOIN utilisateur u ON u.id = psc.id_configure_par
        WHERE p.type = 'profil_defaut' AND p.date_suppression IS NULL
        ORDER BY p.label`,
      [id]
    );

    const resultat = [];
    for (const profil of profils) {
      const { rows: matrice } = profil.configure
        ? await tenantPool.query(
            `SELECT id_permission FROM profil_societe_permission
              WHERE id_profil = $1 AND id_societe = $2`, [profil.id, id])
        : await tenantPool.query(
            `SELECT id_permission FROM profil_permission
              WHERE id_profil = $1 AND date_suppression IS NULL`, [profil.id]);
      resultat.push({ ...profil, permission_ids: matrice.map((r) => r.id_permission) });
    }
    res.json({ societe: soc[0], profils: resultat });
  } catch (err) {
    console.error("GET /societes/:id/profils error", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Remplacement complet de la matrice du profil pour cette société (Q2). La
// société devient configurée (Q3), y compris pour une matrice vide : vider
// volontairement n'est pas revenir au défaut.
router.put("/societes/:id/profils/:idProfil/matrice", async (req, res) => {
  const { id, idProfil } = req.params;
  if (!estUuid(id)) return res.status(404).json({ error: "Société introuvable" });
  if (!estUuid(idProfil)) return res.status(404).json({ error: "Profil introuvable" });
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: soc } = await client.query(
      `SELECT id, raison_sociale FROM societe WHERE id = $1 AND date_suppression IS NULL`, [id]
    );
    // code_retour: 2075
    if (!soc.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Société introuvable" }); }
    const { rows: prof } = await client.query(
      `SELECT id, label, type FROM profil WHERE id = $1 AND date_suppression IS NULL FOR UPDATE`, [idProfil]
    );
    if (!prof.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Profil introuvable" }); }
    if (prof[0].type !== "profil_defaut") {
      await client.query("ROLLBACK");
      // code_retour: 2074
      return res.status(409).json({ error: `"${prof[0].label}" n'est pas un profil par défaut : seul un profil par défaut se configure par société.` });
    }
    const matrice = await validerPermissionIds(client, req.body?.permission_ids);
    if (matrice.erreur) {
      await client.query("ROLLBACK");
      // code_retour: 2076
      return res.status(400).json({ error: matrice.erreur });
    }
    const { rows: conf } = await client.query(
      `SELECT 1 FROM profil_societe_configuration WHERE id_profil = $1 AND id_societe = $2`,
      [idProfil, id]
    );
    const avantConfigure = conf.length > 0;
    const avantCodes = avantConfigure ? await matriceSocieteCourante(client, idProfil, id) : null;
    await configurerMatriceSociete(client, req, {
      profil: prof[0], societe: soc[0], ids: matrice.ids, codes: matrice.codes,
      avantConfigure, avantCodes,
    });
    const { rows: relecture } = await client.query(
      `SELECT psc.configure_le,
              TRIM(COALESCE(u.prenom, '') || ' ' || COALESCE(u.nom, '')) AS configure_par_label
         FROM profil_societe_configuration psc
         LEFT JOIN utilisateur u ON u.id = psc.id_configure_par
        WHERE psc.id_profil = $1 AND psc.id_societe = $2`,
      [idProfil, id]
    );
    await client.query("COMMIT");
    res.json({
      id_profil: idProfil, id_societe: id, configure: true,
      configure_le: relecture[0]?.configure_le || null,
      configure_par_label: relecture[0]?.configure_par_label || null,
      permission_ids: matrice.ids,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /societes/:id/profils/:idProfil/matrice error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// Retour au défaut : retire la configuration et sa matrice. La société suit à
// nouveau la matrice par défaut du tenant, les évolutions futures comprises.
router.delete("/societes/:id/profils/:idProfil/matrice", async (req, res) => {
  const { id, idProfil } = req.params;
  if (!estUuid(id) || !estUuid(idProfil)) {
    return res.status(404).json({ error: "Cette société n'est pas configurée pour ce profil." });
  }
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: conf } = await client.query(
      `SELECT psc.id, p.label AS profil_label, s.raison_sociale
         FROM profil_societe_configuration psc
         JOIN profil p ON p.id = psc.id_profil
         JOIN societe s ON s.id = psc.id_societe
        WHERE psc.id_profil = $1 AND psc.id_societe = $2
        FOR UPDATE`,
      [idProfil, id]
    );
    if (!conf.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Cette société n'est pas configurée pour ce profil." });
    }
    const avantCodes = await matriceSocieteCourante(client, idProfil, id);
    await client.query(`DELETE FROM profil_societe_permission WHERE id_profil = $1 AND id_societe = $2`, [idProfil, id]);
    await client.query(`DELETE FROM profil_societe_configuration WHERE id_profil = $1 AND id_societe = $2`, [idProfil, id]);
    await log(client, "DELETE", "profil_societe_permission", idProfil,
      `Profil "${conf[0].profil_label}" revenu au défaut pour la société "${conf[0].raison_sociale}"`, null);
    // code_retour: 2072
    await auditer(client, req, {
      action: "PROFIL_SOCIETE_RETOUR_DEFAUT", entiteType: "profil", entiteId: idProfil,
      avant: { societe: conf[0].raison_sociale, configure: true, permissions: avantCodes },
      apres: { societe: conf[0].raison_sociale, configure: false },
    });
    await client.query("COMMIT");
    res.status(204).end();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /societes/:id/profils/:idProfil/matrice error", err);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
