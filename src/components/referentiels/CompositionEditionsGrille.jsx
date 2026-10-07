// CompositionEditionsGrille - grille « composants en lignes, éditions en
// colonnes » de la fiche d'un logiciel composé (#279, décision client du
// 06/10/2026 : Office Standard et Office Pro diffèrent par Access).
//
// Pré-remplie depuis la composition par défaut : toute case cochée, aucune
// saisie requise pour un composé sans exception. Seules les différences au
// défaut partent au serveur (PUT /logiciels/:id/composition-editions), qui
// normalise et reste seul juge ; ses refus sont affichés tels quels. Une
// ligne « propre à des éditions » (hors défaut) disparaît de la grille quand
// plus aucune édition ne l'inclut après enregistrement.
import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { logicielsService } from '../../services/referentielsService';
import Button from '../ui/Button';
import { useToast } from '../../hooks/useToast';

// État initial depuis la fiche : composants du défaut (cochés partout), puis
// composants hors défaut présents dans les exceptions, enfin les exceptions
// elles-mêmes posées sur les cases.
function construire(produit) {
  const editions = produit.editions ?? [];
  const exceptions = produit.composition_exceptions ?? [];
  const lignes = (produit.composants ?? []).map(c => ({
    id: c.id, label: c.label ?? 'Logiciel introuvable', auDefaut: true,
  }));
  const vus = new Set(lignes.map(l => l.id));
  for (const x of exceptions) {
    if (x.inclus && !vus.has(x.id_produit_composant)) {
      vus.add(x.id_produit_composant);
      lignes.push({
        id: x.id_produit_composant,
        label: x.composant_label ?? 'Logiciel introuvable',
        auDefaut: false,
      });
    }
  }
  const coches = {};
  for (const l of lignes) for (const e of editions) coches[`${l.id}|${e.id}`] = l.auDefaut;
  for (const x of exceptions) {
    const cle = `${x.id_produit_composant}|${x.id_edition}`;
    if (cle in coches) coches[cle] = x.inclus;
  }
  return { lignes, coches };
}

// Différences au défaut, seules enregistrées : case cochée d'un composant
// hors défaut (inclus) ou décochée d'un composant du défaut (exclu).
function differences(lignes, coches, editions) {
  const liste = [];
  for (const l of lignes) {
    for (const e of editions) {
      const coche = !!coches[`${l.id}|${e.id}`];
      if (coche !== l.auDefaut) {
        liste.push({ id_edition: e.id, id_produit_composant: l.id, inclus: coche });
      }
    }
  }
  return liste.sort((a, b) =>
    `${a.id_produit_composant}|${a.id_edition}`.localeCompare(`${b.id_produit_composant}|${b.id_edition}`));
}

export default function CompositionEditionsGrille({ produit, canWrite, candidats, onSaved }) {
  const { addToast } = useToast();
  const editions = produit.editions ?? [];
  const [etat, setEtat] = useState(() => construire(produit));
  const [ajout, setAjout] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => { setEtat(construire(produit)); setAjout(''); }, [produit]);

  const initiales = useMemo(() => {
    const base = construire(produit);
    return JSON.stringify(differences(base.lignes, base.coches, editions));
  }, [produit, editions]);
  const actuelles = differences(etat.lignes, etat.coches, editions);
  const modifie = JSON.stringify(actuelles) !== initiales;

  // Candidats d'une ligne hors défaut : ceux du sélecteur de composant,
  // moins les lignes déjà dans la grille. Le serveur reste seul juge.
  const restants = (candidats ?? []).filter(p => !etat.lignes.some(l => l.id === p.id));

  const basculer = (idComposant, idEdition) => setEtat(prev => ({
    ...prev,
    coches: { ...prev.coches, [`${idComposant}|${idEdition}`]: !prev.coches[`${idComposant}|${idEdition}`] },
  }));

  const ajouterLigne = () => {
    const choisi = restants.find(p => p.id === ajout);
    if (!choisi) return;
    setEtat(prev => {
      const coches = { ...prev.coches };
      for (const e of editions) coches[`${choisi.id}|${e.id}`] = false;
      return { lignes: [...prev.lignes, { id: choisi.id, label: choisi.label, auDefaut: false }], coches };
    });
    setAjout('');
  };

  const annuler = () => { setEtat(construire(produit)); setAjout(''); };

  const enregistrer = async () => {
    setEnregistrement(true);
    try {
      await logicielsService.saveCompositionEditions(produit.id, actuelles);
      addToast({ type: 'success', message: 'Composition par édition enregistrée.' });
      await onSaved?.();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Composition par édition</h3>
      <p className="text-xs text-gray-500 mb-3">
        Par défaut, chaque composant est couvert par toutes les éditions. Décochez une case pour
        retirer un composant d&apos;une édition, ou ajoutez un composant propre à certaines éditions.
        Une licence sans édition couvre la composition par défaut ; seules les différences sont
        enregistrées.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="py-1.5 pr-3 font-medium">Composant</th>
              <th className="py-1.5 px-3 font-medium text-center">Défaut</th>
              {editions.map(e => (
                <th key={e.id} className="py-1.5 px-3 font-medium text-center whitespace-nowrap">{e.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {etat.lignes.map(l => (
              <tr key={l.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-300">
                  {l.label}
                  {!l.auDefaut && (
                    <span className="ml-2 text-xs text-gray-400">Propre aux éditions cochées</span>
                  )}
                </td>
                <td className="py-1.5 px-3 text-center text-gray-400" aria-label={l.auDefaut ? 'Au défaut' : 'Hors défaut'}>
                  {l.auDefaut ? '✓' : ''}
                </td>
                {editions.map(e => (
                  <td key={e.id} className="py-1.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={!!etat.coches[`${l.id}|${e.id}`]}
                      onChange={() => basculer(l.id, e.id)}
                      disabled={!canWrite}
                      aria-label={`${l.label} dans l'édition ${e.label}`}
                      className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canWrite && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {restants.length > 0 && (
            <div className="flex gap-2 flex-1 min-w-56">
              <select
                value={ajout}
                onChange={e => setAjout(e.target.value)}
                aria-label="Logiciel à ajouter comme composant propre à certaines éditions"
                className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Ajouter un composant propre à certaines éditions...</option>
                {restants.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <Button variant="secondary" size="sm" onClick={ajouterLigne} disabled={!ajout}>
                <Plus size={14} /> Ajouter
              </Button>
            </div>
          )}
          {modifie && (
            <div className="flex gap-2 ml-auto">
              <Button variant="secondary" size="sm" onClick={annuler} disabled={enregistrement}>Annuler</Button>
              <Button size="sm" onClick={enregistrer} disabled={enregistrement}>Enregistrer</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
