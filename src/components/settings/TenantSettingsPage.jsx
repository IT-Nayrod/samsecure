// TenantSettingsPage - Section 5 Specs UX v0.5
import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { mockTenant } from '../../data/mockSettings';
import { mockSocietes } from '../../data/mockReferentiels';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import FormField from '../ui/FormField';

const TABS = ['Informations client', 'Sociétés', 'Configuration', 'Connecteurs'];
const CONNECTEURS = ['Lansweeper', 'GLPI', 'Active Directory', 'SCCM', 'Intune', 'Ivanti'];

function InfoTab() {
  const fields = [
    ['Raison sociale', mockTenant.raison_sociale],
    ['SIRET', mockTenant.siret],
    ['Abonnement', mockTenant.abonnement],
    ['Administrateur', mockTenant.admin],
  ];
  return (
    <div className="flex flex-col gap-4 max-w-lg">
      {fields.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{value}</p>
        </div>
      ))}
    </div>
  );
}

function SocietesTab() {
  const columns = [
    { key: 'raison_sociale', label: 'Raison sociale', sortable: true },
    { key: 'siret', label: 'SIRET' },
    { key: 'societe_parent_id', label: 'Société parente', render: r => mockSocietes.find(s => s.id === r.societe_parent_id)?.raison_sociale ?? '-' },
    { key: 'duree_amortissement', label: 'Durée amort.', render: r => `${r.duree_amortissement} mois` },
    { key: 'delai_revalidation', label: 'Délai revalid.', render: r => `${r.delai_revalidation} jours` },
    { key: 'actif', label: 'Statut', render: r => <Badge variant={r.actif ? 'success' : 'neutral'} label={r.actif ? 'Active' : 'Inactive'} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-sm text-blue-700 dark:text-blue-400">La création et l'édition des sociétés se font désormais depuis Administration &gt; Organisation.</p>
        <Link to="/referentiels/organisation">
          <Button variant="secondary" size="sm">Gérer les sociétés <ArrowRight size={14} /></Button>
        </Link>
      </div>
      <DataTable columns={columns} data={mockSocietes} filename="societes" emptyState={{ message: 'Aucune société.' }} />
    </div>
  );
}

function ConfigTab() {
  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <FormField label="Langue par défaut">
        <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
          <option value="fr">Français</option>
        </select>
      </FormField>
      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Seuils dashboard</h4>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-700 dark:text-blue-400">Ces seuils sont gérés par l'équipe SamSecure. Contactez le support pour les modifier.</p>
        </div>
      </div>
    </div>
  );
}

function ConnecteursTab() {
  const [infoModal, setInfoModal] = useState(null);
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        {CONNECTEURS.map(name => (
          <button
            key={name}
            onClick={() => setInfoModal(name)}
            className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-blue-300 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-lg font-bold text-gray-500">
              {name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{name}</p>
              <span className="text-[10px] font-medium bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">Non configuré</span>
            </div>
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full whitespace-nowrap">Disponible v2</span>
          </button>
        ))}
      </div>
      <Modal isOpen={!!infoModal} onClose={() => setInfoModal(null)} title={infoModal ?? 'Connecteur'} size="sm"
        footer={<Button variant="primary" onClick={() => setInfoModal(null)}>Fermer</Button>}
      >
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-3xl font-bold text-gray-400">
            {infoModal?.[0]}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Cette fonctionnalité sera disponible dans la version 2.0 de SamSecure.
          </p>
        </div>
      </Modal>
    </>
  );
}

export default function TenantSettingsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'connecteurs' ? 3 : 0;
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Paramètres tenant</h1>
      <div className="flex gap-6 min-h-[500px]">
        <nav className="flex flex-col gap-1 w-52 flex-shrink-0">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${tab === i ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          {tab === 0 && <InfoTab />}
          {tab === 1 && <SocietesTab />}
          {tab === 2 && <ConfigTab />}
          {tab === 3 && <ConnecteursTab />}
        </div>
      </div>
    </div>
  );
}
