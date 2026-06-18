// GlobalSearch - Section 7 Specs UX v0.5
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, FileText, Shield, Users, Store } from 'lucide-react';
import useDebounce from '../../hooks/useDebounce';
import useAuth from '../../hooks/useAuth';
import { mockEditeurs, mockContrats, mockLicences, mockSocietes } from '../../data/mockSettings';
import { mockUsers } from '../../data/mockUsers';

const CATEGORIES = [
  { key: 'editeurs', label: 'EDITEURS', icon: Building2, path: () => '/referentiels/editeurs' },
  { key: 'contrats', label: 'CONTRATS', icon: FileText, path: () => '/contrats/liste' },
  { key: 'licences', label: 'LICENCES', icon: Shield, path: () => '/conformite/licences' },
  { key: 'utilisateurs', label: 'UTILISATEURS', icon: Users, path: () => '/admin/users' },
  { key: 'societes', label: 'SOCIÉTÉS', icon: Store, path: () => '/admin/settings' },
];

function search(query, profil) {
  const q = query.toLowerCase().trim();
  if (q.length < 3) return {};
  return {
    editeurs: mockEditeurs.filter(e => e.raison_sociale.toLowerCase().includes(q)).slice(0, 5),
    contrats: mockContrats.filter(c => c.label.toLowerCase().includes(q)).slice(0, 5),
    licences: mockLicences.filter(l => l.produit.toLowerCase().includes(q)).slice(0, 5),
    utilisateurs: profil === 'manager_dsi'
      ? mockUsers.filter(u => `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(q)).slice(0, 5)
      : [],
    societes: mockSocietes.filter(s => s.raison_sociale.toLowerCase().includes(q) || s.siret.includes(q)).slice(0, 5),
  };
}

function getLabel(cat, item) {
  const map = { editeurs: 'raison_sociale', contrats: 'label', licences: 'produit', utilisateurs: null, societes: 'raison_sociale' };
  if (cat === 'utilisateurs') return `${item.prenom} ${item.nom}`;
  return item[map[cat]];
}

export default function GlobalSearch() {
  const { profil } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const results = debouncedQuery.length >= 3 ? search(debouncedQuery, profil) : {};
  const allItems = CATEGORIES.flatMap(cat => (results[cat.key] ?? []).map(item => ({ cat: cat.key, item })));
  const hasResults = allItems.length > 0;

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

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setQuery(''); setOpen(false); inputRef.current?.blur(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, allItems.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)); }
    if (e.key === 'Enter' && cursor >= 0 && allItems[cursor]) {
      const { cat } = allItems[cursor];
      const catDef = CATEGORIES.find(c => c.key === cat);
      navigate(catDef.path());
      setOpen(false); setQuery('');
    }
  }

  const totalResults = allItems.length;

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-gray-800 transition-colors w-52 md:w-64">
        <Search size={14} className="text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher… (Ctrl+K)"
          aria-label="Recherche globale"
          className="bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none w-full"
        />
      </div>

      {open && debouncedQuery.length >= 3 && (
        <div ref={panelRef} className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-[9998] max-h-96 overflow-y-auto">
          {hasResults ? (
            CATEGORIES.map(cat => {
              const items = results[cat.key] ?? [];
              if (!items.length) return null;
              const Icon = cat.icon;
              return (
                <div key={cat.key}>
                  <p className="px-4 py-2 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">{cat.label} ({items.length})</p>
                  {items.map((item, i) => {
                    const globalIdx = allItems.findIndex(a => a.cat === cat.key && a.item === item);
                    return (
                      <button
                        key={item.id}
                        onClick={() => { navigate(cat.path()); setOpen(false); setQuery(''); }}
                        className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors ${cursor === globalIdx ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      >
                        <Icon size={14} className="flex-shrink-0 text-gray-400" />
                        <span className="truncate">{getLabel(cat.key, item)}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          ) : (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              Aucun résultat pour « {debouncedQuery} »
            </div>
          )}
        </div>
      )}
    </div>
  );
}
