// BudgetTable - Section Budget - SamSecure v0.5
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import BudgetProgressBar from './BudgetProgressBar';
import { mockLicences } from '../../data/mockDeploiement';
import { mockContrats, mockCommandes } from '../../data/mockContrats';
import { mockEditeurs, mockProduits, mockSocietes } from '../../data/mockReferentiels';
import { getSocieteDeLicence, ligneDansPerimetre } from '../../utils/orgUtils';

const SELECT_CLS = 'text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const fmtEur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const SOURCES = { licences: mockLicences, commandes: mockCommandes, societes: mockSocietes };

function isBudgetLineInPeriod(ligne, period) {
  if (!period?.debut || !period?.fin) return true;
  return new Date(ligne.date_debut) <= period.fin && new Date(ligne.date_fin) >= period.debut;
}

function buildRow(ligne, allInPeriod) {
  const licence = mockLicences.find(l => l.id === ligne.id_licence);
  const contrat = mockContrats.find(c => c.id === licence?.id_contrat);
  const editeur = mockEditeurs.find(e => e.id === contrat?.id_editeur);
  const produit = mockProduits.find(p => p.id === licence?.id_produit);
  const societe = getSocieteDeLicence(ligne.id_licence, SOURCES);

  const siblingType = ligne.type === 'alloue' ? 'previsionnel' : 'alloue';
  const sibling = allInPeriod.find(b => b.id_licence === ligne.id_licence && b.type === siblingType);

  const capex_engage = ligne.type === 'alloue' ? ligne.montant_CAPEX : (sibling?.montant_CAPEX ?? 0);
  const capex_alloue = ligne.type === 'previsionnel' ? ligne.montant_CAPEX : (sibling?.montant_CAPEX ?? 0);
  const opex_engage  = ligne.type === 'alloue' ? ligne.montant_OPEX  : (sibling?.montant_OPEX  ?? 0);
  const opex_alloue  = ligne.type === 'previsionnel' ? ligne.montant_OPEX  : (sibling?.montant_OPEX  ?? 0);

  return {
    id: ligne.id,
    _ligne: ligne,
    type: ligne.type,
    societe_id: societe?.id,
    societe_label: societe?.raison_sociale ?? 'Organisation inconnue',
    contrat_id: contrat?.id,
    contrat_label: contrat?.label ?? '-',
    editeur_id: editeur?.id,
    editeur_label: editeur?.raison_sociale ?? '-',
    produit_id: produit?.id,
    produit_label: produit?.label ?? '-',
    capex_engage,
    capex_alloue,
    opex_engage,
    opex_alloue,
  };
}

export default function BudgetTable({ budgetLines, period, societeIds, onEdit, onDelete, canEdit = false, canDelete = false }) {
  const navigate = useNavigate();
  const [filtreType, setFiltreType] = useState('tous');
  const [filtreContrat, setFiltreContrat] = useState('');
  const [filtreEditeur, setFiltreEditeur] = useState('');
  const [filtreProduit, setFiltreProduit] = useState('');

  const allInPeriod = useMemo(
    () => budgetLines.filter(b => {
      if (!isBudgetLineInPeriod(b, period)) return false;
      return ligneDansPerimetre(b, societeIds, SOURCES);
    }),
    [budgetLines, period, societeIds]
  );

  const baseRows = useMemo(() => {
    const typeFiltered = filtreType === 'tous' ? allInPeriod : allInPeriod.filter(b => b.type === filtreType);
    return typeFiltered.map(ligne => buildRow(ligne, allInPeriod));
  }, [allInPeriod, filtreType]);

  const rows = useMemo(() => {
    return baseRows.filter(row => {
      if (filtreContrat && row.contrat_id !== filtreContrat) return false;
      if (filtreEditeur && row.editeur_id !== filtreEditeur) return false;
      if (filtreProduit && row.produit_id !== filtreProduit) return false;
      return true;
    });
  }, [baseRows, filtreContrat, filtreEditeur, filtreProduit]);

  const contratsUniques = useMemo(() => {
    const ids = new Set(baseRows.map(r => r.contrat_id).filter(Boolean));
    return mockContrats.filter(c => ids.has(c.id));
  }, [baseRows]);

  const editeursUniques = useMemo(() => {
    const ids = new Set(baseRows.map(r => r.editeur_id).filter(Boolean));
    return mockEditeurs.filter(e => ids.has(e.id));
  }, [baseRows]);

  const produitsUniques = useMemo(() => {
    const ids = new Set(baseRows.map(r => r.produit_id).filter(Boolean));
    return mockProduits.filter(p => ids.has(p.id));
  }, [baseRows]);

  const columns = [
    {
      key: 'societe_label',
      label: 'Organisation',
      sortable: true,
      csvValue: row => row.societe_label,
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: row => (
        <Badge variant={row.type === 'alloue' ? 'success' : 'neutral'}>
          {row.type === 'previsionnel' ? 'Previsionnel' : 'Alloue'}
        </Badge>
      ),
      csvValue: row => row.type,
    },
    {
      key: 'contrat_label',
      label: 'Contrat',
      sortable: true,
      render: row => (
        <button
          onClick={() => row.contrat_id && navigate(`/contrats/liste/${row.contrat_id}`)}
          className="text-blue-800 dark:text-blue-400 hover:underline text-left max-w-[200px] truncate block"
        >
          {row.contrat_label}
        </button>
      ),
      csvValue: row => row.contrat_label,
    },
    {
      key: 'editeur_label',
      label: 'Editeur',
      sortable: true,
      csvValue: row => row.editeur_label,
    },
    {
      key: 'produit_label',
      label: 'Produit',
      sortable: true,
      csvValue: row => row.produit_label,
    },
    {
      key: 'capex_engage',
      label: 'CAPEX engage',
      render: row => (
        <div className="flex flex-col gap-1.5 min-w-[130px]">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{fmtEur(row.capex_engage)}</span>
          {row.capex_alloue > 0 && <BudgetProgressBar valeur={row.capex_engage} total={row.capex_alloue} />}
        </div>
      ),
      csvValue: row => row.capex_engage,
    },
    {
      key: 'capex_alloue',
      label: 'CAPEX alloue',
      render: row => <span className="text-sm text-gray-600 dark:text-gray-400">{fmtEur(row.capex_alloue)}</span>,
      csvValue: row => row.capex_alloue,
    },
    {
      key: 'opex_engage',
      label: 'OPEX projete / engage',
      render: row => (
        <div className="flex flex-col gap-1.5 min-w-[130px]">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{fmtEur(row.opex_engage)}</span>
          {row.opex_alloue > 0 && <BudgetProgressBar valeur={row.opex_engage} total={row.opex_alloue} />}
        </div>
      ),
      csvValue: row => row.opex_engage,
    },
    {
      key: 'opex_alloue',
      label: 'OPEX alloue',
      render: row => <span className="text-sm text-gray-600 dark:text-gray-400">{fmtEur(row.opex_alloue)}</span>,
      csvValue: row => row.opex_alloue,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: row => (
        <div className="flex items-center gap-1">
          {canEdit && (
            <button
              onClick={() => onEdit(row._ligne)}
              aria-label="Modifier"
              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <Pencil size={14} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(row._ligne)}
              aria-label="Supprimer"
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <select value={filtreType} onChange={e => setFiltreType(e.target.value)} className={SELECT_CLS} aria-label="Filtre type">
          <option value="tous">Tous les types</option>
          <option value="previsionnel">Previsionnel</option>
          <option value="alloue">Alloue</option>
        </select>
        <select value={filtreContrat} onChange={e => setFiltreContrat(e.target.value)} className={SELECT_CLS} aria-label="Filtre contrat">
          <option value="">Tous les contrats</option>
          {contratsUniques.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={filtreEditeur} onChange={e => setFiltreEditeur(e.target.value)} className={SELECT_CLS} aria-label="Filtre editeur">
          <option value="">Tous les editeurs</option>
          {editeursUniques.map(e => <option key={e.id} value={e.id}>{e.raison_sociale}</option>)}
        </select>
        <select value={filtreProduit} onChange={e => setFiltreProduit(e.target.value)} className={SELECT_CLS} aria-label="Filtre produit">
          <option value="">Tous les produits</option>
          {produitsUniques.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        filename="budget"
        pageSize={20}
        emptyState={{ message: 'Aucune ligne budgetaire', description: 'Aucune ligne ne correspond aux criteres selectionnes.' }}
      />
    </div>
  );
}
