// CustomReportBuilderPage - Constructeur de rapport personnalise - SamSecure v0.5
// Route : /rapports/personnalise
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, Play, FolderOpen, RotateCcw } from 'lucide-react';
import BuilderLayout from '../../components/rapports/builder/BuilderLayout';
import BuilderDomainSection from '../../components/rapports/builder/BuilderDomainSection';
import BuilderPeriodSection from '../../components/rapports/builder/BuilderPeriodSection';
import BuilderFiltersSection from '../../components/rapports/builder/BuilderFiltersSection';
import BuilderColumnsSection from '../../components/rapports/builder/BuilderColumnsSection';
import BuilderGroupSection from '../../components/rapports/builder/BuilderGroupSection';
import BuilderSortSection from '../../components/rapports/builder/BuilderSortSection';
import BuilderChartSection from '../../components/rapports/builder/BuilderChartSection';
import BuilderOptionsSection from '../../components/rapports/builder/BuilderOptionsSection';
import BuilderPreview from '../../components/rapports/builder/BuilderPreview';
import SavedTemplatesPanel from '../../components/rapports/builder/SavedTemplatesPanel';
import {
  getDomainesOptions, getChampsByType, getChampsDates, getChampsNumeriques,
  fieldsDictionary,
} from '../../data/reportFieldsDictionary';
import {
  getPeriodeAnneeCalendaire, getExercicesFiscaux, getPeriodeTroisDerniersMois, getPeriodeMois,
} from '../../utils/periodUtils';

const DOMAINES = getDomainesOptions();

const CONFIG_INITIALE = {
  domaine: '',
  periode: { mode: 'annee_calendaire', annee: new Date().getFullYear() },
  champDate: null,
  filtres: [],
  logiqueFiltres: 'ET',
  colonnes: [],
  groupement: null,
  granularite: null,
  aggregations: [],
  tri: [],
  graphique: null,
  options: { titre: '', description: '', lignesMax: 'toutes', afficherNumerosLignes: false },
};

function resolvePeriode(periodeConfig) {
  if (!periodeConfig) return null;
  const { mode, annee, exerciceIdx, moisAnnee, moisMois, persoDebut, persoFin } = periodeConfig;
  const exercices = getExercicesFiscaux();
  switch (mode) {
    case 'annee_calendaire': return getPeriodeAnneeCalendaire(annee ?? new Date().getFullYear());
    case 'annee_fiscale':    return exercices[exerciceIdx ?? exercices.length - 1] ?? exercices[0];
    case 'trois_mois':       return getPeriodeTroisDerniersMois();
    case 'mois':             return getPeriodeMois(moisAnnee ?? new Date().getFullYear(), moisMois ?? 1);
    case 'personnalisee':    return persoDebut && persoFin ? { dateDebut: persoDebut, dateFin: persoFin } : null;
    default: return null;
  }
}

const SECTIONS = [
  { id: 'domaine',  label: 'Source' },
  { id: 'periode',  label: 'Période' },
  { id: 'filtres',  label: 'Filtres' },
  { id: 'colonnes', label: 'Colonnes' },
  { id: 'groupe',   label: 'Regroupement' },
  { id: 'tri',      label: 'Tri' },
  { id: 'graphique', label: 'Graphique' },
  { id: 'options',  label: 'Options' },
];

export default function CustomReportBuilderPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(CONFIG_INITIALE);
  const [templatesPanelOpen, setTemplatesPanelOpen] = useState(false);
  const [sectionOuverte, setSectionOuverte] = useState('domaine');

  const champs = useMemo(() => getChampsByType(config.domaine), [config.domaine]);
  const champsDate = useMemo(() => getChampsDates(config.domaine), [config.domaine]);
  const champsNumeriques = useMemo(() => getChampsNumeriques(config.domaine), [config.domaine]);
  const colonnesDefaut = useMemo(() => fieldsDictionary[config.domaine]?.colonnesDefaut ?? [], [config.domaine]);

  function updateConfig(patch) {
    setConfig(prev => ({ ...prev, ...patch }));
  }

  // Quand on change de domaine : reinitialiser colonnes, filtres, etc.
  function changerDomaine(domaine) {
    const def = fieldsDictionary[domaine]?.colonnesDefaut ?? [];
    setConfig(prev => ({
      ...CONFIG_INITIALE,
      periode: prev.periode,
      options: prev.options,
      domaine,
      colonnes: def,
      champDate: fieldsDictionary[domaine]?.champDateDefaut ?? null,
    }));
    setSectionOuverte('periode');
  }

  function generer() {
    const periode = resolvePeriode(config.periode);
    const configPourSession = {
      ...config,
      periode,
      titre: config.options?.titre || 'Rapport personnalisé',
    };
    sessionStorage.setItem('ss_custom_report_config', JSON.stringify(configPourSession));
    const params = new URLSearchParams();
    if (periode?.dateDebut) params.set('du', periode.dateDebut);
    if (periode?.dateFin) params.set('au', periode.dateFin);
    navigate(`/rapports/vue/custom?${params.toString()}`);
  }

  function reinitialiser() {
    setConfig(CONFIG_INITIALE);
    setSectionOuverte('domaine');
  }

  function toggleSection(id) {
    setSectionOuverte(prev => prev === id ? null : id);
  }

  function renderSection(id) {
    switch (id) {
      case 'domaine':
        return (
          <BuilderDomainSection
            domaines={DOMAINES}
            value={config.domaine}
            onChange={changerDomaine}
          />
        );
      case 'periode':
        return (
          <BuilderPeriodSection
            periode={config.periode}
            onChange={periode => updateConfig({ periode })}
            champDate={config.champDate}
            onChampDateChange={v => updateConfig({ champDate: v })}
            champsDateOptions={champsDate}
          />
        );
      case 'filtres':
        return (
          <BuilderFiltersSection
            champs={champs}
            filtres={config.filtres}
            logique={config.logiqueFiltres}
            onFiltresChange={filtres => updateConfig({ filtres })}
            onLogiqueChange={logique => updateConfig({ logiqueFiltres: logique })}
          />
        );
      case 'colonnes':
        return (
          <BuilderColumnsSection
            champsDisponibles={champs}
            colonnes={config.colonnes}
            onChange={colonnes => updateConfig({ colonnes })}
          />
        );
      case 'groupe':
        return (
          <BuilderGroupSection
            champs={champs}
            champsNumeriques={champsNumeriques}
            groupement={config.groupement}
            granularite={config.granularite}
            aggregations={config.aggregations}
            onChange={patch => updateConfig(patch)}
          />
        );
      case 'tri':
        return (
          <BuilderSortSection
            champs={champs}
            tri={config.tri}
            onChange={tri => updateConfig({ tri })}
          />
        );
      case 'graphique':
        return (
          <BuilderChartSection
            graphique={config.graphique}
            onGraphiqueChange={graphique => updateConfig({ graphique })}
            groupementActif={!!config.groupement}
            champsNumeriques={champsNumeriques}
          />
        );
      case 'options':
        return (
          <BuilderOptionsSection
            options={config.options}
            onChange={options => updateConfig({ options })}
          />
        );
      default: return null;
    }
  }

  const canGenerer = !!config.domaine && config.colonnes.length > 0;

  const configPanel = (
    <div className="flex flex-col h-full">
      {/* En-tete */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h1 className="font-bold text-gray-900 dark:text-white text-base">Rapport personnalisé</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTemplatesPanelOpen(true)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <FolderOpen className="w-3.5 h-3.5" />
            Modeles
          </button>
          <button onClick={reinitialiser} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Sections accordeon */}
      <div className="flex-1 overflow-y-auto">
        {SECTIONS.map(section => (
          <div key={section.id} className="border-b border-gray-100 dark:border-gray-700/50">
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <span>{section.label}</span>
              <span className="text-gray-400 text-xs">{sectionOuverte === section.id ? '▲' : '▼'}</span>
            </button>
            {sectionOuverte === section.id && (
              <div className="px-5 pb-5 pt-1">
                {!config.domaine && section.id !== 'domaine' ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">Choisissez d'abord une source de données.</p>
                ) : renderSection(section.id)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bouton generer */}
      <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={generer}
          disabled={!canGenerer}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
        >
          <Play className="w-4 h-4" />
          Générer le rapport
        </button>
        {!canGenerer && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
            {!config.domaine ? 'Choisissez une source de données.' : 'Sélectionnez au moins une colonne.'}
          </p>
        )}
      </div>
    </div>
  );

  const previewPanel = (
    <BuilderPreview
      config={config}
      champsDisponibles={champs}
    />
  );

  return (
    <>
      <BuilderLayout config={configPanel} preview={previewPanel} />
      <SavedTemplatesPanel
        isOpen={templatesPanelOpen}
        onClose={() => setTemplatesPanelOpen(false)}
        onCharger={cfg => setConfig({ ...CONFIG_INITIALE, ...cfg })}
        configActuelle={config}
      />
    </>
  );
}
