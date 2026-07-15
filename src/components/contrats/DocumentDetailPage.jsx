// DocumentDetailPage - fiche detail d'une facture ou d'une preuve, avec apercu placeholder
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { mockDocuments, getContrat, getCommande } from '../../data/mockContrats';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import StatutValidationBadge from '../referentiels/StatutValidationBadge';
import ValidationActions from '../referentiels/ValidationActions';
import DocumentIcon from './DocumentIcon';
import DocumentFormModal from './DocumentFormModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';
import { formatDate } from '../../utils/dateUtils';

export default function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canValidate, canDelete, submitsForValidation } = useRbac();
  const { user } = useAuth();
  const [documents, setDocuments] = useState(mockDocuments);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const doc = documents.find(d => d.id === id);

  if (!doc) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Droits d\'usage', to: '/contrats/factures' }, { label: 'Factures & Preuves', to: '/contrats/factures' }, { label: 'Introuvable' }]} />
        <EmptyState title="Document introuvable" description="Ce document n'existe pas ou a ete supprime." ctaLabel="Retour a la liste" onCta={() => navigate('/contrats/factures')} />
      </div>
    );
  }

  const contrat = doc.id_contrat ? getContrat(doc.id_contrat) : null;
  const commande = doc.id_commande ? getCommande(doc.id_commande) : null;

  function handleValidate() {
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, statut_validation: 'valide', motif_refus: undefined } : d));
    addToast({ type: 'success', message: 'Document valide.' });
  }

  function handleRefuse(motif) {
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, statut_validation: 'refuse', motif_refus: motif } : d));
    addToast({ type: 'info', message: 'Document refuse.' });
  }

  function handleSave(data, existing) {
    const resoumis = submitsForValidation;
    setDocuments(prev => prev.map(d => d.id === existing.id ? {
      ...d, ...data,
      statut_validation: resoumis ? 'en_attente' : 'valide',
      soumis_par: `${user.prenom} ${user.nom}`,
    } : d));
    addToast({ type: 'success', message: resoumis ? 'Modification soumise a validation.' : 'Document mis a jour.' });
  }

  function handleDelete() {
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
    addToast({ type: 'success', message: 'Document supprime.' });
    navigate('/contrats/factures');
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[
        { label: 'Droits d\'usage', to: '/contrats/factures' },
        { label: 'Factures & Preuves', to: '/contrats/factures' },
        { label: doc.label },
      ]} />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <DocumentIcon nomFichier={doc.nom_fichier} size={48} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{doc.label}</h1>
              <span className="text-xs font-semibold text-blue-700 bg-blue-100 dark:bg-blue-900/30 px-2.5 py-1 rounded-full">{doc.type === 'facture' ? 'Facture' : 'Preuve'}</span>
              <StatutValidationBadge statut={doc.statut_validation} />
            </div>
            <p className="text-sm text-gray-500 mt-1">{doc.nom_fichier}{doc.type_preuve ? ` - ${doc.type_preuve}` : ''}</p>
            {doc.statut_validation === 'refuse' && doc.motif_refus && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">Motif du refus : {doc.motif_refus}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">Soumis par {doc.soumis_par}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canValidate && <ValidationActions statut={doc.statut_validation} onValidate={handleValidate} onRefuse={handleRefuse} />}
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
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Apercu</h2>
          <div className="flex flex-col items-center justify-center gap-3 py-8 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
            <DocumentIcon nomFichier={doc.nom_fichier} size={72} />
            <p className="text-sm text-gray-600 dark:text-gray-300">{doc.nom_fichier}</p>
            <p className="text-xs text-gray-400">Apercu non disponible en v0.5 (pas de stockage de fichier reel)</p>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Liaisons</h2>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Contrat lie</p>
              {contrat
                ? <Link to={`/contrats/liste/${contrat.id}`} className="text-sm text-blue-800 hover:underline">{contrat.label}</Link>
                : <p className="text-sm text-gray-500">Aucun</p>
              }
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Commande liee</p>
              {commande
                ? <Link to={`/contrats/commandes/${commande.id}`} className="text-sm text-blue-800 hover:underline">{commande.label}</Link>
                : <p className="text-sm text-gray-500">Aucune</p>
              }
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Date</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{formatDate(doc.date)}</p>
            </div>
          </div>
        </section>
      </div>

      <DocumentFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} doc={doc} />

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer le document"
        isDestructive
        confirmLabel="Supprimer"
        message={`Supprimer definitivement ${doc.label} ? Cette action est irreversible.`}
      />
    </div>
  );
}
