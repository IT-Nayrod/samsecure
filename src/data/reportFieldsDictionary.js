// reportFieldsDictionary - Dictionnaire des champs par domaine - SamSecure v0.5
// Definit les champs disponibles dans le Builder de rapport personnalise.
// Aligne sur les schemas reels des mocks (ne rien inventer).

export const fieldsDictionary = {
  licences: {
    label: 'Licences',
    icone: 'KeyRound',
    champDateDefaut: 'contrat.date_debut',
    colonnesDefaut: ['produit.label', 'editeur.raison_sociale', 'type', 'quantite', 'cout'],
    champs: [
      { key: 'produit.label',           label: 'Produit',              type: 'reference', source: 'produits' },
      { key: 'editeur.raison_sociale',  label: 'Éditeur',              type: 'reference', source: 'editeurs' },
      { key: 'contrat.label',           label: 'Contrat',              type: 'reference', source: 'contrats' },
      { key: 'type',                    label: 'Type de licence',      type: 'enum', valeurs: ['souscription', 'perpetuelle', 'oem'] },
      { key: 'unite_mesure',            label: 'Unité de mesure',      type: 'enum', valeurs: ['utilisateur', 'device', 'coeur', 'instance'] },
      { key: 'quantite',                label: 'Quantité',             type: 'nombre' },
      { key: 'cout',                    label: 'Coût',                 type: 'montant' },
      { key: 'contrat.date_debut',      label: 'Date début contrat',   type: 'date' },
      { key: 'contrat.date_fin',        label: 'Date fin contrat',     type: 'date' },
      { key: 'societe.raison_sociale',  label: 'Société',              type: 'reference', source: 'societes' },
    ],
  },

  affectations: {
    label: 'Affectations',
    icone: 'Tag',
    champDateDefaut: 'date_derniere_revalidation',
    colonnesDefaut: ['produit.label', 'editeur.raison_sociale', 'societe.raison_sociale', 'quantite', 'statut_validation'],
    champs: [
      { key: 'produit.label',            label: 'Produit',           type: 'reference', source: 'produits' },
      { key: 'editeur.raison_sociale',   label: 'Éditeur',           type: 'reference', source: 'editeurs' },
      { key: 'societe.raison_sociale',   label: 'Société',           type: 'reference', source: 'societes' },
      { key: 'reference_client',         label: 'Référence client',  type: 'texte' },
      { key: 'quantite',                 label: 'Quantité',          type: 'nombre' },
      { key: 'statut_validation',        label: 'Statut validation', type: 'enum', valeurs: ['valide', 'en_attente'] },
      { key: 'date_derniere_revalidation', label: 'Date revalidation', type: 'date' },
    ],
  },

  contrats: {
    label: 'Contrats',
    icone: 'FileText',
    champDateDefaut: 'date_fin',
    colonnesDefaut: ['label', 'editeur.raison_sociale', 'type', 'date_debut', 'date_fin'],
    champs: [
      { key: 'label',                    label: 'Intitulé',          type: 'texte' },
      { key: 'numero',                   label: 'Numéro',            type: 'texte' },
      { key: 'editeur.raison_sociale',   label: 'Éditeur',           type: 'reference', source: 'editeurs' },
      { key: 'societe.raison_sociale',   label: 'Société',           type: 'reference', source: 'societes' },
      { key: 'type',                     label: 'Type',              type: 'enum', valeurs: ['cadre', 'simple'] },
      { key: 'date_debut',               label: 'Date début',        type: 'date' },
      { key: 'date_fin',                 label: 'Date fin',          type: 'date' },
      { key: 'a_renouveler',             label: 'À renouveler',      type: 'booleen' },
      { key: 'statut_validation',        label: 'Statut validation', type: 'enum', valeurs: ['valide', 'en_attente'] },
    ],
  },

  commandes: {
    label: 'Commandes',
    icone: 'ShoppingCart',
    champDateDefaut: 'date',
    colonnesDefaut: ['label', 'editeur.raison_sociale', 'montant', 'date', 'statut_validation'],
    champs: [
      { key: 'label',                    label: 'Intitulé',          type: 'texte' },
      { key: 'numero_devis',             label: 'N. devis',          type: 'texte' },
      { key: 'reference_interne',        label: 'Réf. interne',      type: 'texte' },
      { key: 'contrat.label',            label: 'Contrat',           type: 'reference', source: 'contrats' },
      { key: 'editeur.raison_sociale',   label: 'Éditeur',           type: 'reference', source: 'editeurs' },
      { key: 'societe.raison_sociale',   label: 'Société',           type: 'reference', source: 'societes' },
      { key: 'montant',                  label: 'Montant',           type: 'montant' },
      { key: 'mode',                     label: 'Mode commande',     type: 'texte' },
      { key: 'date',                     label: 'Date commande',     type: 'date' },
      { key: 'date_fin',                 label: 'Date fin',          type: 'date' },
      { key: 'a_renouveler',             label: 'À renouveler',      type: 'booleen' },
      { key: 'statut_validation',        label: 'Statut validation', type: 'enum', valeurs: ['valide', 'en_attente'] },
    ],
  },

  factures_preuves: {
    label: 'Factures et preuves',
    icone: 'Receipt',
    champDateDefaut: 'date',
    colonnesDefaut: ['label', 'type', 'editeur.raison_sociale', 'date', 'statut_validation'],
    champs: [
      { key: 'label',                    label: 'Intitulé',          type: 'texte' },
      { key: 'type',                     label: 'Type',              type: 'enum', valeurs: ['facture', 'preuve'] },
      { key: 'type_preuve',              label: 'Type de preuve',    type: 'texte' },
      { key: 'editeur.raison_sociale',   label: 'Éditeur',           type: 'reference', source: 'editeurs' },
      { key: 'commande.label',           label: 'Commande',          type: 'reference', source: 'commandes' },
      { key: 'contrat.label',            label: 'Contrat',           type: 'reference', source: 'contrats' },
      { key: 'date',                     label: 'Date document',     type: 'date' },
      { key: 'statut_validation',        label: 'Statut validation', type: 'enum', valeurs: ['valide', 'en_attente'] },
    ],
  },

  maintenance: {
    label: 'Maintenance',
    icone: 'Wrench',
    champDateDefaut: 'date_fin',
    colonnesDefaut: ['produit.label', 'editeur.raison_sociale', 'prestataire', 'date_debut', 'date_fin', 'cout'],
    champs: [
      { key: 'produit.label',            label: 'Produit',           type: 'reference', source: 'produits' },
      { key: 'editeur.raison_sociale',   label: 'Éditeur',           type: 'reference', source: 'editeurs' },
      { key: 'prestataire',              label: 'Prestataire',       type: 'texte' },
      { key: 'cout',                     label: 'Coût annuel',       type: 'montant' },
      { key: 'date_debut',               label: 'Date debut',        type: 'date' },
      { key: 'date_fin',                 label: 'Date fin',          type: 'date' },
    ],
  },

  budget: {
    label: 'Budget',
    icone: 'PiggyBank',
    champDateDefaut: 'date_debut',
    colonnesDefaut: ['produit.label', 'editeur.raison_sociale', 'type', 'montant_OPEX', 'montant_CAPEX'],
    champs: [
      { key: 'produit.label',            label: 'Produit',       type: 'reference', source: 'produits' },
      { key: 'editeur.raison_sociale',   label: 'Éditeur',       type: 'reference', source: 'editeurs' },
      { key: 'contrat.label',            label: 'Contrat',       type: 'reference', source: 'contrats' },
      { key: 'type',                     label: 'Type budget',   type: 'enum', valeurs: ['previsionnel', 'alloue'] },
      { key: 'montant_OPEX',             label: 'Montant OPEX',  type: 'montant' },
      { key: 'montant_CAPEX',            label: 'Montant CAPEX', type: 'montant' },
      { key: 'quantite_OPEX',            label: 'Quantite OPEX', type: 'nombre' },
      { key: 'quantite_CAPEX',           label: 'Quantite CAPEX', type: 'nombre' },
      { key: 'date_debut',               label: 'Date debut',    type: 'date' },
      { key: 'date_fin',                 label: 'Date fin',      type: 'date' },
    ],
  },

  conformite: {
    label: 'Conformité',
    icone: 'ShieldCheck',
    champDateDefaut: null,
    colonnesDefaut: ['produit', 'editeur', 'droits', 'usages', 'ecart', 'statut'],
    champs: [
      { key: 'produit',    label: 'Produit',         type: 'texte' },
      { key: 'editeur',    label: 'Éditeur',         type: 'texte' },
      { key: 'droits',     label: 'Droits acquis',   type: 'nombre' },
      { key: 'usages',     label: 'Usages déclarés', type: 'nombre' },
      { key: 'ecart',      label: 'Écart',           type: 'nombre' },
      { key: 'ecart_pct',  label: 'Écart %',         type: 'nombre' },
      { key: 'statut',     label: 'Statut',          type: 'enum', valeurs: ['conforme', 'attention', 'non_conforme'] },
    ],
  },
};

/** Retourne tous les domaines comme options de select */
export function getDomainesOptions() {
  return Object.entries(fieldsDictionary).map(([key, val]) => ({
    value: key,
    label: val.label,
    icone: val.icone,
  }));
}

/** Retourne les champs d'un domaine filtrés par type */
export function getChampsByType(domaine, type) {
  const def = fieldsDictionary[domaine];
  if (!def) return [];
  if (!type) return def.champs;
  return def.champs.filter(c => c.type === type);
}

/** Retourne les champs de type date d'un domaine (pour le selecteur de filtre date) */
export function getChampsDates(domaine) {
  return getChampsByType(domaine, 'date');
}

/** Retourne les champs numeriques et montants d'un domaine (pour les agregats) */
export function getChampsNumeriques(domaine) {
  const def = fieldsDictionary[domaine];
  if (!def) return [];
  return def.champs.filter(c => c.type === 'nombre' || c.type === 'montant');
}
