// Sélecteur de période partagé entre le budget, les fiches et les rapports (US #164).
// Deux axes : TYPE (année calendaire, trimestre, année fiscale) x FENETRE (précédent, en cours, suivant).
// L'année fiscale est ancrée sur debut_exercice_fiscal de l'organisation fournie (défaut 1er janvier).
// Expose via onChange la période résolue par src/utils/periode.js :
//   { type, fenetre, debut: Date, fin: Date, dateDebut: 'YYYY-MM-DD', dateFin: 'YYYY-MM-DD', label, cle }
//
// Mode non contrôlé (défaut) : le composant porte type et fenêtre.
//   <PeriodeSelector societe={societe} onChange={setPeriode} />
// Mode contrôlé : le parent porte type et fenêtre (ex. depuis usePeriode ou des query params).
//   <PeriodeSelector type={type} fenetre={fenetre} onTypeChange={setType} onFenetreChange={setFenetre} societe={societe} onChange={setPeriode} />
import { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar } from 'lucide-react';
import {
  TYPES_PERIODE, FENETRES_PERIODE, resoudrePeriode, normaliserDebutExercice, formatBornes,
} from '../../utils/periode';

const SELECT_CLS = 'text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function PeriodeSelector({
  // Mode contrôlé (optionnel)
  type: typeControle,
  fenetre: fenetreControlee,
  onTypeChange,
  onFenetreChange,
  // Mode non contrôlé
  defaultType = 'calendaire',
  defaultFenetre = 'courant',
  // Source de l'exercice fiscal : debutExercice explicite prime, sinon societe.debut_exercice_fiscal, sinon 01/01
  societe = null,
  debutExercice = null,
  // Sous-ensemble de types proposes (ex. ['calendaire', 'fiscale'] pour un rapport annuel)
  types = null,
  // Callback recevant la période résolue à chaque changement (type, fenetre, exercice)
  onChange,
  afficherBornes = true,
  className = '',
}) {
  const [typeInterne, setTypeInterne] = useState(defaultType);
  const [fenetreInterne, setFenetreInterne] = useState(defaultFenetre);
  const type = typeControle ?? typeInterne;
  const fenetre = fenetreControlee ?? fenetreInterne;

  const typesProposes = useMemo(
    () => (types ? TYPES_PERIODE.filter(t => types.includes(t.value)) : TYPES_PERIODE),
    [types]
  );

  // Memo sur jour/mois : les objets société changent d'identité à chaque rechargement API.
  const { jour, mois } = normaliserDebutExercice(debutExercice ?? societe);
  const periode = useMemo(
    () => resoudrePeriode({ type, fenetre, debutExercice: { jour, mois } }),
    [type, fenetre, jour, mois]
  );

  // Ref sur onChange : un parent qui passe une fonction inline ne doit pas rejouer l'effet à chaque rendu.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    onChangeRef.current?.(periode);
  }, [periode]);

  function changerType(v) {
    if (onTypeChange) onTypeChange(v);
    if (typeControle === undefined) setTypeInterne(v);
  }

  function changerFenetre(v) {
    if (onFenetreChange) onFenetreChange(v);
    if (fenetreControlee === undefined) setFenetreInterne(v);
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <Calendar size={16} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
      <select
        value={type}
        onChange={e => changerType(e.target.value)}
        className={SELECT_CLS}
        aria-label="Type de période"
      >
        {typesProposes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <select
        value={fenetre}
        onChange={e => changerFenetre(e.target.value)}
        className={SELECT_CLS}
        aria-label="Fenêtre temporelle"
      >
        {FENETRES_PERIODE.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      {afficherBornes && (
        <span className="text-sm text-gray-500 dark:text-gray-400" title={periode.label}>
          {formatBornes(periode)}
        </span>
      )}
    </div>
  );
}
