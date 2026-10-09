// DroitsViewer - visionneuse des droits effectifs d'un utilisateur, par
// société et par profil (#249 corrigé multi-profils, étendu « tout est
// profil » #276, puis groupes d'utilisateurs US #277/#330) : « Ensemble des
// profils » montre l'union qui fait foi, chaque profil peut être regardé seul
// (matrice configurée pour la société regardée, ou défaut du tenant).
// Provenance de chaque droit : attribution directe (badge Profil) ou groupes
// d'utilisateurs (badge Groupe et noms des groupes) ; quand les deux se
// cumulent, le badge direct reste et les noms de groupes s'affichent en plus.
// Les sociétés regardables couvrent le rattachement ET les sociétés apportées
// par les groupes d'organisations des groupes du compte. La source technique
// 'groupe' (attributions antérieures à la migration 097) s'affiche comme un
// profil.
import { useState, useEffect, useMemo } from 'react';
import SlideOver from '../ui/SlideOver';
import { useToast } from '../../hooks/useToast';
import { droitsService, permissionsService, exceptionsService, groupesUtilisateursService } from '../../services/adminService';
import { optionnel } from '../../services/http';
import { formatDate } from '../../utils/dateUtils';
import { MODULES } from '../../constants/permissions';

// Libellés fidèles à renderSourceBadge (sandbox, index.html).
const SOURCE_CONFIG = {
  profil: { label: 'Accordé · Profil', cls: 'bg-blue-100 text-blue-800' },
  // Source servie pour les attributions de type 'groupe' tant que la 097
  // n'est pas jouée : même rendu qu'un profil, le mot groupe a disparu de
  // l'écran (#276).
  groupe: { label: 'Accordé · Profil', cls: 'bg-blue-100 text-blue-800' },
  // Droit apporté uniquement par des groupes d'utilisateurs (#330) : les
  // noms des groupes sont affichés à côté de la permission.
  groupe_utilisateur: { label: 'Accordé · Groupe', cls: 'bg-purple-100 text-purple-800' },
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
  // Appartenances aux groupes d'utilisateurs (#330) : leurs groupes
  // d'organisations étendent les sociétés regardables au-delà du rattachement,
  // et leurs profils s'ajoutent au sélecteur. Accessoire : un échec laisse la
  // visionneuse sur le rattachement seul.
  const [appartenances, setAppartenances] = useState([]);
  const societesGroupes = useMemo(() => {
    const ids = new Set();
    for (const a of appartenances) {
      for (const acces of a.acces || []) {
        for (const s of acces.societes || []) ids.add(s.id);
      }
    }
    return ids;
  }, [appartenances]);
  const selectable = isTenantScope
    ? societes
    : societes.filter((s) => userSocieteIds.includes(s.id) || societesGroupes.has(s.id));

  const [societeId, setSocieteId] = useState(selectable[0]?.id || '');
  const [profilId, setProfilId] = useState(''); // '' = ensemble des profils
  const [mode, setMode] = useState('tous'); // 'tous' | 'attribues'
  const [catalogue, setCatalogue] = useState([]);
  const [droits, setDroits] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSocieteId(selectable[0]?.id || '');
    setProfilId('');
    permissionsService.list().then(setCatalogue).catch((err) => addToast({ type: 'error', message: err.message }));
    exceptionsService.listForUser(user.id).then(setExceptions).catch(() => {});
    optionnel(groupesUtilisateursService.appartenances(user.id)).then(setAppartenances).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id]);

  // Les appartenances arrivent après l'ouverture : si aucune société n'était
  // regardable (rattachement vide hors tenant), la première société apportée
  // par un groupe prend la main.
  useEffect(() => {
    if (!isOpen || societeId || !selectable.length) return;
    setSocieteId(selectable[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectable.length]);

  useEffect(() => {
    if (!isOpen || !societeId) return;
    setLoading(true);
    droitsService.effectifs(user.id, societeId, profilId || undefined)
      .then(setDroits)
      .catch((err) => addToast({ type: 'error', message: err.message }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, societeId, profilId, user?.id]);

  const rows = useMemo(() => {
    const byPermId = new Map((droits?.droits || []).map((d) => [d.permission.id, d]));
    return catalogue.map((perm) => {
      const entry = byPermId.get(perm.id);
      return {
        permission: perm,
        source: entry?.source || 'aucun',
        effectif: entry?.effectif ?? false,
        redondante: entry?.redondante ?? false,
        groupes_utilisateurs: entry?.groupes_utilisateurs || [],
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
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Société</label>
            <select
              value={societeId}
              onChange={(e) => setSocieteId(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white"
            >
              {selectable.map((s) => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Profil</label>
            <select
              value={profilId}
              onChange={(e) => setProfilId(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white"
            >
              <option value="">Ensemble des profils</option>
              {(() => {
                // Profils directs puis profils portés par les groupes (dédoublonnés) :
                // chacun peut être regardé seul, la provenance est dite dans le libellé.
                const directs = user.profils || [];
                const idsDirects = new Set(directs.map((p) => p.id));
                const parGroupe = new Map();
                for (const a of appartenances) {
                  for (const acces of a.acces || []) {
                    if (!idsDirects.has(acces.id_profil) && !parGroupe.has(acces.id_profil)) {
                      parGroupe.set(acces.id_profil, acces.profil_label);
                    }
                  }
                }
                return [
                  ...directs.map((p) => <option key={p.id} value={p.id}>{p.label}</option>),
                  ...[...parGroupe].map(([id, label]) => <option key={id} value={id}>{label} (via groupe)</option>),
                ];
              })()}
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

        {!loading && (
          <p className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
            {[
              (droits?.profils || []).length
                ? droits.profils.map((p) =>
                    `Profil "${p.label}" : ${p.configure
                      ? 'matrice configurée pour cette société'
                      : 'matrice par défaut du tenant (société non configurée)'}.`
                  ).join(' ')
                : 'Aucun profil direct.',
              ...appartenances.flatMap((a) =>
                (a.acces || [])
                  .filter((acces) => (acces.societes || []).some((s) => s.id === societeId))
                  .map((acces) => `Groupe "${a.nom}" : ${acces.profil_label} via "${acces.groupe_organisation_nom}".`)
              ),
            ].join(' ')}
          </p>
        )}

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
                        {r.redondante && <span className="ml-2 text-xs text-gray-400">(exception redondante avec un profil)</span>}
                        {r.groupes_utilisateurs.length > 0 && (
                          <span className="block text-xs text-purple-700 dark:text-purple-400 mt-0.5">
                            via {r.groupes_utilisateurs.length > 1 ? 'les groupes' : 'le groupe'} {r.groupes_utilisateurs.map((n) => `"${n}"`).join(', ')}
                          </span>
                        )}
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
