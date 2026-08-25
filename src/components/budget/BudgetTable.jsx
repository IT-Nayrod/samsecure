// BudgetTable - Section Budget - SamSecure v0.5
// Lignes servies par GET /budget (organisation, contrat, editeur et produit
// deduits par l'API, jamais recalcules ici). L'engage par licence vient de
// GET /budget/engage (BudgetPage fait un appel par licence distincte) ; la
// barre de progression rapporte cet engage au montant de la ligne, avec le
// code couleur de BudgetProgressBar. Filtres type, contrat, editeur et produit
// construits a partir des lignes elles-memes.
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import BudgetProgressBar from './BudgetProgressBar';
import { formatEuros, formatDateIso, libelleType } from './budgetCalculs';

const SELECT_CLS = 'text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

function optionsDepuisLignes(lignes, cleId, cleLabel) {
  const index = new Map();
  for (const l of lignes) if (l[cleId] && !index.has(l[cleId])) index.set(l[cleId], l[cleLabel] ?? '-');
  return [...index.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

function quantite(q) {
  if (q === null || q === undefined) return null;
  return `${Number(q).toLocaleString('fr-FR')} lic.`;
}

export default function BudgetTable({
  lignes = [], engageParLicence = new Map(), isLoading = false,
  onEdit, onDelete, canEdit = false, canDelete = false, emptyState,
}) {
  const navigate = useNavigate();
  const [filtreType, setFiltreType] = useState('tous');
  const [filtreContrat, setFiltreContrat] = useState('');
  const [filtreEditeur, setFiltreEditeur] = useState('');
  const [filtreProduit, setFiltreProduit] = useState('');

  const contratsUniques = useMemo(() => optionsDepuisLignes(lignes, 'id_contrat', 'contrat_label'), [lignes]);
  const editeursUniques = useMemo(() => optionsDepuisLignes(lignes, 'id_editeur', 'editeur_label'), [lignes]);
  const produitsUniques = useMemo(() => optionsDepuisLignes(lignes, 'id_produit', 'produit_label'), [lignes]);

  // Un filtre dont l'option a disparu apres rechargement (ligne supprimee,
  // periode changee) ne s'applique plus : sinon tableau vide sans explication.
  const contratActif = contratsUniques.some(c => c.id === filtreContrat) ? filtreContrat : '';
  const editeurActif = editeursUniques.some(e => e.id === filtreEditeur) ? filtreEditeur : '';
  const produitActif = produitsUniques.some(p => p.id === filtreProduit) ? filtreProduit : '';

  const rows = useMemo(() => lignes
    .filter(l => {
      if (filtreType !== 'tous' && l.type !== filtreType) return false;
      if (contratActif && l.id_contrat !== contratActif) return false;
      if (editeurActif && l.id_editeur !== editeurActif) return false;
      if (produitActif && l.id_produit !== produitActif) return false;
      return true;
    })
    .map(l => {
      const e = engageParLicence.get(l.id_licence);
      return {
        ...l,
        engage: e && !e.indisponible ? e.montant : null,
        engage_indisponible: !!e?.indisponible,
        engage_message: e?.message ?? null,
      };
    }), [lignes, engageParLicence, filtreType, contratActif, editeurActif, produitActif]);

  const columns = [
    {
      key: 'societe_label',
      label: 'Organisation',
      sortable: true,
      render: row => row.id_societe
        ? row.societe_label
        : <span className="text-gray-400 dark:text-gray-500" title="Licence sans commande : organisation payeuse non déterminée">Non déterminée</span>,
      csvValue: row => row.societe_label ?? '',
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: row => (
        <Badge variant={row.type === 'alloue' ? 'success' : 'neutral'}>{libelleType(row.type)}</Badge>
      ),
      csvValue: row => libelleType(row.type),
    },
    {
      key: 'contrat_label',
      label: 'Contrat',
      sortable: true,
      render: row => row.id_contrat ? (
        <button
          onClick={() => navigate(`/contrats/liste/${row.id_contrat}`)}
          className="text-blue-800 dark:text-blue-400 hover:underline text-left max-w-[200px] truncate block"
        >
          {row.contrat_label ?? '-'}
        </button>
      ) : <span className="text-gray-400">-</span>,
      csvValue: row => row.contrat_label ?? '',
    },
    {
      key: 'editeur_label',
      label: 'Éditeur',
      sortable: true,
      render: row => row.editeur_label ?? '-',
      csvValue: row => row.editeur_label ?? '',
    },
    {
      key: 'produit_label',
      label: 'Produit',
      sortable: true,
      getValue: row => row.produit_label ?? row.licence_label ?? '',
      render: row => (
        <div className="flex flex-col">
          <button
            onClick={() => navigate(`/conformite/licences/${row.id_licence}`)}
            className="text-blue-800 dark:text-blue-400 hover:underline text-left max-w-[220px] truncate block"
          >
            {row.produit_label ?? row.licence_label ?? '-'}
          </button>
          {row.licence_label && row.licence_label !== row.produit_label && (
            <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[220px]">{row.licence_label}</span>
          )}
        </div>
      ),
      csvValue: row => row.produit_label ?? row.licence_label ?? '',
    },
    {
      key: 'date_debut',
      label: 'Période',
      sortable: true,
      render: row => <span className="text-xs text-gray-500 dark:text-gray-400">{formatDateIso(row.date_debut)} au {formatDateIso(row.date_fin)}</span>,
      csvValue: row => `${row.date_debut} au ${row.date_fin}`,
    },
    {
      key: 'montant_capex',
      label: 'CAPEX',
      sortable: true,
      getValue: row => row.montant_capex ?? -1,
      render: row => (
        <div className="flex flex-col">
          <span className="text-sm text-gray-800 dark:text-gray-200">{formatEuros(row.montant_capex)}</span>
          {quantite(row.quantite_capex) && <span className="text-xs text-gray-400 dark:text-gray-500">{quantite(row.quantite_capex)}</span>}
        </div>
      ),
      csvValue: row => row.montant_capex ?? '',
    },
    {
      key: 'montant_opex',
      label: 'OPEX',
      sortable: true,
      getValue: row => row.montant_opex ?? -1,
      render: row => (
        <div className="flex flex-col">
          <span className="text-sm text-gray-800 dark:text-gray-200">{formatEuros(row.montant_opex)}</span>
          {quantite(row.quantite_opex) && <span className="text-xs text-gray-400 dark:text-gray-500">{quantite(row.quantite_opex)}</span>}
        </div>
      ),
      csvValue: row => row.montant_opex ?? '',
    },
    {
      key: 'engage',
      // La barre rapporte l'engage de la licence au total CAPEX + OPEX de la
      // ligne : la somme est nommee dans l'intitule et sous la barre.
      label: 'Engagé / total ligne (CAPEX + OPEX)',
      sortable: true,
      getValue: row => row.engage ?? -1,
      render: row => row.engage_indisponible
        ? <span className="text-xs text-gray-400" title={row.engage_message ?? undefined}>Indisponible</span>
        : row.engage === null
          ? <span className="text-xs text-gray-400">…</span>
          : (
            <div className="flex flex-col gap-1.5 min-w-[130px]">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatEuros(row.engage)}</span>
              <BudgetProgressBar valeur={row.engage} total={row.montant_total} />
              <span className="text-[10px] text-gray-400 dark:text-gray-500">sur {formatEuros(row.montant_total)} CAPEX + OPEX</span>
            </div>
          ),
      csvValue: row => row.engage ?? '',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: row => (
        <div className="flex items-center gap-1">
          {canEdit && (
            <button
              onClick={() => onEdit(row)}
              aria-label="Modifier"
              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <Pencil size={14} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(row)}
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
          <option value="previsionnel">Prévisionnel</option>
          <option value="alloue">Alloué</option>
        </select>
        <select value={contratActif} onChange={e => setFiltreContrat(e.target.value)} className={SELECT_CLS} aria-label="Filtre contrat">
          <option value="">Tous les contrats</option>
          {contratsUniques.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={editeurActif} onChange={e => setFiltreEditeur(e.target.value)} className={SELECT_CLS} aria-label="Filtre éditeur">
          <option value="">Tous les éditeurs</option>
          {editeursUniques.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
        <select value={produitActif} onChange={e => setFiltreProduit(e.target.value)} className={SELECT_CLS} aria-label="Filtre produit">
          <option value="">Tous les produits</option>
          {produitsUniques.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        filename="budget"
        pageSize={20}
        isLoading={isLoading}
        emptyState={emptyState ?? { message: 'Aucune ligne budgétaire', description: 'Aucune ligne ne correspond aux filtres sélectionnés.' }}
      />
    </div>
  );
}
