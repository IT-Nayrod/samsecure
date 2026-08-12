// ProduitDetailPage - fiche detail d'un produit (catalogue commun en lecture seule, produit client editable)
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2, Plus, X } from 'lucide-react';
import {
  mockProduits, mockEditeurs, mockVersions as initialVersions, mockEditions as initialEditions,
  getSousProduits,
} from '../../data/mockReferentiels';
import { getLicencesByProduit } from '../../data/mockDeploiement';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import StatutValidationBadge from './StatutValidationBadge';
import ProduitFormModal from './ProduitFormModal';
import LogoEditeur from './LogoEditeur';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';

function getEditeur(idEditeur) {
  return mockEditeurs.find(e => e.id === idEditeur) ?? null;
}

function editeurLabel(idEditeur) {
  return getEditeur(idEditeur)?.raison_sociale ?? null;
}

export default function ProduitDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canDelete } = useRbac();
  const [produits, setProduits] = useState(mockProduits);
  const [versions, setVersions] = useState(initialVersions);
  const [editions, setEditions] = useState(initialEditions);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [newEdition, setNewEdition] = useState('');

  const produit = produits.find(p => p.id === id);

  if (!produit) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Referentiels', to: '/referentiels/logiciels' }, { label: 'Logiciels', to: '/referentiels/logiciels' }, { label: 'Introuvable' }]} />
        <EmptyState title="Produit introuvable" description="Ce produit n'existe pas ou a ete supprime." ctaLabel="Retour a la liste" onCta={() => navigate('/referentiels/logiciels')} />
      </div>
    );
  }

  const isCatalogue = produit.source === 'catalogue';
  const parent = produit.id_produit_parent ? produits.find(p => p.id === produit.id_produit_parent) : null;
  const enfants = getSousProduits(produit.id);
  const versionsProduit = versions.filter(v => v.id_produit === produit.id);
  const editionsProduit = editions.filter(e => e.id_produit === produit.id);
  const licences = getLicencesByProduit(produit.id);
  const nbLiens = licences.length + enfants.length;

  function handleSave(data, existing) {
    setProduits(prev => prev.map(p => p.id === existing.id ? { ...p, ...data } : p));
    addToast({ type: 'success', message: 'Produit mis a jour.' });
  }

  function handleDelete() {
    setProduits(prev => prev.filter(p => p.id !== produit.id));
    addToast({ type: 'success', message: 'Produit supprime.' });
    navigate('/referentiels/logiciels');
  }

  function addVersion() {
    if (!newVersion.trim()) return;
    setVersions(prev => [...prev, { id: `v-${Date.now()}`, id_produit: produit.id, label: newVersion.trim() }]);
    setNewVersion('');
  }

  function removeVersion(versionId) {
    setVersions(prev => prev.filter(v => v.id !== versionId));
  }

  function addEdition() {
    if (!newEdition.trim()) return;
    setEditions(prev => [...prev, { id: `e-${Date.now()}`, id_produit: produit.id, label: newEdition.trim() }]);
    setNewEdition('');
  }

  function removeEdition(editionId) {
    setEditions(prev => prev.filter(e => e.id !== editionId));
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[
        { label: 'Referentiels', to: '/referentiels/logiciels' },
        { label: 'Logiciels', to: '/referentiels/logiciels' },
        { label: produit.label },
      ]} />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <LogoEditeur editeur={getEditeur(produit.id_editeur)} size={48} />
          <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{produit.label}</h1>
            <Badge variant={isCatalogue ? 'neutral' : 'success'} label={isCatalogue ? 'Catalogue' : 'Client'} />
            {produit.a_maintenir && <Badge variant="success" label="Maintenance" />}
            {!isCatalogue && <StatutValidationBadge statut={produit.statut_validation} />}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {editeurLabel(produit.id_editeur) ?? 'Aucun editeur'}{produit.sku ? ` - SKU ${produit.sku}` : ''}
          </p>
          {!isCatalogue && produit.statut_validation === 'refuse' && produit.motif_refus && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">Motif du refus : {produit.motif_refus}</p>
          )}
          </div>
        </div>
        {!isCatalogue && (
          <div className="flex items-center gap-2 flex-wrap">
            {canWrite && (
              <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}>
                <Pencil size={14} /> Editer
              </Button>
            )}
            {canDelete && (
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={14} /> Supprimer
              </Button>
            )}
          </div>
        )}
      </div>

      {isCatalogue && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Catalogue commun, non modifiable. Ce produit est partage par tous les clients SamSecure.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Hierarchie</h2>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Produit parent</p>
              {parent
                ? <Link to={`/referentiels/logiciels/${parent.id}`} className="text-sm text-blue-800 hover:underline">{parent.label}</Link>
                : <p className="text-sm text-gray-500">Aucun (produit racine)</p>
              }
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Sous-produits ({enfants.length})</p>
              {enfants.length === 0
                ? <p className="text-sm text-gray-500">Aucun sous-produit.</p>
                : (
                  <ul className="flex flex-col gap-1">
                    {enfants.map(e => (
                      <li key={e.id}><Link to={`/referentiels/logiciels/${e.id}`} className="text-sm text-blue-800 hover:underline">{e.label}</Link></li>
                    ))}
                  </ul>
                )}
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Licences liees ({licences.length})</h2>
          {licences.length === 0
            ? <p className="text-sm text-gray-500">Aucune licence ne reference ce produit.</p>
            : <Link to={`/conformite/licences?produit=${produit.id}`} className="text-sm text-blue-800 hover:underline">Voir les {licences.length} licence{licences.length > 1 ? 's' : ''} liee{licences.length > 1 ? 's' : ''}</Link>
          }
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Versions ({versionsProduit.length})</h2>
          <div className="flex flex-col gap-1.5 mb-3">
            {versionsProduit.length === 0
              ? <p className="text-sm text-gray-500">Aucune version enregistree.</p>
              : versionsProduit.map(v => (
                <div key={v.id} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{v.label}</span>
                  {!isCatalogue && canWrite && (
                    <button onClick={() => removeVersion(v.id)} aria-label="Supprimer la version" className="text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
          </div>
          {!isCatalogue && canWrite && (
            <div className="flex gap-2">
              <input
                value={newVersion}
                onChange={e => setNewVersion(e.target.value)}
                placeholder="Nouvelle version..."
                className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button variant="secondary" size="sm" onClick={addVersion} disabled={!newVersion.trim()}>
                <Plus size={14} /> Ajouter
              </Button>
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Editions ({editionsProduit.length})</h2>
          <div className="flex flex-col gap-1.5 mb-3">
            {editionsProduit.length === 0
              ? <p className="text-sm text-gray-500">Aucune edition enregistree.</p>
              : editionsProduit.map(e => (
                <div key={e.id} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{e.label}</span>
                  {!isCatalogue && canWrite && (
                    <button onClick={() => removeEdition(e.id)} aria-label="Supprimer l'edition" className="text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
          </div>
          {!isCatalogue && canWrite && (
            <div className="flex gap-2">
              <input
                value={newEdition}
                onChange={e => setNewEdition(e.target.value)}
                placeholder="Nouvelle edition..."
                className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button variant="secondary" size="sm" onClick={addEdition} disabled={!newEdition.trim()}>
                <Plus size={14} /> Ajouter
              </Button>
            </div>
          )}
        </section>
      </div>

      {!isCatalogue && (
        <ProduitFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} produit={produit} allProduits={produits} />
      )}

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={nbLiens > 0 ? () => setDeleteOpen(false) : handleDelete}
        title="Supprimer le produit"
        isDestructive={nbLiens === 0}
        confirmLabel={nbLiens > 0 ? 'Compris' : 'Supprimer'}
        message={
          nbLiens > 0
            ? `Suppression impossible : ${produit.label} est rattache a ${licences.length} licence${licences.length > 1 ? 's' : ''} et ${enfants.length} sous-produit${enfants.length > 1 ? 's' : ''}. Detachez ou supprimez d'abord ces elements.`
            : `Supprimer definitivement ${produit.label} ? Cette action est irreversible.`
        }
      />
    </div>
  );
}
