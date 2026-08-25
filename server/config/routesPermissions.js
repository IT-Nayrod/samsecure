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
// Codes disponibles, referentiel permission (29 codes, 7 modules) :
//   administration : gerer_utilisateurs, gerer_exceptions_droit,
//                    consulter_audit_log, gerer_connecteurs
//   droits_usage   : consulter_contrats, consulter_factures, saisir_contrat,
//                    saisir_commande, deposer_facture_preuve
//   deploiement    : valider_saisie, consulter_licences, consulter_inventaire,
//                    saisir_licence, saisir_affectation, rapprocher_inventaire,
//                    importer_inventaire (#111, 28e code)
//   organisation   : consulter_referentiels, gerer_referentiels, gerer_contacts
//   budget         : consulter_budget, saisir_budget, consulter_kpi_financiers,
//                    supprimer_budget (#146, 29e code)
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

  // ---- Deploiement : licences (#102) ---------------------------------------
  // Le droit de lire un montant est distinct du droit de lire la licence :
  // consulter_kpi_financiers est evalue dans le routeur (masquage des couts),
  // pas ici. Les sous-routes de maintenance suivent les memes deux droits.
  ["GET",    "/licences",                              "consulter_licences"],
  ["GET",    "/licences/:id",                          "consulter_licences"],
  ["GET",    "/licences/:id/maintenance",              "consulter_licences"],
  ["POST",   "/licences",                              "saisir_licence"],
  ["PATCH",  "/licences/:id",                          "saisir_licence"],
  ["DELETE", "/licences/:id",                          "saisir_licence"],
  ["POST",   "/licences/:id/maintenance",              "saisir_licence"],
  ["PATCH",  "/licences/:id/maintenance/:mid",         "saisir_licence"],
  ["DELETE", "/licences/:id/maintenance/:mid",         "saisir_licence"],
  ["POST",   "/licences/:id/arret-maintenance",        "saisir_licence"],
  ["POST",   "/licences/:id/reprise-maintenance",      "saisir_licence"],

  // ---- Module 3 : affectations, usage declare et revalidation (#106) --------
  // Lecture : consulter_inventaire (Financier, IT Ops, Manager DSI). Saisie :
  // saisir_affectation (IT Ops, IT Data input, et Manager DSI par la matrice
  // 011). Revalidation : valider_saisie, comme le traitement du circuit unique.
  // Les chemins litteraux decompte et historique passent avant /affectations/:id.
  // GET /licences est servi par le routeur licences (#102), regle ci-dessus.
  ["GET",    "/affectations/decompte",        "consulter_inventaire"],
  ["GET",    "/affectations/historique",      "consulter_inventaire"],
  ["GET",    "/affectations",                 "consulter_inventaire"],
  ["GET",    "/affectations/:id",             "consulter_inventaire"],
  ["POST",   "/affectations/:id/revalider",   "valider_saisie"],
  ["POST",   "/affectations",                 "saisir_affectation"],
  ["PATCH",  "/affectations/:id",             "saisir_affectation"],
  ["DELETE", "/affectations/:id",             "saisir_affectation"],

  // ---- Inventaire (#111, module 3) ------------------------------------------
  // Les chemins litteraux /inventaire/ecarts et /inventaire/affectations
  // passent avant /inventaire/releves/:id. L'import exige un droit propre,
  // importer_inventaire (migrations 031 et 032), detenu par admin_sam et
  // manager_dsi : consulter et rapprocher ne suffisent pas a introduire des
  // donnees dans le parc. Le rapprochement ne touche jamais une affectation.
  ["GET",    "/inventaire/imports",                       "consulter_inventaire"],
  ["POST",   "/inventaire/imports",                       "importer_inventaire"],
  ["GET",    "/inventaire/imports/:id",                   "consulter_inventaire"],
  ["GET",    "/inventaire/ecarts",                        "consulter_inventaire"],
  ["GET",    "/inventaire/affectations",                  "consulter_inventaire"],
  ["GET",    "/inventaire/releves",                       "consulter_inventaire"],
  ["GET",    "/inventaire/releves/:id",                   "consulter_inventaire"],
  ["POST",   "/inventaire/releves/:id/rapprocher",        "rapprocher_inventaire"],
  ["POST",   "/inventaire/releves/:id/ecart-assume",      "rapprocher_inventaire"],
  ["POST",   "/inventaire/releves/:id/rejeter",           "rapprocher_inventaire"],
  ["POST",   "/inventaire/releves/:id/reouvrir",          "rapprocher_inventaire"],

  // ---- Module 4 : budget (#146) ---------------------------------------------
  // Lecture : consulter_budget (Admin, Manager DSI, Financier, IT Ops). Saisie
  // et preremplissage : saisir_budget (Admin, Manager DSI, Financier ; retiree
  // a IT Ops par les migrations 035 et 036, la US le place en lecture).
  // Suppression : supprimer_budget, permission propre (035 Commune, 036
  // Tenant) detenue par Admin, Manager DSI et Financier : la saisie ne vaut
  // pas droit de supprimer. Les montants ne sont pas masques dans ce module.
  // Les chemins litteraux passent avant /budget/:id.
  ["GET",    "/budget/preremplissage",       "saisir_budget"],
  ["GET",    "/budget/engage",               "consulter_budget"],
  ["GET",    "/budget/synthese",             "consulter_budget"],
  ["GET",    "/budget",                      "consulter_budget"],
  ["GET",    "/budget/:id",                  "consulter_budget"],
  ["POST",   "/budget",                      "saisir_budget"],
  ["PATCH",  "/budget/:id",                  "saisir_budget"],
  ["DELETE", "/budget/:id",                  "supprimer_budget"],

  // ---- Referentiels en lecture ---------------------------------------------
  ["GET",    "/produits",                    "consulter_referentiels"],
  ["GET",    "/unites-mesure",               "consulter_referentiels"],
  ["GET",    "/mainteneurs",                 "consulter_referentiels"],
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
  ["POST",   "/utilisateurs/:id/mot-de-passe/generer",          "gerer_utilisateurs"],
  ["PUT",    "/utilisateurs/:id/mot-de-passe",                  "gerer_utilisateurs"],
  ["GET",    "/utilisateurs/:id/historique",                    "gerer_utilisateurs"],
  ["GET",    "/utilisateurs/:id/droits-effectifs",              "gerer_utilisateurs"],
  ["GET",    "/utilisateurs/:id/profils",                       "gerer_utilisateurs"],
  ["POST",   "/utilisateurs/:id/profils",                       "gerer_utilisateurs"],
  ["DELETE", "/utilisateurs/:id/profils/:attribId",             "gerer_utilisateurs"],
  ["GET",    "/utilisateurs/:id/societes",                      "gerer_utilisateurs"],
  ["POST",   "/utilisateurs/:id/societes",                      "gerer_utilisateurs"],
  ["DELETE", "/utilisateurs/:id/societes/:societeId",           "gerer_utilisateurs"],
  ["DELETE", "/utilisateurs/:id/rattachement-tenant",           "gerer_utilisateurs"],
  ["GET",    "/attributions",                                   "gerer_utilisateurs"],
  ["GET",    "/utilisateurs",                                   "gerer_utilisateurs"],
  ["POST",   "/utilisateurs",                                   "gerer_utilisateurs"],
  ["PATCH",  "/utilisateurs/:id",                               "gerer_utilisateurs"],
  ["POST",   "/utilisateurs/:id/mot-de-passe/reinitialisation", "gerer_utilisateurs"],

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

  // ---- Mails (#87) ---------------------------------------------------------
  // Test de la configuration SMTP. gerer_connecteurs n'est detenue que par le
  // groupe admin_sam (matrice 011/021) : la route est de fait reservee au
  // profil administrateur, sans nommer de profil ici.
  ["POST",   "/mails/test",                  "gerer_connecteurs"],

  // ---- Journal -------------------------------------------------------------
  // La lecture du journal est une consultation d'audit. L'ecriture reste
  // ouverte a tout utilisateur authentifie : c'est une trace produite par ses
  // propres actions, la lui refuser ferait perdre la trace, pas la proteger.
  ["GET",    "/journal",                     "consulter_audit_log"],
  ["POST",   "/journal",                     PUBLIC_AUTHENTIFIE],
];
