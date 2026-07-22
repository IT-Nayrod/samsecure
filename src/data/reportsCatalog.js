// reportsCatalog - Catalogue des 12 rapports preconfigures - SamSecure v0.5
// Structure pilotant ReportViewPage : colonnes, KPIs, icones, extraParams, cle de calcul.
import {
  ShieldCheck, Users2, AlertOctagon, RefreshCw, FolderOpen, Building2,
  Moon, Wrench, BarChart2, CalendarClock, Copy, TrendingUp,
} from 'lucide-react';

// Map icone string -> composant Lucide (utilise par ReportCard)
export const REPORT_ICONS = {
  ShieldCheck, Users2, AlertOctagon, RefreshCw, FolderOpen, Building2,
  Moon, Wrench, BarChart2, CalendarClock, Copy, TrendingUp,
};

/**
 * Format des colonnes :
 *   { key, label, sortable?, format?, csvLabel? }
 * Formats : 'nombre' | 'montant' | 'pourcentage' | 'date' | 'badge_conformite' |
 *           'badge_revalidation' | 'badge_recommandation' | 'taux_usage'
 *
 * Format des kpis :
 *   { key, label, format, couleur? }
 * Couleurs : 'vert' | 'orange' | 'rouge' | null
 *
 * Rapports multi-sections (R-C05, R-C06) :
 *   sections: [{ titre, colonnes }] au lieu de colonnes directes
 */
export const reportsCatalog = [
  // ============================================================
  // CONFORMITE
  // ============================================================
  {
    id: 'r-c01',
    categorie: 'conformite',
    titre: 'État de conformité global',
    description: 'Balance droits acquis vs usages déclarés pour chaque produit du parc.',
    icone: 'ShieldCheck',
    extraParams: [],
    kpis: [
      { key: 'conformes',    label: 'Produits conformes',   format: 'nombre', couleur: 'vert' },
      { key: 'attention',    label: 'En attention',          format: 'nombre', couleur: 'orange' },
      { key: 'non_conformes', label: 'Non conformes',        format: 'nombre', couleur: 'rouge' },
      { key: 'ecart_total',  label: 'Écart total (unités)', format: 'nombre_signe', couleur: null },
    ],
    colonnes: [
      { key: 'produit',    label: 'Produit',          sortable: true },
      { key: 'editeur',    label: 'Éditeur',          sortable: true },
      { key: 'droits',     label: 'Droits acquis',    sortable: true, format: 'nombre' },
      { key: 'usages',     label: 'Usages déclarés',  sortable: true, format: 'nombre' },
      { key: 'ecart',      label: 'Écart',            sortable: true, format: 'nombre_signe' },
      { key: 'ecart_pct',  label: 'Écart %',          sortable: true, format: 'pourcentage' },
      { key: 'statut',     label: 'Statut',           format: 'badge_conformite' },
    ],
    computeKey: 'conformiteGlobale',
  },
  {
    id: 'r-c02',
    categorie: 'conformite',
    titre: 'Conformité par éditeur',
    description: 'Vision agrégée des écarts entre droits et usages, éditeur par éditeur.',
    icone: 'Building2',
    extraParams: [],
    kpis: [
      { key: 'nb_editeurs',        label: 'Éditeurs',           format: 'nombre', couleur: null },
      { key: 'editeurs_depassement', label: 'En dépassement',   format: 'nombre', couleur: 'rouge' },
      { key: 'ecart_cumule',       label: 'Écart cumulé',       format: 'nombre_signe', couleur: null },
    ],
    colonnes: [
      { key: 'editeur',       label: 'Éditeur',        sortable: true },
      { key: 'nb_produits',   label: 'Nb produits',    sortable: true, format: 'nombre' },
      { key: 'droits_totaux', label: 'Droits totaux',  sortable: true, format: 'nombre' },
      { key: 'usages_totaux', label: 'Usages totaux',  sortable: true, format: 'nombre' },
      { key: 'ecart',         label: 'Écart',          sortable: true, format: 'nombre_signe' },
      { key: 'statut',        label: 'Statut',         format: 'badge_conformite' },
    ],
    graphique: { type: 'bar_horizontal', xKey: 'ecart', nameKey: 'editeur' },
    computeKey: 'conformiteParEditeur',
  },
  {
    id: 'r-c03',
    categorie: 'conformite',
    titre: 'Usages sans droits',
    description: "Affectations non couvertes par une licence suffisante (risque d'audit).",
    icone: 'AlertOctagon',
    extraParams: [],
    kpis: [
      { key: 'nb_usages_non_couverts', label: 'Usages non couverts',  format: 'nombre', couleur: 'rouge' },
      { key: 'quantite_manquante',     label: 'Quantité manquante',   format: 'nombre', couleur: 'rouge' },
      { key: 'nb_produits',            label: 'Produits concernés',   format: 'nombre', couleur: null },
    ],
    colonnes: [
      { key: 'reference_client',  label: 'Référence client',   sortable: true },
      { key: 'produit',           label: 'Produit',             sortable: true },
      { key: 'editeur',           label: 'Éditeur',             sortable: true },
      { key: 'societe',           label: 'Société',             sortable: true },
      { key: 'quantite_affectee', label: 'Quantité affectée',  sortable: true, format: 'nombre' },
      { key: 'droits_disponibles', label: 'Droits disponibles', sortable: true, format: 'nombre' },
      { key: 'manque',            label: 'Manque',             sortable: true, format: 'nombre' },
    ],
    computeKey: 'usagesSansDroits',
  },
  {
    id: 'r-c04',
    categorie: 'conformite',
    titre: 'État des revalidations',
    description: 'Suivi du cycle de revalidation des affectations par échéance.',
    icone: 'RefreshCw',
    extraParams: [],
    kpis: [
      { key: 'a_jour',     label: 'À jour',      format: 'nombre', couleur: 'vert' },
      { key: 'a_revalider', label: 'À revalider', format: 'nombre', couleur: 'orange' },
      { key: 'depassees',  label: 'Dépassées',   format: 'nombre', couleur: 'rouge' },
    ],
    colonnes: [
      { key: 'reference_client',       label: 'Référence client',    sortable: true },
      { key: 'produit',                label: 'Produit',              sortable: true },
      { key: 'societe',                label: 'Société',              sortable: true },
      { key: 'derniere_validation',    label: 'Dernière validation',  sortable: true, format: 'date' },
      { key: 'prochaine_echeance',     label: 'Prochaine échéance',   sortable: true, format: 'date' },
      { key: 'statut',                 label: 'Statut',               format: 'badge_revalidation' },
    ],
    computeKey: 'etatRevalidations',
  },
  {
    id: 'r-c05',
    categorie: 'conformite',
    titre: 'Preuves et documents manquants',
    description: "Préparation d'audit : exhaustivité documentaire des contrats et commandes.",
    icone: 'FolderOpen',
    extraParams: [],
    kpis: [
      { key: 'contrats_sans_preuve',    label: 'Contrats sans preuve',    format: 'nombre', couleur: 'orange' },
      { key: 'commandes_sans_facture',  label: 'Commandes sans facture',  format: 'nombre', couleur: 'orange' },
    ],
    sections: [
      {
        titre: 'Contrats sans preuve',
        colonnes: [
          { key: 'contrat',      label: 'Contrat',     sortable: true },
          { key: 'editeur',      label: 'Éditeur',     sortable: true },
          { key: 'date_debut',   label: 'Date début',  sortable: true, format: 'date' },
          { key: 'date_fin',     label: 'Date fin',    sortable: true, format: 'date' },
        ],
      },
      {
        titre: 'Commandes sans facture',
        colonnes: [
          { key: 'commande',  label: 'Commande',  sortable: true },
          { key: 'contrat',   label: 'Contrat',   sortable: true },
          { key: 'montant',   label: 'Montant',   sortable: true, format: 'montant' },
          { key: 'date',      label: 'Date',      sortable: true, format: 'date' },
        ],
      },
    ],
    computeKey: 'preuvesManquantes',
  },
  {
    id: 'r-c06',
    categorie: 'conformite',
    titre: "Dossier d'audit éditeur",
    description: "Pack complet pour préparer un audit d'un éditeur donné : conformité, contrats, licences.",
    icone: 'Users2',
    extraParams: [
      { key: 'id_editeur', label: 'Éditeur', type: 'select', source: 'editeurs', required: true },
    ],
    kpis: [
      { key: 'droits_totaux',  label: 'Droits totaux',  format: 'nombre', couleur: null },
      { key: 'usages_totaux',  label: 'Usages totaux',  format: 'nombre', couleur: null },
      { key: 'ecart',          label: 'Écart',          format: 'nombre_signe', couleur: null },
      { key: 'nb_contrats',    label: 'Nb contrats',    format: 'nombre', couleur: null },
      { key: 'nb_preuves',     label: 'Nb preuves',     format: 'nombre', couleur: null },
    ],
    sections: [
      {
        titre: 'Conformité par produit',
        colonnes: [
          { key: 'produit',   label: 'Produit',          sortable: true },
          { key: 'droits',    label: 'Droits acquis',    sortable: true, format: 'nombre' },
          { key: 'usages',    label: 'Usages déclarés',  sortable: true, format: 'nombre' },
          { key: 'ecart',     label: 'Écart',            sortable: true, format: 'nombre_signe' },
          { key: 'statut',    label: 'Statut',           format: 'badge_conformite' },
        ],
      },
      {
        titre: 'Contrats et preuves',
        colonnes: [
          { key: 'contrat',    label: 'Contrat',    sortable: true },
          { key: 'type',       label: 'Type',       sortable: true },
          { key: 'date_debut', label: 'Date début', sortable: true, format: 'date' },
          { key: 'date_fin',   label: 'Date fin',   sortable: true, format: 'date' },
          { key: 'nb_preuves', label: 'Nb preuves', sortable: true, format: 'nombre' },
        ],
      },
      {
        titre: 'Licences',
        colonnes: [
          { key: 'produit',  label: 'Produit',   sortable: true },
          { key: 'type',     label: 'Type',      sortable: true },
          { key: 'quantite', label: 'Quantité',  sortable: true, format: 'nombre' },
          { key: 'cout',     label: 'Coût',      sortable: true, format: 'montant' },
        ],
      },
    ],
    computeKey: 'dossierAuditEditeur',
  },

  // ============================================================
  // OPTIMISATION
  // ============================================================
  {
    id: 'r-o01',
    categorie: 'optimisation',
    titre: 'Licences dormantes',
    description: "Droits acquis non ou sous-utilisés (taux d'utilisation < 50 %).",
    icone: 'Moon',
    extraParams: [],
    kpis: [
      { key: 'nb_dormantes',         label: 'Licences dormantes',     format: 'nombre', couleur: 'orange' },
      { key: 'economie_potentielle', label: 'Économie potentielle',   format: 'montant', couleur: null },
    ],
    colonnes: [
      { key: 'produit',             label: 'Produit',              sortable: true },
      { key: 'editeur',             label: 'Éditeur',              sortable: true },
      { key: 'droits',              label: 'Droits',               sortable: true, format: 'nombre' },
      { key: 'usages',              label: 'Usages',               sortable: true, format: 'nombre' },
      { key: 'taux_utilisation',    label: "Taux d'utilisation",   sortable: true, format: 'taux_usage' },
      { key: 'cout',                label: 'Coût',                 sortable: true, format: 'montant' },
      { key: 'economie_potentielle', label: 'Économie potentielle', sortable: true, format: 'montant' },
    ],
    computeKey: 'licencesDormantes',
  },
  {
    id: 'r-o02',
    categorie: 'optimisation',
    titre: 'Maintenance sur licences non utilisées',
    description: 'Coûts de maintenance payés sur des licences sans aucun usage valide.',
    icone: 'Wrench',
    extraParams: [],
    kpis: [
      { key: 'cout_total_inutile', label: 'Coût de maintenance inutile', format: 'montant', couleur: 'rouge' },
      { key: 'nb_licences',        label: 'Licences concernées',          format: 'nombre', couleur: null },
    ],
    colonnes: [
      { key: 'produit',    label: 'Produit',            sortable: true },
      { key: 'editeur',    label: 'Éditeur',            sortable: true },
      { key: 'prestataire', label: 'Mainteneur',        sortable: true },
      { key: 'date_debut', label: 'Début maintenance',  sortable: true, format: 'date' },
      { key: 'date_fin',   label: 'Fin maintenance',    sortable: true, format: 'date' },
      { key: 'cout',       label: 'Coût',               sortable: true, format: 'montant' },
      { key: 'usages',     label: 'Usages sur période', sortable: true, format: 'nombre' },
    ],
    computeKey: 'maintenanceInutile',
  },
  {
    id: 'r-o03',
    categorie: 'optimisation',
    titre: 'Économies potentielles par éditeur',
    description: "Synthèse des gisements d'économies identifiés (licences dormantes + maintenance inutile).",
    icone: 'BarChart2',
    extraParams: [],
    kpis: [
      { key: 'economie_totale', label: 'Économie totale identifiée', format: 'montant', couleur: 'vert' },
      { key: 'top_editeur',    label: 'Éditeur à optimiser',         format: 'texte', couleur: null },
    ],
    colonnes: [
      { key: 'editeur',           label: 'Éditeur',                    sortable: true },
      { key: 'eco_licences',      label: 'Éco. licences dormantes',    sortable: true, format: 'montant' },
      { key: 'eco_maintenance',   label: 'Éco. maintenance inutile',   sortable: true, format: 'montant' },
      { key: 'total',             label: 'Total',                      sortable: true, format: 'montant' },
    ],
    graphique: { type: 'pie', nameKey: 'editeur', valueKey: 'total' },
    computeKey: 'economiesParEditeur',
  },
  {
    id: 'r-o04',
    categorie: 'optimisation',
    titre: 'Renouvellements à venir',
    description: "Contrats et commandes dont l'échéance tombe dans la période, avec recommandation de renouvellement.",
    icone: 'CalendarClock',
    extraParams: [],
    kpis: [
      { key: 'nb_echeances',       label: 'Échéances',              format: 'nombre', couleur: null },
      { key: 'montant_actuel',     label: 'Montant actuel total',   format: 'montant', couleur: null },
      { key: 'montant_projete',    label: 'Montant projeté total',  format: 'montant', couleur: null },
    ],
    colonnes: [
      { key: 'contrat',           label: 'Contrat',            sortable: true },
      { key: 'editeur',           label: 'Éditeur',            sortable: true },
      { key: 'echeance',          label: 'Échéance',           sortable: true, format: 'date' },
      { key: 'montant_actuel',    label: 'Montant actuel',     sortable: true, format: 'montant' },
      { key: 'montant_projete',   label: 'Montant projeté',    sortable: true, format: 'montant' },
      { key: 'taux_utilisation',  label: "Taux d'utilisation", sortable: true, format: 'taux_usage' },
      { key: 'recommandation',    label: 'Recommandation',     format: 'badge_recommandation' },
    ],
    computeKey: 'renouvellements',
  },
  {
    id: 'r-o05',
    categorie: 'optimisation',
    titre: 'Doublons et chevauchements',
    description: 'Produits redondants avec licences actives simultanées sur la période.',
    icone: 'Copy',
    extraParams: [],
    kpis: [
      { key: 'nb_groupes',         label: 'Groupes de doublons',      format: 'nombre', couleur: 'orange' },
      { key: 'droits_redondants',  label: 'Droits cumulés redondants', format: 'nombre', couleur: null },
    ],
    colonnes: [
      { key: 'groupe',           label: 'Groupe',          sortable: true },
      { key: 'produits',         label: 'Produits',        sortable: false },
      { key: 'droits_cumules',   label: 'Droits cumulés',  sortable: true, format: 'nombre' },
      { key: 'usages_cumules',   label: 'Usages cumulés',  sortable: true, format: 'nombre' },
      { key: 'recommandation',   label: 'Recommandation',  sortable: false },
    ],
    computeKey: 'doublonsChevauche',
  },
  {
    id: 'r-o06',
    categorie: 'optimisation',
    titre: 'Évolution des coûts (TCO)',
    description: 'Tendance mensuelle des dépenses : commandes et coûts de maintenance.',
    icone: 'TrendingUp',
    extraParams: [],
    kpis: [
      { key: 'cout_total',    label: 'Coût total période',         format: 'montant', couleur: null },
      { key: 'variation_pct', label: 'Variation vs période préc.', format: 'pourcentage_signe', couleur: null },
    ],
    colonnes: [
      { key: 'periode',      label: 'Période (mois)',       sortable: true },
      { key: 'commandes',    label: 'Coût commandes',       sortable: true, format: 'montant' },
      { key: 'maintenance',  label: 'Coût maintenance',     sortable: true, format: 'montant' },
      { key: 'total',        label: 'Total',                sortable: true, format: 'montant' },
    ],
    graphique: { type: 'line', nameKey: 'periode', lines: ['commandes', 'maintenance', 'total'] },
    computeKey: 'evolutionCoutsTCO',
  },
];

export function getReportById(id) {
  return reportsCatalog.find(r => r.id === id) ?? null;
}

export function getReportsByCategorie(categorie) {
  return reportsCatalog.filter(r => r.categorie === categorie);
}
