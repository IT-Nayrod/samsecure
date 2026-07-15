// searchRegistry - registre extensible de la recherche globale
// Ajouter une categorie = ajouter une entree ici, sans toucher au moteur (utils/search.js) ni a l'UI (GlobalSearch.jsx).
// Chaque entree lit une source de donnees existante (aucune copie), declare ses champs cherchables,
// le contexte affiche dans le resultat, et les routes de destination (detail si elle existe, sinon liste).
import {
  Building, Building2, Store, Users, Package, FileText, ShoppingCart, Receipt, Shield, Tag, Database, UserCog,
} from 'lucide-react';
import {
  mockSocietes, mockEditeurs, mockRevendeurs, mockContacts, mockProduits, mockFonctions,
  getProduitsByEditeur, getRattachementInfo,
} from './mockReferentiels';
import { mockContrats, mockCommandes, mockDocuments, getEditeurLabel, getSocieteLabelContrat } from './mockContrats';
import { mockLicences, mockAffectations, mockInventaireRaw } from './mockDeploiement';
import { mockUsers } from './mockUsers';

function produitLabel(idProduit) {
  return mockProduits.find(p => p.id === idProduit)?.label ?? 'Produit inconnu';
}

function societeLabel(idSociete) {
  return mockSocietes.find(s => s.id === idSociete)?.raison_sociale ?? 'Societe inconnue';
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
      return `SIRET ${item.siret} - ${parent ? parent.raison_sociale : 'Societe mere'}`;
    },
    getDetailPath: item => `/referentiels/organisation/${item.id}`,
    getListPath: () => '/referentiels/organisation',
  },
  {
    key: 'editeurs',
    label: 'Editeurs',
    icon: Building2,
    getData: () => mockEditeurs,
    fields: item => [item.raison_sociale],
    getResultLabel: item => item.raison_sociale,
    getContext: item => `${getProduitsByEditeur(item.id).length} produit${getProduitsByEditeur(item.id).length > 1 ? 's' : ''}`,
    getDetailPath: item => `/referentiels/editeurs/${item.id}`,
    getListPath: () => '/referentiels/editeurs',
  },
  {
    key: 'revendeurs',
    label: 'Revendeurs',
    icon: Store,
    getData: () => mockRevendeurs,
    fields: item => [item.raison_sociale, item.siret, item.email],
    getResultLabel: item => item.raison_sociale,
    getContext: item => item.siret ?? item.email ?? '',
    getDetailPath: item => `/referentiels/revendeurs/${item.id}`,
    getListPath: () => '/referentiels/revendeurs',
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
    profiles: ['manager_dsi', 'it_ops'],
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
    profiles: ['manager_dsi', 'it_ops'],
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
    profiles: ['manager_dsi', 'it_ops'],
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
  {
    key: 'inventaire',
    label: 'Inventaire',
    icon: Database,
    getData: () => mockInventaireRaw,
    fields: item => [produitLabel(item.id_produit), item.connecteur],
    getResultLabel: item => `${produitLabel(item.id_produit)} - ${societeLabel(item.id_societe)}`,
    getContext: item => `${item.connecteur} - ${item.quantite_detectee} detectes`,
    getDetailPath: item => `/conformite/inventaire/${item.id}`,
    getListPath: () => '/conformite/inventaire',
  },
  {
    key: 'utilisateurs',
    label: 'Utilisateurs',
    icon: UserCog,
    profiles: ['manager_dsi'],
    getData: () => mockUsers,
    fields: item => [item.nom, item.prenom, item.email],
    getResultLabel: item => `${item.prenom} ${item.nom}`,
    getContext: item => item.habilitations?.[0]?.profilLabel ?? '',
    getDetailPath: () => null,
    getListPath: () => '/admin/users',
  },
];
