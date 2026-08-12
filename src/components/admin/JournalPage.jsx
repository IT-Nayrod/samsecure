// JournalPage - journal d'audit serveur : recherche, pagination (gérée par
// DataTable), téléchargement complet (bouton CSV intégré à DataTable).
import { useState, useEffect, useCallback } from 'react';
import DataTable from '../ui/DataTable';
import { useToast } from '../../hooks/useToast';
import useDebounce from '../../hooks/useDebounce';
import { journalService } from '../../services/adminService';

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR');
}

export default function JournalPage() {
  const { addToast } = useToast();
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(async (q) => {
    setIsLoading(true);
    try {
      const rows = await journalService.list({ search: q, limit: 2000 });
      setEntries(rows);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(debouncedSearch); }, [load, debouncedSearch]);

  const columns = [
    { key: 'created_at', label: 'Horodatage', sortable: true, render: r => formatDateTime(r.created_at), csvValue: r => formatDateTime(r.created_at) },
    { key: 'action', label: 'Action', sortable: true },
    { key: 'entite_type', label: 'Entité', sortable: true },
    { key: 'description', label: 'Description' },
    { key: 'payload', label: 'Détail', render: r => r.payload ? <code className="text-xs text-gray-400">{JSON.stringify(r.payload).slice(0, 80)}</code> : '—', csvValue: r => r.payload ? JSON.stringify(r.payload) : '' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Journal</h1>
        <p className="text-sm text-gray-500 mt-0.5">{entries.length} événement{entries.length > 1 ? 's' : ''}</p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher dans les descriptions…"
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-md"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable columns={columns} data={entries} filename="journal" isLoading={isLoading} pageSize={50} pageSizeOptions={[25, 50, 100]} emptyState={{ message: 'Aucun événement.' }} />
      </div>
    </div>
  );
}
