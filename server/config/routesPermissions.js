// Table de correspondance entre les routes de l'API et la permission exigee.
//
// Source unique et auditable du controle d'acces serveur : aucune permission
// n'est declaree ailleurs, dans aucun routeur. Lire ce fichier suffit a savoir
// qui peut faire quoi.
//
// Regle de securite : le controle est fail-closed. Une route protegee absente
// de cette table est refusee, elle n'est pas laissee passer. Ajouter une route
// a l'API impose donc d'ajouter sa ligne ici, l'oubli se voit immediatement.
//
// L'ORDRE COMPTE : la premiere regle qui correspond gagne. Les chemins
// litteraux doivent preceder les chemins parametres de meme longueur,
// /commandes/agregats avant /commandes/:id.
//
// Codes disponibles, referentiel permission (27 codes, 7 modules) :
//   administration : gerer_utilisateurs, gerer_exceptions_droit,
//                    consulter_audit_log, gerer_connecteurs
//   droits_usage   : consulter_contrats, consulter_factures, saisir_contrat,
//                    saisir_commande, deposer_facture_preuve
//   deploiement    : valider_saisie, consulter_licences, consulter_inventaire,
//                    saisir_licence, saisir_affectation, rapprocher_inventaire
//   organisation   : consulter_referentiels, gerer_referentiels, gerer_contacts
//   budget         : consulter_budget, saisir_budget, consulter_kpi_financiers
//   rapports, dashboards : non encore branches sur l'API
//
// PUBLIC_AUTHENTIFIE : accessible a tout porteur d'un jeton valide, sans
// permission particuliere. A n'employer que pour les routes qui ne divulguent
// et ne modifient aucune donnee metier.
export const PUBLIC_AUTHENTIFIE = null;

export const ROUTES_PERMISSIONS = [
  // ---- Droits d'usage : contrats -------------------------------------------
  ["GET",    "/contrats",                    "consulter_contrats"],
  ["GET",    "/contrats/:id",                "consulter_contrats"],
  ["POST",   "/contrats",                    "saisir_contrat"],
  ["PATCH",  "/contrats/:id",                "saisir_contrat"],
  ["DELETE", "/contrats/:id",                "saisir_contrat"],

  // ---- Droits d'usage : commandes ------------------------------------------
  // Les deux chemins litteraux passent avant /commandes/:id.
  // Les agregats sont un KPI financier, les manques appartiennent au module
  // documents : ni l'un ni l'autre ne se lit avec le droit de saisie.
  ["GET",    "/commandes/agregats",          "consulter_kpi_financiers"],
  ["GET",    "/commandes/manques",           "consulter_factures"],
  ["GET",    "/commandes",                   "consulter_contrats"],
  ["GET",    "/commandes/:id",               "consulter_contrats"],
  ["POST",   "/commandes",                   "saisir_commande"],
  ["PATCH",  "/commandes/:id",               "saisir_commande"],
  ["DELETE", "/commandes/:id",               "saisir_commande"],

  // ---- Documents : factures ------------------------------------------------
  ["POST",   "/factures/depot",              "deposer_facture_preuve"],
  ["GET",    "/factures",                    "consulter_factures"],
  ["GET",    "/factures/:id",                "consulter_factures"],
  ["POST",   "/factures",                    "deposer_facture_preuve"],
  ["PATCH",  "/factures/:id",                "deposer_facture_preuve"],
  ["DELETE", "/factures/:id",                "deposer_facture_preuve"],

  // ---- Documents : preuves -------------------------------------------------
  ["GET",    "/preuves",                     "consulter_factures"],
  ["GET",    "/preuves/:id/fichier",         "consulter_factures"],
  ["POST",   "/preuves/:id/fichier",         "deposer_facture_preuve"],
  ["GET",    "/preuves/:id",                 "consulter_factures"],
  ["POST",   "/preuves",                     "deposer_facture_preuve"],
  ["PATCH",  "/preuves/:id",                 "deposer_facture_preuve"],
  ["DELETE", "/preuves/:id",                 "deposer_facture_preuve"],

  // ---- Workflow de validation (#53) ----------------------------------------
  // Le droit de traiter une saisie est distinct du droit de la produire :
  // c'est le sens de la story Droits annoncee a la #53.
  ["POST",   "/validation/:type/:id/valider", "valider_saisie"],
  ["POST",   "/validation/:type/:id/refuser", "valider_saisie"],

  // ---- Referentiels en lecture ---------------------------------------------
  ["GET",    "/types-contrat",               "consulter_referentiels"],
  ["GET",    "/editeurs",                    "consulter_referentiels"],
  ["GET",    "/revendeurs",                  "consulter_referentiels"],
  ["GET",    "/modes-commande",              "consulter_referentiels"],
  ["GET",    "/types-preuve",                "consulter_referentiels"],

  // ---- Organisation : societes ---------------------------------------------
  ["GET",    "/societes/:id/profils-orphelins", "gerer_referentiels"],
  ["GET",    "/societes",                    "consulter_referentiels"],
  ["POST",   "/societes",                    "gerer_referentiels"],
  ["PATCH",  "/societes/:id",                "gerer_referentiels"],
  ["DELETE", "/societes/:id",                "gerer_referentiels"],

  // ---- Administration : exceptions de droits -------------------------------
  // Declarees avant les routes /utilisateurs/:id/... generiques.
  ["GET",    "/exceptions",                              "gerer_exceptions_droit"],
  ["GET",    "/utilisateurs/:id/exceptions",             "gerer_exceptions_droit"],
  ["POST",   "/utilisateurs/:id/exceptions",             "gerer_exceptions_droit"],
  ["PATCH",  "/utilisateurs/:id/exceptions/:excId",      "gerer_exceptions_droit"],
  ["DELETE", "/utilisateurs/:id/exceptions/:excId",      "gerer_exceptions_droit"],

  // ---- Administration : utilisateurs, profils, attributions ----------------
  ["GET",    "/utilisateurs/:id/droits-effectifs",       "gerer_utilisateurs"],
  ["GET",    "/utilisateurs/:id/profils",                "gerer_utilisateurs"],
  ["POST",   "/utilisateurs/:id/profils",                "gerer_utilisateurs"],
  ["DELETE", "/utilisateurs/:id/profils/:attribId",      "gerer_utilisateurs"],
  ["GET",    "/utilisateurs/:id/societes",               "gerer_utilisateurs"],
  ["POST",   "/utilisateurs/:id/societes",               "gerer_utilisateurs"],
  ["DELETE", "/utilisateurs/:id/societes/:societeId",    "gerer_utilisateurs"],
  ["DELETE", "/utilisateurs/:id/rattachement-tenant",    "gerer_utilisateurs"],
  ["GET",    "/attributions",                            "gerer_utilisateurs"],
  ["GET",    "/utilisateurs",                            "gerer_utilisateurs"],
  ["POST",   "/utilisateurs",                            "gerer_utilisateurs"],
  ["PATCH",  "/utilisateurs/:id",                        "gerer_utilisateurs"],

  ["GET",    "/profils/:id/permissions",                 "gerer_utilisateurs"],
  ["POST",   "/profils/:id/permissions",                 "gerer_utilisateurs"],
  ["DELETE", "/profils/:id/permissions/:idPermission",   "gerer_utilisateurs"],
  ["GET",    "/profils/:id/societes",                    "gerer_utilisateurs"],
  ["POST",   "/profils/:id/societes",                    "gerer_utilisateurs"],
  ["DELETE", "/profils/:id/societes/:psId",              "gerer_utilisateurs"],
  ["GET",    "/profils/:id/impact",                      "gerer_utilisateurs"],
  ["GET",    "/profils",                                 "gerer_utilisateurs"],
  ["POST",   "/profils",                                 "gerer_utilisateurs"],
  ["GET",    "/profils/:id",                             "gerer_utilisateurs"],
  ["PATCH",  "/profils/:id",                             "gerer_utilisateurs"],
  ["DELETE", "/profils/:id",                             "gerer_utilisateurs"],
  ["GET",    "/permissions",                             "gerer_utilisateurs"],

  // ---- Journal -------------------------------------------------------------
  // La lecture du journal est une consultation d'audit. L'ecriture reste
  // ouverte a tout utilisateur authentifie : c'est une trace produite par ses
  // propres actions, la lui refuser ferait perdre la trace, pas la proteger.
  ["GET",    "/journal",                     "consulter_audit_log"],
  ["POST",   "/journal",                     PUBLIC_AUTHENTIFIE],
];
