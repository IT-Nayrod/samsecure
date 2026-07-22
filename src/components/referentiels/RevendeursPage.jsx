// RevendeursPage - liste des revendeurs (Referentiels)
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { mockRevendeurs as initialRevendeurs, getContactsByRattachement } from '../../data/mockReferentiels';
import { getLicencesByRevendeur } from '../../data/mockDeploiement';
import { getCommandesByRevendeur } from '../../data/mockContrats';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Breadcrumb from '../ui/Breadcrumb';
import StatutValidationBadge from './StatutValidationBadge';
import RevendeurFormModal from './RevendeurFormModal';
import useRbac from '../../hooks/useRbac';
import useDebounce from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';

export default function RevendeursPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, submitsForValidation } = useRbac();
  const { user } = useAuth();
  const [revendeurs, setRevendeurs] = useState(initialRevendeurs);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 300);
  const [formModal, setFormModal] = useState({ open: false, revendeur: null });

  const filtered = useMemo(() => {
    if (!debouncedSearch) return revendeurs;
    const q = debouncedSearch.toLowerCase();
    return revendeurs.filter(r => r.raison_sociale.toLowerCase().includes(q) || r.siret?.includes(q));
  }, [revendeurs, debouncedSearch]);

  function handleSave(data, existing) {
    if (existing) {
      const resoumis = submitsForValidation;
      setRevendeurs(prev => prev.map(r => r.id === existing.id ? {
        ...r, ...data,
        statut_validation: resoumis ? 'en_attente' : 'valide',
        soumis_par: `${user.prenom} ${user.nom}`,
      } : r));
      addToast({ type: 'success', message: resoumis ? 'Modification soumise a validation.' : 'Revendeur mis a jour.' });
    } else {
      const newRevendeur = {
        id: `rv-${Date.now()}`, ...data,
        statut_validation: submitsForValidation ? 'en_attente' : 'valide',
        soumis_par: `${user.prenom} ${user.nom}`,
      };
      setRevendeurs(prev => [...prev, newRevendeur]);
      addToast({ type: 'success', message: submitsForValidation ? 'Revendeur soumis a validation.' : 'Revendeur cree.' });
    }
  }

  const columns = [
    { key: 'raison_sociale', label: 'Raison sociale', sortable: true, render: r => (
      <button onClick={() => navigate(`/referentiels/revendeurs/${r.id}`)} className="font-medium text-blue-800 hover:underline text-left">{r.raison_sociale}</button>
    ) },
    { key: 'siret', label: 'SIRET', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'nb_commandes', label: 'Nb commandes', sortable: true, getValue: r => getCommandesByRevendeur(r.id).length, render: r => getCommandesByRevendeur(r.id).length },
    { key: 'nb_licences', label: 'Nb licences', sortable: true, getValue: r => getLicencesByRevendeur(r.id).length, render: r => getLicencesByRevendeur(r.id).length },
    { key: 'nb_contacts', label: 'Nb contacts', sortable: true, getValue: r => getContactsByRattachement('revendeur', r.id).length, render: r => getContactsByRattachement('revendeur', r.id).length },
    { key: 'statut_validation', label: 'Statut', sortable: true, render: r => <StatutValidationBadge statut={r.statut_validation} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Referentiels' }, { label: 'Revendeurs' }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Revendeurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{revendeurs.length} revendeur{revendeurs.length > 1 ? 's' : ''} au total</p>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={() => setFormModal({ open: true, revendeur: null })}>
            <Plus size={15} /> Nouveau revendeur
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par raison sociale ou SIRET..."
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable
          columns={columns}
          data={filtered}
          filename="revendeurs"
          emptyState={{
            message: 'Aucun revendeur ne correspond a la recherche.',
            ctaLabel: canWrite ? 'Nouveau revendeur' : undefined,
            onCta: canWrite ? () => setFormModal({ open: true, revendeur: null }) : undefined,
          }}
        />
      </div>

      <RevendeurFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, revendeur: null })}
        onSave={handleSave}
        revendeur={formModal.revendeur}
        existingRevendeurs={revendeurs}
      />
    </div>
  );
}
