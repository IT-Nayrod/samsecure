// CommandeDetailPage - fiche detail d'une commande : origine, financier, rattachements.
// Donnees API. La suppression s'appuie sur le refus du serveur, pas sur un garde-fou local.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { commandesService, modesCommandeService } from '../../services/commandesService';
import { contratsService, referentielsContratsService } from '../../services/contratsService';
import { societesService } from '../../services/adminService';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import StatutEcheanceBadge from './StatutEcheanceBadge';
import CommandeFormModal from './CommandeFormModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';

const euros = (v) => `${(v ?? 0).toLocaleString('fr-FR')} €`;

export default function CommandeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canDelete } = useRbac();

  const [commande, setCommande] = useState(null);
  const [contrats, setContrats] = useState([]);
  const [societes, setSocietes] = useState([]);
  const [revendeurs, setRevendeurs] = useState([]);
  const [modes, setModes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIntrouvable(false);
    try {
      const [k, c, s, r, m] = await Promise.all([
        commandesService.get(id),
        contratsService.list(),
        societesService.list(),
        referentielsContratsService.revendeurs(),
        modesCommandeService.list(),
      ]);
      setCommande(k); setContrats(c); setSocietes(s); setRevendeurs(r); setModes(m);
    } catch (err) {
      // 404 : la commande n'existe pas ou vient d'etre supprimee, pas une panne.
      if (err.status === 404) setIntrouvable(true);
      else { setError(err.message); addToast({ type: 'error', message: err.message }); }
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    try {
      await commandesService.remove(commande.id);
      addToast({ type: 'success', message: 'Commande supprimee.' });
      navigate('/contrats/commandes');
    } catch (err) {
      // Message du serveur affiche tel quel : "Suppression impossible : ..."
      addToast({ type: 'error', message: err.message, persistent: true });
    }
  }

  const fil = (
    <Breadcrumb items={[
      { label: 'Droits d\'usage', to: '/contrats/commandes' },
      { label: 'Commandes', to: '/contrats/commandes' },
      { label: commande?.label ?? '...' },
    ]} />
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">{fil}<Skeleton height="h-16" /><Skeleton height="h-32" /><Skeleton height="h-48" /></div>
    );
  }

  if (introuvable) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Droits d\'usage', to: '/contrats/commandes' }, { label: 'Commandes', to: '/contrats/commandes' }, { label: 'Introuvable' }]} />
        <EmptyState title="Commande introuvable" description="Cette commande n'existe pas ou a ete supprimee." ctaLabel="Retour a la liste" onCta={() => navigate('/contrats/commandes')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {fil}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <ErrorState message={error} onRetry={load} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {fil}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{commande.label}</h1>
            {(commande.a_renouveler || commande.date_fin) && <StatutEcheanceBadge statut={commande.statut_echeance} />}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {commande.societe_label ?? '-'}{commande.revendeur_label ? ` - ${commande.revendeur_label}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canWrite && (
            <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}><Pencil size={14} /> Editer</Button>
          )}
          {canDelete && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Supprimer</Button>
          )}
        </div>
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Origine</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Contrat</p>
            {commande.id_contrat
              ? <Link to={`/contrats/liste/${commande.id_contrat}`} className="text-sm text-blue-800 hover:underline">{commande.contrat_label}</Link>
              : <p className="text-sm text-gray-500">-</p>}
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Societe acheteuse</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{commande.societe_label ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Revendeur</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{commande.revendeur_label ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Mode de commande</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{commande.mode_label ?? '-'}</p>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Financier et echeance</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Montant</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{euros(commande.montant)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Date de commande</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{formatDate(commande.date_commande)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">A renouveler</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{commande.a_renouveler ? 'Oui' : 'Non'}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Numero de devis</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{commande.numero_devis ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Reference interne</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{commande.reference_interne ?? '-'}</p>
          </div>
        </div>
        {(commande.statut_echeance === 'expire' || commande.statut_echeance === 'a_renouveler') && commande.jours_restants !== null && (
          <p className="text-sm mt-3" style={{ color: commande.statut_echeance === 'expire' ? '#EF4444' : '#F59E0B' }}>
            {commande.statut_echeance === 'expire'
              ? `Echu depuis ${-commande.jours_restants} jours`
              : `Echeance dans ${commande.jours_restants} jours`}
          </p>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Rattachements</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Factures</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{commande.nb_factures ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Preuves</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{commande.nb_preuves ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Licences</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{commande.nb_licences ?? 0}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Le detail des documents et des licences sera liste au branchement de ces modules.</p>
      </section>

      <CommandeFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        commande={commande}
        contrats={contrats}
        societes={societes}
        revendeurs={revendeurs}
        modes={modes}
      />
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer la commande"
        isDestructive
        confirmLabel="Supprimer"
        message={`Supprimer definitivement ${commande.label} ? Cette action est irreversible.`}
      />
    </div>
  );
}