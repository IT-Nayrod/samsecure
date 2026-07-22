// ReportKPIs - Bandeau de KPIs d'un rapport genere - SamSecure v0.5
const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtNb = new Intl.NumberFormat('fr-FR');

function formaterValeur(valeur, format) {
  if (valeur == null) return '-';
  switch (format) {
    case 'montant':          return fmt.format(valeur);
    case 'nombre':           return fmtNb.format(valeur);
    case 'nombre_signe':     return (valeur >= 0 ? '+' : '') + fmtNb.format(valeur);
    case 'pourcentage':      return `${valeur >= 0 ? '+' : ''}${valeur.toFixed(1)} %`;
    case 'pourcentage_signe': return (valeur == null ? '-' : (valeur >= 0 ? '+' : '') + valeur.toFixed(1) + ' %');
    case 'taux_usage':       return `${(valeur * 100).toFixed(0)} %`;
    case 'texte':            return String(valeur);
    default:                 return String(valeur);
  }
}

const COULEUR_CLASSES = {
  vert:   'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300',
  orange: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300',
  rouge:  'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300',
  null:   'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300',
};

export default function ReportKPIs({ kpisDef, kpisData }) {
  if (!kpisDef?.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-6">
      {kpisDef.map(kpi => {
        const valeur = kpisData?.[kpi.key];
        const couleurKey = kpi.couleur ?? 'null';
        const classes = COULEUR_CLASSES[couleurKey] ?? COULEUR_CLASSES['null'];
        return (
          <div key={kpi.key} className={`border rounded-xl p-4 flex flex-col gap-1 ${classes}`}>
            <p className="text-xs font-medium opacity-70 leading-tight">{kpi.label}</p>
            <p className="text-2xl font-bold tabular-nums">{formaterValeur(valeur, kpi.format)}</p>
          </div>
        );
      })}
    </div>
  );
}
