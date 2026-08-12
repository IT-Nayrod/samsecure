// CommandesPage - vue financiere et transactionnelle des commandes (Droits d'usage)
// Montants, timeline et KPI viennent tous de /api/commandes/agregats : aucun
// montant n'est calcule ici. La liste est filtree sur les bornes mensuelles
// que l'API renvoie, ce qui garantit qu'elle ne peut pas diverger du graphe.
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Wallet, Hash, RefreshCw, TrendingUp, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { commandesService, modesCommandeService } from '../../services/commandesService';
import { contratsService, referentielsContratsService } from '../../services/contratsService';
import { societesService } from '../../services/adminService';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Breadcrumb from '../ui/Breadcrumb';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import StatutEcheanceBadge from './StatutEcheanceBadge';
import DeploiementKpiCard from '../deploiement/DeploiementKpiCard';
import PeriodeFiscaleSelector from '../ui/PeriodeFiscaleSelector';
import CommandeFormModal from './CommandeFormModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import { toIsoDate, debutExerciceDepuisDate } from '../../utils/fiscalPeriod';
import ValidationCell from '../referentiels/ValidationCell';
import ValidationActions from '../referentiels/ValidationActions';
import useValidation from '../../hooks/useValidation';
import { appliquerStatut } from '../../services/validationService';

const euros = (v) => `${(v ?? 0).toLocaleString('fr-FR')} €`;

export default function CommandesPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite } = useRbac();

  const [commandes, setCommandes] = useState([]);
  const [contrats, setContrats] = useState([]);
  const [societes, setSocietes] = useState([]);
  const [revendeurs, setRevendeurs] = useState([]);
  const [modes, setModes] = useState([]);
  const [agregats, setAgregats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filterContrat, setFilterContrat] = useState('');
  const [filterSociete, setFilterSociete] = useState('');
  const [filterRevendeur, setFilterRevendeur] = useState('');
  const [filterRenouvellement, setFilterRenouvellement] = useState('');
  const [activeKpi, setActiveKpi] = useState(null);
  const [periode, setPeriode] = useState(null);
  const [searchParams] = useSearchParams();
  const societeParam = searchParams.get('societe');
    const revendeurParam = searchParams.get('revendeur');
  const contratParam = searchParams.get('contrat');
  const [formModal, setFormModal] = useState({ open: false, commande: null });

  const societeActive = filterSociete || societeParam || null;

  // Le referentiel se charge une fois, les agregats a chaque changement de
  // periode ou de societe : ce sont les deux seuls axes que porte le precalcul.
  const loadReferentiel = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [k, c, s, r, m] = await Promise.all([
        commandesService.list(),
        contratsService.list(),
        societesService.list(),
        referentielsContratsService.revendeurs(),
        modesCommandeService.list(),
      ]);
      setCommandes(k); setContrats(c); setSocietes(s); setRevendeurs(r); setModes(m);
    } catch (err) {
      setError(err.message);
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAgregats = useCallback(async () => {
    if (!periode?.debut || !periode?.fin) return;
    try {
      setAgregats(await commandesService.agregats({
        dateDebut: toIsoDate(periode.debut),
        dateFin: toIsoDate(periode.fin),
        idSociete: societeActive,
      }));
    } catch (err) {
      setError(err.message);
      addToast({ type: 'error', message: err.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode?.debut, periode?.fin, societeActive]);

  useEffect(() => { loadReferentiel(); }, [loadReferentiel]);
  useEffect(() => { loadAgregats(); }, [loadAgregats]);

  const reload = useCallback(async () => {
    await loadReferentiel();
    await loadAgregats();
  }, [loadReferentiel, loadAgregats]);

  // Ni loadReferentiel ni loadAgregats : le statut de validation n'entre dans
  // aucun agregat financier, seule la ligne concernee change.
  const appliquer = useCallback(reponse => {
    setCommandes(prev => prev.map(k => k.id === reponse.entite_id ? appliquerStatut(k, reponse) : k));
  }, []);
  const { valider, refuser } = useValidation(appliquer);

  // L'exercice fiscal vient de la societe filtree, a defaut l'annee civile :
  // il n'existe pas d'endpoint sur tenant_config pour un defaut de tenant.
  const debutExercice = useMemo(() => {
    const s = societes.find((x) => x.id === societeActive);
    return debutExerciceDepuisDate(s?.debut_exercice_fiscal) ?? { jour: 1, mois: 1 };
  }, [societes, societeActive]);

  // Filtrage sur les bornes MENSUELLES renvoyees par l'API et non sur la plage
  // du selecteur : le precalcul est mensuel, aligner la liste dessus est la
    // seule facon de garantir l'egalite au centime entre liste, timeline et KPI.
  const dansPeriode = useMemo(() => {
    if (!agregats) return [];
    return commandes.filter((k) => {
      if (!k.date_commande) return false;
      const mois = k.date_commande.slice(0, 7);
      return mois >= agregats.periode_debut && mois <= agregats.periode_fin;
    });
  }, [commandes, agregats]);

  const filtrees = useMemo(() => dansPeriode.filter((k) => {
    if ((filterContrat || contratParam) && k.id_contrat !== (filterContrat || contratParam)) return false;
    if ((filterSociete || societeParam) && k.id_societe !== (filterSociete || societeParam)) return false;
    if ((filterRevendeur || revendeurParam) && k.id_revendeur !== (filterRevendeur || revendeurParam)) return false;
    if (filterRenouvellement === 'oui' && !k.a_renouveler) return false;
    if (filterRenouvellement === 'non' && k.a_renouveler) return false;
    if (activeKpi === 'a_renouveler' && !k.a_renouveler) return false;
    return true;
  }), [dansPeriode, filterContrat, filterSociete, filterRevendeur, filterRenouvellement,
       activeKpi, societeParam, revendeurParam, contratParam]);

  const totaux = agregats?.totaux ?? {};

  const timeline = useMemo(() => (agregats?.mois ?? []).map((m) => {
    const [an, mo] = m.periode.split('-').map(Number);
    return {
      mois: new Date(an, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      montant: m.montant_commande,
    };
  }), [agregats]);

  function toggleKpi(kpi) { setActiveKpi((p) => (p === kpi ? null : kpi)); }

  function resetFiltres() {
    setFilterContrat(''); setFilterSociete(''); setFilterRevendeur('');
    setFilterRenouvellement(''); setActiveKpi(null);
  }

  const hasActiveFiltres = !!(filterContrat || filterSociete || filterRevendeur || filterRenouvellement || activeKpi);

  const columns = [
    { key: 'label', label: 'Label', sortable: true, render: r => (
      <button onClick={() => navigate(`/contrats/commandes/${r.id}`)} className="font-medium text-blue-800 hover:underline text-left">{r.label}</button>
    ) },
    { key: 'numero_devis', label: 'Devis', sortable: true, render: r => r.numero_devis ?? '-' },
    { key: 'reference_interne', label: 'Reference', sortable: true, render: r => r.reference_interne ?? '-' },
    { key: 'contrat_label', label: 'Contrat', sortable: true, render: r => r.contrat_label ?? '-' },
    { key: 'societe_label', label: 'Societe acheteuse', sortable: true, render: r => r.societe_label ?? '-' },
    { key: 'revendeur_label', label: 'Revendeur', sortable: true, render: r => r.revendeur_label ?? '-' },
    { key: 'mode_label', label: 'Mode', sortable: true, render: r => r.mode_label ?? '-' },
    { key: 'montant', label: 'Montant', sortable: true, getValue: r => r.montant, render: r => euros(r.montant) },
    { key: 'date_commande', label: 'Date', sortable: true, render: r => formatDate(r.date_commande) },
    { key: 'statut_echeance', label: 'Renouvellement', sortable: true, render: r => (
      r.a_renouveler || r.date_fin
              ? <div className="flex items-center gap-2">
            <StatutEcheanceBadge statut={r.statut_echeance} />
            {r.date_fin && <span className="text-xs text-gray-500">{formatDate(r.date_fin)}</span>}
          </div>
        : <span className="text-gray-400">-</span>
    ) },
    { key: 'statut_validation', label: 'Validation', sortable: true,
      csvValue: r => [r.statut_validation_label, r.message_refus].filter(Boolean).join(' - '),
      render: r => <ValidationCell statut={r.statut_validation} motif={r.message_refus} /> },
    { key: 'actions_validation', label: '', csvValue: () => '',
      render: r => (
        <ValidationActions
          statut={r.statut_validation}
          onValidate={() => valider('commande', r.id)}
          onRefuse={motif => refuser('commande', r.id, motif)}
        />
      ) },
  ];

  const enTete = (
    <>
      <Breadcrumb items={[{ label: 'Droits d\'usage' }, { label: 'Commandes' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Commandes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Suivi financier des actes d'achat</p>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={() => setFormModal({ open: true, commande: null })} disabled={isLoading || !!error}>
            <Plus size={15} /> Nouvelle commande
          </Button>
        )}
      </div>
    </>
  );

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {enTete}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <ErrorState message={error} onRetry={reload} />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {enTete}
        <Skeleton height="h-16" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} height="h-20" />)}
        </div>
        <Skeleton height="h-56" />
        <Skeleton height="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {enTete}

      <PeriodeFiscaleSelector debutExercice={debutExercice} onChange={setPeriode} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DeploiementKpiCard label="Montant total commande" value={euros(totaux.montant_commande)} icon={Wallet} color="#7C6FCD" />
        <DeploiementKpiCard label="Nombre de commandes" value={totaux.nb_commandes ?? 0} icon={Hash} color="#1F4E79" />
        <DeploiementKpiCard label="Commandes a renouveler" value={totaux.nb_a_renouveler ?? 0} icon={RefreshCw} color="#F59E0B" onClick={() => toggleKpi('a_renouveler')} active={activeKpi === 'a_renouveler'} />
        <DeploiementKpiCard label="Montant a renouveler" value={euros(totaux.montant_a_renouveler)} icon={TrendingUp} color="#EF4444" />
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Timeline des commandes (montant par mois)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v / 1000).toLocaleString('fr-FR')} k€`} />
            <Tooltip formatter={v => euros(v)} />
            <Bar dataKey="montant" name="Montant" fill="#7C6FCD" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Budget vs commandes {agregats && <span className="font-normal text-gray-500">- {agregats.periode_debut} a {agregats.periode_fin}</span>}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Realise (commandes)</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{euros(totaux.montant_commande)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Budget</p>
            <p className="text-lg font-semibold text-gray-400">A venir</p>
            <p className="text-xs text-gray-400 mt-1">Le volet budget sera branche avec le module 4.</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterSociete} onChange={e => setFilterSociete(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les societes</option>
          {societes.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
        </select>
        <select value={filterRevendeur} onChange={e => setFilterRevendeur(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les revendeurs</option>
          {revendeurs.filter(r => commandes.some(k => k.id_revendeur === r.id)).map(r => <option key={r.id} value={r.id}>{r.raison_sociale}</option>)}
        </select>
        <select value={filterContrat} onChange={e => setFilterContrat(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les contrats</option>
          {contrats.filter(c => commandes.some(k => k.id_contrat === c.id)).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={filterRenouvellement} onChange={e => setFilterRenouvellement(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Renouvellement : tous</option>
          <option value="oui">A renouveler</option>
          <option value="non">Sans renouvellement</option>
        </select>
        {hasActiveFiltres && (
          <button onClick={resetFiltres} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-2">
            <X size={14} /> Reinitialiser les filtres
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable
          columns={columns}
          data={filtrees}
          filename="commandes"
          emptyState={{ message: commandes.length === 0 ? 'Aucune commande enregistree.' : 'Aucune commande ne correspond aux filtres.' }}
        />
      </div>

      <CommandeFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, commande: null })}
        onSaved={reload}
        commande={formModal.commande}
        contrats={contrats}
        societes={societes}
        revendeurs={revendeurs}
        modes={modes}
      />
    </div>
  );
}