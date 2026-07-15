// OrganisationDetailPage - fiche detail d'une societe de l'organisation
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import {
  mockSocietes, getFilialesBySociete, getContactsByRattachement,
} from '../../data/mockReferentiels';
import { getAffectationsBySociete } from '../../data/mockDeploiement';
import { getContratsBySociete, getCommandesBySociete } from '../../data/mockContrats';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import StatutValidationBadge from './StatutValidationBadge';
import ValidationActions from './ValidationActions';
import OrganisationFormModal from './OrganisationFormModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';

export default function OrganisationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canValidate, canDelete, submitsForValidation } = useRbac();
  const { user } = useAuth();
  const [societes, setSocietes] = useState(mockSocietes);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const societe = societes.find(s => s.id === id);

  if (!societe) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Administration', to: '/referentiels/organisation' }, { label: 'Organisation', to: '/referentiels/organisation' }, { label: 'Introuvable' }]} />
        <EmptyState title="Societe introuvable" description="Cette societe n'existe pas ou a ete supprimee." ctaLabel="Retour a la liste" onCta={() => navigate('/referentiels/organisation')} />
      </div>
    );
  }

  const parent = societe.societe_parent_id ? societes.find(s => s.id === societe.societe_parent_id) : null;
  const filiales = getFilialesBySociete(societe.id);
  const contrats = getContratsBySociete(societe.id);
  const commandes = getCommandesBySociete(societe.id);
  const affectations = getAffectationsBySociete(societe.id);
  const contacts = getContactsByRattachement('client', societe.id);
  const nbLiens = contacts.length + contrats.length + commandes.length + affectations.length + filiales.length;

  function handleValidate() {
    setSocietes(prev => prev.map(s => s.id === societe.id ? { ...s, statut_validation: 'valide', motif_refus: undefined } : s));
    addToast({ type: 'success', message: 'Societe validee.' });
  }

  function handleRefuse(motif) {
    setSocietes(prev => prev.map(s => s.id === societe.id ? { ...s, statut_validation: 'refuse', motif_refus: motif } : s));
    addToast({ type: 'info', message: 'Societe refusee.' });
  }

  function handleSave(data, existing) {
    const resoumis = submitsForValidation;
    setSocietes(prev => prev.map(s => s.id === existing.id ? {
      ...s, ...data,
      statut_validation: resoumis ? 'en_attente' : 'valide',
      soumis_par: `${user.prenom} ${user.nom}`,
    } : s));
    addToast({ type: 'success', message: resoumis ? 'Modification soumise a validation.' : 'Societe mise a jour.' });
  }

  function handleDelete() {
    setSocietes(prev => prev.filter(s => s.id !== societe.id));
    addToast({ type: 'success', message: 'Societe supprimee.' });
    navigate('/referentiels/organisation');
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[
        { label: 'Administration', to: '/referentiels/organisation' },
        { label: 'Organisation', to: '/referentiels/organisation' },
        { label: societe.raison_sociale },
      ]} />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{societe.raison_sociale}</h1>
            <Badge variant={societe.actif ? 'success' : 'neutral'} label={societe.actif ? 'Active' : 'Inactive'} />
            <StatutValidationBadge statut={societe.statut_validation} />
          </div>
          {societe.statut_validation === 'refuse' && societe.motif_refus && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">Motif du refus : {societe.motif_refus}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">Soumis par {societe.soumis_par}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canValidate && <ValidationActions statut={societe.statut_validation} onValidate={handleValidate} onRefuse={handleRefuse} />}
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
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">SIRET</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{societe.siret ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Societe parente</p>
              {parent
                ? <Link to={`/referentiels/organisation/${parent.id}`} className="text-sm text-blue-800 hover:underline">{parent.raison_sociale}</Link>
                : <p className="text-sm text-gray-500">Aucune (societe mere)</p>
              }
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Filiales ({filiales.length})</p>
              {filiales.length === 0
                ? <p className="text-sm text-gray-500">Aucune filiale.</p>
                : (
                  <ul className="flex flex-col gap-1">
                    {filiales.map(f => (
                      <li key={f.id}><Link to={`/referentiels/organisation/${f.id}`} className="text-sm text-blue-800 hover:underline">{f.raison_sociale}</Link></li>
                    ))}
                  </ul>
                )}
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Parametres financiers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Duree amortissement</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{societe.duree_amortissement} mois</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Revalorisation annuelle</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{societe.revalorisation} %</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Delai de revalidation</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{societe.delai_revalidation} jours</p>
            </div>
          </div>
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

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Contrats, commandes et affectations</h2>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">{contrats.length} contrat{contrats.length > 1 ? 's' : ''}, {commandes.length} commande{commandes.length > 1 ? 's' : ''}, {affectations.length} affectation{affectations.length > 1 ? 's' : ''}.</p>
            <Link to={`/contrats/liste?societe=${societe.id}`} className="text-sm text-blue-800 hover:underline">Voir les contrats</Link>
            <Link to={`/contrats/commandes?societe=${societe.id}`} className="text-sm text-blue-800 hover:underline">Voir les commandes</Link>
            <Link to={`/conformite/affectations?societe=${societe.id}`} className="text-sm text-blue-800 hover:underline">Voir les affectations</Link>
          </div>
        </section>
      </div>

      <OrganisationFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} societe={societe} existingSocietes={societes} />

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={nbLiens > 0 ? () => setDeleteOpen(false) : handleDelete}
        title="Supprimer la societe"
        isDestructive={nbLiens === 0}
        confirmLabel={nbLiens > 0 ? 'Compris' : 'Supprimer'}
        message={
          nbLiens > 0
            ? `Suppression impossible : ${societe.raison_sociale} est rattachee a ${contacts.length} contact${contacts.length > 1 ? 's' : ''}, ${contrats.length} contrat${contrats.length > 1 ? 's' : ''}, ${commandes.length} commande${commandes.length > 1 ? 's' : ''}, ${affectations.length} affectation${affectations.length > 1 ? 's' : ''} et ${filiales.length} filiale${filiales.length > 1 ? 's' : ''}. Detachez ou supprimez d'abord ces elements.`
            : `Supprimer definitivement ${societe.raison_sociale} ? Cette action est irreversible.`
        }
      />
    </div>
  );
}
