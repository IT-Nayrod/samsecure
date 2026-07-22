// InventaireDetailPage - fiche detail d'une entree d'inventaire (donnee brute simulee)
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FileJson } from 'lucide-react';
import { mockInventaireRaw, mockAffectations } from '../../data/mockDeploiement';
import { mockProduits, mockSocietes } from '../../data/mockReferentiels';
import Breadcrumb from '../ui/Breadcrumb';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';

const RAPPROCHEMENT_STATUT = {
  en_attente: { variant: 'neutral', label: 'En attente' },
  rapproche: { variant: 'success', label: 'Rapproche' },
  ecart_detecte: { variant: 'warning', label: 'Ecart detecte' },
  rejete: { variant: 'neutral', label: 'Rejete' },
};

export default function InventaireDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const entree = mockInventaireRaw.find(i => i.id === id);

  if (!entree) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Usage', to: '/conformite/inventaire' }, { label: 'Inventaire', to: '/conformite/inventaire' }, { label: 'Introuvable' }]} />
        <EmptyState title="Entree introuvable" description="Cette entree d'inventaire n'existe pas." ctaLabel="Retour a la liste" onCta={() => navigate('/conformite/inventaire')} />
      </div>
    );
  }

  const produit = mockProduits.find(p => p.id === entree.id_produit);
  const societe = mockSocietes.find(s => s.id === entree.id_societe);
  const affectation = entree.id_affectation ? mockAffectations.find(a => a.id === entree.id_affectation) : null;
  const cfg = RAPPROCHEMENT_STATUT[entree.statut_rapprochement] ?? RAPPROCHEMENT_STATUT.en_attente;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[
        { label: 'Usage', to: '/conformite/inventaire' },
        { label: 'Inventaire', to: '/conformite/inventaire' },
        { label: produit?.label ?? entree.id },
      ]} />

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{produit?.label ?? 'Produit inconnu'}</h1>
          <Badge variant={cfg.variant} label={cfg.label} />
        </div>
        <p className="text-sm text-gray-500 mt-1">{societe?.raison_sociale} - detecte via {entree.connecteur}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Donnee brute</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Connecteur source</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{entree.connecteur}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Format source</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{entree.format_source}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Quantite detectee</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{entree.quantite_detectee}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Date de collecte</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{entree.date_collecte}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-1">Pointeur fichier</p>
              <p className="text-sm text-gray-800 dark:text-gray-200 flex items-center gap-1.5 font-mono break-all">
                <FileJson size={13} className="flex-shrink-0 text-gray-400" /> {entree.url_fichier}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Rapprochement</h2>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Statut</p>
              <Badge variant={cfg.variant} label={cfg.label} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Affectation resultante</p>
              {affectation
                ? <Link to={`/conformite/affectations/${affectation.id}`} className="text-sm text-blue-800 hover:underline">{affectation.reference_client}</Link>
                : <p className="text-sm text-gray-500">Aucune affectation rapprochee.</p>
              }
            </div>
            {entree.nature_ecart && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Nature de l'ecart</p>
                <p className="text-sm text-orange-600 dark:text-orange-400">{entree.nature_ecart}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
