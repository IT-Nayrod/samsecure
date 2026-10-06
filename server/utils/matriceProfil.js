// Écritures des matrices de profils par défaut (#249), partagées entre
// profils.js (matrice par défaut du tenant, application en masse) et
// societes.js (configuration par société depuis la fiche société).
//
// Règles portées ici :
// - Q2 : la matrice d'un profil pour une société est un remplacement complet,
//   jamais un delta. L'écriture efface puis réinsère dans la transaction ;
//   l'avant/après est porté par audit_log, pas par un soft-delete.
// - Q3 : le marqueur « société configurée » (profil_societe_configuration) est
//   posé à chaque enregistrement, même pour une matrice vide.
import { auditer } from "./audit.js";
import { estUuid } from "./matriceGroupe.js";

// Journal fonctionnel, erreurs avalées (même convention que les routeurs).
async function log(client, action, entite_type, entite_id, description, payload) {
  try {
    await client.query(
      `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [action, entite_type, entite_id || null, description, payload ? JSON.stringify(payload) : null]
    );
  } catch (e) {
    console.error("[journal] log failed:", e.message);
  }
}

// Valide le corps permission_ids : liste d'UUID connus du catalogue, doublons
// tolérés (dédoublonnés). Rend { ids, codes } ou { erreur } (message rendu,
// code_retour: 2076).
export async function validerPermissionIds(client, permissionIds) {
  if (!Array.isArray(permissionIds)) {
    return { erreur: "permission_ids doit être une liste d'identifiants de permissions." };
  }
  const ids = [...new Set(permissionIds)];
  if (!ids.every((id) => estUuid(id))) {
    return { erreur: "Cette permission n'existe pas au catalogue." };
  }
  if (!ids.length) return { ids: [], codes: [] };
  const { rows } = await client.query(
    `SELECT id, code FROM permission WHERE id = ANY($1)`,
    [ids]
  );
  if (rows.length !== ids.length) {
    return { erreur: "Cette permission n'existe pas au catalogue." };
  }
  return { ids, codes: rows.map((r) => r.code).sort() };
}

// Codes de la matrice configurée actuelle d'un couple (profil, société), pour
// la valeur avant de la trace probante.
export async function matriceSocieteCourante(client, idProfil, idSociete) {
  const { rows } = await client.query(
    `SELECT p.code
       FROM profil_societe_permission psp
       JOIN permission p ON p.id = psp.id_permission
      WHERE psp.id_profil = $1 AND psp.id_societe = $2
      ORDER BY p.code`,
    [idProfil, idSociete]
  );
  return rows.map((r) => r.code);
}

// Remplace intégralement la matrice d'un profil pour une société et pose le
// marqueur de configuration. S'exécute dans la transaction de l'appelant.
// avantConfigure/avantCodes : état lu avant l'écriture, pour la trace.
export async function configurerMatriceSociete(client, req, {
  profil, societe, ids, codes, avantConfigure, avantCodes, enMasse = false,
}) {
  await client.query(
    `DELETE FROM profil_societe_permission WHERE id_profil = $1 AND id_societe = $2`,
    [profil.id, societe.id]
  );
  if (ids.length) {
    await client.query(
      `INSERT INTO profil_societe_permission (id_profil, id_societe, id_permission)
       SELECT $1, $2, unnest($3::uuid[])`,
      [profil.id, societe.id, ids]
    );
  }
  await client.query(
    `INSERT INTO profil_societe_configuration (id_profil, id_societe, id_configure_par)
     VALUES ($1, $2, $3)
     ON CONFLICT ON CONSTRAINT uq_profil_societe_configuration
     DO UPDATE SET configure_le = now(), id_configure_par = EXCLUDED.id_configure_par`,
    [profil.id, societe.id, req.user?.id || null]
  );
  const origine = enMasse ? " (paramétrage en masse)" : "";
  await log(client, "UPDATE", "profil_societe_permission", profil.id,
    `Profil "${profil.label}" configuré pour la société "${societe.raison_sociale}" : ${ids.length} permission(s)${origine}`,
    { id_profil: profil.id, id_societe: societe.id, permissions: codes });
  // code_retour: 2071
  await auditer(client, req, {
    action: "PROFIL_SOCIETE_CONFIGURE", entiteType: "profil", entiteId: profil.id,
    avant: { societe: societe.raison_sociale,
             configure: avantConfigure,
             permissions: avantConfigure ? avantCodes : null },
    apres: { societe: societe.raison_sociale, configure: true, permissions: codes,
             ...(enMasse ? { en_masse: true } : {}) },
  });
}
