// reportEngine - Moteur de calcul pur pour le module Rapports - SamSecure v0.5
// Fonctions pures sans state ni import React. Sert les 12 rapports preconfigures et le builder.
// TODO API: POST /api/rapports/executer - remplacer le moteur local par l'appel serveur

import { mockLicences, mockAffectations, mockMaintenanceHistorique } from '../data/mockDeploiement';
import { mockContrats, mockCommandes, mockDocuments } from '../data/mockContrats';
import { mockBudget, FACTEUR_INFLATION_DEFAUT } from '../data/mockBudget';
import { mockEditeurs, mockProduits, mockSocietes } from '../data/mockReferentiels';

// --- LOOKUPS PRE-CALCULES -------------------------------------------------------
const editeurById  = Object.fromEntries(mockEditeurs.map(e => [e.id, e]));
const produitById  = Object.fromEntries(mockProduits.map(p => [p.id, p]));
const societeById  = Object.fromEntries(mockSocietes.map(s => [s.id, s]));
const contratById  = Object.fromEntries(mockContrats.map(c => [c.id, c]));
const commandeById = Object.fromEntries(mockCommandes.map(k => [k.id, k]));
const licenceById  = Object.fromEntries(mockLicences.map(l => [l.id, l]));

// --- HELPERS -------------------------------------------------------------------

/** Resout une cle a point (ex: 'produit.label') sur un objet enrichi */
export function resoudreChamp(row, key) {
  if (!key || row == null) return undefined;
  const parts = key.split('.');
  let val = row;
  for (const part of parts) {
    if (val == null) return undefined;
    val = val[part];
  }
  return val;
}

/** Verifie si une date ISO string est dans une periode { dateDebut, dateFin } (strings ISO) */
export function estDansPeriode(dateStr, periode) {
  if (!dateStr || !periode?.dateDebut || !periode?.dateFin) return false;
  const d = new Date(dateStr);
  return d >= new Date(periode.dateDebut) && d <= new Date(periode.dateFin);
}

function chevauchePeriode(dateDebut, dateFin, periode) {
  if (!periode?.dateDebut) return true;
  const d1 = new Date(dateDebut ?? '1970-01-01');
  const d2 = new Date(dateFin ?? '9999-12-31');
  return d1 <= new Date(periode.dateFin) && d2 >= new Date(periode.dateDebut);
}

function fmtDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

// Nb de mois entre deux dates ISO (minimum 1)
function nbMoisChevauchement(debut, fin, periodeDebut, periodeFin) {
  const d1 = new Date(Math.max(new Date(debut ?? '1970-01-01'), new Date(periodeDebut)));
  const d2 = new Date(Math.min(new Date(fin ?? '9999-12-31'), new Date(periodeFin)));
  if (d2 < d1) return 0;
  const mois = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1;
  return Math.max(mois, 1);
}

// Duree en mois d'un intervalle (pour proratisation)
function dureeMoisTotal(debut, fin) {
  const d1 = new Date(debut ?? '1970-01-01');
  const d2 = new Date(fin ?? d1);
  const mois = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1;
  return Math.max(mois, 1);
}

// --- FONCTIONS GENERIQUES (pour le Builder) ------------------------------------

/** Filtre les lignes dont le champ date est dans la periode */
export function appliquerPeriode(rows, champDate, periode) {
  if (!periode?.dateDebut || !periode?.dateFin) return rows;
  return rows.filter(row => estDansPeriode(resoudreChamp(row, champDate), periode));
}

/** Applique une liste de conditions (ET ou OU) */
export function appliquerFiltres(rows, conditions, logique = 'ET') {
  if (!conditions?.length) return rows;
  return rows.filter(row => {
    const resultats = conditions.map(c => evaluerCondition(row, c));
    return logique === 'ET' ? resultats.every(Boolean) : resultats.some(Boolean);
  });
}

function evaluerCondition(row, { champ, operateur, valeur }) {
  const val = resoudreChamp(row, champ);
  switch (operateur) {
    case 'est':               return String(val ?? '') === String(valeur ?? '');
    case 'nest_pas':          return String(val ?? '') !== String(valeur ?? '');
    case 'contient':          return String(val ?? '').toLowerCase().includes(String(valeur ?? '').toLowerCase());
    case 'ne_contient_pas':   return !String(val ?? '').toLowerCase().includes(String(valeur ?? '').toLowerCase());
    case 'commence_par':      return String(val ?? '').toLowerCase().startsWith(String(valeur ?? '').toLowerCase());
    case 'est_vide':          return val == null || val === '';
    case 'nest_pas_vide':     return val != null && val !== '';
    case 'egal':              return Number(val) === Number(valeur);
    case 'different':         return Number(val) !== Number(valeur);
    case 'superieur':         return Number(val) > Number(valeur);
    case 'superieur_ou_egal': return Number(val) >= Number(valeur);
    case 'inferieur':         return Number(val) < Number(valeur);
    case 'inferieur_ou_egal': return Number(val) <= Number(valeur);
    case 'entre':             return Number(val) >= Number(valeur?.[0]) && Number(val) <= Number(valeur?.[1]);
    case 'avant':             return val && new Date(val) < new Date(valeur);
    case 'apres':             return val && new Date(val) > new Date(valeur);
    case 'est_parmi':         return Array.isArray(valeur) && valeur.includes(val);
    case 'est_vrai':          return Boolean(val) === true;
    case 'est_faux':          return Boolean(val) === false;
    default:                  return true;
  }
}

/** Regroupe par champ, avec granularite optionnelle pour les dates */
export function regrouper(rows, champ, granularite = null) {
  const groupes = new Map();
  rows.forEach(row => {
    let cle = resoudreChamp(row, champ);
    if (granularite && cle) cle = formaterGranularite(String(cle), granularite);
    const cleStr = cle ?? '(Non defini)';
    if (!groupes.has(cleStr)) groupes.set(cleStr, { cle: cleStr, lignes: [] });
    groupes.get(cleStr).lignes.push(row);
  });
  return Array.from(groupes.values());
}

function formaterGranularite(dateStr, granularite) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  switch (granularite) {
    case 'mois':     return dateStr.slice(0, 7);
    case 'trimestre': { const q = Math.floor(d.getMonth() / 3) + 1; return `${d.getFullYear()}-T${q}`; }
    case 'annee':    return String(d.getFullYear());
    case 'jour':     return dateStr.slice(0, 10);
    default:         return dateStr.slice(0, 10);
  }
}

/** Calcule les agregats par groupe */
export function agreger(groupes, aggregations) {
  return groupes.map(groupe => {
    const totaux = {};
    aggregations.forEach(agg => {
      const vals = groupe.lignes.map(l => Number(resoudreChamp(l, agg.champ) ?? 0)).filter(v => !isNaN(v));
      const cleAgg = `${agg.champ}_agg`;
      switch (agg.fonction) {
        case 'somme':  totaux[cleAgg] = vals.reduce((a, b) => a + b, 0); break;
        case 'moyenne': totaux[cleAgg] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0; break;
        case 'min':    totaux[cleAgg] = vals.length ? Math.min(...vals) : 0; break;
        case 'max':    totaux[cleAgg] = vals.length ? Math.max(...vals) : 0; break;
        case 'nombre': totaux[cleAgg] = groupe.lignes.length; break;
      }
    });
    return { ...groupe, totaux };
  });
}

/** Tri multi-niveaux (max 3 criteres) */
export function trier(rows, criteres) {
  if (!criteres?.length) return [...rows];
  return [...rows].sort((a, b) => {
    for (const { champ, direction } of criteres) {
      const va = resoudreChamp(a, champ);
      const vb = resoudreChamp(b, champ);
      let cmp = 0;
      if (typeof va === 'string' && typeof vb === 'string') {
        cmp = va.localeCompare(vb, 'fr', { sensitivity: 'base' });
      } else {
        cmp = (va ?? 0) < (vb ?? 0) ? -1 : (va ?? 0) > (vb ?? 0) ? 1 : 0;
      }
      if (cmp !== 0) return direction === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

/** Point d'entree du builder : execute une config complete */
export function executerRapport(config) {
  const { domaine, periode, filtres, logiqueFiltres, colonnes: _c, groupement, granularite, aggregations, tri, lignesMax } = config;
  let rows = obtenirSourceDomaine(domaine, periode);
  if (filtres?.length) rows = appliquerFiltres(rows, filtres, logiqueFiltres ?? 'ET');
  let groupes = null;
  if (groupement) {
    groupes = regrouper(rows, groupement, granularite ?? null);
    if (aggregations?.length) groupes = agreger(groupes, aggregations);
  } else if (tri?.length) {
    rows = trier(rows, tri);
  }
  const nbLignesTotal = rows.length;
  const max = lignesMax && lignesMax !== 'toutes' ? Number(lignesMax) : null;
  const lignesLimitees = max ? rows.slice(0, max) : rows;
  return { lignes: lignesLimitees, groupes, nbLignesTotal };
}

// --- ENRICHISSEMENT DES SOURCES (pour le Builder) ------------------------------

function obtenirSourceDomaine(domaine, periode) {
  switch (domaine) {
    case 'licences':        return enrichirLicences(periode);
    case 'affectations':    return enrichirAffectations();
    case 'contrats':        return enrichirContrats(periode);
    case 'commandes':       return enrichirCommandes(periode);
    case 'factures_preuves': return enrichirDocuments(periode);
    case 'maintenance':     return enrichirMaintenance(periode);
    case 'budget':          return enrichirBudget(periode);
    case 'conformite':      return conformiteGlobale(null, periode, {}).lignes;
    default:                return [];
  }
}

function enrichirLicences(periode) {
  return mockLicences.map(l => {
    const contrat = contratById[l.id_contrat] ?? {};
    const produit = produitById[l.id_produit] ?? {};
    const editeur = editeurById[produit.id_editeur] ?? {};
    const societe = societeById[l.id_societe] ?? {};
    return { ...l, contrat, produit, editeur, societe,
      'contrat.label': contrat.label, 'contrat.date_debut': contrat.date_debut, 'contrat.date_fin': contrat.date_fin,
      'produit.label': produit.label, 'editeur.raison_sociale': editeur.raison_sociale, 'societe.raison_sociale': societe.raison_sociale };
  }).filter(l => !periode?.dateDebut || chevauchePeriode(l['contrat.date_debut'], l['contrat.date_fin'], periode));
}

function enrichirAffectations() {
  return mockAffectations.map(a => {
    const produit = produitById[a.id_produit] ?? {};
    const editeur = editeurById[produit.id_editeur] ?? {};
    const societe = societeById[a.id_societe] ?? {};
    return { ...a, produit, editeur, societe,
      'produit.label': produit.label, 'editeur.raison_sociale': editeur.raison_sociale, 'societe.raison_sociale': societe.raison_sociale };
  });
}

function enrichirContrats(periode) {
  return mockContrats.map(c => {
    const editeur = editeurById[c.id_editeur] ?? {};
    const societe = societeById[c.id_societe] ?? {};
    return { ...c, editeur, societe, 'editeur.raison_sociale': editeur.raison_sociale, 'societe.raison_sociale': societe.raison_sociale };
  }).filter(c => !periode?.dateDebut || chevauchePeriode(c.date_debut, c.date_fin, periode));
}

function enrichirCommandes(periode) {
  return mockCommandes.map(k => {
    const contrat = contratById[k.id_contrat] ?? {};
    const editeur = editeurById[contrat.id_editeur] ?? {};
    const societe = societeById[k.id_societe] ?? {};
    return { ...k, contrat, editeur, societe,
      'contrat.label': contrat.label, 'editeur.raison_sociale': editeur.raison_sociale, 'societe.raison_sociale': societe.raison_sociale };
  }).filter(k => !periode?.dateDebut || estDansPeriode(k.date ?? k.date_fin, periode));
}

function enrichirDocuments(periode) {
  return mockDocuments.map(d => {
    const commande = commandeById[d.id_commande] ?? {};
    const contrat = contratById[d.id_contrat ?? commande.id_contrat] ?? {};
    const editeur = editeurById[contrat.id_editeur] ?? {};
    return { ...d, commande, contrat, editeur,
      'commande.label': commande.label, 'contrat.label': contrat.label, 'editeur.raison_sociale': editeur.raison_sociale };
  }).filter(d => !periode?.dateDebut || estDansPeriode(d.date, periode));
}

function enrichirMaintenance(periode) {
  return mockMaintenanceHistorique.map(m => {
    const licence = licenceById[m.id_licence] ?? {};
    const produit = produitById[licence.id_produit] ?? {};
    const editeur = editeurById[produit.id_editeur] ?? {};
    return { ...m, licence, produit, editeur,
      'produit.label': produit.label, 'editeur.raison_sociale': editeur.raison_sociale };
  }).filter(m => !periode?.dateDebut || chevauchePeriode(m.date_debut, m.date_fin, periode));
}

function enrichirBudget(periode) {
  return mockBudget.map(b => {
    const licence = licenceById[b.id_licence] ?? {};
    const contrat = contratById[licence.id_contrat] ?? {};
    const produit = produitById[licence.id_produit] ?? {};
    const editeur = editeurById[produit.id_editeur] ?? {};
    return { ...b, licence, contrat, produit, editeur,
      'produit.label': produit.label, 'editeur.raison_sociale': editeur.raison_sociale, 'contrat.label': contrat.label };
  }).filter(b => !periode?.dateDebut || chevauchePeriode(b.date_debut, b.date_fin, periode));
}

// --- FONCTIONS DE CALCUL DES 12 RAPPORTS -------------------------------------

// Droits par produit (pour la periode donnee)
function calculerDroitsParProduit(periode) {
  const droits = {};
  mockLicences.forEach(l => {
    const contrat = contratById[l.id_contrat] ?? {};
    if (periode?.dateDebut && !chevauchePeriode(contrat.date_debut, contrat.date_fin, periode)) return;
    droits[l.id_produit] = (droits[l.id_produit] ?? 0) + l.quantite;
  });
  return droits;
}

// Usages valides par produit (snapshot, pas de filtre date)
function calculerUsagesParProduit() {
  const usages = {};
  mockAffectations.forEach(a => {
    if (a.statut_validation !== 'valide') return;
    usages[a.id_produit] = (usages[a.id_produit] ?? 0) + a.quantite;
  });
  return usages;
}

// Statut de conformite
function statutConformite(ecart, ecartPct) {
  if (ecart >= 0) return 'conforme';
  if (ecartPct > -10) return 'attention';
  return 'non_conforme';
}

export function conformiteGlobale(_sources, periode, _params) {
  const droitsMap = calculerDroitsParProduit(periode);
  const usagesMap = calculerUsagesParProduit();
  const produitIds = new Set([...Object.keys(droitsMap), ...Object.keys(usagesMap)]);

  const lignes = Array.from(produitIds).map(idProduit => {
    const produit = produitById[idProduit] ?? { label: idProduit };
    const editeur = editeurById[produit.id_editeur] ?? { raison_sociale: '-' };
    const droits = droitsMap[idProduit] ?? 0;
    const usages = usagesMap[idProduit] ?? 0;
    const ecart = droits - usages;
    const ecartPct = droits > 0 ? (ecart / droits) * 100 : (usages > 0 ? -100 : 0);
    return { id: idProduit, produit: produit.label, editeur: editeur.raison_sociale, droits, usages, ecart, ecart_pct: ecartPct, statut: statutConformite(ecart, ecartPct) };
  }).sort((a, b) => a.produit.localeCompare(b.produit, 'fr'));

  return {
    kpis: {
      conformes:    lignes.filter(l => l.statut === 'conforme').length,
      attention:    lignes.filter(l => l.statut === 'attention').length,
      non_conformes: lignes.filter(l => l.statut === 'non_conforme').length,
      ecart_total:  lignes.reduce((s, l) => s + Math.min(l.ecart, 0), 0),
    },
    lignes,
  };
}

export function conformiteParEditeur(_sources, periode, _params) {
  const baseResult = conformiteGlobale(null, periode, {});
  const parEditeur = {};
  baseResult.lignes.forEach(l => {
    if (!parEditeur[l.editeur]) parEditeur[l.editeur] = { editeur: l.editeur, nb_produits: 0, droits_totaux: 0, usages_totaux: 0 };
    const g = parEditeur[l.editeur];
    g.nb_produits++;
    g.droits_totaux += l.droits;
    g.usages_totaux += l.usages;
  });

  const lignes = Object.values(parEditeur).map(g => {
    const ecart = g.droits_totaux - g.usages_totaux;
    const ecartPct = g.droits_totaux > 0 ? (ecart / g.droits_totaux) * 100 : 0;
    return { ...g, ecart, ecart_pct: ecartPct, statut: statutConformite(ecart, ecartPct) };
  }).sort((a, b) => a.ecart - b.ecart);

  return {
    kpis: {
      nb_editeurs:          lignes.length,
      editeurs_depassement: lignes.filter(l => l.statut === 'non_conforme').length,
      ecart_cumule:         lignes.reduce((s, l) => s + Math.min(l.ecart, 0), 0),
    },
    lignes,
    donneesGraphique: {
      type: 'bar_horizontal',
      data: lignes.map(l => ({ name: l.editeur, ecart: l.ecart, fill: l.ecart >= 0 ? '#22c55e' : '#ef4444' })),
      xKey: 'ecart', nameKey: 'name',
    },
  };
}

export function usagesSansDroits(_sources, periode, _params) {
  const droitsMap = calculerDroitsParProduit(periode);
  const lignes = [];

  mockAffectations.forEach(a => {
    if (a.statut_validation !== 'valide') return;
    const droits = droitsMap[a.id_produit] ?? 0;
    const usagesAutres = mockAffectations.filter(x => x.id_produit === a.id_produit && x.statut_validation === 'valide' && x.id !== a.id).reduce((s, x) => s + x.quantite, 0);
    const droitsRestants = droits - usagesAutres;
    const manque = Math.max(a.quantite - droitsRestants, 0);
    if (manque > 0) {
      const produit = produitById[a.id_produit] ?? {};
      const editeur = editeurById[produit.id_editeur] ?? {};
      const societe = societeById[a.id_societe] ?? {};
      lignes.push({ reference_client: a.reference_client, produit: produit.label, editeur: editeur.raison_sociale, societe: societe.raison_sociale, quantite_affectee: a.quantite, droits_disponibles: Math.max(droitsRestants, 0), manque });
    }
  });

  return {
    kpis: {
      nb_usages_non_couverts: lignes.length,
      quantite_manquante: lignes.reduce((s, l) => s + l.manque, 0),
      nb_produits: new Set(lignes.map(l => l.produit)).size,
    },
    lignes,
  };
}

export function etatRevalidations(_sources, periode, _params) {
  const now = new Date();
  const lignes = [];

  mockAffectations.filter(a => a.statut_validation === 'valide' && a.date_derniere_revalidation).forEach(a => {
    if (periode?.dateDebut && !estDansPeriode(a.date_derniere_revalidation, periode)) return;
    const societe = societeById[a.id_societe] ?? {};
    const delai = societe.delai_revalidation ?? 30;
    const derniereVal = new Date(a.date_derniere_revalidation);
    const prochaine = new Date(derniereVal);
    prochaine.setDate(prochaine.getDate() + delai);
    const joursRestants = Math.round((prochaine - now) / 86400000);
    let statut;
    if (joursRestants > 30) statut = 'a_jour';
    else if (joursRestants >= 0) statut = 'a_revalider';
    else statut = 'depassee';
    const produit = produitById[a.id_produit] ?? {};
    lignes.push({ reference_client: a.reference_client, produit: produit.label, societe: societe.raison_sociale, derniere_validation: a.date_derniere_revalidation, prochaine_echeance: prochaine.toISOString().slice(0, 10), statut });
  });

  return {
    kpis: {
      a_jour:    lignes.filter(l => l.statut === 'a_jour').length,
      a_revalider: lignes.filter(l => l.statut === 'a_revalider').length,
      depassees: lignes.filter(l => l.statut === 'depassee').length,
    },
    lignes,
  };
}

export function preuvesManquantes(_sources, periode, _params) {
  // Contrats actifs dans la periode sans preuve liee
  const contratsActifs = mockContrats.filter(c => !periode?.dateDebut || chevauchePeriode(c.date_debut, c.date_fin, periode));
  const lignesContrats = contratsActifs.filter(c => {
    const docsDirects = mockDocuments.filter(d => d.id_contrat === c.id && d.type === 'preuve');
    const docsViaCmd = mockCommandes.filter(k => k.id_contrat === c.id).flatMap(k => mockDocuments.filter(d => d.id_commande === k.id && d.type === 'preuve'));
    return docsDirects.length === 0 && docsViaCmd.length === 0;
  }).map(c => {
    const editeur = editeurById[c.id_editeur] ?? {};
    return { contrat: c.label, editeur: editeur.raison_sociale, date_debut: c.date_debut, date_fin: c.date_fin };
  });

  // Commandes sans facture dans la periode
  const commandesPeriode = mockCommandes.filter(k => !periode?.dateDebut || estDansPeriode(k.date, periode));
  const lignesCommandes = commandesPeriode.filter(k => {
    return !mockDocuments.some(d => d.id_commande === k.id && d.type === 'facture');
  }).map(k => {
    const contrat = contratById[k.id_contrat] ?? {};
    return { commande: k.label, contrat: contrat.label, montant: k.montant, date: k.date };
  });

  return {
    kpis: { contrats_sans_preuve: lignesContrats.length, commandes_sans_facture: lignesCommandes.length },
    sections: [
      { titre: 'Contrats sans preuve', lignes: lignesContrats },
      { titre: 'Commandes sans facture', lignes: lignesCommandes },
    ],
  };
}

export function dossierAuditEditeur(_sources, periode, params) {
  const idEditeur = params?.id_editeur;
  const editeur = editeurById[idEditeur] ?? {};

  // Section 1 : conformite produits de l'editeur
  const produitsDeLEditeur = mockProduits.filter(p => p.id_editeur === idEditeur).map(p => p.id);
  const droitsMap = calculerDroitsParProduit(periode);
  const usagesMap = calculerUsagesParProduit();
  const lignesConformite = produitsDeLEditeur.map(idProduit => {
    const produit = produitById[idProduit] ?? {};
    const droits = droitsMap[idProduit] ?? 0;
    const usages = usagesMap[idProduit] ?? 0;
    const ecart = droits - usages;
    const ecartPct = droits > 0 ? (ecart / droits) * 100 : 0;
    return { produit: produit.label, droits, usages, ecart, ecart_pct: ecartPct, statut: statutConformite(ecart, ecartPct) };
  }).filter(l => l.droits > 0 || l.usages > 0);

  // Section 2 : contrats et preuves
  const contratsEditeur = mockContrats.filter(c => c.id_editeur === idEditeur && (!periode?.dateDebut || chevauchePeriode(c.date_debut, c.date_fin, periode)));
  const lignesContrats = contratsEditeur.map(c => {
    const preuves = mockDocuments.filter(d => d.id_contrat === c.id && d.type === 'preuve');
    const preuvesViaCmd = mockCommandes.filter(k => k.id_contrat === c.id).flatMap(k => mockDocuments.filter(d => d.id_commande === k.id && d.type === 'preuve'));
    return { contrat: c.label, type: c.type, date_debut: c.date_debut, date_fin: c.date_fin, nb_preuves: preuves.length + preuvesViaCmd.length };
  });

  // Section 3 : licences
  const lignesLicences = mockLicences.filter(l => {
    const produit = produitById[l.id_produit] ?? {};
    return produit.id_editeur === idEditeur;
  }).map(l => {
    const produit = produitById[l.id_produit] ?? {};
    return { produit: produit.label, type: l.type, quantite: l.quantite, cout: l.cout };
  });

  return {
    kpis: {
      droits_totaux: lignesConformite.reduce((s, l) => s + l.droits, 0),
      usages_totaux: lignesConformite.reduce((s, l) => s + l.usages, 0),
      ecart:         lignesConformite.reduce((s, l) => s + l.ecart, 0),
      nb_contrats:   contratsEditeur.length,
      nb_preuves:    lignesContrats.reduce((s, l) => s + l.nb_preuves, 0),
    },
    sections: [
      { titre: `Conformite par produit - ${editeur.raison_sociale ?? idEditeur}`, lignes: lignesConformite },
      { titre: 'Contrats et preuves', lignes: lignesContrats },
      { titre: 'Licences', lignes: lignesLicences },
    ],
  };
}

export function licencesDormantes(_sources, periode, _params) {
  const droitsMap = calculerDroitsParProduit(periode);
  const usagesMap = calculerUsagesParProduit();
  const lignes = [];

  // Calculer le cout par produit (somme des licences actives)
  const coutMap = {};
  mockLicences.forEach(l => {
    const contrat = contratById[l.id_contrat] ?? {};
    if (periode?.dateDebut && !chevauchePeriode(contrat.date_debut, contrat.date_fin, periode)) return;
    coutMap[l.id_produit] = (coutMap[l.id_produit] ?? 0) + l.cout;
  });

  Object.keys(droitsMap).forEach(idProduit => {
    const droits = droitsMap[idProduit] ?? 0;
    const usages = usagesMap[idProduit] ?? 0;
    const taux = droits > 0 ? usages / droits : 0;
    if (taux >= 0.5) return;
    const produit = produitById[idProduit] ?? {};
    const editeur = editeurById[produit.id_editeur] ?? {};
    const cout = coutMap[idProduit] ?? 0;
    const eco = cout * (1 - taux);
    lignes.push({ produit: produit.label, editeur: editeur.raison_sociale, droits, usages, taux_utilisation: taux, cout, economie_potentielle: eco });
  });

  lignes.sort((a, b) => a.taux_utilisation - b.taux_utilisation);
  return {
    kpis: { nb_dormantes: lignes.length, economie_potentielle: lignes.reduce((s, l) => s + l.economie_potentielle, 0) },
    lignes,
  };
}

export function maintenanceInutile(_sources, periode, _params) {
  const usagesMap = calculerUsagesParProduit();
  const lignes = [];

  mockMaintenanceHistorique.forEach(m => {
    if (!chevauchePeriode(m.date_debut, m.date_fin, periode)) return;
    const licence = licenceById[m.id_licence] ?? {};
    const produit = produitById[licence.id_produit] ?? {};
    const editeur = editeurById[produit.id_editeur] ?? {};
    const usages = usagesMap[licence.id_produit] ?? 0;
    if (usages > 0) return; // On garde uniquement les licences a 0 usage
    lignes.push({ produit: produit.label, editeur: editeur.raison_sociale, prestataire: m.prestataire, date_debut: m.date_debut, date_fin: m.date_fin, cout: m.cout, usages });
  });

  return {
    kpis: { cout_total_inutile: lignes.reduce((s, l) => s + l.cout, 0), nb_licences: lignes.length },
    lignes,
  };
}

export function economiesParEditeur(_sources, periode, params) {
  const dormant = licencesDormantes(null, periode, params);
  const maint = maintenanceInutile(null, periode, params);
  const parEditeur = {};

  dormant.lignes.forEach(l => {
    if (!parEditeur[l.editeur]) parEditeur[l.editeur] = { editeur: l.editeur, eco_licences: 0, eco_maintenance: 0 };
    parEditeur[l.editeur].eco_licences += l.economie_potentielle;
  });
  maint.lignes.forEach(l => {
    if (!parEditeur[l.editeur]) parEditeur[l.editeur] = { editeur: l.editeur, eco_licences: 0, eco_maintenance: 0 };
    parEditeur[l.editeur].eco_maintenance += l.cout;
  });

  const lignes = Object.values(parEditeur).map(g => ({ ...g, total: g.eco_licences + g.eco_maintenance })).sort((a, b) => b.total - a.total);
  const ecoTotale = lignes.reduce((s, l) => s + l.total, 0);
  const topEditeur = lignes[0]?.editeur ?? '-';

  return {
    kpis: { economie_totale: ecoTotale, top_editeur: topEditeur },
    lignes,
    donneesGraphique: {
      type: 'pie',
      data: lignes.filter(l => l.total > 0).map(l => ({ name: l.editeur, value: l.total })),
      nameKey: 'name', valueKey: 'value',
    },
  };
}

export function renouvellements(_sources, periode, _params) {
  const droitsMap = calculerDroitsParProduit(null);
  const usagesMap = calculerUsagesParProduit();
  const lignes = [];

  // Contrats avec date_fin dans la periode
  mockContrats.forEach(c => {
    if (!c.date_fin || !estDansPeriode(c.date_fin, periode)) return;
    const editeur = editeurById[c.id_editeur] ?? {};
    // Taux d'utilisation : moyenne des licences de ce contrat
    const licencesContrat = mockLicences.filter(l => l.id_contrat === c.id);
    const droitsContrat = licencesContrat.reduce((s, l) => s + l.quantite, 0);
    const usagesContrat = licencesContrat.reduce((s, l) => s + (usagesMap[l.id_produit] ?? 0), 0);
    const taux = droitsContrat > 0 ? Math.min(usagesContrat / droitsContrat, 1) : 0;
    const montant = mockCommandes.filter(k => k.id_contrat === c.id).reduce((s, k) => s + k.montant, 0);
    const montantProj = montant * (1 + FACTEUR_INFLATION_DEFAUT);
    const recommandation = taux >= 0.8 ? 'Renouveler' : taux >= 0.4 ? 'Renegocier' : 'Abandonner';
    lignes.push({ contrat: c.label, editeur: editeur.raison_sociale, echeance: c.date_fin, montant_actuel: montant, montant_projete: montantProj, taux_utilisation: taux, recommandation });
  });

  lignes.sort((a, b) => new Date(a.echeance) - new Date(b.echeance));
  return {
    kpis: {
      nb_echeances:    lignes.length,
      montant_actuel:  lignes.reduce((s, l) => s + l.montant_actuel, 0),
      montant_projete: lignes.reduce((s, l) => s + l.montant_projete, 0),
    },
    lignes,
  };
}

export function doublonsChevauche(_sources, periode, _params) {
  // Heuristique v0.5 : produits partageant le meme parent (id_produit_parent) avec licences actives
  // Si aucun doublon par parent trouve, signale-le dans la note.
  const droitsMap = calculerDroitsParProduit(periode);
  const produitsAvecLicences = Object.keys(droitsMap);
  const parParent = {};

  produitsAvecLicences.forEach(idProduit => {
    const produit = produitById[idProduit];
    if (!produit?.id_produit_parent) return;
    const parent = produit.id_produit_parent;
    if (!parParent[parent]) parParent[parent] = [];
    parParent[parent].push(idProduit);
  });

  const doublons = Object.entries(parParent).filter(([, enfants]) => enfants.length > 1);
  const usagesMap = calculerUsagesParProduit();
  const lignes = doublons.map(([idParent, enfants]) => {
    const parentProduit = produitById[idParent] ?? {};
    const enfantLabels = enfants.map(id => produitById[id]?.label ?? id).join(', ');
    const droitsCumules = enfants.reduce((s, id) => s + (droitsMap[id] ?? 0), 0);
    const usagesCumules = enfants.reduce((s, id) => s + (usagesMap[id] ?? 0), 0);
    return { groupe: parentProduit.label ?? idParent, produits: enfantLabels, droits_cumules: droitsCumules, usages_cumules: usagesCumules, recommandation: 'Consolider les licences sur un seul produit' };
  });

  return {
    kpis: { nb_groupes: lignes.length, droits_redondants: lignes.reduce((s, l) => s + l.droits_cumules, 0) },
    lignes,
    // Note si aucun doublon detecte par hierarchie produit (les licences sont sur les produits parents)
    note: lignes.length === 0 ? 'Aucun doublon detecte par hierarchie produit sur la periode selectionnee. Les licences sont associees aux produits parents, pas aux sous-produits.' : null,
  };
}

// Helper non-recursif : calcule les lignes mensuelles TCO pour une periode
function _lignesMensuellesTCO(periode) {
  if (!periode?.dateDebut) return [];
  const parMoisCommandes = {};
  mockCommandes.forEach(k => {
    if (!k.date || !estDansPeriode(k.date, periode)) return;
    const mois = k.date.slice(0, 7);
    parMoisCommandes[mois] = (parMoisCommandes[mois] ?? 0) + k.montant;
  });
  const parMoisMaintenance = {};
  mockMaintenanceHistorique.forEach(m => {
    if (!chevauchePeriode(m.date_debut, m.date_fin, periode)) return;
    const dureeTotal = dureeMoisTotal(m.date_debut, m.date_fin);
    const coutMensuel = m.cout / dureeTotal;
    const d1 = new Date(Math.max(new Date(m.date_debut), new Date(periode.dateDebut)));
    const d2 = new Date(Math.min(new Date(m.date_fin ?? '9999-12-31'), new Date(periode.dateFin)));
    let cur = new Date(d1.getFullYear(), d1.getMonth(), 1);
    while (cur <= d2) {
      const mois = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`;
      parMoisMaintenance[mois] = (parMoisMaintenance[mois] ?? 0) + coutMensuel;
      cur.setMonth(cur.getMonth() + 1);
    }
  });
  const moisSet = new Set([...Object.keys(parMoisCommandes), ...Object.keys(parMoisMaintenance)]);
  return Array.from(moisSet).sort().map(mois => {
    const commandes = Math.round(parMoisCommandes[mois] ?? 0);
    const maintenance = Math.round(parMoisMaintenance[mois] ?? 0);
    return { periode: mois, commandes, maintenance, total: commandes + maintenance };
  });
}

export function evolutionCoutsTCO(_sources, periode, _params) {
  if (!periode?.dateDebut) return { kpis: { cout_total: 0, variation_pct: null }, lignes: [] };

  const lignes = _lignesMensuellesTCO(periode);
  const coutTotal = lignes.reduce((s, l) => s + l.total, 0);

  // Variation vs periode precedente (meme duree, juste avant) - sans recursion
  const debut = new Date(periode.dateDebut);
  const fin = new Date(periode.dateFin);
  const dureeMs = fin - debut;
  const periodePrec = {
    dateDebut: new Date(debut.getTime() - dureeMs - 86400000).toISOString().slice(0, 10),
    dateFin: new Date(debut.getTime() - 86400000).toISOString().slice(0, 10),
  };
  const lignesPrec = _lignesMensuellesTCO(periodePrec);
  const coutPrec = lignesPrec.reduce((s, l) => s + l.total, 0);
  const variationPct = coutPrec > 0 ? ((coutTotal - coutPrec) / coutPrec) * 100 : null;

  return {
    kpis: { cout_total: coutTotal, variation_pct: variationPct },
    lignes,
    donneesGraphique: {
      type: 'line',
      data: lignes,
      nameKey: 'periode',
      lines: [
        { key: 'commandes',   label: 'Commandes',   color: '#3b82f6' },
        { key: 'maintenance', label: 'Maintenance',  color: '#f59e0b' },
        { key: 'total',       label: 'Total',        color: '#8b5cf6' },
      ],
    },
  };
}

// --- DISPATCH ---------------------------------------------------------------

const COMPUTE_FNS = {
  conformiteGlobale, conformiteParEditeur, usagesSansDroits, etatRevalidations,
  preuvesManquantes, dossierAuditEditeur, licencesDormantes, maintenanceInutile,
  economiesParEditeur, renouvellements, doublonsChevauche, evolutionCoutsTCO,
};

/** Execute un rapport preconfigue depuis son computeKey */
export function executerRapportPreconfiguree(computeKey, periode, params = {}) {
  const fn = COMPUTE_FNS[computeKey];
  if (!fn) return { kpis: {}, lignes: [], erreur: `Calcul inconnu : ${computeKey}` };
  return fn(null, periode, params);
}
