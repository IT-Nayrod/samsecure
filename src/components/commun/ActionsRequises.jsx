// ActionsRequises - bloc « Actions requises » en tête des fiches (US #324) :
// une ligne par manque de complétude, gravité visible, bouton qui ouvre la
// modale ou l'écran qui lève le manque. Les règles vivent côté serveur
// (GET /api/completude/:type/:id, catalogue pur server/utils/completude.js) :
// mêmes règles que la détection des manques du module Preuves et que le
// résumé des compteurs.
//
// Composant autonome et accessoire : il charge sa donnée et se tait sur
// refus de droit ou panne (la fiche reste servie, même doctrine
// qu'optionnel()). Aucun bloc si la fiche est complète. La prop `version`
// est incrémentée par la fiche après chaque action (dépôt, édition,
// validation) : le bloc se recharge sans rechargement de page.
//
// `actions` : { [action.code]: fn } fourni par la fiche ; une ligne dont le
// code n'a pas de levier (droit manquant, écran absent) s'affiche sans
// bouton, le libellé dit déjà quoi faire.
//
// Surlignage (#324, alertes des listes) : le paramètre d'URL ?action=<code>
// surligne la première ligne portant cette action et la fait défiler en vue,
// sans ouvrir la modale à la place de l'utilisateur.
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { completudeService } from '../../services/completudeService';
import Button from '../ui/Button';

const GRAVITES = {
  bloquant: {
    label: 'Bloquant conformité',
    pastille: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    barre: '#EF4444',
  },
  recommande: {
    label: 'Recommandé audit',
    pastille: 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
    barre: '#F59E0B',
  },
};

export default function ActionsRequises({ type, id, version = 0, actions = {} }) {
  const [completude, setCompletude] = useState(null);
  const [searchParams] = useSearchParams();
  const actionCible = searchParams.get('action');
  const ligneCibleRef = useRef(null);
  const dejaDefile = useRef(false);

  useEffect(() => {
    let actif = true;
    completudeService.fiche(type, id)
      .then((d) => { if (actif) setCompletude(d); })
      .catch((err) => {
        console.info('[completude] bloc Actions requises non servi :', err.message);
        if (actif) setCompletude(null);
      });
    return () => { actif = false; };
  }, [type, id, version]);

  const manques = completude?.manques ?? [];

  // Défilement vers la ligne surlignée, une seule fois par ouverture de fiche.
  useEffect(() => {
    if (actionCible && !dejaDefile.current && ligneCibleRef.current) {
      ligneCibleRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      dejaDefile.current = true;
    }
  }, [manques, actionCible]);

  if (!manques.length) return null;

  let cibleAttribuee = false;

  return (
    <section
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
      aria-label="Actions requises"
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Actions requises ({manques.length})
        </h2>
        <p className="text-xs text-gray-500">
          {completude.nb_bloquants > 0 && `${completude.nb_bloquants} bloquant(s) pour la conformité`}
          {completude.nb_bloquants > 0 && completude.nb_recommandes > 0 && ', '}
          {completude.nb_recommandes > 0 && `${completude.nb_recommandes} recommandé(s) pour l'audit`}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {manques.map((m) => {
          const gravite = GRAVITES[m.gravite] ?? GRAVITES.recommande;
          const lever = actions[m.action?.code];
          const surlignee = !cibleAttribuee && actionCible && m.action?.code === actionCible;
          if (surlignee) cibleAttribuee = true;
          return (
            <li
              key={m.regle}
              ref={surlignee ? ligneCibleRef : undefined}
              className={`flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40${
                surlignee ? ' ring-2 ring-blue-500' : ''}`}
              style={{ borderLeft: `3px solid ${gravite.barre}` }}
            >
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${gravite.pastille}`}>
                  <AlertTriangle size={11} /> {gravite.label}
                </span>
                <p className="text-sm text-gray-800 dark:text-gray-200">{m.libelle}</p>
              </div>
              {lever && (
                <Button variant="secondary" size="sm" onClick={lever} className="flex-shrink-0">
                  {m.action.libelle} <ChevronRight size={14} />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
