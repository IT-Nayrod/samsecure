// OrganisationPage - liste des societes de l'organisation (Referentiels), vue arborescente ou liste plate
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, List, GitBranch, ChevronRight, ChevronDown } from 'lucide-react';
import {
  mockSocietes as initialSocietes, getFilialesBySociete, getContactsByRattachement,
} from '../../data/mockReferentiels';
import { getContratsBySociete } from '../../data/mockContrats';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Breadcrumb from '../ui/Breadcrumb';
import EmptyState from '../ui/EmptyState';
import StatutValidationBadge from './StatutValidationBadge';
import OrganisationFormModal from './OrganisationFormModal';
import useRbac from '../../hooks/useRbac';
import useDebounce from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';

function TreeNode({ societe, depth, navigate }) {
  const [open, setOpen] = useState(depth === 0);
  const filiales = getFilialesBySociete(societe.id);
  const hasFiliales = filiales.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => navigate(`/referentiels/organisation/${societe.id}`)}
      >
        {hasFiliales
          ? <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }} className="text-gray-400 flex-shrink-0">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
          : <span className="w-3.5 flex-shrink-0" />
        }
        <span className="text-sm text-blue-800 hover:underline">{societe.raison_sociale}</span>
        <Badge variant={societe.actif ? 'success' : 'neutral'} label={societe.actif ? 'Active' : 'Inactive'} />
        <StatutValidationBadge statut={societe.statut_validation} />
      </div>
      {open && hasFiliales && filiales.map(f => (
        <TreeNode key={f.id} societe={f} depth={depth + 1} navigate={navigate} />
      ))}
    </div>
  );
}

export default function OrganisationPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, submitsForValidation } = useRbac();
  const { user } = useAuth();
  const [societes, setSocietes] = useState(initialSocietes);
  const [vueArbo, setVueArbo] = useState(true);
  const [filterParent, setFilterParent] = useState('');
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 300);
  const [formModal, setFormModal] = useState({ open: false, societe: null });

  const filtered = useMemo(() => {
    return societes.filter(s => {
      if (filterParent && s.societe_parent_id !== filterParent) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (!`${s.raison_sociale} ${s.siret}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [societes, filterParent, debouncedSearch]);

  const racinesArbo = useMemo(() => societes.filter(s => !s.societe_parent_id), [societes]);
  const societesMeres = useMemo(() => societes.filter(s => !s.societe_parent_id), [societes]);

  function handleSave(data, existing) {
    if (existing) {
      const resoumis = submitsForValidation;
      setSocietes(prev => prev.map(s => s.id === existing.id ? {
        ...s, ...data,
        statut_validation: resoumis ? 'en_attente' : 'valide',
        soumis_par: `${user.prenom} ${user.nom}`,
      } : s));
      addToast({ type: 'success', message: resoumis ? 'Modification soumise a validation.' : 'Societe mise a jour.' });
    } else {
      const newSociete = {
        id: `cl-${Date.now()}`, ...data, actif: true,
        statut_validation: submitsForValidation ? 'en_attente' : 'valide',
        soumis_par: `${user.prenom} ${user.nom}`,
      };
      setSocietes(prev => [...prev, newSociete]);
      addToast({ type: 'success', message: submitsForValidation ? 'Societe soumise a validation.' : 'Societe creee.' });
    }
  }

  const columns = [
    { key: 'raison_sociale', label: 'Raison sociale', sortable: true, render: r => (
      <button onClick={() => navigate(`/referentiels/organisation/${r.id}`)} className="font-medium text-blue-800 hover:underline text-left">{r.raison_sociale}</button>
    ) },
    { key: 'siret', label: 'SIRET', sortable: true },
    { key: 'societe_parent', label: 'Societe parente', getValue: r => societes.find(s => s.id === r.societe_parent_id)?.raison_sociale ?? '', render: r => societes.find(s => s.id === r.societe_parent_id)?.raison_sociale ?? '-' },
    { key: 'nb_contacts', label: 'Nb contacts', sortable: true, getValue: r => getContactsByRattachement('client', r.id).length, render: r => getContactsByRattachement('client', r.id).length },
    { key: 'nb_contrats', label: 'Nb contrats', sortable: true, getValue: r => getContratsBySociete(r.id).length, render: r => getContratsBySociete(r.id).length },
    { key: 'duree_amortissement', label: 'Duree amort.', sortable: true, render: r => `${r.duree_amortissement} mois` },
    { key: 'statut_validation', label: 'Statut', sortable: true, render: r => <StatutValidationBadge statut={r.statut_validation} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'Organisation' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Organisation</h1>
          <p className="text-sm text-gray-500 mt-0.5">{societes.length} societe{societes.length > 1 ? 's' : ''} au total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button onClick={() => setVueArbo(true)} aria-label="Vue arborescente" className={`p-1.5 rounded ${vueArbo ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-800' : 'text-gray-500'}`}>
              <GitBranch size={15} />
            </button>
            <button onClick={() => setVueArbo(false)} aria-label="Vue liste" className={`p-1.5 rounded ${!vueArbo ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-800' : 'text-gray-500'}`}>
              <List size={15} />
            </button>
          </div>
          {canWrite && (
            <Button variant="primary" onClick={() => setFormModal({ open: true, societe: null })}>
              <Plus size={15} /> Nouvelle societe
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterParent} onChange={e => setFilterParent(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les societes parentes</option>
          {societesMeres.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
        </select>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par raison sociale ou SIRET..."
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
        />
      </div>

      {vueArbo ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          {racinesArbo.length === 0
            ? <EmptyState title="Aucune societe" description="Aucune societe dans le referentiel." />
            : racinesArbo.map(s => <TreeNode key={s.id} societe={s} depth={0} navigate={navigate} />)
          }
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <DataTable
            columns={columns}
            data={filtered}
            filename="organisation"
            emptyState={{
              message: 'Aucune societe ne correspond aux filtres.',
              ctaLabel: canWrite ? 'Nouvelle societe' : undefined,
              onCta: canWrite ? () => setFormModal({ open: true, societe: null }) : undefined,
            }}
          />
        </div>
      )}

      <OrganisationFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, societe: null })}
        onSave={handleSave}
        societe={formModal.societe}
        existingSocietes={societes}
      />
    </div>
  );
}
