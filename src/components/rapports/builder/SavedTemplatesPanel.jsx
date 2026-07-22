// SavedTemplatesPanel - Tiroir de gestion des modeles sauvegardes - SamSecure v0.5
// Cle localStorage : 'ss_report_templates'
import { useState, useEffect } from 'react';
import { X, Trash2, Download, FolderOpen } from 'lucide-react';

const STORAGE_KEY = 'ss_report_templates';

function chargerModeles() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function sauvegarderModeles(liste) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(liste));
}

export default function SavedTemplatesPanel({ isOpen, onClose, onCharger, configActuelle }) {
  const [modeles, setModeles] = useState([]);
  const [nomNouveauModele, setNomNouveauModele] = useState('');

  useEffect(() => {
    if (isOpen) setModeles(chargerModeles());
  }, [isOpen]);

  function sauvegarder() {
    const nom = nomNouveauModele.trim();
    if (!nom || !configActuelle) return;
    const nouvelleListre = [...modeles, { id: `tpl-${Date.now()}`, nom, date: new Date().toISOString().slice(0, 10), config: configActuelle }];
    sauvegarderModeles(nouvelleListre);
    setModeles(nouvelleListre);
    setNomNouveauModele('');
  }

  function supprimer(id) {
    const liste = modeles.filter(m => m.id !== id);
    sauvegarderModeles(liste);
    setModeles(liste);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-80 bg-white dark:bg-gray-800 shadow-xl flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Modeles sauvegardes</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sauvegarder config actuelle */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Sauvegarder la configuration actuelle</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={nomNouveauModele}
              onChange={e => setNomNouveauModele(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sauvegarder()}
              placeholder="Nom du modele..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 min-w-0"
            />
            <button
              onClick={sauvegarder}
              disabled={!nomNouveauModele.trim()}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
            >
              Sauver
            </button>
          </div>
        </div>

        {/* Liste des modeles */}
        <div className="flex-1 overflow-y-auto">
          {modeles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400 dark:text-gray-500">
              <FolderOpen className="w-8 h-8" />
              <p className="text-sm">Aucun modele sauvegarde</p>
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-700">
              {modeles.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{m.nom}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{m.date} - {m.config?.domaine ?? '?'}</p>
                  </div>
                  <button
                    onClick={() => { onCharger(m.config); onClose(); }}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Charger"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => supprimer(m.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
