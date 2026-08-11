// RevendeurDetailPage - fiche detail d'un revendeur
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { mockRevendeurs, getContactsByRattachement, mockProduits } from '../../data/mockReferentiels';
import { getLicencesByRevendeur } from '../../data/mockDeploiement';
import { getCommandesByRevendeur } from '../../data/mockContrats';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import StatutValidationBadge from './StatutValidationBadge';
import ValidationActions from './ValidationActions';
import RevendeurFormModal from './RevendeurFormModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';

function maskIban(iban) {
  if (!iban) return '-';
  return `${iban.slice(0, 4)} **** **** **** ${iban.slice(-4)}`;
}

export default function RevendeurDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canValidate, canDelete, submitsForValidation } = useRbac();
  const { user } = useAuth();
  const [revendeurs, setRevendeurs] = useState(mockRevendeurs);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [ibanVisible, setIbanVisible] = useState(false);

  const revendeur = revendeurs.find(r => r.id === id);

  if (!revendeur) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Referentiels', to: '/referentiels/revendeurs' }, { label: 'Revendeurs', to: '/referentiels/revendeurs' }, { label: 'Introuvable' }]} />
        <EmptyState title="Revendeur introuvable" description="Ce revendeur n'existe pas ou a ete supprime." ctaLabel="Retour a la liste" onCta={() => navigate('/referentiels/revendeurs')} />
      </div>
    );
  }

  const commandes = getCommandesByRevendeur(revendeur.id);
  const licences = getLicencesByRevendeur(revendeur.id);
  const contacts = getContactsByRattachement('revendeur', revendeur.id);
  const nbLiens = commandes.length + licences.length;

  function handleValidate() {
    setRevendeurs(prev => prev.map(r => r.id === revendeur.id ? { ...r, statut_validation: 'valide', motif_refus: undefined } : r));
    addToast({ type: 'success', message: 'Revendeur valide.' });
  }

  function handleRefuse(motif) {
    setRevendeurs(prev => prev.map(r => r.id === revendeur.id ? { ...r, statut_validation: 'refuse', motif_refus: motif } : r));
    addToast({ type: 'info', message: 'Revendeur refuse.' });
  }

  function handleSave(data, existing) {
    const resoumis = submitsForValidation;
    setRevendeurs(prev => prev.map(r => r.id === existing.id ? {
      ...r, ...data,
      statut_validation: resoumis ? 'en_attente' : 'valide',
      soumis_par: `${user.prenom} ${user.nom}`,
    } : r));
    addToast({ type: 'success', message: resoumis ? 'Modification soumise a validation.' : 'Revendeur mis a jour.' });
  }

  function handleDelete() {
    setRevendeurs(prev => prev.filter(r => r.id !== revendeur.id));
    addToast({ type: 'success', message: 'Revendeur supprime.' });
    navigate('/referentiels/revendeurs');
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[
        { label: 'Referentiels', to: '/referentiels/revendeurs' },
        { label: 'Revendeurs', to: '/referentiels/revendeurs' },
        { label: revendeur.raison_sociale },
      ]} />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{revendeur.raison_sociale}</h1>
            <StatutValidationBadge statut={revendeur.statut_validation} />
          </div>
          {revendeur.statut_validation === 'refuse' && revendeur.motif_refus && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">Motif du refus : {revendeur.motif_refus}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">Soumis par {revendeur.soumis_par}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canValidate && <ValidationActions statut={revendeur.statut_validation} onValidate={handleValidate} onRefuse={handleRefuse} />}
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

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">SIRET</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">{revendeur.siret ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">IBAN</p>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-800 dark:text-gray-200 font-mono">{ibanVisible ? (revendeur.iban ?? '-') : maskIban(revendeur.iban)}</p>
            {revendeur.iban && (
              <button onClick={() => setIbanVisible(v => !v)} aria-label={ibanVisible ? 'Masquer l\'IBAN' : 'Afficher l\'IBAN'} className="text-gray-400 hover:text-gray-600">
                {ibanVisible ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Email</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">{revendeur.email ?? '-'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Commandes associees ({commandes.length})</h2>
          {commandes.length === 0
            ? <p className="text-sm text-gray-500">Aucune commande rattachee.</p>
            : <Link to={`/contrats/commandes?revendeur=${revendeur.id}`} className="text-sm text-blue-800 hover:underline">Voir les commandes</Link>
          }
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Licences associees ({licences.length})</h2>
          {licences.length === 0
            ? <p className="text-sm text-gray-500">Aucune licence rattachee.</p>
            : (
              <ul className="flex flex-col gap-1.5">
                {licences.map(l => {
                  const produit = mockProduits.find(p => p.id === l.id_produit);
                  return (
                    <li key={l.id}>
                      <Link to={`/referentiels/logiciels/${l.id_produit}`} className="text-sm text-blue-800 hover:underline">{produit?.label ?? l.id_produit}</Link>
                    </li>
                  );
                })}
              </ul>
            )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Contacts rattaches ({contacts.length})</h2>
          {contacts.length === 0
            ? <p className="text-sm text-gray-500">Aucun contact rattache.</p>
            : (
              <ul className="flex flex-col gap-1.5">
                {contacts.map(c => (
                  <li key={c.id}>
                    <Link to={`/referentiels/contacts/${c.id}`} className="text-sm text-blue-800 hover:underline">{c.prenom} {c.nom}</Link>
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>

      <RevendeurFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} revendeur={revendeur} existingRevendeurs={revendeurs} />

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={nbLiens > 0 ? () => setDeleteOpen(false) : handleDelete}
        title="Supprimer le revendeur"
        isDestructive={nbLiens === 0}
        confirmLabel={nbLiens > 0 ? 'Compris' : 'Supprimer'}
        message={
          nbLiens > 0
            ? `Suppression impossible : ${revendeur.raison_sociale} est rattache a ${commandes.length} commande${commandes.length > 1 ? 's' : ''} et ${licences.length} licence${licences.length > 1 ? 's' : ''}. Detachez ou supprimez d'abord ces elements.`
            : `Supprimer definitivement ${revendeur.raison_sociale} ? Cette action est irreversible.`
        }
      />
    </div>
  );
}
