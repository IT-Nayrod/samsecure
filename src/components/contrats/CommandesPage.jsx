// CommandesPage - vue financiere et transactionnelle des commandes (Droits d'usage)
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Wallet, Hash, RefreshCw, TrendingUp, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  mockCommandes as initialCommandes, getContrat, getSocieteLabelContrat, getRevendeurLabelCommande, getEcheanceCommande,
} from '../../data/mockContrats';
import { mockSocietes, mockRevendeurs } from '../../data/mockReferentiels';
import { mockLicences } from '../../data/mockDeploiement';
import { mockBudgets } from '../../data/mockBudgets';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Breadcrumb from '../ui/Breadcrumb';
import StatutValidationBadge from '../referentiels/StatutValidationBadge';
import DeploiementKpiCard from '../deploiement/DeploiementKpiCard';
import PeriodeFiscaleSelector from '../ui/PeriodeFiscaleSelector';
import CommandeFormModal from './CommandeFormModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';
import { formatDate } from '../../utils/dateUtils';
import { isDateInRange, getExerciceFiscalKey } from '../../utils/fiscalPeriod';

export default function CommandesPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, submitsForValidation } = useRbac();
  const { user } = useAuth();
  const [commandes, setCommandes] = useState(initialCommandes);
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

  function toggleKpi(kpi) {
    setActiveKpi(prev => prev === kpi ? null : kpi);
  }

  function resetFiltres() {
    setFilterContrat('');
    setFilterSociete('');
    setFilterRevendeur('');
    setFilterRenouvellement('');
    setActiveKpi(null);
  }

  const hasActiveFiltres = !!(filterContrat || filterSociete || filterRevendeur || filterRenouvellement || activeKpi);

  const dansPeriode = useMemo(() => commandes.filter(k => isDateInRange(k.date, periode)), [commandes, periode]);

  const filtrees = useMemo(() => {
    return dansPeriode.filter(k => {
      if ((filterContrat || contratParam) && k.id_contrat !== (filterContrat || contratParam)) return false;
      if ((filterSociete || societeParam) && k.id_societe !== (filterSociete || societeParam)) return false;
      if ((filterRevendeur || revendeurParam) && k.id_revendeur !== (filterRevendeur || revendeurParam)) return false;
      if (filterRenouvellement === 'oui' && !k.a_renouveler) return false;
      if (filterRenouvellement === 'non' && k.a_renouveler) return false;
      if (activeKpi === 'a_renouveler' && !k.a_renouveler) return false;
      return true;
    });
  }, [dansPeriode, filterContrat, filterSociete, filterRevendeur, filterRenouvellement, activeKpi, societeParam, revendeurParam, contratParam]);

  const kpis = useMemo(() => {
    const montantTotal = dansPeriode.reduce((s, k) => s + k.montant, 0);
    const aRenouveler = dansPeriode.filter(k => k.a_renouveler);
    const montantARenouveler = aRenouveler.reduce((s, k) => s + k.montant, 0);
    return { montantTotal, nombre: dansPeriode.length, nbARenouveler: aRenouveler.length, montantARenouveler };
  }, [dansPeriode]);

  // Budget vs commande (feature E) : compare le montant des commandes filtrees au budget de l'exercice en cours,
  // sur le meme perimetre (contrat selectionne, ou global sinon)
  const contratActif = filterContrat || contratParam || null;
  const exerciceCourant = getExerciceFiscalKey(societeActive);
  const budgetVsCommande = useMemo(() => {
    const licencesScope = contratActif ? mockLicences.filter(l => l.id_contrat === contratActif) : mockLicences;
    const budget = licencesScope.reduce((s, l) => {
      const b = mockBudgets.find(x => x.id_licence === l.id && x.exercice === exerciceCourant);
      return s + (b?.montant ?? 0);
    }, 0);
    const montantCommande = filtrees.reduce((s, k) => s + k.montant, 0);
    const pct = budget > 0 ? Math.round((montantCommande / budget) * 1000) / 10 : (montantCommande > 0 ? Infinity : 0);
    return { budget, montantCommande, ecart: budget - montantCommande, pct };
  }, [filtrees, contratActif, exerciceCourant]);

  const timeline = useMemo(() => {
    const parMois = new Map();
    dansPeriode.forEach(k => {
      const d = new Date(k.date);
      const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      parMois.set(cle, (parMois.get(cle) ?? 0) + k.montant);
    });
    return [...parMois.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cle, montant]) => {
        const [annee, mois] = cle.split('-');
        const label = new Date(Number(annee), Number(mois) - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        return { mois: label, montant };
      });
  }, [dansPeriode]);

  function handleSave(data, existing) {
    if (existing) {
      const resoumis = submitsForValidation;
      setCommandes(prev => prev.map(k => k.id === existing.id ? {
        ...k, ...data,
        statut_validation: resoumis ? 'en_attente' : 'valide',
        soumis_par: `${user.prenom} ${user.nom}`,
      } : k));
      addToast({ type: 'success', message: resoumis ? 'Modification soumise a validation.' : 'Commande mise a jour.' });
    } else {
      const newCommande = {
        id: `k-${Date.now()}`, ...data,
        statut_validation: submitsForValidation ? 'en_attente' : 'valide',
        soumis_par: `${user.prenom} ${user.nom}`,
      };
      setCommandes(prev => [...prev, newCommande]);
      addToast({ type: 'success', message: submitsForValidation ? 'Commande soumise a validation.' : 'Commande creee.' });
    }
  }

  const columns = [
    { key: 'label', label: 'Label', sortable: true, render: r => (
      <button onClick={() => navigate(`/contrats/commandes/${r.id}`)} className="font-medium text-blue-800 hover:underline text-left">{r.label}</button>
    ) },
    { key: 'numero_devis', label: 'Devis', sortable: true },
    { key: 'reference_interne', label: 'Reference', sortable: true },
    { key: 'contrat', label: 'Contrat', getValue: r => getContrat(r.id_contrat)?.label ?? '', render: r => getContrat(r.id_contrat)?.label ?? '-' },
    { key: 'societe', label: 'Societe', getValue: r => getSocieteLabelContrat(r.id_societe) ?? '', render: r => getSocieteLabelContrat(r.id_societe) ?? '-' },
    { key: 'revendeur', label: 'Revendeur', getValue: r => getRevendeurLabelCommande(r.id_revendeur) ?? '', render: r => getRevendeurLabelCommande(r.id_revendeur) ?? '-' },
    { key: 'mode', label: 'Mode' },
    { key: 'montant', label: 'Montant', sortable: true, getValue: r => r.montant, render: r => `${r.montant.toLocaleString('fr-FR')} €` },
    { key: 'date', label: 'Date', sortable: true, render: r => formatDate(r.date) },
    { key: 'renouvellement', label: 'Renouvellement', render: r => {
      if (!r.a_renouveler) return <span className="text-gray-400">-</span>;
      const echeance = getEcheanceCommande(r);
      return <Badge variant={echeance.statut === 'expire' ? 'error' : echeance.statut === 'a_renouveler' ? 'warning' : 'neutral'} label={r.date_fin ? formatDate(r.date_fin) : 'A renouveler'} />;
    } },
    { key: 'statut_validation', label: 'Validation', sortable: true, render: r => <StatutValidationBadge statut={r.statut_validation} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Droits d\'usage' }, { label: 'Commandes' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Commandes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Suivi financier des actes d'achat</p>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={() => setFormModal({ open: true, commande: null })}>
            <Plus size={15} /> Nouvelle commande
          </Button>
        )}
      </div>

      <PeriodeFiscaleSelector societeId={societeActive} onChange={setPeriode} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DeploiementKpiCard label="Montant total commande" value={`${kpis.montantTotal.toLocaleString('fr-FR')} €`} icon={Wallet} color="#7C6FCD" />
        <DeploiementKpiCard label="Nombre de commandes" value={kpis.nombre} icon={Hash} color="#1F4E79" />
        <DeploiementKpiCard label="Commandes a renouveler" value={kpis.nbARenouveler} icon={RefreshCw} color="#F59E0B" onClick={() => toggleKpi('a_renouveler')} active={activeKpi === 'a_renouveler'} />
        <DeploiementKpiCard label="Montant souscriptions a echeance" value={`${kpis.montantARenouveler.toLocaleString('fr-FR')} €`} icon={TrendingUp} color="#EF4444" />
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Timeline des commandes (montant par mois)</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune commande sur la periode selectionnee.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v / 1000).toLocaleString('fr-FR')} k€`} />
              <Tooltip formatter={v => `${v.toLocaleString('fr-FR')} €`} />
              <Bar dataKey="montant" name="Montant" fill="#7C6FCD" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Budget vs commande - exercice {exerciceCourant}{contratActif ? ` (${getContrat(contratActif)?.label ?? contratActif})` : ' (tous contrats)'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Budget</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{budgetVsCommande.budget.toLocaleString('fr-FR')} €</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Montant commande</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{budgetVsCommande.montantCommande.toLocaleString('fr-FR')} €</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Ecart</p>
            <p className="text-lg font-semibold" style={{ color: budgetVsCommande.ecart < 0 ? '#EF4444' : '#22C55E' }}>
              {budgetVsCommande.ecart >= 0 ? '+' : ''}{budgetVsCommande.ecart.toLocaleString('fr-FR')} €
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">% consommation</p>
            <p className="text-lg font-semibold" style={{ color: budgetVsCommande.pct > 100 ? '#EF4444' : budgetVsCommande.pct >= 90 ? '#F59E0B' : '#22C55E' }}>
              {Number.isFinite(budgetVsCommande.pct) ? `${budgetVsCommande.pct}%` : '-'}
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterSociete} onChange={e => setFilterSociete(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les societes</option>
          {mockSocietes.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
        </select>
        <select value={filterRevendeur} onChange={e => setFilterRevendeur(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les revendeurs</option>
          {mockRevendeurs.filter(r => commandes.some(k => k.id_revendeur === r.id)).map(r => <option key={r.id} value={r.id}>{r.raison_sociale}</option>)}
        </select>
        <select value={filterContrat} onChange={e => setFilterContrat(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les contrats</option>
          {[...new Set(commandes.map(k => k.id_contrat))].map(idC => <option key={idC} value={idC}>{getContrat(idC)?.label ?? idC}</option>)}
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
          emptyState={{ message: 'Aucune commande ne correspond aux filtres.' }}
        />
      </div>

      <CommandeFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, commande: null })}
        onSave={handleSave}
        commande={formModal.commande}
      />
    </div>
  );
}
