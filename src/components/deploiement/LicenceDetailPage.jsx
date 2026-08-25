// LicenceDetailPage - fiche detail d'une licence : identite, origine (commande,
// contrat deduit, societe payeuse), jauge droits vs usage declare du produit,
// historique et arret de maintenance. Donnees API ; la suppression s'appuie
// sur le refus du serveur (4023), pas sur un garde-fou local.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2, ChevronDown, ShieldOff, ShieldCheck, Plus, EyeOff } from 'lucide-react';
import BudgetEmbeddedSection from '../budget/BudgetEmbeddedSection';
import { licencesService, referentielsLicencesService, formatMontant, editeurPourLogo } from '../../services/licencesService';
import { referentielsContratsService } from '../../services/contratsService';
import { commandesService } from '../../services/commandesService';
import { optionnel } from '../../services/http';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import LogoEditeur from '../referentiels/LogoEditeur';
import StatutEcheanceBadge from '../contrats/StatutEcheanceBadge';
import ConformiteGaugeBar from './ConformiteGaugeBar';
import LicenceFormModal from './LicenceFormModal';
import StatutMaintenanceBadge from './StatutMaintenanceBadge';
import MaintenanceTimeline from './MaintenanceTimeline';
import MaintenanceFormModal from './MaintenanceFormModal';
import ArretMaintenanceModal from './ArretMaintenanceModal';
import useRbac from '../../hooks/useRbac';
import useAuth from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

function Champ({ label, children }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="text-sm text-gray-800 dark:text-gray-200">{children}</div>
    </div>
  );
}

export default function LicenceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canDelete } = useRbac({ write: 'saisir_licence' });
  const { hasPermission } = useAuth();
  const montantsVisibles = hasPermission('consulter_kpi_financiers');

  const [licence, setLicence] = useState(null);
  const [periodes, setPeriodes] = useState([]);
  const [produits, setProduits] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [revendeurs, setRevendeurs] = useState([]);
  const [unites, setUnites] = useState([]);
  const [mainteneurs, setMainteneurs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [periodeModal, setPeriodeModal] = useState({ open: false, periode: null });
  const [periodeASupprimer, setPeriodeASupprimer] = useState(null);
  const [arretOpen, setArretOpen] = useState(false);
  const [repriseOpen, setRepriseOpen] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    setIntrouvable(false);
    try {
      // Seule la fiche est indispensable. L'historique de maintenance suit le
      // meme droit (consulter_licences) ; les referentiels servent aux formulaires.
      const [l, h, p, k, r, u, m] = await Promise.all([
        licencesService.get(id),
        optionnel(licencesService.maintenance.list(id)),
        optionnel(referentielsLicencesService.produits()),
        optionnel(commandesService.list()),
        optionnel(referentielsContratsService.revendeurs()),
        optionnel(referentielsLicencesService.unitesMesure()),
        optionnel(referentielsLicencesService.mainteneurs()),
      ]);
      setLicence(l); setPeriodes(h); setProduits(p); setCommandes(k); setRevendeurs(r); setUnites(u); setMainteneurs(m);
    } catch (err) {
      if (err.status === 404) setIntrouvable(true);
      else { setError(err.message); setErrorStatus(err.status); addToast({ type: 'error', message: err.message }); }
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const produit = useMemo(() => produits.find(p => p.id === licence?.id_produit) ?? null, [produits, licence]);
  const versions = produit?.versions ?? [];
  const editeurLogo = licence ? editeurPourLogo(licence.editeur_label, produit?.editeur_url_logo_defaut) : null;

  // La fiche detail porte des compteurs (nb_affectations...) que les reponses
  // d'ecriture ne renvoient pas : fusion plutot que remplacement.
  const appliquer = (saved) => setLicence(prev => ({ ...prev, ...saved }));

  async function rechargerPeriodes() {
    try {
      const [l, h] = await Promise.all([licencesService.get(id), licencesService.maintenance.list(id)]);
      setLicence(l); setPeriodes(h);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  async function handleDelete() {
    try {
      await licencesService.remove(id);
      addToast({ type: 'success', message: 'Licence supprimée.' });
      navigate('/conformite/licences');
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  async function handleDeletePeriode() {
    try {
      await licencesService.maintenance.remove(id, periodeASupprimer.id);
      addToast({ type: 'success', message: 'Période de maintenance supprimée.' });
      await rechargerPeriodes();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  async function handleReprise() {
    try {
      const saved = await licencesService.reprendreMaintenance(id);
      appliquer(saved);
      addToast({ type: 'success', message: 'Maintenance reprise, version libérée.' });
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    }
  }

  const fil = (dernier) => [
    { label: 'Droits d\'usage', to: '/conformite/licences' },
    { label: 'Licences', to: '/conformite/licences' },
    { label: dernier },
  ];

  if (isLoading) {
    return <div className="flex flex-col gap-6"><Breadcrumb items={fil('Chargement')} /><Skeleton lines={8} /></div>;
  }
  if (introuvable) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={fil('Introuvable')} />
        <EmptyState title="Licence introuvable" description="Cette licence n'existe pas ou a été supprimée." ctaLabel="Retour à la liste" onCta={() => navigate('/conformite/licences')} />
      </div>
    );
  }
  if (error) {
    return <div className="flex flex-col gap-6"><Breadcrumb items={fil('Erreur')} /><ErrorState message={error} status={errorStatus} onRetry={load} /></div>;
  }

  const titre = licence.label ?? licence.produit_label ?? licence.id;
  const arretee = licence.statut_maintenance === 'arretee';
  const peutArreter = canWrite && !arretee && (licence.a_maintenance || periodes.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={fil(titre)} />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <LogoEditeur editeur={editeurLogo} size={48} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{titre}</h1>
              <Badge variant={licence.type === 'perpetuelle' ? 'neutral' : 'success'} label={licence.type === 'perpetuelle' ? 'Perpétuelle' : 'Souscription'} />
              <StatutEcheanceBadge statut={licence.statut_echeance} />
              <StatutMaintenanceBadge licence={licence} compact />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {licence.produit_label ?? 'Produit inconnu'}{licence.editeur_label ? ` - ${licence.editeur_label}` : ''}{licence.edition_label ? ` - ${licence.edition_label}` : ''}{licence.version_label ? ` - v${licence.version_label}` : ''}
            </p>
          </div>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}><Pencil size={14} /> Éditer</Button>
            {canDelete && <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Supprimer</Button>}
          </div>
        )}
      </div>

      {licence.statut_echeance === 'expire' && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          Souscription expirée le {licence.date_fin_souscription} : ces {licence.quantite} {licence.unite_label ?? ''} ne comptent plus dans la balance de conformité.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Identité</h2>
          <div className="grid grid-cols-2 gap-4">
            <Champ label="Quantité">{licence.quantite} {licence.unite_label ?? ''}</Champ>
            <Champ label="Coût">
              {licence.montants_masques
                ? <span className="inline-flex items-center gap-1 text-gray-400"><EyeOff size={13} /> Masqué</span>
                : formatMontant(licence.cout_licence)}
            </Champ>
            <Champ label="Fin de souscription">{licence.type === 'souscription' ? (licence.date_fin_souscription ?? '-') : 'Perpétuelle'}</Champ>
            <Champ label="Jours restants">{licence.jours_restants ?? '-'}</Champ>
            <Champ label="Société payeuse">
              {licence.id_societe
                ? <Link to={`/referentiels/organisation/${licence.id_societe}`} className="text-blue-800 hover:underline">{licence.societe_label}</Link>
                : <span className="text-gray-500">Déduite de la commande, non renseignée</span>}
            </Champ>
            <Champ label="Revendeur">
              {licence.id_revendeur
                ? <Link to={`/referentiels/revendeurs/${licence.id_revendeur}`} className="text-blue-800 hover:underline">{licence.revendeur_label}</Link>
                : <span className="text-gray-500">-</span>}
            </Champ>
            <Champ label="Commande">
              {licence.id_commande
                ? <Link to={`/contrats/commandes/${licence.id_commande}`} className="text-blue-800 hover:underline">{licence.commande_label}</Link>
                : <span className="text-gray-500">-</span>}
            </Champ>
            <Champ label="Contrat (déduit de la commande)">
              {licence.id_contrat
                ? <Link to={`/contrats/liste/${licence.id_contrat}`} className="text-blue-800 hover:underline">{licence.contrat_label}</Link>
                : <span className="text-gray-500">-</span>}
            </Champ>
            <Champ label="Usage déclaré sur ce lot">{licence.usage_declare} {licence.unite_label ?? ''} ({licence.nb_affectations ?? 0} affectation(s))</Champ>
            <Champ label="Référence produit">{licence.produit_sku ?? '-'}</Champ>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Balance droits vs usage (produit)</h2>
          <div className="flex flex-col gap-4">
            <ConformiteGaugeBar droits={licence.produit_droits} usage={licence.produit_usage_declare} niveau={licence.produit_niveau} unite={licence.unite_label ?? ''} label="Droits acquis vs usage déclaré" />
            <ConformiteGaugeBar droits={licence.produit_droits} usage={licence.usage_declare} niveau={licence.usage_declare > licence.quantite ? 'depassement' : 'conforme'} unite={licence.unite_label ?? ''} label="Part de ce lot dans l'usage déclaré" />
            <p className="text-xs text-gray-500">Les droits comptent toutes les licences non expirées du produit, l&apos;usage toutes ses affectations. Les seuils (attention à 90 %) sont ceux de l&apos;API.</p>
            <div className="flex gap-3 text-xs">
              <Link to={`/conformite/licences?produit=${licence.id_produit}`} className="text-blue-800 hover:underline">Voir les lots du produit</Link>
              <Link to={`/conformite/affectations?produit=${licence.id_produit}`} className="text-blue-800 hover:underline">Voir les affectations</Link>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Maintenance</h2>
            {canWrite && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPeriodeModal({ open: true, periode: null })}><Plus size={14} /> Période</Button>
                {peutArreter && <Button variant="secondary" size="sm" onClick={() => setArretOpen(true)}><ShieldOff size={14} /> Arrêter la maintenance</Button>}
                {arretee && <Button variant="secondary" size="sm" onClick={() => setRepriseOpen(true)}><ShieldCheck size={14} /> Reprendre la maintenance</Button>}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap text-sm text-gray-600 dark:text-gray-300">
              <StatutMaintenanceBadge licence={licence} />
              {licence.mainteneur_label && <span>Mainteneur : {licence.mainteneur_label}</span>}
              {licence.date_fin_maintenance && !arretee && <span>Fin de maintenance : {licence.date_fin_maintenance}</span>}
            </div>
            <MaintenanceTimeline
              periodes={periodes} licence={licence} canWrite={canWrite}
              onEdit={p => setPeriodeModal({ open: true, periode: p })}
              onDelete={p => setPeriodeASupprimer(p)}
            />
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden md:col-span-2">
          <button onClick={() => setBudgetOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Budget</h2>
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${budgetOpen ? '' : '-rotate-90'}`} />
          </button>
          {budgetOpen && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-700">
              <BudgetEmbeddedSection mode="licence" id={licence.id} licence={licence} />
            </div>
          )}
        </section>
      </div>

      <LicenceFormModal
        isOpen={formOpen} onClose={() => setFormOpen(false)} onSaved={appliquer} licence={licence}
        produits={produits} commandes={commandes} revendeurs={revendeurs} unites={unites} mainteneurs={mainteneurs}
        montantsVisibles={montantsVisibles}
      />
      <MaintenanceFormModal
        isOpen={periodeModal.open} onClose={() => setPeriodeModal({ open: false, periode: null })}
        onSaved={rechargerPeriodes} licenceId={licence.id} periode={periodeModal.periode}
        mainteneurs={mainteneurs} revendeurs={revendeurs} montantsVisibles={montantsVisibles}
      />
      <ArretMaintenanceModal
        isOpen={arretOpen} onClose={() => setArretOpen(false)} licence={licence} versions={versions}
        onSaved={(saved) => { appliquer(saved); rechargerPeriodes(); }}
      />
      <ConfirmModal
        isOpen={repriseOpen} onClose={() => setRepriseOpen(false)} onConfirm={handleReprise}
        title="Reprendre la maintenance"
        message="La version figée est libérée et la licence repasse sous maintenance. L'historique n'est pas modifié : saisissez ensuite la nouvelle période."
        confirmLabel="Reprendre"
      />
      <ConfirmModal
        isOpen={!!periodeASupprimer} onClose={() => setPeriodeASupprimer(null)} onConfirm={handleDeletePeriode}
        title="Supprimer la période de maintenance"
        message={periodeASupprimer ? `Supprimer la période du ${periodeASupprimer.date_debut} au ${periodeASupprimer.date_fin ?? 'en cours'} ?` : ''}
        confirmLabel="Supprimer" isDestructive
      />
      <ConfirmModal
        isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete}
        title="Supprimer la licence"
        message={`Supprimer "${titre}" ? L'historique de maintenance est supprimé avec elle. Le serveur refuse si des affectations ou des lignes budgétaires y sont rattachées.`}
        confirmLabel="Supprimer" isDestructive
      />
    </div>
  );
}
