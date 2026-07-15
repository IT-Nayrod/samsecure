// FacturesPage - vue documentaire et orientee audit (Factures & Preuves)
import { useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Receipt, FileCheck, AlertTriangle, X } from 'lucide-react';
import {
  mockDocuments as initialDocuments, mockContrats, mockCommandes, mockTypesPreuve, getContrat, getCommande, getManquesAudit,
} from '../../data/mockContrats';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Breadcrumb from '../ui/Breadcrumb';
import StatutValidationBadge from '../referentiels/StatutValidationBadge';
import DocumentIcon from './DocumentIcon';
import ManqueBadge from './ManqueBadge';
import DeploiementKpiCard from '../deploiement/DeploiementKpiCard';
import DocumentFormModal from './DocumentFormModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';
import { formatDate } from '../../utils/dateUtils';

export default function FacturesPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, submitsForValidation } = useRbac();
  const { user } = useAuth();
  const [documents, setDocuments] = useState(initialDocuments);
  const [filterType, setFilterType] = useState('');
  const [filterTypePreuve, setFilterTypePreuve] = useState('');
  const [filterContrat, setFilterContrat] = useState('');
  const [filterCommande, setFilterCommande] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [searchParams] = useSearchParams();
  const contratParam = searchParams.get('contrat');
  const commandeParam = searchParams.get('commande');
  const [formModal, setFormModal] = useState({ open: false, doc: null });
  const manquesRef = useRef(null);

  const manques = useMemo(() => getManquesAudit(documents), [documents]);

  function handleKpiFactures() {
    setFilterType(prev => prev === 'facture' ? '' : 'facture');
  }

  function handleKpiPreuves() {
    setFilterType(prev => prev === 'preuve' ? '' : 'preuve');
  }

  function handleKpiManques() {
    manquesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetFiltres() {
    setFilterType('');
    setFilterTypePreuve('');
    setFilterContrat('');
    setFilterCommande('');
    setFilterStatut('');
  }

  const hasActiveFiltres = !!(filterType || filterTypePreuve || filterContrat || filterCommande || filterStatut);

  const filtres = useMemo(() => {
    return documents.filter(d => {
      if (filterType && d.type !== filterType) return false;
      if (filterTypePreuve && d.type_preuve !== filterTypePreuve) return false;
      if ((filterContrat || contratParam) && d.id_contrat !== (filterContrat || contratParam)) return false;
      if ((filterCommande || commandeParam) && d.id_commande !== (filterCommande || commandeParam)) return false;
      if (filterStatut && d.statut_validation !== filterStatut) return false;
      return true;
    });
  }, [documents, filterType, filterTypePreuve, filterContrat, filterCommande, filterStatut, contratParam, commandeParam]);

  const kpis = useMemo(() => ({
    nbFactures: documents.filter(d => d.type === 'facture').length,
    nbPreuves: documents.filter(d => d.type === 'preuve').length,
    nbManques: manques.length,
  }), [documents, manques]);

  function handleSave(data, existing) {
    if (existing) {
      const resoumis = submitsForValidation;
      setDocuments(prev => prev.map(d => d.id === existing.id ? {
        ...d, ...data,
        statut_validation: resoumis ? 'en_attente' : 'valide',
        soumis_par: `${user.prenom} ${user.nom}`,
      } : d));
      addToast({ type: 'success', message: resoumis ? 'Modification soumise a validation.' : 'Document mis a jour.' });
    } else {
      const newDoc = {
        id: `doc-${Date.now()}`, ...data,
        statut_validation: submitsForValidation ? 'en_attente' : 'valide',
        soumis_par: `${user.prenom} ${user.nom}`,
      };
      setDocuments(prev => [...prev, newDoc]);
      addToast({ type: 'success', message: submitsForValidation ? 'Document soumis a validation.' : 'Document ajoute.' });
    }
  }

  const columns = [
    { key: 'nom_fichier', label: 'Fichier', render: r => (
      <button onClick={() => navigate(`/contrats/factures/${r.id}`)} className="flex items-center gap-2.5 font-medium text-blue-800 hover:underline text-left">
        <DocumentIcon nomFichier={r.nom_fichier} size={28} />
        {r.label}
      </button>
    ), csvValue: r => r.label },
    { key: 'type', label: 'Type', sortable: true, render: r => r.type === 'facture' ? 'Facture' : 'Preuve' },
    { key: 'type_preuve', label: 'Type de preuve', render: r => r.type_preuve ?? '-' },
    { key: 'liaison', label: 'Contrat / Commande', render: r => {
      const contrat = r.id_contrat ? getContrat(r.id_contrat) : null;
      const commande = r.id_commande ? getCommande(r.id_commande) : null;
      return [contrat?.label, commande?.label].filter(Boolean).join(' - ') || '-';
    } },
    { key: 'date', label: 'Date', sortable: true, render: r => formatDate(r.date) },
    { key: 'statut_validation', label: 'Validation', sortable: true, render: r => <StatutValidationBadge statut={r.statut_validation} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Droits d\'usage' }, { label: 'Factures & Preuves' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Factures & Preuves</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pieces justificatives et aptitude a l'audit</p>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={() => setFormModal({ open: true, doc: null })}>
            <Plus size={15} /> Ajouter un document
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DeploiementKpiCard label="Factures" value={kpis.nbFactures} icon={Receipt} color="#1F4E79" onClick={handleKpiFactures} active={filterType === 'facture'} />
        <DeploiementKpiCard label="Preuves" value={kpis.nbPreuves} icon={FileCheck} color="#22C55E" onClick={handleKpiPreuves} active={filterType === 'preuve'} />
        <DeploiementKpiCard label="Manques detectes" value={kpis.nbManques} icon={AlertTriangle} color="#EF4444" onClick={handleKpiManques} />
      </div>

      <section ref={manquesRef} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Detection des manques (risque audit)</h2>
        {manques.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun manque detecte : toutes les commandes ont facture et preuve.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {manques.map(({ commande, sansFacture, sansPreuve }) => (
              <div key={commande.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40" style={{ borderLeft: '3px solid #EF4444' }}>
                <button onClick={() => navigate(`/contrats/commandes/${commande.id}`)} className="text-sm font-medium text-gray-900 dark:text-white hover:underline text-left">
                  {commande.label}
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {sansFacture && <ManqueBadge label="Sans facture" />}
                  {sansPreuve && <ManqueBadge label="Sans preuve" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tout</option>
          <option value="facture">Factures</option>
          <option value="preuve">Preuves</option>
        </select>
        <select value={filterTypePreuve} onChange={e => setFilterTypePreuve(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les types de preuve</option>
          {mockTypesPreuve.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterContrat} onChange={e => setFilterContrat(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les contrats</option>
          {mockContrats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={filterCommande} onChange={e => setFilterCommande(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les commandes</option>
          {mockCommandes.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="valide">Valide</option>
          <option value="refuse">Refuse</option>
        </select>
        {hasActiveFiltres && (
          <button onClick={resetFiltres} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-2">
            <X size={14} /> Reinitialiser les filtres
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable
          columns={columns}
          data={filtres}
          filename="documents"
          emptyState={{ message: 'Aucun document ne correspond aux filtres.' }}
        />
      </div>

      <DocumentFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, doc: null })}
        onSave={handleSave}
        doc={formModal.doc}
      />
    </div>
  );
}
