// LicencesPage - vue patrimoniale du parc de licences (droits acquis), groupee
// par editeur puis produit. Donnees API : /licences, /produits, /commandes,
// /revendeurs, /unites-mesure, /mainteneurs. Statuts d'echeance et de
// maintenance, balance droits/usage et niveau de conformite viennent de l'API,
// jamais recalcules ici. Les montants sont servis a null (montants_masques)
// sans consulter_kpi_financiers.
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Layers, List, AlertTriangle, Wallet, Hash, CalendarClock, X } from 'lucide-react';
import { licencesService, referentielsLicencesService, formatMontant, editeurPourLogo } from '../../services/licencesService';
import { referentielsContratsService } from '../../services/contratsService';
import { commandesService } from '../../services/commandesService';
import { optionnel } from '../../services/http';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Breadcrumb from '../ui/Breadcrumb';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import LogoEditeur from '../referentiels/LogoEditeur';
import StatutEcheanceBadge from '../contrats/StatutEcheanceBadge';
import ConformiteGaugeBar from './ConformiteGaugeBar';
import DeploiementKpiCard from './DeploiementKpiCard';
import LicenceFormModal from './LicenceFormModal';
import StatutMaintenanceBadge from './StatutMaintenanceBadge';
import EcheancesFrise from './EcheancesFrise';
import useRbac from '../../hooks/useRbac';
import useAuth from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

const SELECT_CLS = 'text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

function libelleType(t) { return t === 'perpetuelle' ? 'Perpétuelle' : 'Souscription'; }

export default function LicencesPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite } = useRbac({ write: 'saisir_licence' });
  const { hasPermission } = useAuth();
  const montantsVisibles = hasPermission('consulter_kpi_financiers');

  const [licences, setLicences] = useState([]);
  const [produits, setProduits] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [revendeurs, setRevendeurs] = useState([]);
  const [unites, setUnites] = useState([]);
  const [mainteneurs, setMainteneurs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);

  const [vueGroupee, setVueGroupee] = useState(true);
  const [filterEditeur, setFilterEditeur] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterConformite, setFilterConformite] = useState('');
  const [filterMaintenance, setFilterMaintenance] = useState('');
  const [filterEcheance, setFilterEcheance] = useState('');
  const [activeKpi, setActiveKpi] = useState(null);
  const [searchParams] = useSearchParams();
  const produitParam = searchParams.get('produit') ?? '';
  const [formModal, setFormModal] = useState({ open: false, licence: null });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      // Seules les licences sont indispensables. Les referentiels alimentent
      // les logos, les filtres et le formulaire : un droit manquant sur eux
      // prive de ces commodites, pas de la liste.
      const [l, p, k, r, u, m] = await Promise.all([
        licencesService.list(),
        optionnel(referentielsLicencesService.produits()),
        optionnel(commandesService.list()),
        optionnel(referentielsContratsService.revendeurs()),
        optionnel(referentielsLicencesService.unitesMesure()),
        optionnel(referentielsLicencesService.mainteneurs()),
      ]);
      setLicences(l); setProduits(p); setCommandes(k); setRevendeurs(r); setUnites(u); setMainteneurs(m);
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

  const produitParId = useMemo(() => new Map(produits.map(p => [p.id, p])), [produits]);
  const logoEditeur = (l) => editeurPourLogo(l.editeur_label, produitParId.get(l.id_produit)?.editeur_url_logo_defaut);

  const editeurs = useMemo(() => {
    const index = new Map();
    for (const l of licences) if (l.id_editeur && !index.has(l.id_editeur)) index.set(l.id_editeur, l.editeur_label ?? '-');
    return [...index.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [licences]);

  function matchesKpi(l, kpi) {
    if (kpi === 'depassement') return l.produit_niveau === 'depassement';
    if (kpi === 'echeances') return l.statut_echeance === 'expire' || l.statut_echeance === 'a_renouveler' || l.statut_maintenance === 'echue';
    return true;
  }

  const filtered = useMemo(() => licences.filter(l => {
    if (produitParam && l.id_produit !== produitParam) return false;
    if (filterEditeur && l.id_editeur !== filterEditeur) return false;
    if (filterType && l.type !== filterType) return false;
    if (filterConformite && l.produit_niveau !== filterConformite) return false;
    if (filterMaintenance && l.statut_maintenance !== filterMaintenance) return false;
    if (filterEcheance && l.statut_echeance !== filterEcheance) return false;
    if (activeKpi && !matchesKpi(l, activeKpi)) return false;
    return true;
  }), [licences, produitParam, filterEditeur, filterType, filterConformite, filterMaintenance, filterEcheance, activeKpi]);

  // Groupes editeur -> produit, construits a partir des licences filtrees :
  // la balance par produit (droits, usage, niveau) est portee par chaque
  // ligne, identique sur toutes les licences du produit.
  const groupes = useMemo(() => {
    const parEditeur = new Map();
    for (const l of filtered) {
      const cleE = l.id_editeur ?? 'sans-editeur';
      if (!parEditeur.has(cleE)) parEditeur.set(cleE, { id: cleE, label: l.editeur_label ?? 'Éditeur non renseigné', logo: logoEditeur(l), produits: new Map() });
      const e = parEditeur.get(cleE);
      if (!e.produits.has(l.id_produit)) e.produits.set(l.id_produit, { id: l.id_produit, label: l.produit_label ?? l.id_produit, droits: l.produit_droits, usage: l.produit_usage_declare, niveau: l.produit_niveau, licences: [] });
      e.produits.get(l.id_produit).licences.push(l);
    }
    return [...parEditeur.values()]
      .map(e => ({ ...e, produits: [...e.produits.values()].sort((a, b) => a.label.localeCompare(b.label)) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, produitParId]);

  const kpis = useMemo(() => {
    const droitsActifs = licences.filter(l => l.droits_actifs).reduce((s, l) => s + l.quantite, 0);
    const valeurParc = montantsVisibles ? licences.reduce((s, l) => s + (l.cout_licence ?? 0), 0) : null;
    const produitsDepassement = new Set(licences.filter(l => l.produit_niveau === 'depassement').map(l => l.id_produit)).size;
    const echeances = licences.filter(l => matchesKpi(l, 'echeances')).length;
    return { droitsActifs, valeurParc, produitsDepassement, echeances };
  }, [licences, montantsVisibles]);

  function toggleKpi(kpi) { setActiveKpi(prev => prev === kpi ? null : kpi); }
  function resetFiltres() { setFilterEditeur(''); setFilterType(''); setFilterConformite(''); setFilterMaintenance(''); setFilterEcheance(''); setActiveKpi(null); }
  const hasActiveFiltres = !!(filterEditeur || filterType || filterConformite || filterMaintenance || filterEcheance || activeKpi);

  function handleSaved(saved) {
    setLicences(prev => prev.some(l => l.id === saved.id) ? prev.map(l => l.id === saved.id ? saved : l) : [saved, ...prev]);
    // La balance par produit des autres lots a change : rechargement silencieux.
    load();
  }

  const columns = [
    { key: 'label', label: 'Licence', sortable: true, getValue: r => r.label ?? r.produit_label ?? '', render: r => (
      <button onClick={() => navigate(`/conformite/licences/${r.id}`)} className="font-medium text-blue-800 hover:underline text-left">{r.label ?? r.produit_label ?? r.id}</button>
    ) },
    { key: 'produit_label', label: 'Produit', sortable: true, render: r => r.produit_label ?? '-' },
    { key: 'editeur_label', label: 'Éditeur', sortable: true, render: r => r.editeur_label ?? '-' },
    { key: 'type', label: 'Type', sortable: true, render: r => libelleType(r.type) },
    { key: 'quantite', label: 'Quantité', sortable: true, render: r => `${r.quantite} ${r.unite_label ?? ''}` },
    { key: 'cout_licence', label: 'Coût', sortable: true, getValue: r => r.cout_licence ?? -1, csvValue: r => r.montants_masques ? 'Masqué' : (r.cout_licence ?? ''), render: r => formatMontant(r.cout_licence, r.montants_masques) },
    { key: 'statut_echeance', label: 'Échéance', sortable: true, render: r => (
      <span className="inline-flex items-center gap-1.5"><StatutEcheanceBadge statut={r.statut_echeance} />{r.date_fin_souscription && <span className="text-xs text-gray-500">{r.date_fin_souscription}</span>}</span>
    ) },
    { key: 'conformite', label: 'Balance produit', csvValue: r => `${r.produit_usage_declare}/${r.produit_droits} ${r.produit_niveau}`, render: r => (
      <ConformiteGaugeBar droits={r.produit_droits} usage={r.produit_usage_declare} niveau={r.produit_niveau} unite={r.unite_label ?? ''} label="" />
    ) },
    { key: 'statut_maintenance', label: 'Maintenance', sortable: true, render: r => <StatutMaintenanceBadge licence={r} /> },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Droits d\'usage' }, { label: 'Licences' }]} />
        <Skeleton lines={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Droits d\'usage' }, { label: 'Licences' }]} />
        <ErrorState message={error} status={errorStatus} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Droits d\'usage' }, { label: 'Licences' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Licences</h1>
          <p className="text-sm text-gray-500 mt-0.5">Le patrimoine de droits acquis et la balance droits vs usage déclaré</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button onClick={() => setVueGroupee(true)} aria-label="Vue groupée" className={`p-1.5 rounded ${vueGroupee ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-800' : 'text-gray-500'}`}>
              <Layers size={15} />
            </button>
            <button onClick={() => setVueGroupee(false)} aria-label="Vue liste" className={`p-1.5 rounded ${!vueGroupee ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-800' : 'text-gray-500'}`}>
              <List size={15} />
            </button>
          </div>
          {canWrite && (
            <Button variant="primary" onClick={() => setFormModal({ open: true, licence: null })}>
              <Plus size={15} /> Nouvelle licence
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DeploiementKpiCard label="Droits acquis actifs" value={kpis.droitsActifs.toLocaleString('fr-FR')} icon={Hash} color="#1F4E79" />
        <DeploiementKpiCard label={montantsVisibles ? 'Valeur du parc' : 'Valeur du parc (masquée)'} value={montantsVisibles ? formatMontant(kpis.valeurParc) : 'Masqué'} icon={Wallet} color="#7C6FCD" />
        <DeploiementKpiCard label="Produits en dépassement" value={kpis.produitsDepassement} icon={AlertTriangle} color="#EF4444" onClick={() => toggleKpi('depassement')} active={activeKpi === 'depassement'} />
        <DeploiementKpiCard label="Échéances à traiter" value={kpis.echeances} icon={CalendarClock} color="#F59E0B" onClick={() => toggleKpi('echeances')} active={activeKpi === 'echeances'} />
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Frise des échéances de maintenance et de souscription</h2>
        <EcheancesFrise licences={licences} />
      </section>

      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterEditeur} onChange={e => setFilterEditeur(e.target.value)} className={SELECT_CLS}>
          <option value="">Tous les éditeurs</option>
          {editeurs.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className={SELECT_CLS}>
          <option value="">Tous les types</option>
          <option value="souscription">Souscription</option>
          <option value="perpetuelle">Perpétuelle</option>
        </select>
        <select value={filterEcheance} onChange={e => setFilterEcheance(e.target.value)} className={SELECT_CLS}>
          <option value="">Toute échéance</option>
          <option value="actif">Actif</option>
          <option value="a_renouveler">À renouveler</option>
          <option value="expire">Expiré</option>
          <option value="perpetuel">Perpétuel</option>
        </select>
        <select value={filterConformite} onChange={e => setFilterConformite(e.target.value)} className={SELECT_CLS}>
          <option value="">Toute conformité</option>
          <option value="conforme">Conforme</option>
          <option value="attention">Attention</option>
          <option value="depassement">Dépassement</option>
        </select>
        <select value={filterMaintenance} onChange={e => setFilterMaintenance(e.target.value)} className={SELECT_CLS}>
          <option value="">Maintenance : toutes</option>
          <option value="active">Active</option>
          <option value="echue">Échue</option>
          <option value="arretee">Arrêtée</option>
          <option value="aucune">Sans maintenance</option>
        </select>
        {hasActiveFiltres && (
          <button onClick={resetFiltres} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><X size={13} /> Réinitialiser</button>
        )}
      </div>

      {vueGroupee ? (
        <div className="flex flex-col gap-4">
          {groupes.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <EmptyState title="Aucune licence" description={licences.length ? 'Aucune licence ne correspond aux filtres.' : 'Aucune licence enregistrée. Créez la première licence du parc.'} />
            </div>
          ) : groupes.map(editeur => (
            <div key={editeur.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                <LogoEditeur editeur={editeur.logo} size={24} />
                <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{editeur.label}</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {editeur.produits.map(produit => {
                  const singleId = produit.licences.length === 1 ? produit.licences[0].id : null;
                  return (
                    <div
                      key={produit.id}
                      className={`p-4 flex flex-col gap-3 ${singleId ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors' : ''}`}
                      onClick={singleId ? () => navigate(`/conformite/licences/${singleId}`) : undefined}
                      onKeyDown={singleId ? (e) => { if (e.key === 'Enter') navigate(`/conformite/licences/${singleId}`); } : undefined}
                      role={singleId ? 'button' : undefined}
                      tabIndex={singleId ? 0 : undefined}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{produit.label}</span>
                        {produit.licences.length === 1
                          ? <StatutMaintenanceBadge licence={produit.licences[0]} compact />
                          : <Badge variant="neutral" label={`${produit.licences.length} lots de licences`} />
                        }
                      </div>
                      <ConformiteGaugeBar
                        droits={produit.droits} usage={produit.usage} niveau={produit.niveau}
                        unite={produit.licences[0]?.unite_label ?? ''} label="Droits acquis vs usage déclaré"
                      />
                      <div className="flex flex-wrap gap-2">
                        {produit.licences.map(l => (
                          <button
                            key={l.id}
                            onClick={(e) => { if (singleId) e.stopPropagation(); navigate(`/conformite/licences/${l.id}`); }}
                            className={`inline-flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${l.droits_actifs ? 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 line-through'}`}
                            title={l.droits_actifs ? undefined : 'Souscription expirée, exclue de la balance'}
                          >
                            {l.label ? `${l.label} - ` : ''}{l.quantite} {l.unite_label ?? ''} - {libelleType(l.type)} - {formatMontant(l.cout_licence, l.montants_masques)}
                            <StatutEcheanceBadge statut={l.statut_echeance} />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <DataTable
            columns={columns}
            data={filtered}
            filename="licences"
            emptyState={{ message: licences.length ? 'Aucune licence ne correspond aux filtres.' : 'Aucune licence enregistrée.' }}
            onRowClick={r => navigate(`/conformite/licences/${r.id}`)}
          />
        </div>
      )}

      <LicenceFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, licence: null })}
        onSaved={handleSaved}
        licence={formModal.licence}
        produits={produits} commandes={commandes} revendeurs={revendeurs} unites={unites} mainteneurs={mainteneurs}
        montantsVisibles={montantsVisibles}
      />
    </div>
  );
}
