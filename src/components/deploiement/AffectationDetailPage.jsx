// AffectationDetailPage - fiche detail d'une affectation : licence liee, balance, historique
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { mockAffectations, getRevalidationStatut, getTriangleProduit, getDroitsTotalProduit } from '../../data/mockDeploiement';
import { mockProduits, mockSocietes } from '../../data/mockReferentiels';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import StatutValidationBadge from '../referentiels/StatutValidationBadge';
import ValidationActions from '../referentiels/ValidationActions';
import ConformiteGaugeBar from './ConformiteGaugeBar';
import StatutRevalidationBadge from './StatutRevalidationBadge';
import AffectationFormModal from './AffectationFormModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';

export default function AffectationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canValidate } = useRbac();
  const [affectations, setAffectations] = useState(mockAffectations);
  const [formOpen, setFormOpen] = useState(false);

  const affectation = affectations.find(a => a.id === id);

  if (!affectation) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Usage', to: '/conformite/affectations' }, { label: 'Affectations', to: '/conformite/affectations' }, { label: 'Introuvable' }]} />
        <EmptyState title="Affectation introuvable" description="Cette affectation n'existe pas ou a ete supprimee." ctaLabel="Retour a la liste" onCta={() => navigate('/conformite/affectations')} />
      </div>
    );
  }

  const produit = mockProduits.find(p => p.id === affectation.id_produit);
  const societe = mockSocietes.find(s => s.id === affectation.id_societe);
  const revalidation = getRevalidationStatut(affectation);
  const tri = produit ? getTriangleProduit(produit.id) : null;

  function handleValidate() {
    setAffectations(prev => prev.map(a => a.id === affectation.id ? { ...a, statut_validation: 'valide', date_derniere_revalidation: new Date().toISOString().slice(0, 10), motif_refus: undefined } : a));
    addToast({ type: 'success', message: 'Affectation validee.' });
  }

  function handleRefuse(motif) {
    setAffectations(prev => prev.map(a => a.id === affectation.id ? { ...a, statut_validation: 'refuse', motif_refus: motif } : a));
    addToast({ type: 'info', message: 'Affectation refusee.' });
  }

  function handleRevalider() {
    setAffectations(prev => prev.map(a => a.id === affectation.id ? { ...a, date_derniere_revalidation: new Date().toISOString().slice(0, 10) } : a));
    addToast({ type: 'success', message: 'Revalidation effectuee.' });
  }

  function handleSave(data, existing) {
    setAffectations(prev => prev.map(a => a.id === existing.id ? { ...a, ...data } : a));
    addToast({ type: 'success', message: 'Affectation mise a jour.' });
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[
        { label: 'Usage', to: '/conformite/affectations' },
        { label: 'Affectations', to: '/conformite/affectations' },
        { label: affectation.reference_client },
      ]} />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{affectation.reference_client}</h1>
            <StatutValidationBadge statut={affectation.statut_validation} />
            {affectation.statut_validation === 'valide' && <StatutRevalidationBadge revalidation={revalidation} />}
          </div>
          <p className="text-sm text-gray-500 mt-1">{produit?.label} - {societe?.raison_sociale}</p>
          {affectation.statut_validation === 'refuse' && affectation.motif_refus && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">Motif du refus : {affectation.motif_refus}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">Soumis par {affectation.soumis_par}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canValidate && <ValidationActions statut={affectation.statut_validation} onValidate={handleValidate} onRefuse={handleRefuse} />}
          {canValidate && affectation.statut_validation === 'valide' && ['a_revalider', 'depasse'].includes(revalidation?.statut) && (
            <Button variant="secondary" size="sm" onClick={handleRevalider}>Revalider maintenant</Button>
          )}
          {canWrite && (
            <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}>
              <Pencil size={14} /> Editer
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Identite</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Produit</p>
              {produit
                ? <Link to={`/referentiels/logiciels/${produit.id}`} className="text-sm text-blue-800 hover:underline">{produit.label}</Link>
                : <p className="text-sm text-gray-500">-</p>
              }
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Societe</p>
              {societe
                ? <Link to={`/referentiels/organisation/${societe.id}`} className="text-sm text-blue-800 hover:underline">{societe.raison_sociale}</Link>
                : <p className="text-sm text-gray-500">-</p>
              }
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Quantite</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{affectation.quantite}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Reference client</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{affectation.reference_client}</p>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Balance du produit</h2>
          {tri && produit && (
            <ConformiteGaugeBar droits={getDroitsTotalProduit(produit.id)} usage={tri.declare} niveau={tri.niveauDeclare} label="Droits acquis vs usage declare" />
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Historique de validation et de revalidation</h2>
          <ul className="flex flex-col gap-3">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0 bg-gray-400" />
              <p className="text-sm text-gray-700 dark:text-gray-300">Saisie soumise par <strong>{affectation.soumis_par}</strong></p>
            </li>
            {affectation.statut_validation === 'valide' && (
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0 bg-green-500" />
                <p className="text-sm text-gray-700 dark:text-gray-300">Validee, derniere revalidation le <strong>{formatDate(affectation.date_derniere_revalidation)}</strong></p>
              </li>
            )}
            {affectation.statut_validation === 'refuse' && (
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0 bg-red-500" />
                <p className="text-sm text-gray-700 dark:text-gray-300">Refusee : {affectation.motif_refus}</p>
              </li>
            )}
            {revalidation && (
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: revalidation.statut === 'depasse' ? '#EF4444' : revalidation.statut === 'a_revalider' ? '#F59E0B' : '#22C55E' }} />
                <p className="text-sm text-gray-700 dark:text-gray-300">Prochaine revalidation prevue le <strong>{formatDate(revalidation.prochaine)}</strong> ({revalidation.joursRestants >= 0 ? `dans ${revalidation.joursRestants} jours` : `depassee depuis ${-revalidation.joursRestants} jours`})</p>
              </li>
            )}
          </ul>
        </section>
      </div>

      <AffectationFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} affectation={affectation} />
    </div>
  );
}
