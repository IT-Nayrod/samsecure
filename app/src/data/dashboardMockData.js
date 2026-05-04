// V2 - Mock data centralisé — dashboards SamSecure
// ~50 produits · 3 200 licences déployées · 2 326 besoins réels · 5 éditeurs

// ─── CONSTANTES COULEURS (V2 — 4 échelles) ───────────────────────────────────
export const THRESHOLD_GREEN    = '#22C55E';  // Conforme
export const THRESHOLD_YELLOW   = '#EAB308';  // Attention
export const THRESHOLD_ORANGE   = '#F59E0B';  // Problématique
export const THRESHOLD_RED      = '#EF4444';  // Critique
export const THRESHOLD_DARK_RED = '#991B1B';  // Dépassement (usage > droits)
export const THRESHOLD_BLUE     = '#3B82F6';  // Info / sous-utilisé

// ─── ÉDITEURS & LOGICIELS ───────────────────────────────────────────────────
// Total détenues : 3 200 | Total affectées : 2 326
export const editeursData = [
  {
    id: 'microsoft', name: 'Microsoft', color: '#0078D4',
    logiciels: [
      { id: 'ms-365',       name: 'Microsoft 365',   detenues: 800, affectees: 726, prixAnnuel: 250  },
      { id: 'ms-winserver', name: 'Windows Server',  detenues: 200, affectees: 190, prixAnnuel: 1500 },
      { id: 'ms-sql',       name: 'SQL Server',      detenues: 100, affectees: 90,  prixAnnuel: 3000 },
      { id: 'ms-azure',     name: 'Azure',           detenues: 100, affectees: 94,  prixAnnuel: 5000 },
    ],
  },
  {
    id: 'oracle', name: 'Oracle', color: '#C74634',
    logiciels: [
      { id: 'oracle-db',   name: 'Oracle Database',  detenues: 300, affectees: 200, prixAnnuel: 5000 },
      { id: 'oracle-mw',   name: 'Oracle Middleware', detenues: 100, affectees: 60,  prixAnnuel: 5000 },
      { id: 'oracle-java', name: 'Oracle Java SE',    detenues: 200, affectees: 130, prixAnnuel: 500  },
    ],
  },
  {
    id: 'sap', name: 'SAP', color: '#0070F2',
    logiciels: [
      { id: 'sap-erp', name: 'SAP ERP',             detenues: 400, affectees: 340, prixAnnuel: 2000 },
      { id: 'sap-bo',  name: 'SAP BusinessObjects', detenues: 200, affectees: 120, prixAnnuel: 1500 },
    ],
  },
  {
    id: 'ibm', name: 'IBM', color: '#1F70C1',
    logiciels: [
      { id: 'ibm-db2', name: 'IBM Db2',       detenues: 200, affectees: 110, prixAnnuel: 3000 },
      { id: 'ibm-mq',  name: 'IBM MQ',        detenues: 100, affectees: 40,  prixAnnuel: 2000 },
      { id: 'ibm-ws',  name: 'IBM WebSphere', detenues: 100, affectees: 50,  prixAnnuel: 2500 },
    ],
  },
  {
    id: 'adobe', name: 'Adobe', color: '#FF0000',
    logiciels: [
      { id: 'adobe-cc',   name: 'Adobe Creative Cloud', detenues: 200, affectees: 76,  prixAnnuel: 700 },
      { id: 'adobe-acro', name: 'Adobe Acrobat',        detenues: 200, affectees: 100, prixAnnuel: 200 },
    ],
  },
];

// Coûts annuels agrégés (affectées × prixAnnuel) — total : 4 039 700 €
export const coutParEditeur = editeursData.map(ed => ({
  editeur: ed.name, color: ed.color,
  montant: ed.logiciels.reduce((s, l) => s + l.affectees * l.prixAnnuel, 0),
}));

// Coûts annuels si toutes détenues facturées — total : 5 730 000 €
export const coutParEditeurDetenues = editeursData.map(ed => ({
  editeur: ed.name, color: ed.color,
  montant: ed.logiciels.reduce((s, l) => s + l.detenues * l.prixAnnuel, 0),
}));

// ─── W02 REVALIDATIONS ──────────────────────────────────────────────────────
export const revalidationsData = {
  ok: 1850,      // prochaine revalidation > 30 jours
  warning: 312,  // < 30 jours
  expired: 164,  // délai dépassé
};

// ─── W03 QUALITÉ SAISIES (V2 — granularité détaillée) ───────────────────────
export const qualiteSaisiesData = {
  anomalies: 6,
  licencesSansContrat: 3,
  contratsSansFacture: 2,
  doublonsPotentiels: 1,
};

// ─── W04 ÉCHÉANCES CONTRATS (12 mois — V2 : 4 couleurs + détail éditeurs) ───
export const echeancesContratsData = [
  { mois: 'Avr', vert: 3, jaune: 1, orange: 0, rouge: 0,
    editeurs: [{ name: 'Oracle', qte: 2, couleur: 'vert', color: '#C74634' }, { name: 'SAP', qte: 1, couleur: 'vert', color: '#0070F2' }, { name: 'Microsoft', qte: 1, couleur: 'jaune', color: '#0078D4' }] },
  { mois: 'Mai', vert: 4, jaune: 1, orange: 0, rouge: 0,
    editeurs: [{ name: 'IBM', qte: 3, couleur: 'vert', color: '#1F70C1' }, { name: 'Adobe', qte: 1, couleur: 'vert', color: '#FF0000' }, { name: 'Oracle', qte: 1, couleur: 'jaune', color: '#C74634' }] },
  { mois: 'Juin', vert: 2, jaune: 1, orange: 1, rouge: 1,
    editeurs: [{ name: 'SAP', qte: 2, couleur: 'vert', color: '#0070F2' }, { name: 'Microsoft', qte: 1, couleur: 'jaune', color: '#0078D4' }, { name: 'IBM', qte: 1, couleur: 'orange', color: '#1F70C1' }, { name: 'Oracle', qte: 1, couleur: 'rouge', color: '#C74634' }] },
  { mois: 'Juil', vert: 5, jaune: 1, orange: 0, rouge: 0,
    editeurs: [{ name: 'Microsoft', qte: 3, couleur: 'vert', color: '#0078D4' }, { name: 'SAP', qte: 2, couleur: 'vert', color: '#0070F2' }, { name: 'Adobe', qte: 1, couleur: 'jaune', color: '#FF0000' }] },
  { mois: 'Août', vert: 2, jaune: 0, orange: 0, rouge: 0,
    editeurs: [{ name: 'Oracle', qte: 1, couleur: 'vert', color: '#C74634' }, { name: 'IBM', qte: 1, couleur: 'vert', color: '#1F70C1' }] },
  { mois: 'Sep', vert: 3, jaune: 1, orange: 1, rouge: 0,
    editeurs: [{ name: 'Microsoft', qte: 2, couleur: 'vert', color: '#0078D4' }, { name: 'SAP', qte: 1, couleur: 'vert', color: '#0070F2' }, { name: 'Oracle', qte: 1, couleur: 'jaune', color: '#C74634' }, { name: 'IBM', qte: 1, couleur: 'orange', color: '#1F70C1' }] },
  { mois: 'Oct', vert: 4, jaune: 1, orange: 0, rouge: 1,
    editeurs: [{ name: 'SAP', qte: 3, couleur: 'vert', color: '#0070F2' }, { name: 'Adobe', qte: 1, couleur: 'vert', color: '#FF0000' }, { name: 'Microsoft', qte: 1, couleur: 'jaune', color: '#0078D4' }, { name: 'Oracle', qte: 1, couleur: 'rouge', color: '#C74634' }] },
  { mois: 'Nov', vert: 1, jaune: 1, orange: 0, rouge: 0,
    editeurs: [{ name: 'IBM', qte: 1, couleur: 'vert', color: '#1F70C1' }, { name: 'SAP', qte: 1, couleur: 'jaune', color: '#0070F2' }] },
  { mois: 'Déc', vert: 2, jaune: 2, orange: 1, rouge: 0,
    editeurs: [{ name: 'Microsoft', qte: 1, couleur: 'vert', color: '#0078D4' }, { name: 'Oracle', qte: 1, couleur: 'vert', color: '#C74634' }, { name: 'SAP', qte: 1, couleur: 'jaune', color: '#0070F2' }, { name: 'IBM', qte: 1, couleur: 'jaune', color: '#1F70C1' }, { name: 'Adobe', qte: 1, couleur: 'orange', color: '#FF0000' }] },
  { mois: 'Jan', vert: 3, jaune: 0, orange: 0, rouge: 2,
    editeurs: [{ name: 'SAP', qte: 2, couleur: 'vert', color: '#0070F2' }, { name: 'Microsoft', qte: 1, couleur: 'vert', color: '#0078D4' }, { name: 'Oracle', qte: 1, couleur: 'rouge', color: '#C74634' }, { name: 'IBM', qte: 1, couleur: 'rouge', color: '#1F70C1' }] },
  { mois: 'Fév', vert: 2, jaune: 1, orange: 1, rouge: 0,
    editeurs: [{ name: 'Microsoft', qte: 1, couleur: 'vert', color: '#0078D4' }, { name: 'IBM', qte: 1, couleur: 'vert', color: '#1F70C1' }, { name: 'Oracle', qte: 1, couleur: 'jaune', color: '#C74634' }, { name: 'Adobe', qte: 1, couleur: 'orange', color: '#FF0000' }] },
  { mois: 'Mar', vert: 4, jaune: 1, orange: 0, rouge: 0,
    editeurs: [{ name: 'SAP', qte: 2, couleur: 'vert', color: '#0070F2' }, { name: 'Oracle', qte: 1, couleur: 'vert', color: '#C74634' }, { name: 'Microsoft', qte: 1, couleur: 'vert', color: '#0078D4' }, { name: 'IBM', qte: 1, couleur: 'jaune', color: '#1F70C1' }] },
];

// ─── W05 ÉCHÉANCES COMMANDES (12 mois — V2 : 4 couleurs + détail éditeurs) ──
export const echeancesCommandesData = [
  { mois: 'Avr', vert: 2, jaune: 1, orange: 0, rouge: 0,
    editeurs: [{ name: 'Microsoft', qte: 1, couleur: 'vert', color: '#0078D4' }, { name: 'SAP', qte: 1, couleur: 'vert', color: '#0070F2' }, { name: 'Oracle', qte: 1, couleur: 'jaune', color: '#C74634' }] },
  { mois: 'Mai', vert: 3, jaune: 0, orange: 0, rouge: 0,
    editeurs: [{ name: 'IBM', qte: 2, couleur: 'vert', color: '#1F70C1' }, { name: 'Adobe', qte: 1, couleur: 'vert', color: '#FF0000' }] },
  { mois: 'Juin', vert: 1, jaune: 2, orange: 1, rouge: 0,
    editeurs: [{ name: 'Oracle', qte: 1, couleur: 'vert', color: '#C74634' }, { name: 'SAP', qte: 1, couleur: 'jaune', color: '#0070F2' }, { name: 'Microsoft', qte: 1, couleur: 'jaune', color: '#0078D4' }, { name: 'IBM', qte: 1, couleur: 'orange', color: '#1F70C1' }] },
  { mois: 'Juil', vert: 4, jaune: 0, orange: 0, rouge: 1,
    editeurs: [{ name: 'Microsoft', qte: 2, couleur: 'vert', color: '#0078D4' }, { name: 'SAP', qte: 2, couleur: 'vert', color: '#0070F2' }, { name: 'Oracle', qte: 1, couleur: 'rouge', color: '#C74634' }] },
  { mois: 'Août', vert: 1, jaune: 1, orange: 0, rouge: 0,
    editeurs: [{ name: 'Oracle', qte: 1, couleur: 'vert', color: '#C74634' }, { name: 'IBM', qte: 1, couleur: 'jaune', color: '#1F70C1' }] },
  { mois: 'Sep', vert: 5, jaune: 1, orange: 0, rouge: 0,
    editeurs: [{ name: 'Microsoft', qte: 3, couleur: 'vert', color: '#0078D4' }, { name: 'SAP', qte: 1, couleur: 'vert', color: '#0070F2' }, { name: 'Adobe', qte: 1, couleur: 'vert', color: '#FF0000' }, { name: 'Oracle', qte: 1, couleur: 'jaune', color: '#C74634' }] },
  { mois: 'Oct', vert: 2, jaune: 2, orange: 0, rouge: 0,
    editeurs: [{ name: 'IBM', qte: 1, couleur: 'vert', color: '#1F70C1' }, { name: 'Oracle', qte: 1, couleur: 'vert', color: '#C74634' }, { name: 'Microsoft', qte: 1, couleur: 'jaune', color: '#0078D4' }, { name: 'SAP', qte: 1, couleur: 'jaune', color: '#0070F2' }] },
  { mois: 'Nov', vert: 3, jaune: 0, orange: 0, rouge: 1,
    editeurs: [{ name: 'SAP', qte: 2, couleur: 'vert', color: '#0070F2' }, { name: 'Microsoft', qte: 1, couleur: 'vert', color: '#0078D4' }, { name: 'IBM', qte: 1, couleur: 'rouge', color: '#1F70C1' }] },
  { mois: 'Déc', vert: 1, jaune: 1, orange: 1, rouge: 0,
    editeurs: [{ name: 'Oracle', qte: 1, couleur: 'vert', color: '#C74634' }, { name: 'SAP', qte: 1, couleur: 'jaune', color: '#0070F2' }, { name: 'Adobe', qte: 1, couleur: 'orange', color: '#FF0000' }] },
  { mois: 'Jan', vert: 4, jaune: 1, orange: 0, rouge: 0,
    editeurs: [{ name: 'Microsoft', qte: 3, couleur: 'vert', color: '#0078D4' }, { name: 'IBM', qte: 1, couleur: 'vert', color: '#1F70C1' }, { name: 'Oracle', qte: 1, couleur: 'jaune', color: '#C74634' }] },
  { mois: 'Fév', vert: 2, jaune: 0, orange: 0, rouge: 2,
    editeurs: [{ name: 'SAP', qte: 1, couleur: 'vert', color: '#0070F2' }, { name: 'Microsoft', qte: 1, couleur: 'vert', color: '#0078D4' }, { name: 'Oracle', qte: 1, couleur: 'rouge', color: '#C74634' }, { name: 'IBM', qte: 1, couleur: 'rouge', color: '#1F70C1' }] },
  { mois: 'Mar', vert: 3, jaune: 1, orange: 1, rouge: 0,
    editeurs: [{ name: 'Microsoft', qte: 2, couleur: 'vert', color: '#0078D4' }, { name: 'SAP', qte: 1, couleur: 'vert', color: '#0070F2' }, { name: 'Oracle', qte: 1, couleur: 'jaune', color: '#C74634' }, { name: 'IBM', qte: 1, couleur: 'orange', color: '#1F70C1' }] },
];

// ─── W06 MONTANTS TOTAUX (par éditeur / période 1 an) ───────────────────────
export const montantsTotauxData = {
  parEditeur: [
    { label: 'Microsoft', value: 1206500, color: '#0078D4' },
    { label: 'Oracle',    value: 1365000, color: '#C74634' },
    { label: 'SAP',       value:  860000, color: '#0070F2' },
    { label: 'IBM',       value:  535000, color: '#1F70C1' },
    { label: 'Adobe',     value:   73200, color: '#FF0000' },
  ],
  parSociete: [
    { label: 'Siège',        value: 2420820, color: '#7C6FCD' },
    { label: 'Filiale Nord', value:  978640, color: '#3FC8B8' },
    { label: 'Filiale Sud',  value:  640240, color: '#52C97A' },
  ],
  parProduit: [
    { label: 'Oracle Database',    value: 1000000, color: '#C74634' },
    { label: 'SAP ERP',            value:  680000, color: '#0070F2' },
    { label: 'Azure',              value:  470000, color: '#0078D4' },
    { label: 'Oracle Middleware',  value:  300000, color: '#E07B39' },
    { label: 'IBM Db2',            value:  330000, color: '#1F70C1' },
    { label: 'SQL Server',         value:  270000, color: '#1A8CFF' },
    { label: 'Windows Server',     value:  285000, color: '#50AAD8' },
    { label: 'SAP BusinessObjects',value:  180000, color: '#3DBAEE' },
    { label: 'IBM WebSphere',      value:  125000, color: '#5294CF' },
    { label: 'Microsoft 365',      value:  181500, color: '#00A4EF' },
  ],
};

// ─── W07 INDICE DE CONFIANCE ─────────────────────────────────────────────────
export const indicConfianceData = { score: 74 };

// ─── W08 VALIDATIONS EN ATTENTE > 1 JOUR ────────────────────────────────────
export const validationsEnAttenteData = { count: 7 };

// ─── W09 INDICE DE CONFORMITÉ GLOBAL ────────────────────────────────────────
export const indiceConformiteData = {
  score: 50,
  segments: [
    { name: 'Conforme',     value: 22, color: THRESHOLD_GREEN  },
    { name: 'À risque',     value: 12, color: THRESHOLD_ORANGE },
    { name: 'Non conforme', value:  8, color: THRESHOLD_RED    },
    { name: 'Sous-utilisé', value:  8, color: THRESHOLD_BLUE   },
  ],
};

// ─── W10 PRÉVISION BUDGÉTAIRE N+1 ───────────────────────────────────────────
export const previsionBudgetaireData = [
  { produit: 'Oracle Database',     coutN: 1000000, coutN1: 950000,  prevN1: 1050000 },
  { produit: 'SAP ERP',             coutN:  680000, coutN1: 680000,  prevN1:  714000 },
  { produit: 'Azure',               coutN:  470000, coutN1: 380000,  prevN1:  550000 },
  { produit: 'IBM Db2',             coutN:  330000, coutN1: 330000,  prevN1:  346500 },
  { produit: 'Oracle Middleware',   coutN:  300000, coutN1: 310000,  prevN1:  295000 },
  { produit: 'SQL Server',          coutN:  270000, coutN1: 265000,  prevN1:  280000 },
  { produit: 'Windows Server',      coutN:  285000, coutN1: 285000,  prevN1:  285000 },
  { produit: 'SAP BusinessObjects', coutN:  180000, coutN1: 195000,  prevN1:  175000 },
  { produit: 'Microsoft 365',       coutN:  181500, coutN1: 175000,  prevN1:  188000 },
];

// ─── W11 MONTANTS PÉRIODE BUDGÉTAIRE ────────────────────────────────────────
export const montantsBudgetaireData = {
  engages:       2847320,
  resteAEngager: 1012380,
  periode: 'Jan 2026 — Déc 2026',
};

// ─── W12 CONFORMITÉ RÉEL VS PRÉVISIONNEL (V2) ────────────────────────────────
export const reelVsPrevisionnelData = {
  reel:          2847320,
  previsionnel:  2758400,
  ecartPct:      3.2,
  conformitePct: 96.8,   // min(reel,prev) / max(reel,prev) × 100
};

// ─── W13 ÉCHÉANCES DES CONTRATS (V2 — 4 catégories) ─────────────────────────
export const contratsEnCoursData = {
  ok:       14,  // > 3 mois (vert)
  warning:   4,  // 2-3 mois (jaune)
  critique:  4,  // dernier mois (orange)
  expired:   3,  // échus (rouge)
};

// ─── W15 ÉCHÉANCES DE TRÉSORERIE (montants mensuels + détail éditeurs) ───────
export const echeancesTresorerieData = [
  { mois: 'Avr', montant: 125000, editeurs: [{ name: 'Microsoft', montant: 75000, color: '#0078D4' }, { name: 'Adobe', montant: 50000, color: '#FF0000' }] },
  { mois: 'Mai', montant: 234000, editeurs: [{ name: 'Oracle', montant: 150000, color: '#C74634' }, { name: 'SAP', montant: 84000, color: '#0070F2' }] },
  { mois: 'Juin', montant: 87000, editeurs: [{ name: 'IBM', montant: 52000, color: '#1F70C1' }, { name: 'Microsoft', montant: 35000, color: '#0078D4' }] },
  { mois: 'Juil', montant: 156000, editeurs: [{ name: 'SAP', montant: 95000, color: '#0070F2' }, { name: 'Oracle', montant: 61000, color: '#C74634' }] },
  { mois: 'Août', montant: 45000, editeurs: [{ name: 'Adobe', montant: 30000, color: '#FF0000' }, { name: 'IBM', montant: 15000, color: '#1F70C1' }] },
  { mois: 'Sep', montant: 312000, editeurs: [{ name: 'Oracle', montant: 180000, color: '#C74634' }, { name: 'Microsoft', montant: 82000, color: '#0078D4' }, { name: 'SAP', montant: 50000, color: '#0070F2' }] },
  { mois: 'Oct', montant: 198000, editeurs: [{ name: 'SAP', montant: 120000, color: '#0070F2' }, { name: 'IBM', montant: 78000, color: '#1F70C1' }] },
  { mois: 'Nov', montant: 76000, editeurs: [{ name: 'Microsoft', montant: 46000, color: '#0078D4' }, { name: 'Adobe', montant: 30000, color: '#FF0000' }] },
  { mois: 'Déc', montant: 423000, editeurs: [{ name: 'Oracle', montant: 210000, color: '#C74634' }, { name: 'SAP', montant: 130000, color: '#0070F2' }, { name: 'Microsoft', montant: 83000, color: '#0078D4' }] },
  { mois: 'Jan', montant: 167000, editeurs: [{ name: 'IBM', montant: 90000, color: '#1F70C1' }, { name: 'SAP', montant: 77000, color: '#0070F2' }] },
  { mois: 'Fév', montant: 89000, editeurs: [{ name: 'Microsoft', montant: 55000, color: '#0078D4' }, { name: 'Oracle', montant: 34000, color: '#C74634' }] },
  { mois: 'Mar', montant: 298000, editeurs: [{ name: 'SAP', montant: 150000, color: '#0070F2' }, { name: 'Oracle', montant: 98000, color: '#C74634' }, { name: 'IBM', montant: 50000, color: '#1F70C1' }] },
];

// ─── W16 VALORISATION DES LICENCES NON UTILISÉES (V2) ────────────────────────
// non utilisées : 3200 − 2326 = 874 licences → 874/3200 = 27.3 %
export const valorisationLicencesData = {
  total: 142528,
  pctNonUtilisees: 27.3,   // % de licences non utilisées sur total détenues
  segments: [
    { name: 'Oracle',    value:  32000, color: '#C74634' },
    { name: 'SAP',       value:  36000, color: '#0070F2' },
    { name: 'IBM',       value:  31500, color: '#1F70C1' },
    { name: 'Adobe',     value:  22828, color: '#FF0000' },
    { name: 'Microsoft', value:  20200, color: '#0078D4' },
  ],
};

// ─── W17 COÛT PAR LOGICIEL (V2 — liste triable, top 10) ─────────────────────
const _totalBudget = 4039700;
export const coutParLogicielData = [
  { name: 'Oracle Database',    montant: 1000000, color: '#C74634' },
  { name: 'SAP ERP',            montant:  680000, color: '#0070F2' },
  { name: 'Azure',              montant:  470000, color: '#0078D4' },
  { name: 'IBM Db2',            montant:  330000, color: '#1F70C1' },
  { name: 'Oracle Middleware',  montant:  300000, color: '#E07B39' },
  { name: 'SQL Server',         montant:  270000, color: '#1A8CFF' },
  { name: 'Windows Server',     montant:  285000, color: '#50AAD8' },
  { name: 'SAP BusinessObjects',montant:  180000, color: '#3DBAEE' },
  { name: 'Microsoft 365',      montant:  181500, color: '#00A4EF' },
  { name: 'IBM WebSphere',      montant:  125000, color: '#5294CF' },
].map(l => ({ ...l, pctBudget: Math.round((l.montant / _totalBudget) * 1000) / 10 }));

// ─── W18 COÛT DES LICENCES MANQUANTES (16 mois) ──────────────────────────────
export const coutEcartsData = [
  { mois: 'Jan 25', valeur: 42000 },
  { mois: 'Fév 25', valeur: 45600 },
  { mois: 'Mar 25', valeur: 38400 },
  { mois: 'Avr 25', valeur: 52000 },
  { mois: 'Mai 25', valeur: 47300 },
  { mois: 'Juin 25',valeur: 44100 },
  { mois: 'Juil 25',valeur: 56200 },
  { mois: 'Août 25',valeur: 49700 },
  { mois: 'Sep 25', valeur: 43800 },
  { mois: 'Oct 25', valeur: 58900 },
  { mois: 'Nov 25', valeur: 62400 },
  { mois: 'Déc 25', valeur: 55100 },
  { mois: 'Jan 26', valeur: 68200 },
  { mois: 'Fév 26', valeur: 71500 },
  { mois: 'Mar 26', valeur: 64800 },
  { mois: 'Avr 26', valeur: 73200 },
];

// ─── MONTANTS ENGAGÉS VS PAYÉS (nouveau widget financier V2) ─────────────────
export const montantsEngagesPayesData = {
  parEditeur: [
    { editeur: 'Microsoft', color: '#0078D4', commande: 1350000, paye: 1206500 },
    { editeur: 'Oracle',    color: '#C74634', commande: 1500000, paye: 1365000 },
    { editeur: 'SAP',       color: '#0070F2', commande:  920000, paye:  860000 },
    { editeur: 'IBM',       color: '#1F70C1', commande:  580000, paye:  535000 },
    { editeur: 'Adobe',     color: '#FF0000', commande:   80000, paye:   73200 },
  ],
  parProduit: {
    Microsoft: [
      { produit: 'Microsoft 365',  commande: 210000, paye: 181500 },
      { produit: 'Windows Server', commande: 310000, paye: 285000 },
      { produit: 'SQL Server',     commande: 290000, paye: 270000 },
      { produit: 'Azure',          commande: 540000, paye: 470000 },
    ],
    Oracle: [
      { produit: 'Oracle Database',  commande: 1100000, paye: 1000000 },
      { produit: 'Oracle Middleware', commande:  320000, paye:  300000 },
      { produit: 'Oracle Java SE',    commande:   80000, paye:   65000 },
    ],
    SAP: [
      { produit: 'SAP ERP',            commande: 730000, paye: 680000 },
      { produit: 'SAP BusinessObjects', commande: 190000, paye: 180000 },
    ],
    IBM: [
      { produit: 'IBM Db2',       commande: 350000, paye: 330000 },
      { produit: 'IBM MQ',        commande: 100000, paye:  80000 },
      { produit: 'IBM WebSphere', commande: 130000, paye: 125000 },
    ],
    Adobe: [
      { produit: 'Adobe Creative Cloud', commande: 55000, paye: 53200 },
      { produit: 'Adobe Acrobat',        commande: 25000, paye: 20000 },
    ],
  },
};

// ─── W19 BALANCE USAGES VS DROITS ────────────────────────────────────────────
export const balanceUsagesDroitsData = {
  depassement:  2,
  saturation:   3,
  risque:       8,
  ok:          37,
};

// ─── W20 USAGE 12 MOIS GLISSANTS ────────────────────────────────────────────
export const usage12MoisData = {
  produits: ['Tous', 'Microsoft 365', 'Oracle Database', 'SAP ERP'],
  societes: ['Toutes', 'Siège', 'Filiale Nord', 'Filiale Sud'],
  series: {
    'Tous': [
      { mois: 'Mai 25', affectees: 2180, droits: 2326 },
      { mois: 'Juin 25',affectees: 2200, droits: 2326 },
      { mois: 'Juil 25',affectees: 2240, droits: 2326 },
      { mois: 'Août 25',affectees: 2210, droits: 2326 },
      { mois: 'Sep 25', affectees: 2280, droits: 2326 },
      { mois: 'Oct 25', affectees: 2290, droits: 2326 },
      { mois: 'Nov 25', affectees: 2300, droits: 2326 },
      { mois: 'Déc 25', affectees: 2310, droits: 2326 },
      { mois: 'Jan 26', affectees: 2290, droits: 2326 },
      { mois: 'Fév 26', affectees: 2315, droits: 2326 },
      { mois: 'Mar 26', affectees: 2320, droits: 2326 },
      { mois: 'Avr 26', affectees: 2326, droits: 2326 },
      { mois: 'Mai 26', affectees: null, droits: 2326, projection: 2336 },
      { mois: 'Juin 26',affectees: null, droits: 2326, projection: 2346 },
      { mois: 'Juil 26',affectees: null, droits: 2326, projection: 2360 },
    ],
    'Microsoft 365': [
      { mois: 'Mai 25', affectees: 700, droits: 800 },
      { mois: 'Juin 25',affectees: 710, droits: 800 },
      { mois: 'Juil 25',affectees: 718, droits: 800 },
      { mois: 'Août 25',affectees: 714, droits: 800 },
      { mois: 'Sep 25', affectees: 720, droits: 800 },
      { mois: 'Oct 25', affectees: 722, droits: 800 },
      { mois: 'Nov 25', affectees: 724, droits: 800 },
      { mois: 'Déc 25', affectees: 725, droits: 800 },
      { mois: 'Jan 26', affectees: 724, droits: 800 },
      { mois: 'Fév 26', affectees: 725, droits: 800 },
      { mois: 'Mar 26', affectees: 725, droits: 800 },
      { mois: 'Avr 26', affectees: 726, droits: 800 },
      { mois: 'Mai 26', affectees: null, droits: 800, projection: 728 },
      { mois: 'Juin 26',affectees: null, droits: 800, projection: 731 },
      { mois: 'Juil 26',affectees: null, droits: 800, projection: 734 },
    ],
    'Oracle Database': [
      { mois: 'Mai 25', affectees: 188, droits: 300 },
      { mois: 'Juin 25',affectees: 192, droits: 300 },
      { mois: 'Juil 25',affectees: 195, droits: 300 },
      { mois: 'Août 25',affectees: 193, droits: 300 },
      { mois: 'Sep 25', affectees: 196, droits: 300 },
      { mois: 'Oct 25', affectees: 198, droits: 300 },
      { mois: 'Nov 25', affectees: 199, droits: 300 },
      { mois: 'Déc 25', affectees: 199, droits: 300 },
      { mois: 'Jan 26', affectees: 200, droits: 300 },
      { mois: 'Fév 26', affectees: 200, droits: 300 },
      { mois: 'Mar 26', affectees: 200, droits: 300 },
      { mois: 'Avr 26', affectees: 200, droits: 300 },
      { mois: 'Mai 26', affectees: null, droits: 300, projection: 202 },
      { mois: 'Juin 26',affectees: null, droits: 300, projection: 204 },
      { mois: 'Juil 26',affectees: null, droits: 300, projection: 207 },
    ],
    'SAP ERP': [
      { mois: 'Mai 25', affectees: 320, droits: 400 },
      { mois: 'Juin 25',affectees: 326, droits: 400 },
      { mois: 'Juil 25',affectees: 330, droits: 400 },
      { mois: 'Août 25',affectees: 328, droits: 400 },
      { mois: 'Sep 25', affectees: 333, droits: 400 },
      { mois: 'Oct 25', affectees: 336, droits: 400 },
      { mois: 'Nov 25', affectees: 338, droits: 400 },
      { mois: 'Déc 25', affectees: 339, droits: 400 },
      { mois: 'Jan 26', affectees: 338, droits: 400 },
      { mois: 'Fév 26', affectees: 340, droits: 400 },
      { mois: 'Mar 26', affectees: 340, droits: 400 },
      { mois: 'Avr 26', affectees: 340, droits: 400 },
      { mois: 'Mai 26', affectees: null, droits: 400, projection: 342 },
      { mois: 'Juin 26',affectees: null, droits: 400, projection: 345 },
      { mois: 'Juil 26',affectees: null, droits: 400, projection: 348 },
    ],
  },
};

// ─── W23 DERNIÈRES SAISIES ────────────────────────────────────────────────────
export const dernieresSaisiesData = [
  { id: 1, statut: 'en_attente', date: '16/04/2026', type: 'Affectation',     nom: 'M365 – M. Faure',        soumis: 'C. Bernard' },
  { id: 2, statut: 'valide',     date: '16/04/2026', type: 'Renouvellement',  nom: 'Oracle DB – Siège',      soumis: 'T. Dupont'  },
  { id: 3, statut: 'en_attente', date: '15/04/2026', type: 'Nouveau logiciel',nom: 'SAP BO v4',              soumis: 'M. Leblanc' },
  { id: 4, statut: 'refuse',     date: '15/04/2026', type: 'Affectation',     nom: 'IBM MQ – K. Pires',     soumis: 'J. Petit'   },
  { id: 5, statut: 'valide',     date: '14/04/2026', type: 'Suppression',     nom: 'Adobe CC – 8 licences', soumis: 'C. Bernard' },
  { id: 6, statut: 'en_attente', date: '14/04/2026', type: 'Affectation',     nom: 'SQL Server – Filiale N',soumis: 'S. Martin'  },
  { id: 7, statut: 'valide',     date: '13/04/2026', type: 'Renouvellement',  nom: 'IBM WebSphere – v9',    soumis: 'T. Dupont'  },
  { id: 8, statut: 'en_attente', date: '13/04/2026', type: 'Affectation',     nom: 'Azure – Filiale Sud',   soumis: 'M. Leblanc' },
  { id: 9, statut: 'valide',     date: '12/04/2026', type: 'Nouveau logiciel',nom: 'Oracle Java SE 21',     soumis: 'J. Petit'   },
  { id:10, statut: 'refuse',     date: '12/04/2026', type: 'Affectation',     nom: 'SAP ERP – L. Moreau',   soumis: 'S. Martin'  },
];

// ─── FILTRES SOCIÉTÉ ──────────────────────────────────────────────────────────
export const societes = ['Toutes', 'Siège', 'Filiale Nord', 'Filiale Sud'];
