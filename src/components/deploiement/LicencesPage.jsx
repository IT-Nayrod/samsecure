// LicencesPage - vue patrimoniale du parc de licences (droits acquis), groupee par editeur puis produit
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Layers, List, PackageCheck, ShieldOff, Wallet, AlertTriangle, Hash } from 'lucide-react';
import {
  mockLicences as initialLicences, getDroitsTotalProduit, getTriangleProduit,
} from '../../data/mockDeploiement';
import { mockProduits, mockEditeurs, getVersionsByProduit } from '../../data/mockReferentiels';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Breadcrumb from '../ui/Breadcrumb';
import EmptyState from '../ui/EmptyState';
import LogoEditeur from '../referentiels/LogoEditeur';
import ConformiteGaugeBar from './ConformiteGaugeBar';
import DeploiementKpiCard from './DeploiementKpiCard';
import LicenceFormModal from './LicenceFormModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';

function getProduit(idProduit) {
  return mockProduits.find(p => p.id === idProduit) ?? null;
}

function getEditeur(idEditeur) {
  return mockEditeurs.find(e => e.id === idEditeur) ?? null;
}

function getMaintenanceStatut(licence, produit) {
  if (!produit?.a_maintenir) return null;
  if (licence.date_arret_maintenance) {
    const version = getVersionsByProduit(licence.id_produit).find(v => v.id === licence.version_figee_id);
    return { active: false, dateArret: licence.date_arret_maintenance, versionLabel: version?.label ?? null };
  }
  return { active: true };
}

function MaintenanceBadge({ statut }) {
  if (!statut) return null;
  if (statut.active) return <Badge variant="success" label="Maintenance active" />;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
      <ShieldOff size={11} /> Maintenance arretee le {statut.dateArret}{statut.versionLabel ? ` - version figee ${statut.versionLabel}` : ''}
    </span>
  );
}

export default function LicencesPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite } = useRbac();
  const [licences, setLicences] = useState(initialLicences);
  const [vueGroupee, setVueGroupee] = useState(true);
  const [filterEditeur, setFilterEditeur] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterConformite, setFilterConformite] = useState('');
  const [filterMaintenance, setFilterMaintenance] = useState('');
  const [searchParams] = useSearchParams();
  const [filterProduit] = useState(searchParams.get('produit') ?? '');
  const [formModal, setFormModal] = useState({ open: false, licence: null });

  const produitsAvecLicence = useMemo(() => {
    const ids = new Set(licences.map(l => l.id_produit));
    return mockProduits.filter(p => ids.has(p.id));
  }, [licences]);

  const filteredLicences = useMemo(() => {
    return licences.filter(l => {
      const produit = getProduit(l.id_produit);
      if (filterProduit && l.id_produit !== filterProduit) return false;
      if (filterEditeur && produit?.id_editeur !== filterEditeur) return false;
      if (filterType && l.type !== filterType) return false;
      if (filterMaintenance) {
        const maintenance = getMaintenanceStatut(l, produit);
        if (filterMaintenance === 'active' && maintenance?.active !== true) return false;
        if (filterMaintenance === 'arretee' && maintenance?.active !== false) return false;
      }
      if (filterConformite) {
        const tri = getTriangleProduit(l.id_produit);
        if (tri.niveauDeclare !== filterConformite) return false;
      }
      return true;
    });
  }, [licences, filterProduit, filterEditeur, filterType, filterMaintenance, filterConformite]);

  const produitsFiltres = useMemo(() => {
    const ids = new Set(filteredLicences.map(l => l.id_produit));
    return produitsAvecLicence.filter(p => ids.has(p.id));
  }, [filteredLicences, produitsAvecLicence]);

  const editeursGroupes = useMemo(() => {
    const idsEditeurs = [...new Set(produitsFiltres.map(p => p.id_editeur).filter(Boolean))];
    return idsEditeurs.map(idEd => ({
      editeur: getEditeur(idEd),
      produits: produitsFiltres.filter(p => p.id_editeur === idEd),
    })).sort((a, b) => (a.editeur?.raison_sociale ?? '').localeCompare(b.editeur?.raison_sociale ?? ''));
  }, [produitsFiltres]);

  const kpis = useMemo(() => {
    const totalLicences = licences.reduce((s, l) => s + l.quantite, 0);
    const valeurParc = licences.reduce((s, l) => s + l.cout, 0);
    const nbDepassement = produitsAvecLicence.filter(p => getTriangleProduit(p.id).niveauDeclare === 'depassement').length;
    const nbDisponibles = produitsAvecLicence.reduce((s, p) => {
      const tri = getTriangleProduit(p.id);
      return s + Math.max(tri.droits - tri.declare, 0);
    }, 0);
    return { totalLicences, valeurParc, nbDepassement, nbDisponibles };
  }, [licences, produitsAvecLicence]);

  function handleSave(data, existing) {
    if (existing) {
      setLicences(prev => prev.map(l => l.id === existing.id ? { ...l, ...data } : l));
      addToast({ type: 'success', message: 'Licence mise a jour.' });
    } else {
      const newLicence = { id: `l-${Date.now()}`, ...data, version_figee_id: null, date_arret_maintenance: null };
      setLicences(prev => [...prev, newLicence]);
      addToast({ type: 'success', message: 'Licence creee.' });
    }
  }

  const columns = [
    { key: 'produit', label: 'Produit', sortable: true, getValue: r => getProduit(r.id_produit)?.label ?? '', render: r => (
      <button onClick={() => navigate(`/conformite/licences/${r.id}`)} className="font-medium text-blue-800 hover:underline text-left">{getProduit(r.id_produit)?.label ?? r.id_produit}</button>
    ) },
    { key: 'editeur', label: 'Editeur', getValue: r => getEditeur(getProduit(r.id_produit)?.id_editeur)?.raison_sociale ?? '', render: r => getEditeur(getProduit(r.id_produit)?.id_editeur)?.raison_sociale ?? '-' },
    { key: 'type', label: 'Type', sortable: true, render: r => r.type === 'perpetuelle' ? 'Perpetuelle' : 'Souscription' },
    { key: 'quantite', label: 'Quantite', sortable: true, render: r => `${r.quantite} ${r.unite_mesure}` },
    { key: 'cout', label: 'Cout', sortable: true, getValue: r => r.cout, render: r => `${r.cout.toLocaleString('fr-FR')} €` },
    { key: 'conformite', label: 'Conformite', render: r => {
      const tri = getTriangleProduit(r.id_produit);
      return <ConformiteGaugeBar droits={getDroitsTotalProduit(r.id_produit)} usage={tri.declare} niveau={tri.niveauDeclare} unite={r.unite_mesure} label="" />;
    } },
    { key: 'maintenance', label: 'Maintenance', render: r => {
      const maintenance = getMaintenanceStatut(r, getProduit(r.id_produit));
      return maintenance ? <MaintenanceBadge statut={maintenance} /> : <span className="text-gray-400">-</span>;
    } },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Droits d\'usage' }, { label: 'Licences' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Licences</h1>
          <p className="text-sm text-gray-500 mt-0.5">Le patrimoine de droits acquis et la balance droits vs usage</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button onClick={() => setVueGroupee(true)} aria-label="Vue groupee" className={`p-1.5 rounded ${vueGroupee ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-800' : 'text-gray-500'}`}>
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
        <DeploiementKpiCard label="Licences au total" value={kpis.totalLicences.toLocaleString('fr-FR')} icon={Hash} color="#1F4E79" />
        <DeploiementKpiCard label="Valeur du parc" value={`${kpis.valeurParc.toLocaleString('fr-FR')} €`} icon={Wallet} color="#7C6FCD" />
        <DeploiementKpiCard label="Produits en depassement" value={kpis.nbDepassement} icon={AlertTriangle} color="#EF4444" />
        <DeploiementKpiCard label="Licences disponibles" value={kpis.nbDisponibles} icon={PackageCheck} color="#22C55E" />
      </div>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterEditeur} onChange={e => setFilterEditeur(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les editeurs</option>
          {mockEditeurs.filter(e => produitsAvecLicence.some(p => p.id_editeur === e.id)).map(e => <option key={e.id} value={e.id}>{e.raison_sociale}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les types</option>
          <option value="souscription">Souscription</option>
          <option value="perpetuelle">Perpetuelle</option>
        </select>
        <select value={filterConformite} onChange={e => setFilterConformite(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toute conformite</option>
          <option value="conforme">Conforme</option>
          <option value="attention">Attention</option>
          <option value="depassement">Depassement</option>
        </select>
        <select value={filterMaintenance} onChange={e => setFilterMaintenance(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Maintenance : toutes</option>
          <option value="active">Active</option>
          <option value="arretee">Arretee</option>
        </select>
      </div>

      {vueGroupee ? (
        <div className="flex flex-col gap-4">
          {editeursGroupes.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <EmptyState title="Aucune licence" description="Aucune licence ne correspond aux filtres." />
            </div>
          ) : editeursGroupes.map(({ editeur, produits }) => (
            <div key={editeur?.id ?? 'sans-editeur'} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                <LogoEditeur editeur={editeur} size={24} />
                <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{editeur?.raison_sociale}</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {produits.map(produit => {
                  const tri = getTriangleProduit(produit.id);
                  const licencesProduit = filteredLicences.filter(l => l.id_produit === produit.id);
                  const singleId = licencesProduit.length === 1 ? licencesProduit[0].id : null;
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
                        {licencesProduit.length === 1
                          ? <MaintenanceBadge statut={getMaintenanceStatut(licencesProduit[0], produit)} />
                          : produit.a_maintenir && <Badge variant="neutral" label={`${licencesProduit.length} lots de licences`} />
                        }
                      </div>
                      <ConformiteGaugeBar
                        droits={tri.droits} usage={tri.declare} niveau={tri.niveauDeclare}
                        unite={licencesProduit[0]?.unite_mesure} label="Droits acquis vs usage declare"
                      />
                      <div className="flex flex-wrap gap-2">
                        {licencesProduit.map(l => (
                          <button
                            key={l.id}
                            onClick={(e) => { if (singleId) e.stopPropagation(); navigate(`/conformite/licences/${l.id}`); }}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                          >
                            {l.quantite} {l.unite_mesure} - {l.type === 'perpetuelle' ? 'Perpetuelle' : 'Souscription'} - {l.cout.toLocaleString('fr-FR')} €
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
            data={filteredLicences}
            filename="licences"
            emptyState={{ message: 'Aucune licence ne correspond aux filtres.' }}
            onRowClick={r => navigate(`/conformite/licences/${r.id}`)}
          />
        </div>
      )}

      <LicenceFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, licence: null })}
        onSave={handleSave}
        licence={formModal.licence}
      />
    </div>
  );
}
