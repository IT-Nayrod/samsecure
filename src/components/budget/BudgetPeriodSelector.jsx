// BudgetPeriodSelector - Section Budget - SamSecure v0.5
import { useState, useEffect, useCallback } from 'react';
import { getDebutExerciceFiscal, getExerciceFiscalKey, getExerciceFiscalRange } from '../../utils/fiscalPeriod';

const SELECT_CLS = 'text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

function computePeriod(type, fenetre) {
  const now = new Date();
  const offset = fenetre === 'courant' ? 0 : fenetre === 'precedent' ? -1 : 1;

  if (type === 'calendaire') {
    const year = now.getFullYear() + offset;
    return {
      debut: new Date(year, 0, 1),
      fin: new Date(year, 11, 31),
      label: `Annee ${year}`,
    };
  }

  if (type === 'trimestre') {
    const q = Math.floor(now.getMonth() / 3);
    let targetQ = q + offset;
    let year = now.getFullYear();
    if (targetQ < 0) { targetQ += 4; year -= 1; }
    if (targetQ >= 4) { targetQ -= 4; year += 1; }
    const startMonth = targetQ * 3;
    const fin = new Date(year, startMonth + 3, 0);
    return {
      debut: new Date(year, startMonth, 1),
      fin,
      label: `T${targetQ + 1} ${year}`,
    };
  }

  // fiscale
  const key = getExerciceFiscalKey(null, offset);
  const range = getExerciceFiscalRange(key, null);
  const debutEx = getDebutExerciceFiscal(null);
  const yearEnd = new Date(Number(key) + 1, debutEx.mois - 1, debutEx.jour);
  yearEnd.setDate(yearEnd.getDate() - 1);
  const yearLabel = debutEx.mois === 1 ? key : `${key}/${Number(key) + 1}`;
  return { ...range, label: `Exercice fiscal ${yearLabel}` };
}

export default function BudgetPeriodSelector({ onChange }) {
  const [type, setType] = useState('calendaire');
  const [fenetre, setFenetre] = useState('courant');

  const notify = useCallback((t, f) => {
    onChange(computePeriod(t, f));
  }, [onChange]);

  useEffect(() => {
    notify(type, fenetre);
  }, [type, fenetre, notify]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={type}
        onChange={e => setType(e.target.value)}
        className={SELECT_CLS}
        aria-label="Type de periode"
      >
        <option value="calendaire">Annee calendaire</option>
        <option value="trimestre">Trimestre</option>
        <option value="fiscale">Annee fiscale</option>
      </select>
      <select
        value={fenetre}
        onChange={e => setFenetre(e.target.value)}
        className={SELECT_CLS}
        aria-label="Fenetre temporelle"
      >
        <option value="courant">En cours</option>
        <option value="precedent">Precedent</option>
        <option value="suivant">Suivant</option>
      </select>
    </div>
  );
}
