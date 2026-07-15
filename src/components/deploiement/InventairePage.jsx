// InventairePage - vue de reconciliation : droits / declare / reel cote a cote, connecteurs en preview v2
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Info, Plug } from 'lucide-react';
import {
  mockInventaireRaw as initialInventaire, mockConnecteurs, getTriangleProduit, getProduitsAvecLicence,
} from '../../data/mockDeploiement';
import { mockSocietes } from '../../data/mockReferentiels';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import Breadcrumb from '../ui/Breadcrumb';

function produitLabelOf(produits, idProduit) {
  return produits.find(p => p.id === idProduit)?.label ?? 'Produit inconnu';
}

function societeLabel(idSociete) {
  return mockSocietes.find(s => s.id === idSociete)?.raison_sociale ?? 'Societe inconnue';
}

const CONNECTEUR_STATUT = {
  ok: { variant: 'success', label: 'Operationnel' },
  defaillant: { variant: 'error', label: 'Defaillant' },
  non_configure: { variant: 'neutral', label: 'Non configure' },
};

const RAPPROCHEMENT_STATUT = {
  en_attente: { variant: 'neutral', label: 'En attente' },
  rapproche: { variant: 'success', label: 'Rapproche' },
  ecart_detecte: { variant: 'warning', label: 'Ecart detecte' },
  rejete: { variant: 'neutral', label: 'Rejete' },
};

const NIVEAU_VARIANT = { conforme: 'success', attention: 'warning', depassement: 'error' };
const NIVEAU_LABEL = { conforme: 'Conforme', attention: 'Attention', depassement: 'Depassement' };

export default function InventairePage() {
  const navigate = useNavigate();
  const [inventaire] = useState(initialInventaire);
  const [filterSociete, setFilterSociete] = useState('');
  const [filterProduit, setFilterProduit] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterConnecteur, setFilterConnecteur] = useState('');
  const [searchParams] = useSearchParams();
  const produitParam = searchParams.get('produit');

  const produits = getProduitsAvecLicence();

  const triangle = useMemo(() => produits.map(p => ({ produit: p, ...getTriangleProduit(p.id) })), [produits]);

  const filtree = useMemo(() => {
    return inventaire.filter(i => {
      if (filterSociete && i.id_societe !== filterSociete) return false;
      if ((filterProduit || produitParam) && i.id_produit !== (filterProduit || produitParam)) return false;
      if (filterStatut && i.statut_rapprochement !== filterStatut) return false;
      if (filterConnecteur && i.connecteur !== filterConnecteur) return false;
      return true;
    });
  }, [inventaire, filterSociete, filterProduit, filterStatut, filterConnecteur, produitParam]);

  const columns = [
    { key: 'produit', label: 'Produit', sortable: true, getValue: r => produitLabelOf(produits, r.id_produit), render: r => (
      <button onClick={() => navigate(`/conformite/inventaire/${r.id}`)} className="font-medium text-blue-800 hover:underline text-left">{produitLabelOf(produits, r.id_produit)}</button>
    ) },
    { key: 'societe', label: 'Societe', sortable: true, getValue: r => societeLabel(r.id_societe), render: r => societeLabel(r.id_societe) },
    { key: 'connecteur', label: 'Connecteur', sortable: true },
    { key: 'quantite_detectee', label: 'Quantite detectee', sortable: true },
    { key: 'date_collecte', label: 'Date de collecte', sortable: true },
    { key: 'statut_rapprochement', label: 'Rapprochement', sortable: true, render: r => {
      const cfg = RAPPROCHEMENT_STATUT[r.statut_rapprochement] ?? RAPPROCHEMENT_STATUT.en_attente;
      return <Badge variant={cfg.variant} label={cfg.label} />;
    } },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Usage' }, { label: 'Inventaire' }]} />
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Inventaire</h1>
        <p className="text-sm text-gray-500 mt-0.5">L'usage reel detecte, confronte aux droits et a l'usage declare</p>
      </div>

      <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-3">
        <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-400">
          La collecte automatique via connecteurs arrive en version 2 de SamSecure. En v0.5, les donnees affichees ci-dessous sont simulees pour presenter le concept.
        </p>
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Connecteurs (apercu)</h2>
          <span className="text-xs font-semibold text-blue-700 bg-blue-100 dark:bg-blue-900/30 px-2.5 py-1 rounded-full">Disponible en v2</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 opacity-70">
          {mockConnecteurs.map(c => {
            const cfg = CONNECTEUR_STATUT[c.statut];
            return (
              <div key={c.id} className="flex flex-col items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-not-allowed">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700">
                  <Plug size={16} className="text-gray-400" />
                </span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center">{c.nom}</span>
                <Badge variant={cfg.variant} label={cfg.label} />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">Configuration des connecteurs reservee au Manager DSI, disponible en v2.</p>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-4 pt-4 pb-3">Reconciliation - droits, declare, reel</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Produit</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Droits acquis</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Usage declare</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Usage reel detecte</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Ecart declare / reel</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Niveau reel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {triangle.map(({ produit, droits, declare, reel, niveauReel, ecartDeclareReel }) => (
                <tr key={produit.id} onClick={() => setFilterProduit(produit.id)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{produit.label}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{droits}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{declare}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{reel}</td>
                  <td className="px-4 py-2.5 text-right">
                    {ecartDeclareReel === 0
                      ? <span className="text-gray-400">-</span>
                      : <span className={ecartDeclareReel > 0 ? 'text-orange-600 font-medium' : 'text-gray-500'}>{ecartDeclareReel > 0 ? '+' : ''}{ecartDeclareReel}</span>
                    }
                  </td>
                  <td className="px-4 py-2.5"><Badge variant={NIVEAU_VARIANT[niveauReel]} label={NIVEAU_LABEL[niveauReel]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterSociete} onChange={e => setFilterSociete(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les societes</option>
          {mockSocietes.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
        </select>
        <select value={filterProduit} onChange={e => setFilterProduit(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les produits</option>
          {produits.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Rapprochement : tous</option>
          <option value="en_attente">En attente</option>
          <option value="rapproche">Rapproche</option>
          <option value="ecart_detecte">Ecart detecte</option>
          <option value="rejete">Rejete</option>
        </select>
        <select value={filterConnecteur} onChange={e => setFilterConnecteur(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les connecteurs</option>
          {mockConnecteurs.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable
          columns={columns}
          data={filtree}
          filename="inventaire"
          emptyState={{ message: 'Aucune entree d\'inventaire ne correspond aux filtres.' }}
        />
      </div>
    </div>
  );
}
