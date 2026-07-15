// AffectationsPage - vue operationnelle : file de travail (validations + revalidations) puis liste complete
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, AlertTriangle, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import {
  mockAffectations as initialAffectations, getRevalidationStatut,
} from '../../data/mockDeploiement';
import { mockProduits, mockSocietes } from '../../data/mockReferentiels';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Breadcrumb from '../ui/Breadcrumb';
import StatutValidationBadge from '../referentiels/StatutValidationBadge';
import ValidationActions from '../referentiels/ValidationActions';
import DeploiementKpiCard from './DeploiementKpiCard';
import StatutRevalidationBadge from './StatutRevalidationBadge';
import AffectationFormModal from './AffectationFormModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';
import { formatDate } from '../../utils/dateUtils';

function produitLabel(idProduit) {
  return mockProduits.find(p => p.id === idProduit)?.label ?? 'Produit inconnu';
}

function societeLabel(idSociete) {
  return mockSocietes.find(s => s.id === idSociete)?.raison_sociale ?? 'Societe inconnue';
}

function rankQueue({ affectation, revalidation }) {
  if (revalidation?.statut === 'depasse') return 0;
  if (affectation.statut_validation === 'en_attente') return 1;
  if (revalidation?.statut === 'a_revalider') return 2;
  return 3;
}

export default function AffectationsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canValidate, submitsForValidation } = useRbac();
  const { user } = useAuth();
  const [affectations, setAffectations] = useState(initialAffectations);
  const [filterSociete, setFilterSociete] = useState('');
  const [filterProduit, setFilterProduit] = useState('');
  const [filterStatutValidation, setFilterStatutValidation] = useState('');
  const [filterStatutRevalidation, setFilterStatutRevalidation] = useState('');
  const [searchParams] = useSearchParams();
  const [formModal, setFormModal] = useState({ open: false, affectation: null });

  const enrichies = useMemo(() => affectations.map(a => ({ affectation: a, revalidation: getRevalidationStatut(a) })), [affectations]);

  const produitParam = searchParams.get('produit');
  const societeParam = searchParams.get('societe');

  const filtrees = useMemo(() => {
    return enrichies.filter(({ affectation, revalidation }) => {
      if ((filterSociete || societeParam) && affectation.id_societe !== (filterSociete || societeParam)) return false;
      if ((filterProduit || produitParam) && affectation.id_produit !== (filterProduit || produitParam)) return false;
      if (filterStatutValidation && affectation.statut_validation !== filterStatutValidation) return false;
      if (filterStatutRevalidation && revalidation?.statut !== filterStatutRevalidation) return false;
      return true;
    });
  }, [enrichies, filterSociete, filterProduit, filterStatutValidation, filterStatutRevalidation, societeParam, produitParam]);

  const queue = useMemo(() => {
    return enrichies
      .filter(({ affectation, revalidation }) => affectation.statut_validation === 'en_attente' || revalidation?.statut === 'a_revalider' || revalidation?.statut === 'depasse')
      .sort((a, b) => rankQueue(a) - rankQueue(b));
  }, [enrichies]);

  const kpis = useMemo(() => ({
    aValider: enrichies.filter(({ affectation }) => affectation.statut_validation === 'en_attente').length,
    aRevalider: enrichies.filter(({ revalidation }) => revalidation?.statut === 'a_revalider').length,
    depassees: enrichies.filter(({ revalidation }) => revalidation?.statut === 'depasse').length,
  }), [enrichies]);

  function handleValidate(id) {
    setAffectations(prev => prev.map(a => a.id === id ? { ...a, statut_validation: 'valide', date_derniere_revalidation: new Date().toISOString().slice(0, 10), motif_refus: undefined } : a));
    addToast({ type: 'success', message: 'Affectation validee.' });
  }

  function handleRefuse(id, motif) {
    setAffectations(prev => prev.map(a => a.id === id ? { ...a, statut_validation: 'refuse', motif_refus: motif } : a));
    addToast({ type: 'info', message: 'Affectation refusee.' });
  }

  function handleRevalider(id) {
    setAffectations(prev => prev.map(a => a.id === id ? { ...a, date_derniere_revalidation: new Date().toISOString().slice(0, 10) } : a));
    addToast({ type: 'success', message: 'Revalidation effectuee.' });
  }

  function handleSave(data, existing) {
    if (existing) {
      setAffectations(prev => prev.map(a => a.id === existing.id ? { ...a, ...data } : a));
      addToast({ type: 'success', message: 'Affectation mise a jour.' });
    } else {
      const newAffectation = {
        id: `af-${Date.now()}`, ...data,
        statut_validation: submitsForValidation ? 'en_attente' : 'valide',
        soumis_par: `${user.prenom} ${user.nom}`,
        date_derniere_revalidation: submitsForValidation ? null : new Date().toISOString().slice(0, 10),
      };
      setAffectations(prev => [...prev, newAffectation]);
      addToast({ type: 'success', message: submitsForValidation ? 'Affectation soumise a validation.' : 'Affectation creee.' });
    }
  }

  const columns = [
    { key: 'produit', label: 'Produit', sortable: true, getValue: r => produitLabel(r.id_produit), render: r => (
      <button onClick={() => navigate(`/conformite/affectations/${r.id}`)} className="font-medium text-blue-800 hover:underline text-left">{produitLabel(r.id_produit)}</button>
    ) },
    { key: 'societe', label: 'Societe', sortable: true, getValue: r => societeLabel(r.id_societe), render: r => societeLabel(r.id_societe) },
    { key: 'reference_client', label: 'Reference client', sortable: true },
    { key: 'quantite', label: 'Quantite', sortable: true },
    { key: 'statut_validation', label: 'Validation', sortable: true, render: r => <StatutValidationBadge statut={r.statut_validation} /> },
    { key: 'revalidation', label: 'Revalidation', render: r => {
      const revalidation = getRevalidationStatut(r);
      return (
        <div className="flex items-center gap-2">
          <StatutRevalidationBadge revalidation={revalidation} />
          {revalidation && <span className="text-xs text-gray-400">{formatDate(revalidation.prochaine)}</span>}
        </div>
      );
    } },
    {
      key: 'actions', label: 'Actions', render: r => (
        <div className="flex items-center gap-1">
          {canValidate && r.statut_validation === 'en_attente' && (
            <ValidationActions statut={r.statut_validation} onValidate={() => handleValidate(r.id)} onRefuse={motif => handleRefuse(r.id, motif)} />
          )}
          {canValidate && r.statut_validation === 'valide' && ['a_revalider', 'depasse'].includes(getRevalidationStatut(r)?.statut) && (
            <Button variant="secondary" size="sm" onClick={() => handleRevalider(r.id)}>Revalider</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Usage' }, { label: 'Affectations' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Affectations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Qui utilise quoi, validations et revalidations en cours</p>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={() => setFormModal({ open: true, affectation: null })}>
            <Plus size={15} /> Nouvelle affectation
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DeploiementKpiCard label="A valider" value={kpis.aValider} icon={Clock} color="#8B9099" />
        <DeploiementKpiCard label="A revalider" value={kpis.aRevalider} icon={AlertTriangle} color="#F59E0B" />
        <DeploiementKpiCard label="Revalidations depassees" value={kpis.depassees} icon={AlertTriangle} color="#EF4444" />
      </div>

      {/* File de travail - signature de la page */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">File de travail</h2>
        {queue.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <CheckCircle2 size={16} className="text-green-500" /> Aucune action en attente. Tout est a jour.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {queue.map(({ affectation, revalidation }) => {
              const borderColor = revalidation?.statut === 'depasse' ? '#EF4444' : affectation.statut_validation === 'en_attente' ? '#8B9099' : '#F59E0B';
              return (
                <div key={affectation.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40" style={{ borderLeft: `3px solid ${borderColor}` }}>
                  <button onClick={() => navigate(`/conformite/affectations/${affectation.id}`)} className="flex flex-col items-start text-left min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{produitLabel(affectation.id_produit)} - {affectation.reference_client}</span>
                    <span className="text-xs text-gray-500">{societeLabel(affectation.id_societe)}</span>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {affectation.statut_validation === 'en_attente'
                      ? <Badge variant="neutral" label="En attente de validation" />
                      : <StatutRevalidationBadge revalidation={revalidation} />
                    }
                    {canValidate && affectation.statut_validation === 'en_attente' && (
                      <ValidationActions statut={affectation.statut_validation} onValidate={() => handleValidate(affectation.id)} onRefuse={motif => handleRefuse(affectation.id, motif)} />
                    )}
                    {canValidate && affectation.statut_validation === 'valide' && ['a_revalider', 'depasse'].includes(revalidation?.statut) && (
                      <Button variant="secondary" size="sm" onClick={() => handleRevalider(affectation.id)}>Revalider</Button>
                    )}
                    <button onClick={() => navigate(`/conformite/affectations/${affectation.id}`)} aria-label="Voir le detail" className="p-1.5 text-gray-400 hover:text-gray-700">
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterSociete} onChange={e => setFilterSociete(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les societes</option>
          {mockSocietes.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
        </select>
        <select value={filterProduit} onChange={e => setFilterProduit(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les produits</option>
          {[...new Set(affectations.map(a => a.id_produit))].map(idP => <option key={idP} value={idP}>{produitLabel(idP)}</option>)}
        </select>
        <select value={filterStatutValidation} onChange={e => setFilterStatutValidation(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Statut validation : tous</option>
          <option value="en_attente">En attente</option>
          <option value="valide">Valide</option>
          <option value="refuse">Refuse</option>
        </select>
        <select value={filterStatutRevalidation} onChange={e => setFilterStatutRevalidation(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Statut revalidation : tous</option>
          <option value="a_jour">A jour</option>
          <option value="a_revalider">A revalider</option>
          <option value="depasse">Depasse</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable
          columns={columns}
          data={filtrees.map(({ affectation }) => affectation)}
          filename="affectations"
          emptyState={{ message: 'Aucune affectation ne correspond aux filtres.' }}
        />
      </div>

      <AffectationFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, affectation: null })}
        onSave={handleSave}
        affectation={formModal.affectation}
      />
    </div>
  );
}
