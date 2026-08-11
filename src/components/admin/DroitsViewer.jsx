// DroitsViewer - visionneuse des droits effectifs d'un utilisateur, par
// société de son rattachement. Reprend les badges de source de la sandbox :
// hérité d'un groupe, accordé par exception, retiré par exception, non accordé.
import { useState, useEffect, useMemo } from 'react';
import SlideOver from '../ui/SlideOver';
import { useToast } from '../../hooks/useToast';
import { droitsService, permissionsService, exceptionsService } from '../../services/adminService';
import { formatDate } from '../../utils/dateUtils';
import { MODULES } from '../../constants/permissions';

// Libellés fidèles à renderSourceBadge (sandbox, index.html).
const SOURCE_CONFIG = {
  profil: { label: 'Accordé · Groupe', cls: 'bg-blue-100 text-blue-800' },
  exceptionaccorde: { label: 'Accordé · Exception', cls: 'bg-green-100 text-green-800' },
  exceptionretire: { label: 'Retiré · Exception', cls: 'bg-red-100 text-red-800' },
  aucun: { label: 'Non accordé', cls: 'bg-gray-100 text-gray-500' },
};

function SourceBadge({ source }) {
  const cfg = SOURCE_CONFIG[source] || SOURCE_CONFIG.aucun;
  return <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

export default function DroitsViewer({ isOpen, onClose, user, societes, userSocieteIds }) {
  const { addToast } = useToast();
  const isTenantScope = userSocieteIds.includes(null) || userSocieteIds.length === 0;
  const selectable = isTenantScope ? societes : societes.filter((s) => userSocieteIds.includes(s.id));

  const [societeId, setSocieteId] = useState(selectable[0]?.id || '');
  const [mode, setMode] = useState('tous'); // 'tous' | 'attribues'
  const [catalogue, setCatalogue] = useState([]);
  const [droits, setDroits] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSocieteId(selectable[0]?.id || '');
    permissionsService.list().then(setCatalogue).catch((err) => addToast({ type: 'error', message: err.message }));
    exceptionsService.listForUser(user.id).then(setExceptions).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id]);

  useEffect(() => {
    if (!isOpen || !societeId) return;
    setLoading(true);
    droitsService.effectifs(user.id, societeId)
      .then(setDroits)
      .catch((err) => addToast({ type: 'error', message: err.message }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, societeId, user?.id]);

  const rows = useMemo(() => {
    const byPermId = new Map((droits?.droits || []).map((d) => [d.permission.id, d]));
    return catalogue.map((perm) => {
      const entry = byPermId.get(perm.id);
      return {
        permission: perm,
        source: entry?.source || 'aucun',
        effectif: entry?.effectif ?? false,
        redondante: entry?.redondante ?? false,
      };
    });
  }, [catalogue, droits]);

  const filteredRows = mode === 'tous' ? rows : rows.filter((r) => r.effectif);

  // Regroupement par module dans l'ordre et avec les libellés de la sandbox
  // (const MODULES, index.html), reste du catalogue sous "Autre".
  const modules = useMemo(() => {
    const groups = MODULES.map((m) => [m.label, filteredRows.filter((r) => r.permission.module === m.code)])
      .filter(([, rows]) => rows.length > 0);
    const connus = new Set(MODULES.map((m) => m.code));
    const autres = filteredRows.filter((r) => !connus.has(r.permission.module));
    if (autres.length) groups.push(['Autre', autres]);
    return groups;
  }, [filteredRows]);

  if (!isOpen) return null;

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title={`Droits de ${user.prenom} ${user.nom}`} size="lg">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Organisation</label>
            <select
              value={societeId}
              onChange={(e) => setSocieteId(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white"
            >
              {selectable.map((s) => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
            </select>
          </div>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setMode('tous')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${mode === 'tous' ? 'bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-white' : 'text-gray-500'}`}
            >
              Tous les droits
            </button>
            <button
              onClick={() => setMode('attribues')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${mode === 'attribues' ? 'bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-white' : 'text-gray-500'}`}
            >
              Droits attribués uniquement
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Chargement…</p>
        ) : (
          <div className="flex flex-col gap-5">
            {modules.map(([moduleName, permRows]) => (
              <div key={moduleName}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{moduleName}</h3>
                <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
                  {permRows.map((r) => (
                    <div key={r.permission.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm bg-white dark:bg-gray-800">
                      <span className="text-gray-700 dark:text-gray-200">
                        {r.permission.label}
                        {r.redondante && <span className="ml-2 text-xs text-gray-400">(exception redondante avec le groupe)</span>}
                      </span>
                      <SourceBadge source={r.source} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {modules.length === 0 && <p className="text-sm text-gray-400">Aucun droit à afficher.</p>}
          </div>
        )}

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Exceptions de l'utilisateur</h3>
          {exceptions.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune exception.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {exceptions.map((e) => (
                <div key={e.id} className="text-sm border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${e.type === 'retire' ? 'text-red-600' : 'text-green-700'}`}>
                      {e.type === 'retire' ? 'Retrait' : 'Attribution'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {e.date_debut ? formatDate(e.date_debut) : '—'} → {e.date_fin ? formatDate(e.date_fin) : 'sans fin'}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mt-1">{e.motif}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SlideOver>
  );
}
