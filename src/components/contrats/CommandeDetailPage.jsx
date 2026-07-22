// CommandeDetailPage - fiche detail d'une commande : origine, financier, documents, licences generees
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import {
  mockCommandes, getContrat, getDocumentsByCommande, getEcheanceCommande,
} from '../../data/mockContrats';
import { mockSocietes, mockRevendeurs, mockProduits } from '../../data/mockReferentiels';
import { getLicencesByCommande } from '../../data/mockDeploiement';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import StatutValidationBadge from '../referentiels/StatutValidationBadge';
import ValidationActions from '../referentiels/ValidationActions';
import CommandeFormModal from './CommandeFormModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';
import { formatDate } from '../../utils/dateUtils';

export default function CommandeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canValidate, canDelete, submitsForValidation } = useRbac();
  const { user } = useAuth();
  const [commandes, setCommandes] = useState(mockCommandes);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const commande = commandes.find(k => k.id === id);

  if (!commande) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Droits d\'usage', to: '/contrats/commandes' }, { label: 'Commandes', to: '/contrats/commandes' }, { label: 'Introuvable' }]} />
        <EmptyState title="Commande introuvable" description="Cette commande n'existe pas ou a ete supprimee." ctaLabel="Retour a la liste" onCta={() => navigate('/contrats/commandes')} />
      </div>
    );
  }

  const contrat = getContrat(commande.id_contrat);
  const societe = mockSocietes.find(s => s.id === commande.id_societe);
  const revendeur = commande.id_revendeur ? mockRevendeurs.find(r => r.id === commande.id_revendeur) : null;
  const documents = getDocumentsByCommande(commande.id);
  const licences = getLicencesByCommande(commande.id);
  const echeance = getEcheanceCommande(commande);
  const nbLiens = documents.length + licences.length;

  function handleValidate() {
    setCommandes(prev => prev.map(k => k.id === commande.id ? { ...k, statut_validation: 'valide', motif_refus: undefined } : k));
    addToast({ type: 'success', message: 'Commande validee.' });
  }

  function handleRefuse(motif) {
    setCommandes(prev => prev.map(k => k.id === commande.id ? { ...k, statut_validation: 'refuse', motif_refus: motif } : k));
    addToast({ type: 'info', message: 'Commande refusee.' });
  }

  function handleSave(data, existing) {
    const resoumis = submitsForValidation;
    setCommandes(prev => prev.map(k => k.id === existing.id ? {
      ...k, ...data,
      statut_validation: resoumis ? 'en_attente' : 'valide',
      soumis_par: `${user.prenom} ${user.nom}`,
    } : k));
    addToast({ type: 'success', message: resoumis ? 'Modification soumise a validation.' : 'Commande mise a jour.' });
  }

  function handleDelete() {
    setCommandes(prev => prev.filter(k => k.id !== commande.id));
    addToast({ type: 'success', message: 'Commande supprimee.' });
    navigate('/contrats/commandes');
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[
        { label: 'Droits d\'usage', to: '/contrats/commandes' },
        { label: 'Commandes', to: '/contrats/commandes' },
        { label: commande.label },
      ]} />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{commande.label}</h1>
            <StatutValidationBadge statut={commande.statut_validation} />
          </div>
          <p className="text-sm text-gray-500 mt-1">{societe?.raison_sociale}{revendeur ? ` - ${revendeur.raison_sociale}` : ''}</p>
          {commande.statut_validation === 'refuse' && commande.motif_refus && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">Motif du refus : {commande.motif_refus}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">Soumis par {commande.soumis_par}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canValidate && <ValidationActions statut={commande.statut_validation} onValidate={handleValidate} onRefuse={handleRefuse} />}
          {canWrite && (
            <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}>
              <Pencil size={14} /> Editer
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={14} /> Supprimer
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Identite</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-1">Contrat d'origine</p>
              {contrat
                ? <Link to={`/contrats/liste/${contrat.id}`} className="text-sm text-blue-800 hover:underline">{contrat.label}</Link>
                : <p className="text-sm text-gray-500">-</p>
              }
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Mode de commande</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{commande.mode}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Date</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{formatDate(commande.date)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Numero de devis</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{commande.numero_devis ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Reference interne</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{commande.reference_interne ?? '-'}</p>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Financier</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Montant</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{commande.montant.toLocaleString('fr-FR')} €</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Renouvellement</p>
              {commande.a_renouveler
                ? <Badge variant={echeance.statut === 'expire' ? 'error' : echeance.statut === 'a_renouveler' ? 'warning' : 'neutral'} label={commande.date_fin ? `Echeance le ${formatDate(commande.date_fin)}` : 'A renouveler'} />
                : <span className="text-sm text-gray-500">Sans renouvellement</span>
              }
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Factures et preuves rattachees ({documents.length})</h2>
          {documents.length === 0
            ? <p className="text-sm text-gray-500">Aucun document rattache.</p>
            : (
              <div className="flex flex-wrap gap-2">
                {documents.map(d => (
                  <Link key={d.id} to={`/contrats/factures/${d.id}`} className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors">
                    {d.type === 'facture' ? 'Facture' : 'Preuve'} - {d.label}
                  </Link>
                ))}
              </div>
            )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Licences generees ({licences.length})</h2>
          {licences.length === 0
            ? <p className="text-sm text-gray-500">Aucune licence generee.</p>
            : (
              <ul className="flex flex-col gap-1">
                {licences.map(l => {
                  const produit = mockProduits.find(p => p.id === l.id_produit);
                  return <li key={l.id}><Link to={`/conformite/licences/${l.id}`} className="text-sm text-blue-800 hover:underline">{produit?.label ?? l.id} ({l.quantite} {l.unite_mesure})</Link></li>;
                })}
              </ul>
            )}
        </section>
      </div>

      <CommandeFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} commande={commande} />

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={nbLiens > 0 ? () => setDeleteOpen(false) : handleDelete}
        title="Supprimer la commande"
        isDestructive={nbLiens === 0}
        confirmLabel={nbLiens > 0 ? 'Compris' : 'Supprimer'}
        message={
          nbLiens > 0
            ? `Suppression impossible : ${commande.label} est rattachee a ${documents.length} document${documents.length > 1 ? 's' : ''} et ${licences.length} licence${licences.length > 1 ? 's' : ''}. Detachez ou supprimez d'abord ces elements.`
            : `Supprimer definitivement ${commande.label} ? Cette action est irreversible.`
        }
      />
    </div>
  );
}
