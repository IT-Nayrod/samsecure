// licencesService - accès API du module licences (US #102, #209, #210).
// Même convention que contratsService : aucun fetch direct, http.js porte le
// Bearer, le refresh sur 401, la normalisation des erreurs en ApiError (code =
// code_retour 4000-4099) et le déballage de l'enveloppe { code, type, libelle, data }.
// La projection /licences est en snake_case, servie telle quelle. Les montants
// (cout_licence, coût de maintenance) arrivent à null avec montants_masques =
// true quand l'utilisateur n'a pas consulter_kpi_financiers : ne jamais les
// afficher comme un zéro.
import { http, optionnel } from './http';

export const licencesService = {
  list:   (filtres = {}) => {
    const q = new URLSearchParams(Object.entries(filtres).filter(([, v]) => v)).toString();
    return http.get(`/licences${q ? `?${q}` : ''}`);
  },
  get:    (id)          => http.get(`/licences/${id}`),
  create: (payload)     => http.post('/licences', payload),
  update: (id, payload) => http.patch(`/licences/${id}`, payload),
  remove: (id)          => http.delete(`/licences/${id}`),

  maintenance: {
    list:   (id)                 => http.get(`/licences/${id}/maintenance`),
    create: (id, payload)        => http.post(`/licences/${id}/maintenance`, payload),
    update: (id, mid, payload)   => http.patch(`/licences/${id}/maintenance/${mid}`, payload),
    remove: (id, mid)            => http.delete(`/licences/${id}/maintenance/${mid}`),
  },
  // Arrêt : fige la version et la date, sans retirer de droit quantitatif.
  // Reprise : annule un arrêt saisi par erreur, libère la version.
  arreterMaintenance:  (id, payload = {}) => http.post(`/licences/${id}/arret-maintenance`, payload),
  reprendreMaintenance: (id)              => http.post(`/licences/${id}/reprise-maintenance`, {}),
  // Prolongation (décision du 11/09/2026) : étend la date de fin de la période
  // en cours (souscription ou essai, ou fin de maintenance d'une perpétuelle),
  // sans créer de licence. La "nouvelle période" passe par create() avec
  // id_licence_predecesseur (4025, 4026, 4027).
  prolonger: (id, dateFin) => http.post(`/licences/${id}/prolonger`, { date_fin: dateFin }),

  // Versions et éditions ajoutées par le client à un produit du catalogue
  // (compléments Tenant, migration 063) : doublons refusés à la casse et aux
  // accents près (4037), le libellé est obligatoire (4036).
  complements: {
    list:           ()                 => http.get('/produits/complements'),
    ajouterVersion: (idProduit, label) => http.post(`/produits/${idProduit}/versions`, { label }),
    ajouterEdition: (idProduit, label) => http.post(`/produits/${idProduit}/editions`, { label }),
  },
};

// Fusion des compléments (versions et éditions ajoutées par le client) dans
// le catalogue servi par GET /produits, qui ne connaît que la BDD Commune :
// chaque produit reçoit ses compléments à la suite de ses déclinaisons du
// catalogue, avec source = 'complement'. Aucun doublon d'identifiant possible
// (deux tables distinctes).
export function fusionnerComplements(produits = [], complements = {}) {
  const parProduit = (liste = []) => {
    const index = new Map();
    for (const x of liste) {
      const l = index.get(x.id_produit) ?? [];
      l.push({ id: x.id, label: x.label, source: 'complement' });
      index.set(x.id_produit, l);
    }
    return index;
  };
  const versions = parProduit(complements.versions);
  const editions = parProduit(complements.editions);
  return produits.map(p => ({
    ...p,
    versions: [...(p.versions ?? []), ...(versions.get(p.id) ?? [])],
    editions: [...(p.editions ?? []), ...(editions.get(p.id) ?? [])],
  }));
}

// Référentiels du module : catalogue des produits (BDD Commune, versions et
// éditions imbriquées, éditeur résolu) complété des versions et éditions
// ajoutées par le client, unités de mesure, mainteneurs.
export const referentielsLicencesService = {
  produits: async () => {
    const [produits, complements] = await Promise.all([
      http.get('/produits'),
      // Ressource accessoire : sans le droit de lire les licences, le
      // catalogue est servi tel quel.
      optionnel(licencesService.complements.list(), { versions: [], editions: [] }),
    ]);
    return fusionnerComplements(produits, complements);
  },
  unitesMesure: () => http.get('/unites-mesure'),
  mainteneurs:  () => http.get('/mainteneurs'),
};

// Commandes proposées à une période de maintenance (décision du 11/09/2026) :
// celles du contrat de la licence en premier, puis les autres.
export function commandesPourMaintenance(commandes = [], idContrat = null) {
  if (!idContrat) return commandes;
  const duContrat = commandes.filter(c => c.id_contrat === idContrat);
  const autres = commandes.filter(c => c.id_contrat !== idContrat);
  return [...duContrat, ...autres];
}

// Échéance prolongeable d'une licence, même règle que l'API (4026) : la date
// de fin de souscription quand le type en porte une, sinon la fin de la
// maintenance en cours d'une licence sous maintenance non arrêtée.
export function echeanceProlongeable(licence) {
  if (!licence) return null;
  if (licence.date_fin_souscription) return { mode: 'souscription', date: licence.date_fin_souscription };
  if (licence.a_maintenance && licence.statut_maintenance !== 'arretee' && licence.date_fin_maintenance) {
    return { mode: 'maintenance', date: licence.date_fin_maintenance };
  }
  return null;
}

// Lendemain d'une date AAAA-MM-JJ, en UTC (aucun glissement de fuseau).
export function lendemain(iso) {
  if (!iso) return '';
  const t = Date.parse(String(iso).slice(0, 10));
  if (!Number.isFinite(t)) return '';
  return new Date(t + 86400000).toISOString().slice(0, 10);
}

// Types de licences (#209, référentiel type_licence de la migration 055) :
// sept valeurs et, pour chacune, la règle de la date de début et de la date
// de fin (obligatoire, facultative ou masquee) et la gestion de la version
// (D58 : pas de version sur les souscriptions). Miroir du seed 055 pour le
// formulaire ; la validation qui fait foi est celle de l'API (4018, 4021,
// 4031, 4032), qui lit la table. Une licence servie par l'API porte aussi
// type_label, regle_date_debut, regle_date_fin et version_geree.
export const TYPES_LICENCE = [
  { code: 'perpetuelle',  label: 'Licence perpétuelle',        regle_date_debut: 'facultative', regle_date_fin: 'masquee',     version_geree: true },
  { code: 'souscription', label: 'Souscription ou abonnement', regle_date_debut: 'facultative', regle_date_fin: 'obligatoire', version_geree: false },
  { code: 'essai',        label: 'Version d\'essai',           regle_date_debut: 'facultative', regle_date_fin: 'obligatoire', version_geree: true },
  { code: 'open_source',  label: 'Open source',                regle_date_debut: 'masquee',     regle_date_fin: 'masquee',     version_geree: true },
  { code: 'gratuiciel',   label: 'Gratuiciel',                 regle_date_debut: 'masquee',     regle_date_fin: 'masquee',     version_geree: true },
  { code: 'education',    label: 'Éducation',                  regle_date_debut: 'facultative', regle_date_fin: 'masquee',     version_geree: true },
  { code: 'gouvernement', label: 'Gouvernement',               regle_date_debut: 'facultative', regle_date_fin: 'masquee',     version_geree: true },
];

// Règle d'un type : celle servie par l'API sur la licence quand elle existe
// (source de vérité), sinon le miroir local, sinon un type inconnu traité
// comme une perpétuelle (dates de début facultative, pas de fin).
export function regleType(code, licence = null) {
  if (licence && licence.type === code && licence.regle_date_debut) {
    return {
      code, label: licence.type_label ?? code,
      regle_date_debut: licence.regle_date_debut, regle_date_fin: licence.regle_date_fin,
      version_geree: licence.version_geree !== false,
    };
  }
  return TYPES_LICENCE.find(t => t.code === code)
    ?? { code, label: code ?? 'Type inconnu', regle_date_debut: 'facultative', regle_date_fin: 'masquee', version_geree: true };
}

export function libelleType(code, licence = null) {
  return licence?.type_label ?? regleType(code).label;
}

// Métriques (#210) : liste fermée des huit unités proposées à la saisie
// (codes du seed 055). device, cpu et serveur restent en base pour les
// licences existantes mais ne sont plus proposées : le formulaire n'affiche
// une unité hors liste que si la licence éditée la porte déjà.
export const UNITES_MESURE_PROPOSEES = [
  'utilisateur_nomme', 'utilisateur_concurrent', 'serveur_poste', 'core',
  'processeur_socket', 'consommation', 'transaction_volume', 'gratuit',
];

export function unitesProposees(unites = [], idCourant = null) {
  const rang = new Map(UNITES_MESURE_PROPOSEES.map((c, i) => [c, i]));
  return unites
    .filter(u => rang.has(u.code) || u.id === idCourant)
    .sort((a, b) => (rang.get(a.code) ?? 99) - (rang.get(b.code) ?? 99));
}

// Libellés de l'historique des versions (D60, licence_version_historique).
export const EVENEMENTS_VERSION = {
  modification: 'Saisie directe',
  maintenance: 'Apportée par la maintenance',
  arret_maintenance: 'Figée à l\'arrêt de la maintenance',
  reprise_maintenance: 'Libérée à la reprise de la maintenance',
};

// Montant tel que servi par l'API : null vaut "masque" (ou non renseigné),
// jamais zéro. Affichage unique pour toutes les vues du module.
export function formatMontant(valeur, masque = false) {
  if (masque) return 'Masqué';
  if (valeur === null || valeur === undefined) return '-';
  return `${Number(valeur).toLocaleString('fr-FR')} €`;
}

// L'API sert url_logo_defaut (ex. /logos/microsoft.svg) ; LogoEditeur attend
// un logo_slug. Conversion locale, sans toucher au composant partagé.
export function editeurPourLogo(raisonSociale, urlLogo) {
  if (!raisonSociale) return null;
  const m = /\/logos\/([^/]+)\.svg$/.exec(urlLogo ?? '');
  return { raison_sociale: raisonSociale, logo_slug: m ? m[1] : null };
}
