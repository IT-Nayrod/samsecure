// permissions - mapping des pages/actions d'administration vers les codes
// réels du catalogue (constatés en base, module "administration") et des
// permissions de dashboard (module "dashboards", migration 010).

export const ADMIN_PERMISSIONS = {
  UTILISATEURS: 'gerer_utilisateurs',
  GROUPES: 'gerer_utilisateurs',
  EXCEPTIONS: 'gerer_exceptions_droit',
  JOURNAL: 'consulter_audit_log',
  SOCIETES: 'gerer_referentiels',
  CONNECTEURS: 'gerer_connecteurs',
};

export const ALL_ADMIN_PERMISSIONS = [...new Set(Object.values(ADMIN_PERMISSIONS))];

// Libellés et ordre des modules, fidèles à la sandbox (const MODULES,
// index.html). Un module de permission absent de cette liste (aucun cas
// connu à ce jour) est affiché sous "Autre".
export const MODULES = [
  { code: 'organisation', label: 'Organisation (référentiels)' },
  { code: 'droits_usage', label: "Droits d'usage" },
  { code: 'deploiement', label: 'Déploiement' },
  { code: 'budget', label: 'Budget' },
  { code: 'rapports', label: 'Conformité et optimisation (rapports)' },
  { code: 'administration', label: 'Administration' },
  { code: 'dashboards', label: 'Tableaux de bord' },
];

export function moduleLabel(code) {
  return MODULES.find((m) => m.code === code)?.label || code || 'Autre';
}

export const DASHBOARDS = [
  { id: 'dsi', permission: 'acceder_dashboard_manager_dsi', label: 'Manager DSI' },
  { id: 'financier', permission: 'acceder_dashboard_financier', label: 'Financier' },
  { id: 'itops', permission: 'acceder_dashboard_it_ops', label: 'IT Ops' },
];
