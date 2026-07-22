// BuilderFiltersSection - Gestion des filtres dynamiques - SamSecure v0.5
import { Plus, X } from 'lucide-react';

const OPERATEURS_TEXTE = [
  { value: 'contient',         label: 'contient' },
  { value: 'ne_contient_pas',  label: 'ne contient pas' },
  { value: 'est',              label: 'est egal a' },
  { value: 'commence_par',     label: 'commence par' },
  { value: 'est_vide',         label: 'est vide' },
  { value: 'nest_pas_vide',    label: "n'est pas vide" },
];
const OPERATEURS_NOMBRE = [
  { value: 'egal',              label: '=' },
  { value: 'different',         label: '!=' },
  { value: 'superieur',         label: '>' },
  { value: 'superieur_ou_egal', label: '>=' },
  { value: 'inferieur',         label: '<' },
  { value: 'inferieur_ou_egal', label: '<=' },
  { value: 'est_vide',          label: 'est vide' },
];
const OPERATEURS_DATE = [
  { value: 'avant',         label: 'avant le' },
  { value: 'apres',         label: 'apres le' },
  { value: 'est',           label: 'egal a' },
  { value: 'est_vide',      label: 'est vide' },
  { value: 'nest_pas_vide', label: "n'est pas vide" },
];
const OPERATEURS_ENUM = [
  { value: 'est',     label: 'est' },
  { value: 'nest_pas', label: "n'est pas" },
];
const OPERATEURS_BOOLEEN = [
  { value: 'est_vrai', label: 'est vrai' },
  { value: 'est_faux', label: 'est faux' },
];

function getOperateurs(type) {
  switch (type) {
    case 'nombre':
    case 'montant':  return OPERATEURS_NOMBRE;
    case 'date':     return OPERATEURS_DATE;
    case 'enum':     return OPERATEURS_ENUM;
    case 'booleen':  return OPERATEURS_BOOLEEN;
    default:         return OPERATEURS_TEXTE;
  }
}

function avecValeur(operateur) {
  return !['est_vide','nest_pas_vide','est_vrai','est_faux'].includes(operateur);
}

export default function BuilderFiltersSection({ champs, filtres, logique, onFiltresChange, onLogiqueChange }) {
  function ajouterFiltre() {
    const premierChamp = champs[0];
    if (!premierChamp) return;
    const ops = getOperateurs(premierChamp.type);
    onFiltresChange([...filtres, { champ: premierChamp.key, operateur: ops[0].value, valeur: '' }]);
  }

  function modifierFiltre(idx, patch) {
    onFiltresChange(filtres.map((f, i) => i === idx ? { ...f, ...patch } : f));
  }

  function supprimerFiltre(idx) {
    onFiltresChange(filtres.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Filtres</h3>
        {filtres.length > 1 && (
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
            {['ET', 'OU'].map(l => (
              <button
                key={l}
                type="button"
                onClick={() => onLogiqueChange(l)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${logique === l ? 'bg-white dark:bg-gray-600 shadow font-medium' : 'text-gray-500'}`}
              >
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {filtres.map((f, idx) => {
          const champDef = champs.find(c => c.key === f.champ);
          const type = champDef?.type ?? 'texte';
          const ops = getOperateurs(type);
          return (
            <div key={idx} className="flex flex-col gap-1.5 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-1.5">
                {/* Champ */}
                <select
                  value={f.champ}
                  onChange={e => {
                    const c = champs.find(c2 => c2.key === e.target.value);
                    const newOps = getOperateurs(c?.type ?? 'texte');
                    modifierFiltre(idx, { champ: e.target.value, operateur: newOps[0].value, valeur: '' });
                  }}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 min-w-0"
                >
                  {champs.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                <button type="button" onClick={() => supprimerFiltre(idx)} className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Operateur */}
              <select
                value={f.operateur}
                onChange={e => modifierFiltre(idx, { operateur: e.target.value, valeur: '' })}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              >
                {ops.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
              </select>
              {/* Valeur */}
              {avecValeur(f.operateur) && (
                type === 'enum' && champDef?.valeurs ? (
                  <select
                    value={f.valeur}
                    onChange={e => modifierFiltre(idx, { valeur: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  >
                    <option value="">-- Choisir --</option>
                    {champDef.valeurs.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : type === 'date' ? (
                  <input type="date" value={f.valeur} onChange={e => modifierFiltre(idx, { valeur: e.target.value })} className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
                ) : (type === 'nombre' || type === 'montant') ? (
                  <input type="number" value={f.valeur} onChange={e => modifierFiltre(idx, { valeur: e.target.value })} className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
                ) : (
                  <input type="text" value={f.valeur} onChange={e => modifierFiltre(idx, { valeur: e.target.value })} placeholder="Valeur..." className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
                )
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={ajouterFiltre}
        disabled={!champs.length}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 rounded-lg hover:border-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus className="w-3.5 h-3.5" />
        Ajouter un filtre
      </button>
    </div>
  );
}
