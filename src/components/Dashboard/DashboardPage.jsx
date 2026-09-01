// DashboardPage (#192) - page principale des tableaux de bord.
//
// Selection du dashboard : inchangee (#190, "comportement en place a
// conserver"). Le dashboard affiche depend des permissions dashboard reelles
// de l'utilisateur (heritees de ses groupes, exceptions comprises) : un
// membre de 1, 2 ou 3 groupes voit 1, 2 ou 3 dashboards ; le premier
// accessible, dans l'ordre Manager DSI > Financier > IT Ops, est affiche par
// defaut, ce qui applique la regle du profil le plus eleve en multi-groupes.
//
// Nouveaute #192 : la configuration (widgets par profil, seuils, preferences)
// est chargee une fois aupres de l'API et distribuee par contexte ; le mode
// personnalisation permet de masquer et reordonner les widgets, persiste par
// PUT /dashboards/preferences.
import { useState, useMemo, useEffect, useCallback } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';
import '../../styles/dashboard.css';
import RoleSelector from './RoleSelector';
import ManagerDSIDashboard from './ManagerDSIDashboard';
import FinancierDashboard from './FinancierDashboard';
import ITOpsDashboard from './ITOpsDashboard';
import useAuth from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { DASHBOARDS } from '../../constants/permissions';
import { dashboardService } from '../../services/dashboardService';
import { ContexteDashboard } from './ContexteDashboard';
import { composerListe, ORDRES } from './composition';
import { viderSourcesDashboard } from './useSourceDashboard';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';

const COMPONENTS = {
  dsi: ManagerDSIDashboard,
  financier: FinancierDashboard,
  itops: ITOpsDashboard,
};

// Correspondance dashboard affiche -> profil porteur de sa composition.
const PROFIL_PAR_DASHBOARD = {
  dsi: 'manager_dsi',
  financier: 'financier',
  itops: 'it_ops',
};

export default function DashboardPage() {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const accessibles = useMemo(
    () => DASHBOARDS.filter((d) => hasPermission(d.permission)),
    [hasPermission]
  );
  const [role, setRole] = useState(accessibles[0]?.id ?? null);
  const [config, setConfig] = useState(null);
  const [erreurConfig, setErreurConfig] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [preferences, setPreferences] = useState([]);
  const [personnalisation, setPersonnalisation] = useState(false);

  const chargerConfiguration = useCallback(async () => {
    setChargement(true);
    setErreurConfig(null);
    try {
      const c = await dashboardService.configuration();
      setConfig(c);
      setPreferences(c?.preferences ?? []);
    } catch (err) {
      setErreurConfig(err);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    // Les sources de widgets sont rechargees a chaque visite de la page :
    // un dashboard fige d'une navigation a l'autre trahirait sa mission.
    viderSourcesDashboard();
    chargerConfiguration();
  }, [chargerConfiguration]);

  const activeId = accessibles.some((d) => d.id === role) ? role : accessibles[0]?.id;
  const profilActif = PROFIL_PAR_DASHBOARD[activeId];

  // Fusion locale puis enregistrement : l'ecran repond immediatement, l'echec
  // d'enregistrement est signale sans perdre l'affichage.
  const enregistrer = useCallback((prochaines) => {
    setPreferences((courantes) => {
      const parCode = new Map(courantes.map((p) => [p.widget_code, p]));
      for (const p of prochaines) parCode.set(p.widget_code, p);
      return [...parCode.values()];
    });
    dashboardService.enregistrerPreferences(prochaines).catch((err) => {
      addToast({ type: 'error', message: `Préférences non enregistrées : ${err.message}` });
    });
  }, [addToast]);

  const basculerVisibilite = useCallback((widgetCode) => {
    const liste = composerListe(config?.widgets?.[profilActif], preferences, ORDRES[profilActif] ?? []);
    enregistrer(liste.map((w) => ({
      widget_code: w.widget_code,
      visible: w.widget_code === widgetCode ? !w.visible : w.visible,
      position: w.position,
    })));
  }, [config, preferences, profilActif, enregistrer]);

  const deplacerWidget = useCallback((widgetCode, delta) => {
    const liste = composerListe(config?.widgets?.[profilActif], preferences, ORDRES[profilActif] ?? []);
    const index = liste.findIndex((w) => w.widget_code === widgetCode);
    const cible = index + delta;
    if (index < 0 || cible < 0 || cible >= liste.length) return;
    const reordonnee = [...liste];
    [reordonnee[index], reordonnee[cible]] = [reordonnee[cible], reordonnee[index]];
    enregistrer(reordonnee.map((w, i) => ({
      widget_code: w.widget_code, visible: w.visible, position: i * 10,
    })));
  }, [config, preferences, profilActif, enregistrer]);

  const valeurContexte = useMemo(() => ({
    seuils: config?.seuils ?? {},
    widgetsParProfil: config?.widgets ?? {},
    preferences,
    personnalisation,
    basculerVisibilite,
    deplacerWidget,
  }), [config, preferences, personnalisation, basculerVisibilite, deplacerWidget]);

  if (!accessibles.length) {
    return (
      <div className="text-center py-16 text-sm text-gray-500">
        {"Aucun dashboard n'est accessible avec vos droits actuels."}
      </div>
    );
  }

  if (chargement) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {[...Array(6)].map((_, i) => <Skeleton key={i} lines={4} height="h-8" />)}
      </div>
    );
  }

  if (erreurConfig) {
    return (
      <ErrorState
        message={erreurConfig.message}
        status={erreurConfig.status}
        onRetry={chargerConfiguration}
      />
    );
  }

  const ActiveDashboard = COMPONENTS[activeId];

  return (
    <ContexteDashboard.Provider value={valeurContexte}>
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap', marginBottom: 24,
        }}>
          {accessibles.length > 1 ? (
            <RoleSelector activeRole={activeId} onChange={setRole} options={accessibles} />
          ) : <span />}
          <button
            onClick={() => setPersonnalisation((p) => !p)}
            title={personnalisation
              ? 'Terminer la personnalisation'
              : 'Masquer ou réordonner les widgets'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600,
              color: personnalisation ? 'white' : '#7C6FCD',
              background: personnalisation ? '#7C6FCD' : '#7C6FCD14',
              border: '1px solid #7C6FCD40', borderRadius: 8,
              padding: '6px 14px', cursor: 'pointer',
            }}
          >
            {personnalisation ? <Check size={14} /> : <SlidersHorizontal size={14} />}
            {personnalisation ? 'Terminé' : 'Personnaliser'}
          </button>
        </div>
        <ActiveDashboard />
      </div>
    </ContexteDashboard.Provider>
  );
}
