// EditeurDetailPage - fiche detail d'un editeur
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import {
  mockEditeurs, getProduitsByEditeur, getContactsByRattachement, getConformiteEditeur,
} from '../../data/mockReferentiels';
import { getContratsByEditeur } from '../../data/mockContrats';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import StatutValidationBadge from './StatutValidationBadge';
import ConformiteBadge from './ConformiteBadge';
import ValidationActions from './ValidationActions';
import EditeurFormModal from './EditeurFormModal';
import LogoEditeur from './LogoEditeur';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';

export default function EditeurDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canValidate, canDelete, submitsForValidation } = useRbac();
  const { user } = useAuth();
  const [editeurs, setEditeurs] = useState(mockEditeurs);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const editeur = editeurs.find(e => e.id === id);

  if (!editeur) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Referentiels', to: '/referentiels/editeurs' }, { label: 'Editeurs', to: '/referentiels/editeurs' }, { label: 'Introuvable' }]} />
        <EmptyState title="Editeur introuvable" description="Cet editeur n'existe pas ou a ete supprime." ctaLabel="Retour a la liste" onCta={() => navigate('/referentiels/editeurs')} />
      </div>
    );
  }

  const produits = getProduitsByEditeur(editeur.id);
  const contrats = getContratsByEditeur(editeur.id);
  const contacts = getContactsByRattachement('editeur', editeur.id);
  const conformite = getConformiteEditeur(editeur.id);
  const nbLiens = produits.length + contrats.length;

  function handleValidate() {
    setEditeurs(prev => prev.map(e => e.id === editeur.id ? { ...e, statut_validation: 'valide', motif_refus: undefined } : e));
    addToast({ type: 'success', message: 'Editeur valide.' });
  }

  function handleRefuse(motif) {
    setEditeurs(prev => prev.map(e => e.id === editeur.id ? { ...e, statut_validation: 'refuse', motif_refus: motif } : e));
    addToast({ type: 'info', message: 'Editeur refuse.' });
  }

  function handleSave(data, existing) {
    const resoumis = submitsForValidation;
    setEditeurs(prev => prev.map(e => e.id === existing.id ? {
      ...e, ...data,
      statut_validation: resoumis ? 'en_attente' : 'valide',
      soumis_par: `${user.prenom} ${user.nom}`,
    } : e));
    addToast({ type: 'success', message: resoumis ? 'Modification soumise a validation.' : 'Editeur mis a jour.' });
  }

  function handleDelete() {
    setEditeurs(prev => prev.filter(e => e.id !== editeur.id));
    addToast({ type: 'success', message: 'Editeur supprime.' });
    navigate('/referentiels/editeurs');
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[
        { label: 'Referentiels', to: '/referentiels/editeurs' },
        { label: 'Editeurs', to: '/referentiels/editeurs' },
        { label: editeur.raison_sociale },
      ]} />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <LogoEditeur editeur={editeur} size={48} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{editeur.raison_sociale}</h1>
              <StatutValidationBadge statut={editeur.statut_validation} />
              <ConformiteBadge conformite={conformite} />
            </div>
            {editeur.pays && <p className="text-sm text-gray-500 mt-1">{editeur.pays}</p>}
          {editeur.statut_validation === 'refuse' && editeur.motif_refus && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">Motif du refus : {editeur.motif_refus}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">Soumis par {editeur.soumis_par}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canValidate && <ValidationActions statut={editeur.statut_validation} onValidate={handleValidate} onRefuse={handleRefuse} />}
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
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Produits associes ({produits.length})</h2>
          {produits.length === 0
            ? <p className="text-sm text-gray-500">Aucun produit du catalogue rattache.</p>
            : (
              <ul className="flex flex-col gap-1.5">
                {produits.map(p => (
                  <li key={p.id}>
                    <Link to={`/referentiels/logiciels/${p.id}`} className="text-sm text-blue-800 hover:underline">{p.label}</Link>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Contrats associes ({contrats.length})</h2>
          {contrats.length === 0
            ? <p className="text-sm text-gray-500">Aucun contrat rattache.</p>
            : (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm text-gray-600 dark:text-gray-300">{contrats.length} contrat{contrats.length > 1 ? 's' : ''} rattache{contrats.length > 1 ? 's' : ''}.</p>
                <Link to={`/contrats/liste?editeur=${editeur.id}`} className="text-sm text-blue-800 hover:underline">Voir les contrats</Link>
              </div>
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

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Synthese conformite</h2>
          <div className="flex flex-col gap-2">
            <ConformiteBadge conformite={conformite} />
            <Link to={`/conformite/licences?editeur=${editeur.id}`} className="text-sm text-blue-800 hover:underline">Voir le detail dans le Dashboard</Link>
          </div>
        </section>
      </div>

      <EditeurFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} editeur={editeur} existingEditeurs={editeurs} />

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={nbLiens > 0 ? () => setDeleteOpen(false) : handleDelete}
        title="Supprimer l'editeur"
        isDestructive={nbLiens === 0}
        confirmLabel={nbLiens > 0 ? 'Compris' : 'Supprimer'}
        message={
          nbLiens > 0
            ? `Suppression impossible : ${editeur.raison_sociale} est rattache a ${produits.length} produit${produits.length > 1 ? 's' : ''} et ${contrats.length} contrat${contrats.length > 1 ? 's' : ''}. Detachez ou supprimez d'abord ces elements.`
            : `Supprimer definitivement ${editeur.raison_sociale} ? Cette action est irreversible.`
        }
      />
    </div>
  );
}
