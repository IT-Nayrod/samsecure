// PeriodeFiscaleSelector - selecteur de periode partage (Commandes, Dashboard, Budget)
// Resout la periode choisie en plage de dates concretes via resolveFiscalPeriod et expose { key, debut, fin, label }
import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { PERIODE_OPTIONS, resolveFiscalPeriod, formatPeriodeLabel } from '../../utils/fiscalPeriod';

const SELECT_CLS = 'text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function PeriodeFiscaleSelector({ societeId = null, defaultPeriode = 'fiscale_courante', onChange }) {
  const [periodeKey, setPeriodeKey] = useState(defaultPeriode);
  const [customDebut, setCustomDebut] = useState('');
  const [customFin, setCustomFin] = useState('');

  useEffect(() => {
    const range = resolveFiscalPeriod(periodeKey, { societeId, customDebut, customFin });
    onChange?.({ key: periodeKey, debut: range.debut, fin: range.fin, label: formatPeriodeLabel(range) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodeKey, societeId, customDebut, customFin]);

  const range = resolveFiscalPeriod(periodeKey, { societeId, customDebut, customFin });

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
      <Calendar size={16} className="text-gray-400 flex-shrink-0" />
      <select value={periodeKey} onChange={e => setPeriodeKey(e.target.value)} className={SELECT_CLS}>
        {PERIODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {periodeKey === 'personnalisee' ? (
        <div className="flex items-center gap-2">
          <input type="date" value={customDebut} onChange={e => setCustomDebut(e.target.value)} className={SELECT_CLS} />
          <span className="text-sm text-gray-500">au</span>
          <input type="date" value={customFin} onChange={e => setCustomFin(e.target.value)} className={SELECT_CLS} />
        </div>
      ) : (
        <span className="text-sm text-gray-500">{formatPeriodeLabel(range)}</span>
      )}
    </div>
  );
}
