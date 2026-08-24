// InventairePage - vue de reconciliation branchee sur l'API inventaire (#111) :
// import manuel de releves csv, releves et statut de rapprochement, ecarts
// dans les deux sens (constate sans affectation, affectation jamais
// constatee), synthese droits / declare / constate par produit.
// Le bloc "Connecteurs (apercu)" est conserve tel quel : collecte automatique
// prevue en v2, hors perimetre de la #111.
// Doctrine actee : l'outil constate et alerte, il ne cree ni ne modifie jamais
// une affectation. Le rapprochement est manuel (RapprochementModal).
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Info, Plug, Upload, AlertTriangle, ClipboardList, Link2, CircleSlash, Clock } from 'lucide-react';
import { mockConnecteurs } from '../../data/mockDeploiement';
import { inventaireService, RAPPROCHEMENT_STATUT, IMPORT_STATUT } from '../../services/inventaireService';
import { optionnel } from '../../services/http';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Breadcrumb from '../ui/Breadcrumb';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import DeploiementKpiCard from './DeploiementKpiCard';
import ImportReleveModal from './ImportReleveModal';
import RapprochementModal from './RapprochementModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import { formatDateTime } from '../../utils/dateUtils';

const CONNECTEUR_STATUT = {
  ok: { variant: 'success', label: 'Operationnel' },
  defaillant: { variant: 'error', label: 'Defaillant' },
  non_configure: { variant: 'neutral', label: 'Non configure' },
};

const selectCls = 'text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function InventairePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  // write = import (Admin, Manager DSI), validate = rapprochement (Admin,
  // Manager DSI, IT Ops). Le Financier ne detient que la consultation.
  const { canWrite: canImport, canValidate: canRapprocher } = useRbac({ write: 'importer_inventaire', validate: 'rapprocher_inventaire' });

  const [releves, setReleves] = useState([]);
  const [ecarts, setEcarts] = useState(null);
  const [imports, setImports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);

  const [filterSociete, setFilterSociete] = useState('');
  const [filterProduit, setFilterProduit] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterImport, setFilterImport] = useState('');
  const [searchParams] = useSearchParams();
  const produitParam = searchParams.get('produit');

  const [importModal, setImportModal] = useState(false);
  const [releveEnCours, setReleveEnCours] = useState(null);
  const [importOuvert, setImportOuvert] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      // Les releves sont la ressource principale ; ecarts et historique des
      // imports sont servis par le meme droit, mais leur refus ne doit pas
      // condamner la liste.
      const [r, e, i] = await Promise.all([
        inventaireService.listReleves(),
        optionnel(inventaireService.ecarts(), null),
        optionnel(inventaireService.listImports()),
      ]);
      setReleves(r); setEcarts(e); setImports(i);
    } catch (err) {
      setError(err.message);
      setErrorStatus(err.status);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const societes = useMemo(() => {
    const m = new Map();
    for (const r of releves) if (r.id_societe) m.set(r.id_societe, r.societe_label);
    return [...m].map(([id, label]) => ({ id, label })).sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''));
  }, [releves]);

  const produits = useMemo(() => [...new Set(releves.map(r => r.produit_label).filter(Boolean))].sort(), [releves]);

  const produitActif = filterProduit || produitParam || '';
  const filtree = useMemo(() => releves.filter(r => {
    if (filterSociete && r.id_societe !== filterSociete) return false;
    if (produitActif && r.produit_label !== produitActif && r.produit !== produitActif) return false;
    if (filterStatut && r.statut_rapprochement !== filterStatut) return false;
    if (filterImport && r.id_import !== filterImport) return false;
    return true;
  }), [releves, filterSociete, produitActif, filterStatut, filterImport]);

  function apresTransition(data, mode) {
    setReleves(liste => liste.map(r => r.id === data.id ? data : r));
    addToast({ type: 'success', message: { rapprocher: 'Releve rapproche.', 'ecart-assume': 'Ecart assume.', rejeter: 'Releve rejete.', reouvrir: 'Releve remis en attente.' }[mode] });
    // Compteurs et listes d'ecarts sont une vue calculee : rechargement.
    optionnel(inventaireService.ecarts(), null).then(setEcarts);
  }

  async function reouvrir(r) {
    try {
      apresTransition(await inventaireService.reouvrir(r.id), 'reouvrir');
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  const c = ecarts?.compteurs;

  const columns = [
    { key: 'produit_label', label: 'Produit', sortable: true, render: r => (
      <button onClick={() => navigate(`/conformite/inventaire/${r.id}`)} className="font-medium text-blue-800 hover:underline text-left">{r.produit_label ?? (r.fichier_absent ? 'Fichier archive absent' : '-')}</button>
    ) },
    { key: 'reference', label: 'Reference constatee', sortable: true, render: r => <span className="font-mono text-xs">{r.reference ?? '-'}</span> },
    { key: 'quantite', label: 'Quantite', sortable: true, render: r => r.quantite ?? '-' },
    { key: 'societe_label', label: 'Societe', sortable: true, render: r => r.societe_label ?? '-' },
    { key: 'date_import', label: 'Import', sortable: true, render: r => r.date_import ? formatDateTime(r.date_import) : '-' },
    { key: 'affectation', label: 'Affectation', sortable: true, getValue: r => r.affectation_reference ?? '', render: r => r.id_affectation
      ? <span className="text-sm">{r.affectation_reference ?? r.affectation_label}</span>
      : r.candidates?.length ? <span className="text-xs text-blue-700">{r.candidates.length} candidate(s)</span> : <span className="text-gray-400">-</span> },
    { key: 'statut_rapprochement', label: 'Rapprochement', sortable: true, render: r => {
      const cfg = RAPPROCHEMENT_STATUT[r.statut_rapprochement] ?? RAPPROCHEMENT_STATUT.en_attente;
      return <Badge variant={cfg.variant} label={cfg.label} />;
    } },
  ];
  if (canRapprocher) {
    columns.push({ key: 'actions', label: '', render: r => (
      <div className="flex gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
        {r.statut_rapprochement !== 'rejete' && (
          <Button size="sm" variant="secondary" onClick={() => setReleveEnCours(r)}>Rapprocher</Button>
        )}
        {r.statut_rapprochement !== 'en_attente' && (
          <Button size="sm" variant="ghost" onClick={() => reouvrir(r)}>Reouvrir</Button>
        )}
      </div>
    ) });
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Usage' }, { label: 'Inventaire' }]} />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Inventaire</h1>
          <p className="text-sm text-gray-500 mt-0.5">L'usage constate, confronte aux droits et a l'usage declare. L'outil constate et alerte : aucune affectation n'est creee ni modifiee automatiquement.</p>
        </div>
        {canImport && (
          <Button onClick={() => setImportModal(true)}><Upload size={15} className="mr-1.5" /> Importer un releve</Button>
        )}
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Connecteurs (apercu)</h2>
          <span className="text-xs font-semibold text-blue-700 bg-blue-100 dark:bg-blue-900/30 px-2.5 py-1 rounded-full">Disponible en v2</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 opacity-70">
          {mockConnecteurs.map(cn => {
            const cfg = CONNECTEUR_STATUT[cn.statut];
            return (
              <div key={cn.id} className="flex flex-col items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-not-allowed">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700">
                  <Plug size={16} className="text-gray-400" />
                </span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center">{cn.nom}</span>
                <Badge variant={cfg.variant} label={cfg.label} />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">Configuration des connecteurs reservee au Manager DSI, disponible en v2. En attendant, les releves sont importes manuellement au format csv.</p>
      </section>

      {error ? (
        <ErrorState message={error} status={errorStatus} onRetry={load} />
      ) : isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"><Skeleton lines={6} /></div>
      ) : (
        <>
          {c && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <DeploiementKpiCard label="Releves" value={c.releves_total} icon={ClipboardList} onClick={() => setFilterStatut('')} active={filterStatut === ''} />
              <DeploiementKpiCard label="En attente" value={c.en_attente} icon={Clock} color="#2563EB" onClick={() => setFilterStatut('en_attente')} active={filterStatut === 'en_attente'} />
              <DeploiementKpiCard label="Rapproches" value={c.rapproche} icon={Link2} color="#16A34A" onClick={() => setFilterStatut('rapproche')} active={filterStatut === 'rapproche'} />
              <DeploiementKpiCard label="Ecarts detectes" value={c.ecart_detecte} icon={AlertTriangle} color="#EA580C" onClick={() => setFilterStatut('ecart_detecte')} active={filterStatut === 'ecart_detecte'} />
              <DeploiementKpiCard label="Rejetes" value={c.rejete} icon={CircleSlash} color="#6B7280" onClick={() => setFilterStatut('rejete')} active={filterStatut === 'rejete'} />
              <DeploiementKpiCard label="Affectations jamais constatees" value={`${c.affectations_non_constatees} / ${c.affectations_total}`} icon={AlertTriangle} color="#7C3AED" />
            </div>
          )}

          {ecarts && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Usage constate sans affectation declaree ({ecarts.compteurs.constates_sans_affectation})</h2>
                <p className="text-xs text-gray-500 mb-3">Releves non rejetes qui ne sont rapproches d'aucune affectation.</p>
                {ecarts.constates_sans_affectation.length === 0
                  ? <p className="text-sm text-gray-400">Aucun.</p>
                  : <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-72 overflow-y-auto">
                      {ecarts.constates_sans_affectation.map(r => (
                        <li key={r.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                          <button onClick={() => navigate(`/conformite/inventaire/${r.id}`)} className="text-left text-blue-800 hover:underline truncate">
                            {r.produit_label ?? '-'} <span className="font-mono text-xs text-gray-500">{r.reference}</span> x{r.quantite}{r.societe_label ? ` - ${r.societe_label}` : ''}
                          </button>
                          <Badge variant={RAPPROCHEMENT_STATUT[r.statut_rapprochement]?.variant} label={RAPPROCHEMENT_STATUT[r.statut_rapprochement]?.label} />
                        </li>
                      ))}
                    </ul>}
              </section>
              <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Affectations declarees jamais constatees ({ecarts.compteurs.affectations_non_constatees})</h2>
                <p className="text-xs text-gray-500 mb-3">Affectations sans aucun releve rapproche. Les candidates sont les releves en attente de meme reference.</p>
                {ecarts.affectations_non_constatees.length === 0
                  ? <p className="text-sm text-gray-400">Aucune.</p>
                  : <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-72 overflow-y-auto">
                      {ecarts.affectations_non_constatees.map(a => (
                        <li key={a.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-gray-700 dark:text-gray-300">
                            {a.produit_label ?? a.licence_label ?? '-'} <span className="font-mono text-xs text-gray-500">{a.reference_client}</span> x{a.quantite}{a.societe_label ? ` - ${a.societe_label}` : ''}
                          </span>
                          {a.nb_candidats > 0
                            ? <span className="text-xs text-blue-700 whitespace-nowrap">{a.nb_candidats} releve(s) candidat(s)</span>
                            : <span className="text-xs text-gray-400 whitespace-nowrap">jamais constatee</span>}
                        </li>
                      ))}
                    </ul>}
              </section>
            </div>
          )}

          {ecarts && ecarts.synthese_produits.length > 0 && (
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-4 pt-4 pb-3">Reconciliation par produit - droits, declare, constate</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/40">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Produit</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Droits acquis</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Usage declare</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Usage constate</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Ecart declare / constate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {ecarts.synthese_produits.map(s => (
                      <tr key={s.produit} onClick={() => setFilterProduit(s.produit)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{s.produit}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{s.droits}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{s.declare}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{s.constate}</td>
                        <td className="px-4 py-2.5 text-right">
                          {s.ecart_declare_constate === 0
                            ? <span className="text-gray-400">-</span>
                            : <span className={s.ecart_declare_constate > 0 ? 'text-orange-600 font-medium' : 'text-gray-500'}>{s.ecart_declare_constate > 0 ? '+' : ''}{s.ecart_declare_constate}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <select value={filterSociete} onChange={e => setFilterSociete(e.target.value)} className={selectCls}>
              <option value="">Toutes les societes</option>
              {societes.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select value={produitActif} onChange={e => setFilterProduit(e.target.value)} className={selectCls}>
              <option value="">Tous les produits</option>
              {produits.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className={selectCls}>
              <option value="">Rapprochement : tous</option>
              {Object.entries(RAPPROCHEMENT_STATUT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filterImport} onChange={e => setFilterImport(e.target.value)} className={selectCls}>
              <option value="">Tous les imports</option>
              {imports.map(i => <option key={i.id} value={i.id}>{formatDateTime(i.created_at)} - {IMPORT_STATUT[i.statut]?.label ?? i.statut}</option>)}
            </select>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <DataTable
              columns={columns}
              data={filtree}
              filename="inventaire"
              emptyState={{ message: releves.length ? 'Aucun releve ne correspond aux filtres.' : 'Aucun releve importe. Importez un fichier csv pour commencer.' }}
            />
          </div>

          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Historique des imports ({imports.length})</h2>
            {imports.length === 0 ? <p className="text-sm text-gray-400">Aucun import.</p> : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {imports.map(i => {
                  const cfg = IMPORT_STATUT[i.statut] ?? IMPORT_STATUT.en_cours;
                  const ouvert = importOuvert?.id === i.id;
                  return (
                    <li key={i.id} className="py-2 text-sm">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge variant={cfg.variant} label={cfg.label} />
                          <span className="text-gray-700 dark:text-gray-300">{formatDateTime(i.created_at)}</span>
                          <span className="text-gray-500">{i.auteur_prenom} {i.auteur_nom}</span>
                          <span className="text-gray-500">{i.nb_lignes_total ?? 0} ligne(s), {i.nb_releves} releve(s), {i.nb_erreurs} erreur(s)</span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => { setFilterImport(i.id); setFilterStatut(''); }}>Filtrer</Button>
                          {i.nb_erreurs > 0 && (
                            <Button size="sm" variant="ghost" onClick={async () => {
                              if (ouvert) { setImportOuvert(null); return; }
                              try { setImportOuvert(await inventaireService.getImport(i.id)); }
                              catch (err) { addToast({ type: 'error', message: err.message }); }
                            }}>{ouvert ? 'Masquer' : 'Erreurs'}</Button>
                          )}
                        </div>
                      </div>
                      {ouvert && (
                        <ul className="mt-2 text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-lg px-3 py-2 flex flex-col gap-0.5">
                          {importOuvert.erreurs.map(e => <li key={e.id}>{e.description}</li>)}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-3">
        <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-400">
          Chaque import est trace (statut global et erreurs ligne a ligne) et son fichier archive sous un nom neutre avec son empreinte SHA-256. Le rapprochement est une decision humaine : associer un releve a une affectation existante, le marquer en ecart assume, ou le rejeter avec motif.
        </p>
      </div>

      <ImportReleveModal isOpen={importModal} onClose={() => setImportModal(false)} onImported={t => { addToast(t); load(); }} />
      <RapprochementModal isOpen={!!releveEnCours} onClose={() => setReleveEnCours(null)} releve={releveEnCours} onDone={apresTransition} />
    </div>
  );
}
