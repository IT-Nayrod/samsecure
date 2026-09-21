// ContratDetailPage - fiche détail d'un contrat : identité, échéance, hiérarchie, rattachements.
// Données API. La suppression s'appuie sur le refus du serveur, pas sur un garde-fou local.
// Décision du 11/09/2026 : bandeau "le contrat doit suivre" quand l'API sert
// contrat_a_suivre (des licences renouvelées sur un contrat échu ou à échéance
// sans successeur). Signal seulement, rien n'est modifié automatiquement.
// Unification de l'affichage (#215) : une section « Preuves » liste toutes les
// pièces du contrat, rattachées directement ou par l'une de ses commandes
// (règle de GET /preuves?id_contrat), type facture compris, avec le dépôt
// depuis la fiche. Le compteur nb_preuves de l'API (rattachement direct, celui
// du garde-fou de suppression) n'est plus affiché : la liste fait foi.
// Type Interne (#219, règle client du 17/09/2026) : le bloc Signataires montre
// la société prêteuse à la place du revendeur, le signataire côté vendeur
// étant une société du tenant.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2, ChevronDown, XCircle, Archive, ArchiveRestore, AlertTriangle, ExternalLink, Plus } from 'lucide-react';
import BudgetEmbeddedSection from '../budget/BudgetEmbeddedSection';
import { contratsService, referentielsContratsService } from '../../services/contratsService';
import { preuvesService, typesPreuveService } from '../../services/documentsService';
import { optionnel } from '../../services/http';
import { societesService } from '../../services/adminService';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import StatutEcheanceBadge from './StatutEcheanceBadge';
import ContratFormModal from './ContratFormModal';
import PreuveFormModal from './PreuveFormModal';
import { libelleContrat } from './libelleContrat';
import { fichierDepose } from './preuveAffichage';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import StatutValidationBadge from '../referentiels/StatutValidationBadge';
import ValidationActions from '../referentiels/ValidationActions';
import useValidation from '../../hooks/useValidation';
import { appliquerStatut } from '../../services/validationService';

export default function ContratDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canDelete, canValidate } = useRbac({ write: 'saisir_contrat', validate: 'valider_saisie' });
  // Le dépôt d'une preuve suit le droit de l'écran Preuves, pas celui du contrat.
  const { canWrite: canDeposer } = useRbac({ write: 'deposer_facture_preuve' });

  const [contrat, setContrat] = useState(null);
  const [preuves, setPreuves] = useState([]);
  const [typesPreuve, setTypesPreuve] = useState([]);
  const [preuveModal, setPreuveModal] = useState(false);
  const [ouverture, setOuverture] = useState(null);
  const [contrats, setContrats] = useState([]);
  const [typesContrat, setTypesContrat] = useState([]);
  const [editeurs, setEditeurs] = useState([]);
  const [societes, setSocietes] = useState([]);
  const [revendeurs, setRevendeurs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restaureEnCours, setRestaureEnCours] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    setIntrouvable(false);
    try {
      // Seule la fiche est indispensable. La liste sert aux sous-contrats, les
      // référentiels au formulaire d'édition.
      // Les preuves du contrat (#215) sont accessoires au même titre : un refus
      // de droit sur les documents laisse la fiche lisible, sans sa liste.
      const [c, tous, t, e, s, r, p, tp] = await Promise.all([
        contratsService.get(id),
        // Archives inclus : la hiérarchie doit rester complète, un sous-contrat
        // archivé existe toujours. Le formulaire écarte lui-même les archives.
        optionnel(contratsService.list({ inclureArchives: true })),
        optionnel(referentielsContratsService.typesContrat()),
        optionnel(referentielsContratsService.editeurs()),
        optionnel(societesService.list()),
        optionnel(referentielsContratsService.revendeurs()),
        optionnel(preuvesService.list({ idContrat: id })),
        optionnel(typesPreuveService.list()),
      ]);
      setContrat(c);
      setContrats(tous);
      setTypesContrat(t);
      setEditeurs(e);
      setSocietes(s);
      setRevendeurs(r);
      setPreuves(p);
      setTypesPreuve(tp);
    } catch (err) {
      // 404 : le contrat n'existe pas ou vient d'être supprimé, ce n'est pas une panne.
      if (err.status === 404) setIntrouvable(true);
      else { setError(err.message); setErrorStatus(err.status); addToast({ type: 'error', message: err.message }); }
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const appliquer = useCallback(reponse => setContrat(c => appliquerStatut(c, reponse)), []);
  const { valider, refuser } = useValidation(appliquer);

  const sousContrats = useMemo(
    () => contrats.filter(c => c.id_contrat_parent === id),
    [contrats, id]);

  // Le fichier est protégé par le jeton : on le télécharge puis on ouvre l'objet
  // URL local, comme le font la fiche document et la fiche commande.
  async function ouvrirFichier(idPreuve) {
    setOuverture(idPreuve);
    try {
      const url = await preuvesService.fichierUrl(idPreuve);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setOuverture(null);
    }
  }

  async function handleDelete() {
    try {
      await contratsService.remove(contrat.id);
      addToast({ type: 'success', message: 'Contrat supprimé.' });
      navigate('/contrats/liste');
    } catch (err) {
      // Message du serveur affiché tel quel : "Suppression impossible : ce contrat porte ..."
      addToast({ type: 'error', message: err.message, persistent: true });
    }
  }

  // Archivage (#96) : le contrat quitte les listes sans rien perdre ; la fiche
  // reste consultable et affiche le bandeau de restauration.
  async function handleArchiver() {
    try {
      const maj = await contratsService.archiver(contrat.id);
      setContrat(c => ({ ...c, ...maj }));
      addToast({ type: 'success', message: 'Contrat archivé.' });
    } catch (err) {
      addToast({ type: 'error', message: err.message, persistent: true });
    }
  }

  async function handleRestaurer() {
    setRestaureEnCours(true);
    try {
      const maj = await contratsService.restaurer(contrat.id);
      setContrat(c => ({ ...c, ...maj }));
      addToast({ type: 'success', message: 'Contrat restauré.' });
    } catch (err) {
      addToast({ type: 'error', message: err.message, persistent: true });
    } finally {
      setRestaureEnCours(false);
    }
  }

  const fil = (
    <Breadcrumb items={[
      { label: 'Droits d\'usage', to: '/contrats/liste' },
      { label: 'Contrat', to: '/contrats/liste' },
      { label: contrat ? libelleContrat(contrat.label, contrat.societe_label) : '...' },
    ]} />
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {fil}
        <Skeleton height="h-16" />
        <Skeleton height="h-32" />
        <Skeleton height="h-64" />
      </div>
    );
  }

  if (introuvable) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Droits d\'usage', to: '/contrats/liste' }, { label: 'Contrat', to: '/contrats/liste' }, { label: 'Introuvable' }]} />
        <EmptyState title="Contrat introuvable" description="Ce contrat n'existe pas ou a été supprimé." ctaLabel="Retour à la liste" onCta={() => navigate('/contrats/liste')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {fil}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <ErrorState message={error} status={errorStatus} onRetry={load} />
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
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{libelleContrat(contrat.label, contrat.societe_label)}</h1>
            {contrat.type_code === 'cadre' && <span className="text-xs font-semibold text-blue-700 bg-blue-100 dark:bg-blue-900/30 px-2.5 py-1 rounded-full">Cadre</span>}
            {contrat.type_code === 'interne' && <span className="text-xs font-semibold text-purple-700 bg-purple-100 dark:bg-purple-900/30 px-2.5 py-1 rounded-full">{contrat.type_label ?? 'Interne'}</span>}
            <StatutEcheanceBadge statut={contrat.statut_echeance} />
            <StatutValidationBadge statut={contrat.statut_validation} />
            {contrat.archive && <span className="text-xs font-semibold text-gray-600 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-full">Archivé</span>}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {contrat.type_label ?? '-'}{contrat.editeur_label ? ` - ${contrat.editeur_label}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Un contrat archivé est figé : ni traitement, ni édition, ni
              archivage à nouveau. Seule la restauration, dans le bandeau. */}
          {!contrat.archive && canValidate && <ValidationActions
            statut={contrat.statut_validation}
            onValidate={() => valider('contrat', contrat.id)}
            onRefuse={motif => refuser('contrat', contrat.id, motif)}
          />}
          {!contrat.archive && canWrite && (
            <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}>
              <Pencil size={14} /> Éditer
            </Button>
          )}
          {!contrat.archive && canDelete && (
            <Button variant="secondary" size="sm" onClick={() => setArchiveOpen(true)}>
              <Archive size={14} /> Archiver
            </Button>
          )}
          {/* Supprimer n'est proposé que si l'API déclare le contrat supprimable
              (jamais validé ni à revalider) ; le refus serveur reste la règle. */}
          {!contrat.archive && canDelete && contrat.supprimable && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={14} /> Supprimer
            </Button>
          )}
        </div>
      </div>

      {contrat.archive && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 flex-wrap">
          <div className="flex items-start gap-2">
            <Archive size={16} className="text-gray-600 dark:text-gray-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Contrat archivé le {contrat.date_archivage ? formatDate(contrat.date_archivage) : '-'}
                {contrat.archive_par_label ? ` par ${contrat.archive_par_label}` : ''}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Ce contrat est masqué des listes et ne peut plus être modifié tant qu'il n'est pas restauré.</p>
            </div>
          </div>
          {canDelete && (
            <Button variant="secondary" size="sm" onClick={handleRestaurer} isLoading={restaureEnCours}>
              <ArchiveRestore size={14} /> Restaurer
            </Button>
          )}
        </div>
      )}

      {contrat.contrat_a_suivre && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={16} className="text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Ce contrat doit être renouvelé ou prolongé : des licences ont été renouvelées dessus.</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              {contrat.nb_licences_renouvelees > 1 ? `${contrat.nb_licences_renouvelees} licences ont été renouvelées` : 'Une licence a été renouvelée'} sur ce contrat,
              {contrat.statut_echeance === 'expire' ? ' échu' : ' à échéance'}{contrat.date_fin ? ` le ${formatDate(contrat.date_fin)}` : ''} et sans successeur.
              Prolongez sa date de fin ou créez le contrat qui le renouvelle (champ « Renouvelle le contrat » du formulaire). Rien n&apos;est modifié automatiquement.
            </p>
          </div>
        </div>
      )}

      {contrat.statut_validation === 'refuse' && contrat.message_refus && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <XCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Saisie refusée</p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">{contrat.message_refus}</p>
          </div>
        </div>
      )}

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Signataires</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Société signataire</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{contrat.societe_label ?? '-'}</p>
          </div>
          {contrat.type_code === 'interne' ? (
            <div>
              <p className="text-xs text-gray-500 mb-1">Société prêteuse</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{contrat.societe_preteuse_label ?? '-'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Signataire côté vendeur (prêt de licences entre sociétés)</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-1">Revendeur signataire</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{contrat.revendeur_label ?? '-'}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 mb-1">Éditeur</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{contrat.editeur_label ?? '-'}</p>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Échéance et renouvellement</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Date de début</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{contrat.date_debut ? formatDate(contrat.date_debut) : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Date de fin</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{contrat.date_fin ? formatDate(contrat.date_fin) : 'Perpétuel'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">À renouveler</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{contrat.a_renouveler ? 'Oui' : 'Non'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Préavis de résiliation</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{contrat.duree_resiliation ? `${contrat.duree_resiliation} jours` : '-'}</p>
          </div>
        </div>
        {(contrat.statut_echeance === 'expire' || contrat.statut_echeance === 'a_renouveler') && contrat.jours_restants !== null && (
          <p className="text-sm mt-3" style={{ color: contrat.statut_echeance === 'expire' ? '#EF4444' : '#F59E0B' }}>
            {contrat.statut_echeance === 'expire'
              ? `Échu depuis ${-contrat.jours_restants} jours`
              : `Échéance dans ${contrat.jours_restants} jours`}
          </p>
        )}
        {/* Succession (D35) : prédécesseur et successeurs servis par l'API
            (predecesseur_label, predecesseur_societe_label, successeurs). */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-500 mb-1">Renouvelle le contrat</p>
            {contrat.id_contrat_predecesseur
              ? (
                <Link to={`/contrats/liste/${contrat.id_contrat_predecesseur}`} className="text-sm text-blue-800 hover:underline">
                  {libelleContrat(contrat.predecesseur_label, contrat.predecesseur_societe_label)}
                </Link>
              )
              : <p className="text-sm text-gray-500">Aucun</p>}
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Renouvelé par ({(contrat.successeurs ?? []).length})</p>
            {(contrat.successeurs ?? []).length === 0
              ? <p className="text-sm text-gray-500">Aucun successeur.</p>
              : (
                <ul className="flex flex-col gap-1">
                  {contrat.successeurs.map(s => (
                    <li key={s.id}>
                      <Link to={`/contrats/liste/${s.id}`} className="text-sm text-blue-800 hover:underline">
                        {libelleContrat(s.label, s.societe_label)}{s.archive ? ' (Archivé)' : ''}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Hiérarchie</h2>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Contrat cadre parent</p>
              {contrat.id_contrat_parent
                ? (
                  <p>
                    <Link to={`/contrats/liste/${contrat.id_contrat_parent}`} className="text-sm text-blue-800 hover:underline">
                      {libelleContrat(contrat.parent_label, contrat.parent_societe_label)}
                    </Link>
                  </p>
                )
                : <p className="text-sm text-gray-500">Aucun</p>
              }
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Sous-contrats ({sousContrats.length})</p>
              {sousContrats.length === 0
                ? <p className="text-sm text-gray-500">Aucun sous-contrat.</p>
                : (
                  <ul className="flex flex-col gap-1">
                    {sousContrats.map(s => (
                      <li key={s.id}>
                        <Link to={`/contrats/liste/${s.id}`} className="text-sm text-blue-800 hover:underline">
                          {libelleContrat(s.label, s.societe_label)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Rattachements</h2>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Commandes rattachées</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{contrat.nb_commandes ?? 0}</p>
              <Link to={`/contrats/commandes?contrat=${contrat.id}`} className="text-xs text-blue-800 hover:underline">Voir les commandes</Link>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Preuves ({preuves.length})</h2>
            <div className="flex items-center gap-3">
              <Link to={`/contrats/factures?contrat=${contrat.id}`} className="text-xs text-blue-800 hover:underline">Voir dans Preuves</Link>
              {canDeposer && !contrat.archive && (
                <Button variant="secondary" size="sm" onClick={() => setPreuveModal(true)}><Plus size={14} /> Ajouter une preuve</Button>
              )}
            </div>
          </div>
          {preuves.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune preuve rattachée à ce contrat ni à ses commandes.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {preuves.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link to={`/contrats/factures/${p.id}`} className="text-sm font-medium text-blue-800 hover:underline">{p.label}</Link>
                    <p className="text-xs text-gray-500">
                      {p.type_label ?? '-'}{p.date_preuve ? ` du ${formatDate(p.date_preuve)}` : ''}
                      {p.id_commande ? ` · commande ${p.commande_label ?? ''}` : ''}
                      {' · déposée le '}{formatDate(p.created_at)}
                    </p>
                  </div>
                  {fichierDepose(p) && (
                    <Button variant="secondary" size="sm" onClick={() => ouvrirFichier(p.id)} isLoading={ouverture === p.id}>
                      <ExternalLink size={14} /> Ouvrir le fichier
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Section Budget (dépliée par défaut) */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={() => setBudgetOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Budget</h2>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${budgetOpen ? '' : '-rotate-90'}`} />
        </button>
        {budgetOpen && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-700">
            <BudgetEmbeddedSection mode="contrat" id={contrat.id} contrat={contrat} />
          </div>
        )}
      </section>

      <ContratFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        contrat={contrat}
        contrats={contrats}
        typesContrat={typesContrat}
        editeurs={editeurs}
        societes={societes}
        revendeurs={revendeurs}
      />
      <PreuveFormModal
        isOpen={preuveModal}
        onClose={() => setPreuveModal(false)}
        onDone={toast => { if (toast) addToast(toast); load(); }}
        typesPreuve={typesPreuve}
        contrats={[contrat]}
        contratParDefaut={contrat.id}
      />

      <ConfirmModal
        isOpen={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={handleArchiver}
        title="Archiver le contrat"
        confirmLabel="Archiver"
        message={`Archiver ${libelleContrat(contrat.label, contrat.societe_label)} ? Il disparaîtra des listes, restera consultable et pourra être restauré. Ses sous-contrats et commandes ne changent pas.`}
      />
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer le contrat"
        isDestructive
        confirmLabel="Supprimer"
        message={`Supprimer définitivement ${libelleContrat(contrat.label, contrat.societe_label)} ? Cette action est irréversible.`}
      />
    </div>
  );
}
