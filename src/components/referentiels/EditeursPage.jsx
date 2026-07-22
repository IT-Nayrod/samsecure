// EditeursPage - liste des editeurs (Referentiels)
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { mockEditeurs as initialEditeurs, getProduitsByEditeur, getContactsByRattachement, getConformiteEditeur } from '../../data/mockReferentiels';
import { getContratsByEditeur } from '../../data/mockContrats';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Breadcrumb from '../ui/Breadcrumb';
import StatutValidationBadge from './StatutValidationBadge';
import ConformiteBadge from './ConformiteBadge';
import EditeurFormModal from './EditeurFormModal';
import LogoEditeur from './LogoEditeur';
import useRbac from '../../hooks/useRbac';
import useDebounce from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';

export default function EditeursPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, submitsForValidation } = useRbac();
  const { user } = useAuth();
  const [editeurs, setEditeurs] = useState(initialEditeurs);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 300);
  const [formModal, setFormModal] = useState({ open: false, editeur: null });

  const filtered = useMemo(() => {
    if (!debouncedSearch) return editeurs;
    const q = debouncedSearch.toLowerCase();
    return editeurs.filter(e => e.raison_sociale.toLowerCase().includes(q));
  }, [editeurs, debouncedSearch]);

  function handleSave(data, existing) {
    if (existing) {
      const resoumis = submitsForValidation;
      setEditeurs(prev => prev.map(e => e.id === existing.id ? {
        ...e, ...data,
        statut_validation: resoumis ? 'en_attente' : 'valide',
        soumis_par: `${user.prenom} ${user.nom}`,
      } : e));
      addToast({ type: 'success', message: resoumis ? 'Modification soumise a validation.' : 'Editeur mis a jour.' });
    } else {
      const newEditeur = {
        id: `ed-${Date.now()}`, ...data,
        statut_validation: submitsForValidation ? 'en_attente' : 'valide',
        soumis_par: `${user.prenom} ${user.nom}`,
      };
      setEditeurs(prev => [...prev, newEditeur]);
      addToast({ type: 'success', message: submitsForValidation ? 'Editeur soumis a validation.' : 'Editeur cree.' });
    }
  }

  const columns = [
    { key: 'raison_sociale', label: 'Raison sociale', sortable: true, render: r => (
      <button onClick={() => navigate(`/referentiels/editeurs/${r.id}`)} className="flex items-center gap-2.5 font-medium text-blue-800 hover:underline text-left">
        <LogoEditeur editeur={r} size={24} />
        {r.raison_sociale}
      </button>
    ) },
    { key: 'nb_produits', label: 'Nb produits', sortable: true, getValue: r => getProduitsByEditeur(r.id).length, render: r => getProduitsByEditeur(r.id).length },
    { key: 'nb_contrats', label: 'Nb contrats', sortable: true, getValue: r => getContratsByEditeur(r.id).length, render: r => getContratsByEditeur(r.id).length },
    { key: 'nb_contacts', label: 'Nb contacts', sortable: true, getValue: r => getContactsByRattachement('editeur', r.id).length, render: r => getContactsByRattachement('editeur', r.id).length },
    { key: 'conformite', label: 'Conformite', render: r => <ConformiteBadge conformite={getConformiteEditeur(r.id)} /> },
    { key: 'statut_validation', label: 'Statut', sortable: true, render: r => <StatutValidationBadge statut={r.statut_validation} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Referentiels' }, { label: 'Editeurs' }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Editeurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{editeurs.length} editeur{editeurs.length > 1 ? 's' : ''} au total</p>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={() => setFormModal({ open: true, editeur: null })}>
            <Plus size={15} /> Nouvel editeur
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par raison sociale..."
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable
          columns={columns}
          data={filtered}
          filename="editeurs"
          emptyState={{
            message: 'Aucun editeur ne correspond a la recherche.',
            ctaLabel: canWrite ? 'Nouvel editeur' : undefined,
            onCta: canWrite ? () => setFormModal({ open: true, editeur: null }) : undefined,
          }}
        />
      </div>

      <EditeurFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, editeur: null })}
        onSave={handleSave}
        editeur={formModal.editeur}
        existingEditeurs={editeurs}
      />
    </div>
  );
}
