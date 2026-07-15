// GlobalSearch - Section 7 Specs UX v0.5 - recherche transverse, groupee par categorie via searchRegistry
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import useDebounce from '../../hooks/useDebounce';
import useAuth from '../../hooks/useAuth';
import Highlight from '../ui/Highlight';
import { SEARCH_REGISTRY } from '../../data/searchRegistry';
import { runSearch, buildSearchRegex } from '../../utils/search';

const RESULT_LIMIT = 5;
const MIN_CHARS = 2;

export default function GlobalSearch() {
  const { profil } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const debouncedQuery = useDebounce(query, 250);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  const trimmed = debouncedQuery.trim();
  const isActive = trimmed.length >= MIN_CHARS;
  const isPending = query.trim().length >= MIN_CHARS && query !== debouncedQuery;
  const groups = isActive ? runSearch(SEARCH_REGISTRY, trimmed, profil, RESULT_LIMIT) : [];
  const regex = isActive ? buildSearchRegex(trimmed) : null;
  const flatItems = groups.flatMap(g => g.items.map(item => ({ entry: g.entry, item })));
  const hasResults = flatItems.length > 0;

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    function onClick(e) {
      if (!panelRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => { setCursor(-1); }, [debouncedQuery]);

  function goTo(entry, item) {
    navigate(entry.getDetailPath(item) ?? entry.getListPath());
    setOpen(false);
    setQuery('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setQuery(''); setOpen(false); inputRef.current?.blur(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, flatItems.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)); }
    if (e.key === 'Enter' && cursor >= 0 && flatItems[cursor]) {
      const { entry, item } = flatItems[cursor];
      goTo(entry, item);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-gray-800 transition-colors w-52 md:w-64">
        <Search size={14} className="text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher... (Ctrl+K)"
          aria-label="Recherche globale"
          className="bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none w-full"
        />
        {isPending && <Loader2 size={13} className="text-gray-400 animate-spin flex-shrink-0" />}
      </div>

      {open && isActive && (
        <div ref={panelRef} className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-[9998] max-h-[28rem] overflow-y-auto">
          {hasResults ? (
            groups.map(({ entry, items, total }) => {
              const Icon = entry.icon;
              return (
                <div key={entry.key}>
                  <p className="px-4 py-2 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">{entry.label} ({total})</p>
                  {items.map(item => {
                    const globalIdx = flatItems.findIndex(f => f.entry.key === entry.key && f.item === item);
                    const context = entry.getContext(item);
                    return (
                      <button
                        key={item.id}
                        onClick={() => goTo(entry, item)}
                        className={`flex items-start gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors ${cursor === globalIdx ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      >
                        <Icon size={14} className="flex-shrink-0 text-gray-400 mt-0.5" />
                        <span className="flex flex-col min-w-0">
                          <span className="truncate"><Highlight text={entry.getResultLabel(item)} regex={regex} /></span>
                          {context && <span className="text-xs text-gray-400 truncate">{context}</span>}
                        </span>
                      </button>
                    );
                  })}
                  {total > items.length && (
                    <button
                      onClick={() => { navigate(`${entry.getListPath()}?q=${encodeURIComponent(trimmed)}`); setOpen(false); setQuery(''); }}
                      className="block w-full text-left px-4 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      Voir tous les {total} résultats
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              Aucun résultat pour « {trimmed} »
            </div>
          )}
        </div>
      )}
    </div>
  );
}
