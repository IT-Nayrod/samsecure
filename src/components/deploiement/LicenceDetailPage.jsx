// LicenceDetailPage - fiche detail d'une licence : identite, origine et timeline de maintenance
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, ShieldOff, ChevronDown } from 'lucide-react';
import BudgetEmbeddedSection from '../budget/BudgetEmbeddedSection';
import {
  mockLicences, getMaintenanceHistorique, getContratLabel, getCommandeLabel, getRevendeurLabel, getTriangleProduit,
} from '../../data/mockDeploiement';
import { mockProduits, mockEditeurs, mockSocietes, getVersionsByProduit, getEditionsByProduit } from '../../data/mockReferentiels';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import LogoEditeur from '../referentiels/LogoEditeur';
import ConformiteGaugeBar from './ConformiteGaugeBar';
import LicenceFormModal from './LicenceFormModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';

export default function LicenceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite } = useRbac();
  const [licences, setLicences] = useState(mockLicences);
  const [formOpen, setFormOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(true);

  const licence = licences.find(l => l.id === id);

  if (!licence) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Droits d\'usage', to: '/conformite/licences' }, { label: 'Licences', to: '/conformite/licences' }, { label: 'Introuvable' }]} />
        <EmptyState title="Licence introuvable" description="Cette licence n'existe pas ou a ete supprimee." ctaLabel="Retour a la liste" onCta={() => navigate('/conformite/licences')} />
      </div>
    );
  }

  const produit = mockProduits.find(p => p.id === licence.id_produit);
  const editeur = mockEditeurs.find(e => e.id === produit?.id_editeur);
  const societe = mockSocietes.find(s => s.id === licence.id_societe);
  const edition = getEditionsByProduit(licence.id_produit).find(e => e.id === licence.id_edition);
  const version = getVersionsByProduit(licence.id_produit).find(v => v.id === licence.id_version);
  const versionFigee = getVersionsByProduit(licence.id_produit).find(v => v.id === licence.version_figee_id);
  const historique = getMaintenanceHistorique(licence.id);
  const tri = produit ? getTriangleProduit(produit.id) : null;
  const maintenanceActive = produit?.a_maintenir && !licence.date_arret_maintenance;

  function handleSave(data, existing) {
    setLicences(prev => prev.map(l => l.id === existing.id ? { ...l, ...data } : l));
    addToast({ type: 'success', message: 'Licence mise a jour.' });
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[
        { label: 'Droits d\'usage', to: '/conformite/licences' },
        { label: 'Licences', to: '/conformite/licences' },
        { label: produit?.label ?? licence.id },
      ]} />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <LogoEditeur editeur={editeur} size={48} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{produit?.label ?? 'Produit inconnu'}</h1>
              <Badge variant={licence.type === 'perpetuelle' ? 'neutral' : 'success'} label={licence.type === 'perpetuelle' ? 'Perpetuelle' : 'Souscription'} />
              {produit?.a_maintenir && (
                maintenanceActive
                  ? <Badge variant="success" label="Maintenance active" />
                  : <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"><ShieldOff size={11} /> Maintenance arretee</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">{editeur?.raison_sociale}{edition ? ` - ${edition.label}` : ''}{version ? ` - v${version.label}` : ''}</p>
          </div>
        </div>
        {canWrite && (
          <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}>
            <Pencil size={14} /> Editer
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Identite</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Quantite</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{licence.quantite} {licence.unite_mesure}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Cout</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{licence.cout.toLocaleString('fr-FR')} €</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Societe</p>
              {societe
                ? <Link to={`/referentiels/organisation/${societe.id}`} className="text-sm text-blue-800 hover:underline">{societe.raison_sociale}</Link>
                : <p className="text-sm text-gray-500">-</p>
              }
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Revendeur</p>
              {licence.id_revendeur
                ? <Link to={`/referentiels/revendeurs/${licence.id_revendeur}`} className="text-sm text-blue-800 hover:underline">{getRevendeurLabel(licence.id_revendeur)}</Link>
                : <p className="text-sm text-gray-500">-</p>
              }
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Contrat</p>
              {licence.id_contrat
                ? <Link to={`/contrats/liste/${licence.id_contrat}`} className="text-sm text-blue-800 hover:underline">{getContratLabel(licence.id_contrat)}</Link>
                : <p className="text-sm text-gray-500">-</p>
              }
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Commande</p>
              {licence.id_commande
                ? <Link to={`/contrats/commandes/${licence.id_commande}`} className="text-sm text-blue-800 hover:underline">{getCommandeLabel(licence.id_commande)}</Link>
                : <p className="text-sm text-gray-500">-</p>
              }
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Balance droits vs usage (produit)</h2>
          {tri && (
            <div className="flex flex-col gap-4">
              <ConformiteGaugeBar droits={tri.droits} usage={tri.declare} niveau={tri.niveauDeclare} unite={licence.unite_mesure} label="Droits acquis vs usage declare" />
              <ConformiteGaugeBar droits={tri.droits} usage={tri.reel} niveau={tri.niveauReel} unite={licence.unite_mesure} label="Droits acquis vs usage reel detecte" />
              <div className="flex gap-3 text-xs">
                <Link to={`/conformite/affectations?produit=${produit.id}`} className="text-blue-800 hover:underline">Voir les affectations</Link>
                <Link to={`/conformite/inventaire?produit=${produit.id}`} className="text-blue-800 hover:underline">Voir l'inventaire</Link>
              </div>
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden md:col-span-2">
          <button
            onClick={() => setBudgetOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Budget</h2>
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${budgetOpen ? '' : '-rotate-90'}`} />
          </button>
          {budgetOpen && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-700">
              <BudgetEmbeddedSection mode="licence" id={licence.id} />
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Maintenance</h2>
          {!produit?.a_maintenir ? (
            <p className="text-sm text-gray-500">Ce produit n'est pas soumis a la maintenance (pas de droit aux montees de version).</p>
          ) : (
            <div className="flex flex-col gap-3">
              {!maintenanceActive && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Maintenance arretee le <strong>{licence.date_arret_maintenance}</strong>.
                  {versionFigee && <> Version figee automatiquement sur <strong>{versionFigee.label}</strong>.</>}
                </p>
              )}
              {historique.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun historique de maintenance enregistre.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {historique.map(h => (
                    <li key={h.id} className="flex items-start gap-3">
                      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${h.date_fin && new Date(h.date_fin) < new Date() ? 'bg-gray-400' : 'bg-green-500'}`} />
                      <div>
                        <p className="text-sm text-gray-800 dark:text-gray-200">{h.prestataire}</p>
                        <p className="text-xs text-gray-500">Du {h.date_debut} au {h.date_fin ?? 'en cours'} - {h.cout.toLocaleString('fr-FR')} €</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>

      <LicenceFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} licence={licence} />
    </div>
  );
}
