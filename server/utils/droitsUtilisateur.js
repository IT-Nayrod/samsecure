// Calcul des permissions effectives d'un utilisateur.
//
// Source unique du RBAC serveur : ce module est consommé par le middleware
// exigerPermission (contrôle des actions) et par GET /api/auth/mes-droits
// (affichage côté front). Les deux doivent répondre exactement la même chose,
// sinon un bouton visible mène à un refus, ou l'inverse.
//
// Modèle refondu par le #249 (remplace le modèle du 29/07), corrigé
// multi-profils le 06/10/2026 (stories #73/#190) :
// 1. Profils par défaut du compte : l'ensemble de ses attributions actives de
//    type non-groupe dans utilisateur_profil_societe, id_societe ignoré (#57).
//    utilisateur.id_profil (094) n'est plus lu nulle part : un compte porte
//    plusieurs profils, chacun alimentant notamment son dashboard (#73/#190).
//    Pour chaque profil et chaque société couverte par le rattachement, la
//    matrice configurée pour (profil, société) fait foi intégralement si elle
//    existe (Q2/Q3), sinon la matrice par défaut du tenant. Le contrôle par
//    route porte sur l'union de toutes ces matrices (Q4) ; le filtrage fin par
//    société reste une limite connue.
// 1bis. Groupes d'utilisateurs (#277/#330, décisions du 08/10/2026) : pour
//    chaque appartenance active, chaque ligne profil × groupe d'organisations
//    apporte la matrice effective du profil sur les sociétés du groupe
//    d'organisations (« et/ou » avec les attributions directes, union).
// 2. Groupes personnalisés attribués (utilisateur_profil_societe, type
//    'groupe') : union de leurs permissions. Plus aucune condition de
//    diffusion (#57), la portée d'un groupe suit le rattachement ; la colonne
//    id_societe de la table n'est plus lue.
// 3. Exceptions individuelles, bornées au périmètre : tous les accords puis
//    tous les retraits, le retrait restant inconditionnellement prioritaire.
import { tenantPool } from "../db.js";
import { matriceProfilEffective, appliquerExceptions, unionPermissions, permissionsManquantes, societesParProfilDesGroupes } from "./droitsRegles.js";
import { getAdminScope } from "./scope.js";

// Les règles pures (matrice effective, union multi-profils, exceptions) vivent
// dans droitsRegles.js, sans dépendance à la base : node --test les exécute
// sans .env (même motif que notifications/regles.js). Ré-exportées ici pour
// les consommateurs.
export { matriceProfilEffective, appliquerExceptions, unionPermissions, permissionsManquantes, deltaMatrice, PERMISSIONS_DELEGATION, TYPES_PROFIL_AJOUTE, societesNonDetenues, societesParProfilDesGroupes } from "./droitsRegles.js";

// Profils directs d'un compte : attributions actives non-groupe de
// utilisateur_profil_societe, dédoublonnées par profil, id_societe ignoré
// (#57). Consommée par le calcul effectif et par droitsEffectifs.js
// (visionneuse, simulateur), qui distinguent le direct du porté par groupe.
export async function profilsDirects(idUtilisateur) {
  const { rows } = await tenantPool.query(
    `SELECT DISTINCT p.id, p.code, p.label, p.type
       FROM utilisateur_profil_societe ups
       JOIN profil p ON p.id = ups.id_profil
                    AND p.type <> 'groupe' AND p.date_suppression IS NULL
      WHERE ups.id_utilisateur = $1 AND ups.date_suppression IS NULL
      ORDER BY p.label`,
    [idUtilisateur]
  );
  return rows;
}

// Lignes d'accès conférées par les groupes d'utilisateurs du compte
// (#277/#330) : pour chaque appartenance active à un groupe actif, chaque
// ligne profil × groupe d'organisations active, avec les sociétés actives du
// groupe d'organisations. La portée d'une ligne est celle de son groupe
// d'organisations, indépendamment du rattachement du compte.
// Tant que les migrations 106/107 ne sont pas jouées, les tables n'existent
// pas : la contribution des groupes est alors vide (42P01 avalé, signalé en
// console) pour ne pas faire tomber tout le contrôle des permissions - même
// motif que la robustesse de profils.js à la 097.
let tablesGroupesAbsentesSignalees = false;
export async function lignesAccesGroupes(idUtilisateur) {
  try {
    const { rows } = await tenantPool.query(
      `SELECT gua.id, gua.id_profil,
              p.code AS profil_code, p.label AS profil_label, p.type AS profil_type,
              gu.id AS id_groupe_utilisateur, gu.nom AS groupe_nom,
              go.id AS id_groupe_organisation, go.nom AS groupe_organisation_nom,
              COALESCE(soc.societes, '{}') AS societes
         FROM groupe_utilisateur_membre gum
         JOIN groupe_utilisateur gu ON gu.id = gum.id_groupe_utilisateur
                                   AND gu.date_suppression IS NULL
         JOIN groupe_utilisateur_acces gua ON gua.id_groupe_utilisateur = gu.id
                                          AND gua.date_suppression IS NULL
         JOIN profil p ON p.id = gua.id_profil AND p.date_suppression IS NULL
         JOIN groupe_organisation go ON go.id = gua.id_groupe_organisation
                                    AND go.date_suppression IS NULL
         LEFT JOIN LATERAL (
           SELECT array_agg(gos.id_societe) AS societes
             FROM groupe_organisation_societe gos
             JOIN societe s ON s.id = gos.id_societe AND s.date_suppression IS NULL
            WHERE gos.id_groupe_organisation = go.id
         ) soc ON true
        WHERE gum.id_utilisateur = $1 AND gum.date_suppression IS NULL
        ORDER BY gu.nom, p.label`,
      [idUtilisateur]
    );
    return rows;
  } catch (err) {
    if (err.code === "42P01") {
      if (!tablesGroupesAbsentesSignalees) {
        tablesGroupesAbsentesSignalees = true;
        console.error("[droits] tables des groupes absentes (migrations 106/107 a jouer) : contribution des groupes ignoree.");
      }
      return [];
    }
    throw err;
  }
}

// Profils PORTÉS par un compte : attributions directes et profils apportés par
// ses groupes d'utilisateurs, dédoublonnés. C'est la lecture de dashboards.js
// (un dashboard par profil porté, #73/#190 étendu #330) ; une ligne de groupe
// sans société active ne porte rien, dashboard compris. Le nom historique
// profilsParDefaut est conservé pour ses consommateurs.
export async function profilsParDefaut(idUtilisateur) {
  const directs = await profilsDirects(idUtilisateur);
  const lignes = await lignesAccesGroupes(idUtilisateur);
  const parId = new Map(directs.map((p) => [p.id, p]));
  for (const ligne of lignes) {
    if (ligne.profil_type === "groupe") continue;
    if (!(ligne.societes || []).filter(Boolean).length) continue;
    if (!parId.has(ligne.id_profil)) {
      parId.set(ligne.id_profil, {
        id: ligne.id_profil, code: ligne.profil_code,
        label: ligne.profil_label, type: ligne.profil_type,
      });
    }
  }
  return [...parId.values()].sort((a, b) => (a.label || "").localeCompare(b.label || "", "fr"));
}

// ---------------------------------------------------------------------------
// Lecture en base et assemblage.
// ---------------------------------------------------------------------------

// Permissions issues du profil par défaut, selon la règle Q2/Q3/Q4. Exposée
// pour droitsEffectifs.js (visionneuse et simulateur), qui résout la même
// matrice pour une société donnée.
export async function permissionsDuProfil(idProfil, societesCouvertes) {
  const { rows: defaut } = await tenantPool.query(
    `SELECT p.code
       FROM profil_permission pp
       JOIN permission p ON p.id = pp.id_permission
      WHERE pp.id_profil = $1 AND pp.date_suppression IS NULL`,
    [idProfil]
  );

  const matricesParSociete = new Map();
  if (societesCouvertes.length) {
    const { rows: configurees } = await tenantPool.query(
      `SELECT id_societe FROM profil_societe_configuration
        WHERE id_profil = $1 AND id_societe = ANY($2)`,
      [idProfil, societesCouvertes]
    );
    if (configurees.length) {
      const ids = configurees.map((r) => r.id_societe);
      // Une société configurée sans ligne de matrice est une matrice vidée
      // volontairement : elle doit exister dans la Map, vide (Q3).
      for (const id of ids) matricesParSociete.set(id, []);
      const { rows: matrices } = await tenantPool.query(
        `SELECT psp.id_societe, p.code
           FROM profil_societe_permission psp
           JOIN permission p ON p.id = psp.id_permission
          WHERE psp.id_profil = $1 AND psp.id_societe = ANY($2)`,
        [idProfil, ids]
      );
      for (const m of matrices) matricesParSociete.get(m.id_societe).push(m.code);
    }
  }

  return matriceProfilEffective({
    societesCouvertes,
    matriceDefaut: defaut.map((r) => r.code),
    matricesParSociete,
  });
}

export async function permissionsEffectives(idUtilisateur) {
  const aujourdhui = new Date().toISOString().slice(0, 10);

  // Un compte désactivé ou hors de sa période d'activité n'a aucun droit, même
  // porteur d'un jeton encore valide. Sans ce contrôle, un utilisateur retiré
  // conserve ses permissions jusqu'à l'expiration de son jeton.
  // actif = false est le seul état de retrait : la colonne date_suppression a
  // été supprimée par la migration 023.
  const { rows: actif } = await tenantPool.query(
    `SELECT 1 FROM utilisateur
      WHERE id = $1 AND actif = true
        AND (date_finale            IS NULL OR date_finale            >= CURRENT_DATE)
        AND (date_mise_en_fonction  IS NULL OR date_mise_en_fonction  <= CURRENT_DATE)`,
    [idUtilisateur]
  );
  if (!actif.length) return { permissions: new Set(), isTenantScope: false, compteInactif: true };

  const { rows: ratt } = await tenantPool.query(
    `SELECT id_societe FROM utilisateur_societe
      WHERE id_utilisateur = $1 AND date_suppression IS NULL`,
    [idUtilisateur]
  );
  // Un rattachement à NULL vaut portée tenant : toutes sociétés.
  const isTenantScope = ratt.some((r) => r.id_societe === null);
  const societeIds = ratt.map((r) => r.id_societe).filter(Boolean);
  const dansPerimetre = (idSociete) =>
    isTenantScope || idSociete === null || societeIds.includes(idSociete);

  const permissions = new Set();

  // 1. Profils par défaut (multi-profils #73/#190) : chaque profil contribue
  // sa matrice effective sur les sociétés couvertes, l'union fait foi (Q4).
  // Sociétés couvertes : le rattachement, ou toutes les sociétés actives du
  // tenant pour une portée tenant (les sociétés configurées y contribuent
  // alors toutes).
  const profils = await profilsDirects(idUtilisateur);
  if (profils.length) {
    let societesCouvertes = societeIds;
    if (isTenantScope) {
      const { rows } = await tenantPool.query(
        `SELECT id FROM societe WHERE date_suppression IS NULL`
      );
      societesCouvertes = rows.map((r) => r.id);
    }
    const matrices = [];
    for (const profil of profils) {
      matrices.push(await permissionsDuProfil(profil.id, societesCouvertes));
    }
    for (const code of unionPermissions(matrices)) permissions.add(code);
  }

  // 1bis. Groupes d'utilisateurs (#277/#330) : chaque ligne profil × groupe
  // d'organisations apporte la matrice effective du profil sur les sociétés
  // ACTIVES du groupe d'organisations, indépendamment du rattachement (la
  // portée d'une ligne est celle de son groupe). Union des sociétés par
  // profil (exacte, cf. societesParProfilDesGroupes) pour ne résoudre chaque
  // matrice qu'une fois ; une ligne sans société active ne confère rien.
  const lignesGroupes = await lignesAccesGroupes(idUtilisateur);
  for (const [idProfil, couvertes] of societesParProfilDesGroupes(lignesGroupes)) {
    const matrice = await permissionsDuProfil(idProfil, [...couvertes]);
    for (const code of matrice) permissions.add(code);
  }

  // 2. Groupes personnalisés attribués (#57) : l'attribution suffit, sans
  // condition de diffusion ni lecture de id_societe.
  const { rows: groupes } = await tenantPool.query(
    `SELECT DISTINCT perm.code
       FROM utilisateur_profil_societe ups
       JOIN profil g ON g.id = ups.id_profil
                    AND g.type = 'groupe' AND g.date_suppression IS NULL
       JOIN profil_permission pp ON pp.id_profil = g.id AND pp.date_suppression IS NULL
       JOIN permission perm ON perm.id = pp.id_permission
      WHERE ups.id_utilisateur = $1 AND ups.date_suppression IS NULL`,
    [idUtilisateur]
  );
  for (const r of groupes) permissions.add(r.code);

  // 3. Exceptions, retrait prioritaire (règle pure appliquerExceptions).
  const { rows: exceptions } = await tenantPool.query(
    `SELECT ed.id_societe, ed.type, p.code
       FROM exception_droit ed
       JOIN permission p ON p.id = ed.id_permission
      WHERE ed.id_utilisateur = $1 AND ed.date_suppression IS NULL
        AND (ed.date_debut IS NULL OR ed.date_debut <= $2)
        AND (ed.date_fin   IS NULL OR ed.date_fin   >= $2)`,
    [idUtilisateur, aujourdhui]
  );
  appliquerExceptions(permissions, exceptions, { isTenantScope, dansPerimetre });

  return { permissions, isTenantScope };
}

// ---------------------------------------------------------------------------
// Delegation des droits d'administration (#278, decisions du 06/10/2026).
// ---------------------------------------------------------------------------

// Titulaire admin_sam : une attribution active du profil systeme admin_sam.
// C'est la cle des deux garde-fous #278 : seul un admin_sam modifie le profil
// admin_sam et ses titulaires, et un acteur admin_sam est exempte du controle
// de detention comme du perimetre par societes.
export async function estAdminSam(idUtilisateur) {
  const { rows } = await tenantPool.query(
    `SELECT 1
       FROM utilisateur_profil_societe ups
       JOIN profil p ON p.id = ups.id_profil
                    AND p.code = 'admin_sam' AND p.date_suppression IS NULL
      WHERE ups.id_utilisateur = $1 AND ups.date_suppression IS NULL
      LIMIT 1`,
    [idUtilisateur]
  );
  return rows.length > 0;
}

// Perimetre d'administration (#278) : un admin_sam voit et gere tout le
// tenant, quel que soit son rattachement ; un delegataire est borne a ses
// societes de rattachement (scope.js, inchange). Se substitue a getAdminScope
// dans les routes d'administration des comptes.
export async function scopeAdministration(idUtilisateur) {
  if (await estAdminSam(idUtilisateur)) {
    return { isTenantScope: true, societeIds: [] };
  }
  return getAdminScope(idUtilisateur);
}

// Societes couvertes par le rattachement d'un compte : la liste de ses
// societes, ou toutes les societes actives du tenant pour une portee tenant.
// Meme regle que permissionsEffectives (bloc profils), exposee pour le
// garde-fou d'attribution : les permissions conferees par un profil a la
// CIBLE se calculent sur les societes couvertes par la cible.
export async function societesCouvertes(idUtilisateur) {
  const { rows: ratt } = await tenantPool.query(
    `SELECT id_societe FROM utilisateur_societe
      WHERE id_utilisateur = $1 AND date_suppression IS NULL`,
    [idUtilisateur]
  );
  if (ratt.some((r) => r.id_societe === null)) {
    const { rows } = await tenantPool.query(
      `SELECT id FROM societe WHERE date_suppression IS NULL`
    );
    return rows.map((r) => r.id);
  }
  return ratt.map((r) => r.id_societe).filter(Boolean);
}

// Garde-fou #278 : on n'attribue que des permissions que l'on detient.
// codesDemandes = permissions ajoutees (matrice) ou conferees (profil
// attribue). Rend { ok, manquantes } ; l'acteur admin_sam est exempte.
// Les refus (403, code 2080) sont emis par les routes, le calcul vit ici
// pour que toutes appliquent exactement la meme regle.
export async function verifierDelegation(idActeur, codesDemandes) {
  const codes = [...new Set(codesDemandes)];
  if (!codes.length) return { ok: true, manquantes: [] };
  if (await estAdminSam(idActeur)) return { ok: true, manquantes: [] };
  const { permissions } = await permissionsEffectives(idActeur);
  const manquantes = permissionsManquantes(codes, permissions);
  return { ok: manquantes.length === 0, manquantes };
}

// Verrou #278 : « personne ne modifie le profil admin_sam ni ses titulaires,
// hormis un admin_sam ». Vrai quand la CIBLE est titulaire d'admin_sam et que
// l'acteur ne l'est pas : la route refuse alors en 403 (code 2081), quelle
// que soit l'ecriture (identite, statut, mot de passe, rattachement,
// attributions). Lire un tel compte reste permis.
export async function cibleVerrouilleeAdminSam(idActeur, idCible) {
  if (!(await estAdminSam(idCible))) return false;
  return !(await estAdminSam(idActeur));
}
