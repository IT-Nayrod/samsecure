// searchRegistry - registre extensible de la recherche globale
// Ajouter une categorie = ajouter une entree ici, sans toucher au moteur (utils/search.js) ni a l'UI (GlobalSearch.jsx).
// Chaque entree lit une source de donnees existante (aucune copie), declare ses champs cherchables,
// le contexte affiche dans le resultat, et les routes de destination (detail si elle existe, sinon liste).
import {
  Building, Building2, Store, Users, Package, FileText, ShoppingCart, Receipt, Shield, Tag,
} from 'lucide-react';
import {
  mockSocietes, mockEditeurs, mockContacts, mockProduits, mockFonctions,
  getProduitsByEditeur, getRattachementInfo,
} from './mockReferentiels';
import { mockContrats, mockCommandes, mockDocuments, getEditeurLabel, getSocieteLabelContrat } from './mockContrats';
import { mockLicences, mockAffectations } from './mockDeploiement';

function produitLabel(idProduit) {
  return mockProduits.find(p => p.id === idProduit)?.label ?? 'Produit inconnu';
}

function societeLabel(idSociete) {
  return mockSocietes.find(s => s.id === idSociete)?.raison_sociale ?? 'Société inconnue';
}

export const SEARCH_REGISTRY = [
  {
    key: 'organisation',
    label: 'Clients',
    icon: Building,
    getData: () => mockSocietes,
    fields: item => [item.raison_sociale, item.siret],
    getResultLabel: item => item.raison_sociale,
    getContext: item => {
      const parent = mockSocietes.find(s => s.id === item.societe_parent_id);
      return `SIRET ${item.siret} - ${parent ? parent.raison_sociale : 'Société mère'}`;
    },
    getDetailPath: item => `/referentiels/organisation/${item.id}`,
    getListPath: () => '/referentiels/organisation',
  },
  {
    key: 'editeurs',
    label: 'Éditeurs',
    icon: Building2,
    getData: () => mockEditeurs,
    fields: item => [item.raison_sociale],
    getResultLabel: item => item.raison_sociale,
    getContext: item => `${getProduitsByEditeur(item.id).length} produit${getProduitsByEditeur(item.id).length > 1 ? 's' : ''}`,
    getDetailPath: item => `/referentiels/editeurs/${item.id}`,
    getListPath: () => '/referentiels/editeurs',
  },
  {
    key: 'contacts',
    label: 'Contacts',
    icon: Users,
    getData: () => mockContacts,
    fields: item => [item.nom, item.prenom, item.email, item.telephone],
    getResultLabel: item => `${item.prenom} ${item.nom}`,
    getContext: item => {
      const fonction = mockFonctions.find(f => f.id === item.id_fonction)?.label ?? '';
      const rattachement = getRattachementInfo(item.type_rattachement, item.id_rattachement);
      return [fonction, rattachement.label].filter(Boolean).join(' - ');
    },
    getDetailPath: item => `/referentiels/contacts/${item.id}`,
    getListPath: () => '/referentiels/contacts',
  },
  {
    key: 'logiciels',
    label: 'Logiciels',
    icon: Package,
    getData: () => mockProduits,
    fields: item => [item.label, item.sku],
    getResultLabel: item => item.label,
    getContext: item => {
      const editeur = mockEditeurs.find(e => e.id === item.id_editeur)?.raison_sociale;
      return [editeur, item.sku ? `SKU ${item.sku}` : null].filter(Boolean).join(' - ');
    },
    getDetailPath: item => `/referentiels/logiciels/${item.id}`,
    getListPath: () => '/referentiels/logiciels',
  },
  {
    key: 'contrats',
    label: 'Contrats',
    icon: FileText,
    getData: () => mockContrats,
    fields: item => [item.label, item.numero],
    getResultLabel: item => item.label,
    getContext: item => `${getEditeurLabel(item.id_editeur)} - du ${item.date_debut} au ${item.date_fin ?? "aujourd'hui"}`,
    getDetailPath: item => `/contrats/liste/${item.id}`,
    getListPath: () => '/contrats/liste',
  },
  {
    key: 'commandes',
    label: 'Commandes',
    icon: ShoppingCart,
    getData: () => mockCommandes,
    fields: item => [item.label, item.numero_devis, item.reference_interne],
    getResultLabel: item => item.label,
    getContext: item => `${item.montant.toLocaleString('fr-FR')} € - ${getSocieteLabelContrat(item.id_societe)}`,
    getDetailPath: item => `/contrats/commandes/${item.id}`,
    getListPath: () => '/contrats/commandes',
  },
  {
    key: 'documents',
    label: 'Factures & Preuves',
    icon: Receipt,
    getData: () => mockDocuments,
    fields: item => [item.label, item.nom_fichier],
    getResultLabel: item => item.label,
    getContext: item => item.id_commande ? mockCommandes.find(k => k.id === item.id_commande)?.label ?? '' : '',
    getDetailPath: item => `/contrats/factures/${item.id}`,
    getListPath: () => '/contrats/factures',
  },
  {
    key: 'licences',
    label: 'Licences',
    icon: Shield,
    getData: () => mockLicences,
    fields: item => [produitLabel(item.id_produit), item.unite_mesure, item.type],
    getResultLabel: item => produitLabel(item.id_produit),
    getContext: item => `${item.quantite} ${item.unite_mesure} - ${item.type}`,
    getDetailPath: item => `/conformite/licences/${item.id}`,
    getListPath: () => '/conformite/licences',
  },
  {
    key: 'affectations',
    label: 'Affectations',
    icon: Tag,
    getData: () => mockAffectations,
    fields: item => [item.reference_client, produitLabel(item.id_produit)],
    getResultLabel: item => item.reference_client,
    getContext: item => `${produitLabel(item.id_produit)} - ${societeLabel(item.id_societe)}`,
    getDetailPath: item => `/conformite/affectations/${item.id}`,
    getListPath: () => '/conformite/affectations',
  },
];

// Remarque : l'entrée "Inventaire" a été retirée de la recherche globale (#111) :
// les relevés sont servis par l'API, plus par un mock, et la recherche globale
// n'indexe que des données locales.
// Remarque : l'entrée "Utilisateurs" a été retirée de la recherche globale.
// Elle indexait src/data/mockUsers.js, qui n'est plus la source de vérité
// depuis le passage aux données réelles (voir Administration > Utilisateurs).
// Réintroduire cette entrée suppose une source de données asynchrone que le
// registre actuel (getData synchrone) ne supporte pas encore.
