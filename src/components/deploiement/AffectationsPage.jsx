// AffectationsPage - vue operationnelle des affectations (#106) : file de
// travail (validations en attente, revalidations a faire ou depassees) puis
// liste complete. Branchee sur l'API : statuts de validation et de
// revalidation sont evalues par le serveur a la lecture, jamais recalcules ici.
// La validation et le refus passent par le circuit unique du module 2
// (validationService, entite_type "affectation").
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, AlertTriangle, Clock, CheckCircle2, ArrowRight, History } from 'lucide-react';
import { affectationsService, licencesService } from '../../services/affectationsService';
import { societesService } from '../../services/adminService';
import { optionnel } from '../../services/http';
import { appliquerStatut } from '../../services/validationService';
import useValidation from '../../hooks/useValidation';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Breadcrumb from '../ui/Breadcrumb';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import ValidationCell from '../referentiels/ValidationCell';
import ValidationActions from '../referentiels/ValidationActions';
import DeploiementKpiCard from './DeploiementKpiCard';
import StatutRevalidationBadge from './StatutRevalidationBadge';
import AffectationFormModal from './AffectationFormModal';
import HistoriqueDeclarations from './HistoriqueDeclarations';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';

// Ordre de la file : depasse, puis en attente de validation, puis a revalider.
function rangFile(a) {
  if (a.statut_revalidation === 'depasse' || a.statut_validation === 'a_revalider') return 0;
  if (a.statut_validation === 'en_attente') return 1;
  if (a.statut_revalidation === 'a_revalider') return 2;
  return 3;
}

function dansFile(a) {
  return a.statut_validation === 'en_attente' || a.statut_validation === 'a_revalider'
    || a.statut_revalidation === 'a_revalider' || a.statut_revalidation === 'depasse';
}

// Revalidable : validee (a jour, en alerte ou depassee). Une saisie en attente
// ou refusee ne l'est pas, l'API repond 4030.
function revalidable(a) {
  return a.statut_validation === 'valide' || a.statut_validation === 'a_revalider';
}

export default function AffectationsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canValidate } = useRbac({ write: 'saisir_affectation', validate: 'valider_saisie' });

  const [affectations, setAffectations] = useState([]);
  const [licences, setLicences] = useState([]);
  const [societes, setSocietes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [revalidationEnCours, setRevalidationEnCours] = useState(null);

  const [filterSociete, setFilterSociete] = useState('');
  const [filterProduit, setFilterProduit] = useState('');
  const [filterStatutValidation, setFilterStatutValidation] = useState('');
  const [filterStatutRevalidation, setFilterStatutRevalidation] = useState('');
  const [searchParams] = useSearchParams();
  const [formModal, setFormModal] = useState({ open: false, affectation: null });

  const produitParam = searchParams.get('produit');
  const societeParam = searchParams.get('societe');
  const societeActive = filterSociete || societeParam || '';

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      // Seules les affectations sont indispensables ; licences et societes
      // alimentent filtres et formulaire (consulter_licences et
      // consulter_referentiels peuvent manquer a un lecteur).
      const [a, l, s] = await Promise.all([
        affectationsService.list(),
        optionnel(licencesService.list()),
        optionnel(societesService.list()),
      ]);
      setAffectations(a); setLicences(l); setSocietes(s);
    } catch (err) {
      setError(err.message);
      setErrorStatus(err.status);
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // Un traitement change le cycle de revalidation (ouvert a la validation) :
  // la ligne est rechargee depuis l'API plutot que patchee localement.
  const appliquer = useCallback(async (reponse) => {
    setAffectations(prev => prev.map(a => a.id === reponse.entite_id ? appliquerStatut(a, reponse) : a));
    try {
      const fraiche = await affectationsService.get(reponse.entite_id);
      setAffectations(prev => prev.map(a => a.id === fraiche.id ? fraiche : a));
    } catch { /* le statut est deja applique, le cycle s'affichera au prochain chargement */ }
  }, []);
  const { valider, refuser } = useValidation(appliquer);

  async function handleRevalider(id) {
    setRevalidationEnCours(id);
    try {
      const fraiche = await affectationsService.revalider(id);
      setAffectations(prev => prev.map(a => a.id === id ? fraiche : a));
      addToast({ type: 'success', message: `Revalidation effectuee, prochaine echeance le ${formatDate(fraiche.date_prochaine_revalidation)}.` });
    } catch (err) {
      addToast({ type: 'error', message: err.message, persistent: true });
    } finally {
      setRevalidationEnCours(null);
    }
  }

  const produits = useMemo(() => {
    const m = new Map();
    for (const a of affectations) if (a.id_produit && !m.has(a.id_produit)) m.set(a.id_produit, a.produit_label ?? 'Produit inconnu');
    return [...m.entries()];
  }, [affectations]);

  const filtrees = useMemo(() => affectations.filter(a => {
    if (societeActive && a.id_societe !== societeActive) return false;
    if ((filterProduit || produitParam) && a.id_produit !== (filterProduit || produitParam)) return false;
    if (filterStatutValidation && a.statut_validation !== filterStatutValidation) return false;
    if (filterStatutRevalidation && a.statut_revalidation !== filterStatutRevalidation) return false;
    return true;
  }), [affectations, societeActive, filterProduit, produitParam, filterStatutValidation, filterStatutRevalidation]);

  const file = useMemo(() => affectations.filter(dansFile).sort((a, b) => rangFile(a) - rangFile(b)), [affectations]);

  const kpis = useMemo(() => ({
    aValider: affectations.filter(a => a.statut_validation === 'en_attente').length,
    aRevalider: affectations.filter(a => a.statut_revalidation === 'a_revalider').length,
    depassees: affectations.filter(a => a.statut_revalidation === 'depasse').length,
  }), [affectations]);

  const actions = (a, taille = 'sm') => (
    <div className="flex items-center gap-1">
      {canValidate && a.statut_validation === 'en_attente' && (
        <ValidationActions statut={a.statut_validation} size={taille}
          onValidate={() => valider('affectation', a.id)}
          onRefuse={motif => refuser('affectation', a.id, motif)} />
      )}
      {canValidate && revalidable(a) && ['a_revalider', 'depasse'].includes(a.statut_revalidation) && (
        <Button variant="secondary" size={taille} onClick={() => handleRevalider(a.id)} isLoading={revalidationEnCours === a.id}>Revalider</Button>
      )}
    </div>
  );

  const columns = [
    { key: 'produit', label: 'Produit', sortable: true, getValue: r => r.produit_label ?? '', render: r => (
      <button onClick={() => navigate(`/conformite/affectations/${r.id}`)} className="font-medium text-blue-800 hover:underline text-left">
        {r.produit_label ?? r.licence_label ?? 'Produit inconnu'}
      </button>
    ) },
    { key: 'societe_label', label: 'Societe', sortable: true, render: r => r.societe_label ?? '-' },
    { key: 'reference_client', label: 'Reference client', sortable: true },
    { key: 'quantite', label: 'Quantite', sortable: true },
    { key: 'statut_validation', label: 'Validation', sortable: true, render: r => <ValidationCell statut={r.statut_validation} motif={r.message_refus} /> },
    { key: 'revalidation', label: 'Revalidation', getValue: r => r.date_prochaine_revalidation ?? '', render: r => (
      <div className="flex items-center gap-2">
        <StatutRevalidationBadge revalidation={r.statut_revalidation} />
        {r.date_prochaine_revalidation && <span className="text-xs text-gray-400">{formatDate(r.date_prochaine_revalidation)}</span>}
      </div>
    ) },
    { key: 'actions', label: 'Actions', render: r => actions(r) },
  ];

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Usage' }, { label: 'Affectations' }]} />
        <ErrorState message={error} status={errorStatus} onRetry={load} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton height="h-16" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[0, 1, 2].map(i => <Skeleton key={i} height="h-20" />)}</div>
        <Skeleton height="h-40" />
        <Skeleton height="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Usage' }, { label: 'Affectations' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Affectations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Qui utilise quoi, validations et revalidations en cours</p>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={() => setFormModal({ open: true, affectation: null })}>
            <Plus size={15} /> Nouvelle affectation
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DeploiementKpiCard label="A valider" value={kpis.aValider} icon={Clock} color="#8B9099" />
        <DeploiementKpiCard label="A revalider" value={kpis.aRevalider} icon={AlertTriangle} color="#F59E0B" />
        <DeploiementKpiCard label="Revalidations depassees" value={kpis.depassees} icon={AlertTriangle} color="#EF4444" />
      </div>

      {/* File de travail - signature de la page */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">File de travail</h2>
        {file.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <CheckCircle2 size={16} className="text-green-500" /> Aucune action en attente. Tout est a jour.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {file.map(a => {
              const couleur = a.statut_revalidation === 'depasse' ? '#EF4444' : a.statut_validation === 'en_attente' ? '#8B9099' : '#F59E0B';
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40" style={{ borderLeft: `3px solid ${couleur}` }}>
                  <button onClick={() => navigate(`/conformite/affectations/${a.id}`)} className="flex flex-col items-start text-left min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.produit_label ?? a.licence_label ?? 'Produit inconnu'} - {a.reference_client}</span>
                    <span className="text-xs text-gray-500">{a.societe_label ?? 'Societe non renseignee'} · {a.quantite} · soumis par {a.soumis_par ?? 'inconnu'}</span>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {a.statut_validation === 'en_attente'
                      ? <Badge variant="neutral" label="En attente de validation" />
                      : (
                        <span className="flex items-center gap-2">
                          <StatutRevalidationBadge revalidation={a.statut_revalidation} />
                          {a.date_prochaine_revalidation && (
                            <span className="text-xs text-gray-400">
                              {a.jours_restants >= 0 ? `echeance le ${formatDate(a.date_prochaine_revalidation)}` : `depassee depuis ${-a.jours_restants} j`}
                            </span>
                          )}
                        </span>
                      )
                    }
                    {actions(a)}
                    <button onClick={() => navigate(`/conformite/affectations/${a.id}`)} aria-label="Voir le detail" className="p-1.5 text-gray-400 hover:text-gray-700">
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterSociete} onChange={e => setFilterSociete(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les societes</option>
          {societes.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
        </select>
        <select value={filterProduit} onChange={e => setFilterProduit(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les produits</option>
          {produits.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select value={filterStatutValidation} onChange={e => setFilterStatutValidation(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Statut validation : tous</option>
          <option value="en_attente">En attente</option>
          <option value="valide">Valide</option>
          <option value="a_revalider">A revalider</option>
          <option value="refuse">Refuse</option>
        </select>
        <select value={filterStatutRevalidation} onChange={e => setFilterStatutRevalidation(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Statut revalidation : tous</option>
          <option value="a_jour">A jour</option>
          <option value="a_revalider">A revalider</option>
          <option value="depasse">Depasse</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable
          columns={columns}
          data={filtrees}
          filename="affectations"
          emptyState={{ message: 'Aucune affectation ne correspond aux filtres.' }}
        />
      </div>

      {/* Historique des declarations de la societe filtree (historique_declaration) */}
      {societeActive && (
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <History size={14} /> Historique des declarations de {societes.find(s => s.id === societeActive)?.raison_sociale ?? 'la societe'}
          </h2>
          <HistoriqueDeclarations filtres={{ id_societe: societeActive }} />
        </section>
      )}

      <AffectationFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, affectation: null })}
        onSaved={load}
        affectation={formModal.affectation}
        licences={licences}
        societes={societes}
      />
    </div>
  );
}
