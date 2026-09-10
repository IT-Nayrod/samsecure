// Moteur de notifications (story #121) : creation centralisee.
//
// Point de passage unique : toute notification de l'application est creee par
// creerNotification(). Le moteur calcule les destinataires par droits et
// portee (permissionsEffectives + rattachement, utilitaires RBAC existants),
// compose un texte par destinataire (montants masques sans
// consulter_kpi_financiers), applique la preference de courrier et insere en
// ON CONFLICT DO NOTHING sur (utilisateur, cle d'evenement) : l'anti-doublon
// est porte par l'index unique de la migration 051.
//
// Tables reutilisees (schema 002, section 11) : alerte porte l'evenement (une
// ligne), notification porte la remise a chaque utilisateur (une ligne par
// destinataire, texte deja adapte a ses droits).
//
// Contrat d'echec : creerNotification() ne leve JAMAIS vers l'appelant. Une
// action metier ne doit pas echouer parce que sa notification n'a pas pu
// etre ecrite. Appelee dans une transaction (client de pool), elle travaille
// sous SAVEPOINT pour qu'une erreur SQL n'avorte pas la transaction de
// l'appelant.
import { tenantPool, commonPool } from "../../db.js";
import { permissionsEffectives } from "../droitsUtilisateur.js";
import { getAdminScope } from "../scope.js";
import {
  typeConnu, composerTexte, PERMISSION_MONTANTS, ENTITES_AVEC_SOCIETE, TYPES_CODES,
} from "./catalogue.js";
import {
  cleEvenement, selectionnerDestinataires, modeCourrier, statutCourrierInitial,
} from "./regles.js";
import { planifierEnvoiImmediat } from "./courriers.js";
import { tracer } from "./trace.js";

// ---------------------------------------------------------------------------
// Candidats : utilisateurs actifs avec permissions effectives et portee.
// Un contexte de traitement (planificateur) les charge une fois pour toute la
// passe ; un evenement isole (soumission) les charge a la demande.
// ---------------------------------------------------------------------------

export function nouveauContexte() {
  return { candidats: null, preferences: null };
}

async function chargerCandidats() {
  const { rows } = await tenantPool.query(
    `SELECT id, email, prenom, nom FROM utilisateur
      WHERE actif = true
        AND (date_finale           IS NULL OR date_finale           >= CURRENT_DATE)
        AND (date_mise_en_fonction IS NULL OR date_mise_en_fonction <= CURRENT_DATE)
      ORDER BY nom, prenom`);
  const candidats = [];
  for (const u of rows) {
    const [droits, portee] = await Promise.all([permissionsEffectives(u.id), getAdminScope(u.id)]);
    if (droits.compteInactif) continue;
    candidats.push({
      id: u.id, email: u.email, prenom: u.prenom, nom: u.nom,
      permissions: droits.permissions,
      isTenantScope: portee.isTenantScope,
      societeIds: portee.societeIds,
    });
  }
  return candidats;
}

export async function candidats(contexte) {
  if (!contexte.candidats) contexte.candidats = await chargerCandidats();
  return contexte.candidats;
}

// Preferences de courrier : Map "idUtilisateur:type" -> mode.
async function chargerPreferences() {
  const { rows } = await tenantPool.query(
    `SELECT id_utilisateur, type, courrier FROM preference_notification`);
  return new Map(rows.map((r) => [`${r.id_utilisateur}:${r.type}`, r.courrier]));
}

async function preferences(contexte) {
  if (!contexte.preferences) contexte.preferences = await chargerPreferences();
  return contexte.preferences;
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

function estTransactionnel(client) {
  return Boolean(client) && typeof client.release === "function";
}

// evenement :
//   type          : code du catalogue (obligatoire)
//   cle           : cle d'evenement (obligatoire, cf. regles.cleEvenement)
//   donnees       : donnees de composition du texte (cf. catalogue)
//   id_societe    : perimetre de l'evenement, null = tenant
//   entite_type / entite_id : objet concerne (alerte et notification)
//   destinataires : identifiants explicites (auteur d'une saisie)
//   exclure       : identifiants ecartes
//   urgence       : "immediat" force le courrier immediat (refus)
// Renvoie { crees, ignores, destinataires } ; { crees: 0 } sur toute erreur.
export async function creerNotification(client, evenement, contexte = nouveauContexte()) {
  const cx = client || tenantPool;
  const transactionnel = estTransactionnel(client);
  const resultat = { crees: 0, ignores: 0, destinataires: 0 };
  if (!evenement || !typeConnu(evenement.type) || !evenement.cle) {
    console.error("[notifications] evenement invalide", evenement?.type, evenement?.cle);
    return resultat;
  }
  try {
    const liste = selectionnerDestinataires(await candidats(contexte), evenement);
    resultat.destinataires = liste.length;
    if (!liste.length) return resultat;
    const prefs = await preferences(contexte);

    if (transactionnel) await cx.query("SAVEPOINT notification");
    try {
      const texteEvenement = composerTexte(evenement.type, evenement.donnees, { montantsVisibles: false });
      const { rows: [alerte] } = await cx.query(
        `INSERT INTO alerte (type_alerte, entite_type, entite_id, message, niveau)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [evenement.type, evenement.entite_type || null, evenement.entite_id || null,
         texteEvenement.message, texteEvenement.gravite]
      );

      let immediat = false;
      for (const dest of liste) {
        const montantsVisibles = dest.permissions.has(PERMISSION_MONTANTS);
        const texte = composerTexte(evenement.type, evenement.donnees, { montantsVisibles });
        const mode = modeCourrier(prefs.get(`${dest.id}:${evenement.type}`), evenement.type, evenement.urgence);
        const { rowCount } = await cx.query(
          `INSERT INTO notification
             (id_alerte, id_utilisateur, entite_type, entite_id, statut, type, cle_evenement,
              titre, message, lien, gravite, id_societe, donnees, courrier_mode, courrier_statut)
           VALUES ($1, $2, $3, $4, 'non_lu', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id_utilisateur, cle_evenement) DO NOTHING`,
          [alerte.id, dest.id, evenement.entite_type || null, evenement.entite_id || null,
           evenement.type, evenement.cle, texte.titre, texte.message, texte.lien, texte.gravite,
           evenement.id_societe || null, evenement.donnees ? JSON.stringify(evenement.donnees) : null,
           mode, statutCourrierInitial(mode)]
        );
        if (rowCount) {
          resultat.crees += 1;
          if (mode === "immediat") immediat = true;
        } else {
          resultat.ignores += 1;
        }
      }
      // Evenement deja connu de tous ses destinataires : l'alerte n'apporte
      // rien, elle est retiree (suppression bornee a la ligne qui vient d'etre
      // inseree).
      if (!resultat.crees) await cx.query(`DELETE FROM alerte WHERE id = $1`, [alerte.id]);
      if (transactionnel) await cx.query("RELEASE SAVEPOINT notification");
      if (immediat) planifierEnvoiImmediat();
    } catch (err) {
      if (transactionnel) await cx.query("ROLLBACK TO SAVEPOINT notification").catch(() => {});
      throw err;
    }
  } catch (err) {
    console.error(`[notifications] creation impossible (${evenement.type})`, err.message);
    await tracer("error", "Creation de notification impossible", {
      type: evenement.type, cle: evenement.cle, motif: err.message,
    });
    return { crees: 0, ignores: 0, destinataires: resultat.destinataires };
  }
  return resultat;
}

// ---------------------------------------------------------------------------
// Evenements du workflow de validation
// Appeles dans la transaction de la saisie ou du traitement : les lectures
// passent par le client de l'appelant pour voir l'entite non encore validee.
// ---------------------------------------------------------------------------

async function lirePersonne(cx, id) {
  if (!id) return null;
  const { rows } = await cx.query(`SELECT prenom, nom FROM utilisateur WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function lireSocieteLabel(cx, idSociete) {
  if (!idSociete) return null;
  const { rows } = await cx.query(`SELECT raison_sociale FROM societe WHERE id = $1`, [idSociete]);
  return rows[0]?.raison_sociale || null;
}

// Soumission d'une saisie (soumettre() du workflow). table et colonneLabel
// viennent du catalogue ENTITES_VALIDABLES, jamais d'un parametre de route :
// leur interpolation est sure ici comme dans validation.js.
export async function notifierSoumission(client, { entiteType, entiteId, table, colonneLabel, idAuteur, idWorkflow }) {
  try {
    const cx = client || tenantPool;
    const avecSociete = ENTITES_AVEC_SOCIETE.has(entiteType);
    const { rows } = await cx.query(
      `SELECT ${colonneLabel} AS label${avecSociete ? ", id_societe" : ", NULL::uuid AS id_societe"}
         FROM ${table} WHERE id = $1`, [entiteId]);
    const entite = rows[0];
    if (!entite) return { crees: 0 };
    const [auteur, societeLabel] = await Promise.all([
      lirePersonne(cx, idAuteur), lireSocieteLabel(cx, entite.id_societe),
    ]);
    return creerNotification(client, {
      type: "validation_en_attente",
      cle: cleEvenement("validation_en_attente", entiteType, entiteId, idWorkflow || "soumission"),
      id_societe: entite.id_societe || null,
      entite_type: entiteType, entite_id: entiteId,
      exclure: idAuteur ? [idAuteur] : [],
      donnees: {
        entite_type: entiteType, entite_id: entiteId, label: entite.label,
        auteur, societe_label: societeLabel,
      },
    });
  } catch (err) {
    console.error("[notifications] soumission non notifiee", err.message);
    return { crees: 0 };
  }
}

// Traitement d'une saisie (validation.js) : l'auteur de la soumission est le
// seul destinataire ; un refus part en courrier immediat.
export async function notifierTraitement(client, { entiteType, entiteId, label, statut, motif, idWorkflow, idTraitePar }) {
  try {
    const cx = client || tenantPool;
    const { rows } = await cx.query(
      `SELECT id_soumis_par FROM workflow_validation WHERE id = $1`, [idWorkflow]);
    const idAuteur = rows[0]?.id_soumis_par;
    if (!idAuteur || idAuteur === idTraitePar) return { crees: 0 };
    const traitePar = await lirePersonne(cx, idTraitePar);
    return creerNotification(client, {
      type: "saisie_traitee",
      cle: cleEvenement("saisie_traitee", entiteType, entiteId, idWorkflow, statut),
      entite_type: entiteType, entite_id: entiteId,
      destinataires: [idAuteur],
      urgence: statut === "refuse" ? "immediat" : null,
      donnees: { entite_type: entiteType, entite_id: entiteId, label, statut, motif: motif || null, traite_par: traitePar },
    });
  } catch (err) {
    console.error("[notifications] traitement non notifie", err.message);
    return { crees: 0 };
  }
}

// ---------------------------------------------------------------------------
// Resolution des libelles produit (BDD Commune puis produit_client Tenant),
// partagee par le planificateur. Une requete par base, jamais une par ligne.
// ---------------------------------------------------------------------------
export async function libellesProduits(ids) {
  const uniques = [...new Set((ids || []).filter(Boolean))];
  const labels = new Map();
  if (!uniques.length) return labels;
  try {
    const { rows } = await commonPool.query(
      `SELECT p.id, p.label, p.id_editeur FROM produit_referentiel p WHERE p.id = ANY($1)`, [uniques]);
    for (const r of rows) labels.set(r.id, { label: r.label, id_editeur: r.id_editeur });
  } catch (err) {
    console.error("[notifications] produit_referentiel illisible", err.message);
  }
  const restants = uniques.filter((id) => !labels.has(id));
  if (restants.length) {
    const { rows } = await tenantPool.query(
      `SELECT id, label, id_editeur FROM produit_client WHERE id = ANY($1)`, [restants]);
    for (const r of rows) labels.set(r.id, { label: r.label, id_editeur: r.id_editeur });
  }
  const idsEditeurs = [...new Set([...labels.values()].map((p) => p.id_editeur).filter(Boolean))];
  if (idsEditeurs.length) {
    const { rows } = await tenantPool.query(
      `SELECT id, raison_sociale FROM editeur WHERE id = ANY($1)`, [idsEditeurs]);
    const editeurs = new Map(rows.map((r) => [r.id, r.raison_sociale]));
    for (const p of labels.values()) p.editeur_label = p.id_editeur ? editeurs.get(p.id_editeur) || null : null;
  }
  return labels;
}

export { TYPES_CODES, tracer };
