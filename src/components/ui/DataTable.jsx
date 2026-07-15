// DataTable - Section 8 Specs UX v0.5
import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import Skeleton from './Skeleton';
import EmptyState from './EmptyState';
import { exportToCsv } from '../../utils/exportCsv';

export default function DataTable({
  columns = [],
  data = [],
  pageSize: defaultPageSize = 20,
  pageSizeOptions = [10, 20, 50],
  filename = 'export',
  isLoading = false,
  emptyState,
  viewMode = 'table',
  renderCard,
  cardsClassName = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4',
  onRowClick,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [selected, setSelected] = useState(new Set());

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  }

  function setSortKeyDirect(key) {
    setSortKey(key || null);
    setSortDir('asc');
    setPage(1);
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find(c => c.key === sortKey);
    return [...data].sort((a, b) => {
      const va = col?.getValue ? col.getValue(a) : a[sortKey];
      const vb = col?.getValue ? col.getValue(b) : b[sortKey];
      const cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'fr', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageData = sorted.slice((page - 1) * pageSize, page * pageSize);
  const allSelected = pageData.length > 0 && pageData.every(r => selected.has(r.id ?? r));
  const hasExport = columns.some(c => c.csvValue || c.key);

  function toggleAll() {
    const ids = pageData.map(r => r.id ?? r);
    if (allSelected) setSelected(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
    else setSelected(prev => { const s = new Set(prev); ids.forEach(id => s.add(id)); return s; });
  }

  function toggleRow(id) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  const start = sorted.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, sorted.length);

  const SortIcon = ({ col }) => {
    if (sortKey !== col.key) return <ArrowUpDown size={13} className="text-gray-400" />;
    return sortDir === 'asc' ? <ArrowUp size={13} className="text-blue-600" /> : <ArrowDown size={13} className="text-blue-600" />;
  };

  return (
    <div className="flex flex-col gap-0">
      {/* Top bar */}
      {hasExport && (
        <div className="flex justify-end pb-3">
          <button
            onClick={() => exportToCsv(filename, columns.filter(c => c.key && c.label && c.label !== 'Actions'), data)}
            aria-label="Exporter en CSV"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Download size={13} /> Exporter CSV
          </button>
        </div>
      )}

      {viewMode === 'cards' && renderCard ? (
        <div className="flex flex-col gap-4">
          {columns.some(c => c.sortable) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Trier par</span>
              <select
                value={sortKey ?? ''}
                onChange={e => setSortKeyDirect(e.target.value)}
                className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-white"
              >
                <option value="">Par défaut</option>
                {columns.filter(c => c.sortable).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              {sortKey && (
                <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} aria-label="Inverser l'ordre" className="p-1.5 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500">
                  {sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                </button>
              )}
            </div>
          )}
          {isLoading ? (
            <div className={cardsClassName}>
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height="h-32" />)}
            </div>
          ) : pageData.length === 0 ? (
            <EmptyState
              title={emptyState?.message ?? 'Aucun résultat'}
              description={emptyState?.description}
              ctaLabel={emptyState?.ctaLabel}
              onCta={emptyState?.onCta}
            />
          ) : (
            <div className={cardsClassName}>
              {pageData.map((row, i) => <div key={row.id ?? i}>{renderCard(row)}</div>)}
            </div>
          )}
        </div>
      ) : (
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Tout sélectionner"
                  className="rounded border-gray-300"
                />
              </th>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:text-gray-700 select-none' : ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && <SortIcon col={col} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="w-4 h-4 bg-gray-200 rounded animate-pulse" /></td>
                    {columns.map(col => (
                      <td key={col.key} className="px-4 py-3"><Skeleton height="h-4" /></td>
                    ))}
                  </tr>
                ))
              : pageData.length === 0
              ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="py-0">
                      <EmptyState
                        title={emptyState?.message ?? 'Aucun résultat'}
                        description={emptyState?.description}
                        ctaLabel={emptyState?.ctaLabel}
                        onCta={emptyState?.onCta}
                      />
                    </td>
                  </tr>
                )
              : pageData.map((row, i) => {
                  const id = row.id ?? i;
                  return (
                    <tr
                      key={id}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${selected.has(id) ? 'bg-blue-50/40' : ''} ${onRowClick ? 'cursor-pointer' : ''}`}
                    >
                      <td className="px-4 py-3" onClick={onRowClick ? e => e.stopPropagation() : undefined}>
                        <input type="checkbox" checked={selected.has(id)} onChange={() => toggleRow(id)} className="rounded border-gray-300" />
                      </td>
                      {columns.map(col => (
                        <td key={col.key} className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {col.render ? col.render(row) : (row[col.key] ?? '-')}
                        </td>
                      ))}
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>
      )}

      {/* Pagination */}
      {!isLoading && sorted.length > 0 && (
        <div className="flex items-center justify-between pt-4 text-sm text-gray-500">
          <span>{start} – {end} sur {sorted.length} résultats</span>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600"
            >
              {pageSizeOptions.map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Page précédente"
              className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pg = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`w-7 h-7 rounded text-xs ${pg === page ? 'bg-blue-800 text-white' : 'hover:bg-gray-50 border border-gray-200'}`}
                >
                  {pg}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Page suivante"
              className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
