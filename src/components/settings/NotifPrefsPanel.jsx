// NotifPrefsPanel - section Notifications de la page Parametres (story #121).
// Tableau types x reglage du courrier (immediat, quotidien, desactive), lu et
// enregistre par l'API. La notification en application est toujours creee :
// seul le courrier se regle ici.
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import Button from '../ui/Button';
import { notificationsService } from '../../services/notificationsService';

export default function NotifPrefsPanel() {
  const { addToast } = useToast();
  const [modes, setModes] = useState([]);
  const [preferences, setPreferences] = useState([]);
  const [initiales, setInitiales] = useState({});
  const [etat, setEtat] = useState('chargement'); // chargement | pret | erreur
  const [erreur, setErreur] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const charger = useCallback(async () => {
    setEtat('chargement');
    setErreur(null);
    try {
      const r = await notificationsService.preferences();
      setModes(r?.modes ?? []);
      setPreferences(r?.preferences ?? []);
      setInitiales(Object.fromEntries((r?.preferences ?? []).map((p) => [p.type, p.courrier])));
      setEtat('pret');
    } catch (e) {
      setErreur(e?.message || 'Les préférences n\'ont pas pu être chargées.');
      setEtat('erreur');
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  function choisir(type, courrier) {
    setPreferences((prev) => prev.map((p) => (p.type === type ? { ...p, courrier } : p)));
  }

  const modifiees = preferences.filter((p) => initiales[p.type] !== p.courrier);

  async function enregistrer() {
    if (!modifiees.length) return;
    setEnregistrement(true);
    try {
      const r = await notificationsService.enregistrerPreferences(
        modifiees.map((p) => ({ type: p.type, courrier: p.courrier }))
      );
      setPreferences(r?.preferences ?? preferences);
      setInitiales(Object.fromEntries((r?.preferences ?? preferences).map((p) => [p.type, p.courrier])));
      addToast({ type: 'success', message: 'Préférences de notification enregistrées.' });
    } catch (e) {
      addToast({ type: 'error', message: e?.message || 'Les préférences n\'ont pas pu être enregistrées.' });
    } finally {
      setEnregistrement(false);
    }
  }

  if (etat === 'chargement') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-6">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Chargement des préférences…
      </div>
    );
  }

  if (etat === 'erreur') {
    return (
      <div className="flex flex-col items-start gap-3 py-4">
        <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>
        <Button variant="secondary" size="sm" onClick={charger}>
          <RefreshCw size={13} aria-hidden="true" /> Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Courriers de notification</h3>
        <p className="text-xs text-gray-500 mt-1">
          Chaque notification apparaît toujours dans l&apos;application. Choisissez ici, pour chaque type,
          si un courrier vous est envoyé immédiatement, regroupé dans le récapitulatif du matin, ou jamais.
        </p>
      </div>

      {preferences.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun type de notification disponible.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200 dark:border-gray-700">
                <th scope="col" className="py-2 pr-4 font-medium">Type de notification</th>
                {modes.map((m) => (
                  <th key={m.code} scope="col" className="py-2 px-3 font-medium text-center whitespace-nowrap">{m.libelle}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preferences.map((p) => (
                <tr key={p.type} className="border-b border-gray-100 dark:border-gray-700 last:border-0 align-top">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-gray-800 dark:text-gray-200">{p.libelle}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                  </td>
                  {modes.map((m) => (
                    <td key={m.code} className="py-3 px-3 text-center">
                      <input
                        type="radio"
                        name={`pref-${p.type}`}
                        value={m.code}
                        checked={p.courrier === m.code}
                        onChange={() => choisir(p.type, m.code)}
                        aria-label={`${p.libelle} : ${m.libelle}`}
                        className="h-4 w-4 accent-blue-700 cursor-pointer"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={enregistrer} isLoading={enregistrement} disabled={!modifiees.length}>
          Enregistrer
        </Button>
        {modifiees.length > 0 && (
          <span className="text-xs text-gray-500">
            {modifiees.length > 1 ? `${modifiees.length} réglages modifiés` : '1 réglage modifié'}
          </span>
        )}
      </div>
    </div>
  );
}
