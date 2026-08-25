// PeriodeSelector - Selecteur de periode partage (Budget, fiches, rapports) - SamSecure v0.5 - US #164
// Deux axes : TYPE (annee calendaire, trimestre, annee fiscale) x FENETRE (precedent, en cours, suivant).
// L'annee fiscale est ancree sur debut_exercice_fiscal de l'organisation fournie (defaut 1er janvier).
// Expose via onChange la periode resolue par src/utils/periode.js :
//   { type, fenetre, debut: Date, fin: Date, dateDebut: 'YYYY-MM-DD', dateFin: 'YYYY-MM-DD', label, cle }
//
// Mode non controle (defaut) : le composant porte type et fenetre.
//   <PeriodeSelector societe={societe} onChange={setPeriode} />
// Mode controle : le parent porte type et fenetre (ex. depuis usePeriode ou des query params).
//   <PeriodeSelector type={type} fenetre={fenetre} onTypeChange={setType} onFenetreChange={setFenetre} societe={societe} onChange={setPeriode} />
import { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar } from 'lucide-react';
import {
  TYPES_PERIODE, FENETRES_PERIODE, resoudrePeriode, normaliserDebutExercice, formatBornes,
} from '../../utils/periode';

const SELECT_CLS = 'text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function PeriodeSelector({
  // Mode controle (optionnel)
  type: typeControle,
  fenetre: fenetreControlee,
  onTypeChange,
  onFenetreChange,
  // Mode non controle
  defaultType = 'calendaire',
  defaultFenetre = 'courant',
  // Source de l'exercice fiscal : debutExercice explicite prime, sinon societe.debut_exercice_fiscal, sinon 01/01
  societe = null,
  debutExercice = null,
  // Sous-ensemble de types proposes (ex. ['calendaire', 'fiscale'] pour un rapport annuel)
  types = null,
  // Callback recevant la periode resolue a chaque changement (type, fenetre, exercice)
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

  // Memo sur jour/mois : les objets societe changent d'identite a chaque rechargement API.
  const { jour, mois } = normaliserDebutExercice(debutExercice ?? societe);
  const periode = useMemo(
    () => resoudrePeriode({ type, fenetre, debutExercice: { jour, mois } }),
    [type, fenetre, jour, mois]
  );

  // Ref sur onChange : un parent qui passe une fonction inline ne doit pas rejouer l'effet a chaque rendu.
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
