// LicenceDetailPage - fiche détail d'une licence : identité, origine (commande,
// contrat déduit, société payeuse), jauge droits vs usage déclaré du produit,
// historique et arrêt de maintenance, historique des versions (D60) et lien de
// succession (D35). Données API ; la suppression s'appuie sur le refus du
// serveur (4023), pas sur un garde-fou local. Les dates affichées suivent la
// règle du type servie par l'API (#209).
// Décisions du 11/09/2026 : "Prolonger" étend la période en cours
// (LicenceProlongationModal), "Nouvelle période" crée la licence suivante
// préremplie et liée (LicenceFormModal, prop modele) ; bandeau "le contrat doit
// suivre" quand l'API sert contrat_a_suivre ; la maintenance se rattache à une
// commande.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2, ChevronDown, ShieldOff, ShieldCheck, Plus, EyeOff, History, CalendarPlus, CalendarClock, AlertTriangle } from 'lucide-react';
import BudgetEmbeddedSection from '../budget/BudgetEmbeddedSection';
import { licencesService, referentielsLicencesService, formatMontant, editeurPourLogo, regleType, libelleType, EVENEMENTS_VERSION, echeanceProlongeable } from '../../services/licencesService';
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
import { libelleContrat } from '../contrats/libelleContrat';
import ConformiteGaugeBar from './ConformiteGaugeBar';
import LicenceFormModal from './LicenceFormModal';
import StatutMaintenanceBadge from './StatutMaintenanceBadge';
import MaintenanceTimeline from './MaintenanceTimeline';
import MaintenanceFormModal from './MaintenanceFormModal';
import ArretMaintenanceModal from './ArretMaintenanceModal';
import PreuvesLicenceSection from '../contrats/PreuvesLicenceSection';
import LicenceProlongationModal from './LicenceProlongationModal';
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
  const [licences, setLicences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [periodeSuivanteOpen, setPeriodeSuivanteOpen] = useState(false);
  const [prolongerOpen, setProlongerOpen] = useState(false);
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
      // même droit (consulter_licences) ; les référentiels servent aux formulaires.
      const [l, h, p, k, r, u, m, ls] = await Promise.all([
        licencesService.get(id),
        optionnel(licencesService.maintenance.list(id)),
        optionnel(referentielsLicencesService.produits()),
        optionnel(commandesService.list()),
        optionnel(referentielsContratsService.revendeurs()),
        optionnel(referentielsLicencesService.unitesMesure()),
        optionnel(referentielsLicencesService.mainteneurs()),
        optionnel(licencesService.list()),
      ]);
      setLicence(l); setPeriodes(h); setProduits(p); setCommandes(k); setRevendeurs(r); setUnites(u); setMainteneurs(m); setLicences(ls);
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

  // La fiche détail porte des compteurs (nb_affectations...) et l'historique
  // des versions que les réponses d'écriture ne renvoient pas : fusion puis
  // relecture de la fiche pour rafraîchir cet historique.
  const appliquer = (saved) => {
    setLicence(prev => ({ ...prev, ...saved }));
    licencesService.get(id).then(setLicence).catch(() => {});
  };

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
  const regle = regleType(licence.type, licence);
  const debutVisible = regle.regle_date_debut !== 'masquee';
  const finVisible = regle.regle_date_fin !== 'masquee';
  const historiqueVersions = licence.historique_versions ?? [];
  const versionLabel = (idv, label) => (idv ? (label ?? 'Version inconnue') : 'Aucune');
  const auteur = (h) => [h.auteur_prenom, h.auteur_nom].filter(Boolean).join(' ') || 'Auteur inconnu';
  const peutArreter = canWrite && !arretee && (licence.a_maintenance || periodes.length > 0);
  const echeance = echeanceProlongeable(licence);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={fil(titre)} />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <LogoEditeur editeur={editeurLogo} size={48} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{titre}</h1>
              <Badge variant={finVisible ? 'success' : 'neutral'} label={libelleType(licence.type, licence)} />
              <StatutEcheanceBadge statut={licence.statut_echeance} />
              <StatutMaintenanceBadge licence={licence} compact />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {licence.produit_label ?? 'Logiciel inconnu'}{licence.editeur_label ? ` - ${licence.editeur_label}` : ''}{licence.edition_label ? ` - ${licence.edition_label}` : ''}{licence.version_label ? ` - v${licence.version_label}` : ''}
            </p>
          </div>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2 flex-wrap">
            {echeance && <Button variant="secondary" size="sm" onClick={() => setProlongerOpen(true)}><CalendarClock size={14} /> Prolonger</Button>}
            {echeance && <Button variant="secondary" size="sm" onClick={() => setPeriodeSuivanteOpen(true)}><CalendarPlus size={14} /> Nouvelle période</Button>}
            <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}><Pencil size={14} /> Éditer</Button>
            {canDelete && <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Supprimer</Button>}
          </div>
        )}
      </div>

      {licence.contrat_a_suivre && (
        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Ce contrat doit être renouvelé ou prolongé : des licences ont été renouvelées dessus.</p>
            <p className="text-xs mt-0.5">
              Le contrat <Link to={`/contrats/liste/${licence.id_contrat}`} className="underline">{licence.contrat_label ?? 'rattaché'}</Link>
              {licence.contrat_date_fin ? ` (fin le ${licence.contrat_date_fin})` : ''} est échu ou arrive à échéance et n&apos;a ni successeur ni prolongation. Rien n&apos;est modifié automatiquement.
            </p>
          </div>
        </div>
      )}

      {licence.statut_echeance === 'expire' && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          Licence expirée le {licence.date_fin_souscription} : ces {licence.quantite} {licence.unite_label ?? ''} ne comptent plus dans la balance de conformité.
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
            <Champ label="Type">{libelleType(licence.type, licence)}</Champ>
            <Champ label="Date de début">{debutVisible ? (licence.date_debut ?? '-') : 'Sans objet'}</Champ>
            <Champ label="Date de fin">{finVisible ? (licence.date_fin_souscription ?? '-') : 'Sans fin'}</Champ>
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
                ? <Link to={`/contrats/liste/${licence.id_contrat}`} className="text-blue-800 hover:underline">{libelleContrat(licence.contrat_label, licence.contrat_societe_label)}</Link>
                : <span className="text-gray-500">-</span>}
            </Champ>
            <Champ label="Usage déclaré sur ce lot">{licence.usage_declare} {licence.unite_label ?? ''} ({licence.nb_affectations ?? 0} affectation(s))</Champ>
            <Champ label="Référence logiciel">{licence.produit_sku ?? '-'}</Champ>
            <Champ label="Renouvelle la licence">
              {licence.id_licence_predecesseur
                ? <Link to={`/conformite/licences/${licence.id_licence_predecesseur}`} className="text-blue-800 hover:underline">{licence.predecesseur_label ?? 'Licence renouvelée'}</Link>
                : <span className="text-gray-500">-</span>}
            </Champ>
            <Champ label="Renouvelée par">
              {licence.nb_successeurs > 0
                ? <span>{licence.nb_successeurs} licence(s) : aucune alerte d&apos;échéance ne sera émise</span>
                : <span className="text-gray-500">-</span>}
            </Champ>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Balance droits vs usage (logiciel)</h2>
          <div className="flex flex-col gap-4">
            <ConformiteGaugeBar droits={licence.produit_droits} usage={licence.produit_usage_declare} niveau={licence.produit_niveau} unite={licence.unite_label ?? ''} label="Droits acquis vs usage déclaré" />
            <ConformiteGaugeBar droits={licence.produit_droits} usage={licence.usage_declare} niveau={licence.usage_declare > licence.quantite ? 'depassement' : 'conforme'} unite={licence.unite_label ?? ''} label="Part de ce lot dans l'usage déclaré" />
            <p className="text-xs text-gray-500">Les droits comptent toutes les licences non expirées du logiciel, l&apos;usage toutes ses affectations. Les seuils (attention à 90 %) sont ceux de l&apos;API.</p>
            <div className="flex gap-3 text-xs">
              <Link to={`/conformite/licences?produit=${licence.id_produit}`} className="text-blue-800 hover:underline">Voir les lots du logiciel</Link>
              <Link to={`/conformite/affectations?produit=${licence.id_produit}`} className="text-blue-800 hover:underline">Voir les affectations</Link>
            </div>
          </div>
        </section>

        {/* Preuves rattachées à la licence (#208, intégrée le 16/09) : section
            autonome, elle charge ses données et porte son bouton de dépôt. */}
        <div className="md:col-span-2">
          <PreuvesLicenceSection licence={licence} />
        </div>

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

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><History size={14} /> Historique des versions</h2>
          {!regle.version_geree ? (
            <p className="text-sm text-gray-500">Une licence de type {regle.label} ne porte pas de version : elle suit la version courante de l&apos;éditeur.</p>
          ) : !historiqueVersions.length ? (
            <p className="text-sm text-gray-500">Aucun changement de version enregistré.{licence.version_label ? ` Version courante : ${licence.version_label}.` : ''}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="py-1 pr-3 font-medium">Date d&apos;effet</th>
                    <th className="py-1 pr-3 font-medium">Événement</th>
                    <th className="py-1 pr-3 font-medium">Avant</th>
                    <th className="py-1 pr-3 font-medium">Après</th>
                    <th className="py-1 pr-3 font-medium">Auteur</th>
                  </tr>
                </thead>
                <tbody>
                  {historiqueVersions.map(h => (
                    <tr key={h.id} className="border-t border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200">
                      <td className="py-1.5 pr-3 whitespace-nowrap">{h.date_effet}</td>
                      <td className="py-1.5 pr-3">{EVENEMENTS_VERSION[h.evenement] ?? h.evenement}</td>
                      <td className="py-1.5 pr-3">{versionLabel(h.id_version_avant, h.version_avant_label)}</td>
                      <td className="py-1.5 pr-3">{versionLabel(h.id_version_apres, h.version_apres_label)}</td>
                      <td className="py-1.5 pr-3 text-gray-500">{auteur(h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
        licences={licences}
        montantsVisibles={montantsVisibles}
      />
      <LicenceFormModal
        isOpen={periodeSuivanteOpen} onClose={() => setPeriodeSuivanteOpen(false)}
        onSaved={(creee) => { addToast({ type: 'success', message: 'Nouvelle période créée, l\'ancienne licence conserve son terme.' }); navigate(`/conformite/licences/${creee.id}`); }}
        licence={null} modele={licence}
        produits={produits} commandes={commandes} revendeurs={revendeurs} unites={unites} mainteneurs={mainteneurs}
        licences={licences}
        montantsVisibles={montantsVisibles}
      />
      <LicenceProlongationModal
        isOpen={prolongerOpen} onClose={() => setProlongerOpen(false)} licence={licence}
        onSaved={(saved) => { appliquer(saved); rechargerPeriodes(); }}
      />
      <MaintenanceFormModal
        isOpen={periodeModal.open} onClose={() => setPeriodeModal({ open: false, periode: null })}
        onSaved={rechargerPeriodes} licenceId={licence.id} periode={periodeModal.periode}
        mainteneurs={mainteneurs} commandes={commandes} idContrat={licence.id_contrat ?? null} idProduit={licence.id_produit ?? null}
        montantsVisibles={montantsVisibles}
        versions={regle.version_geree && !arretee ? versions : []}
        versionGeree={regle.version_geree}
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
