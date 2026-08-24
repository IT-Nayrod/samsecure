// AffectationDetailPage - fiche d'une affectation (#106) : identite, balance
// du produit (decompte API), cycles de revalidation, soumissions au circuit
// de validation et historique des declarations. Tout vient de l'API.
import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { affectationsService, licencesService } from '../../services/affectationsService';
import { societesService } from '../../services/adminService';
import { optionnel } from '../../services/http';
import { appliquerStatut } from '../../services/validationService';
import useValidation from '../../hooks/useValidation';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import ConfirmModal from '../ui/ConfirmModal';
import ValidationCell from '../referentiels/ValidationCell';
import ValidationActions from '../referentiels/ValidationActions';
import ConformiteGaugeBar from './ConformiteGaugeBar';
import StatutRevalidationBadge from './StatutRevalidationBadge';
import AffectationFormModal from './AffectationFormModal';
import HistoriqueDeclarations from './HistoriqueDeclarations';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import { formatDate, formatDateTime } from '../../utils/dateUtils';

function niveau(ratio) {
  if (ratio > 1) return 'depassement';
  if (ratio >= 0.9) return 'attention';
  return 'conforme';
}

export default function AffectationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canDelete, canValidate } = useRbac({ write: 'saisir_affectation', validate: 'valider_saisie' });

  const [affectation, setAffectation] = useState(null);
  const [decompte, setDecompte] = useState(null);
  const [licences, setLicences] = useState([]);
  const [societes, setSocietes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [revalidationEnCours, setRevalidationEnCours] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      const a = await affectationsService.get(id);
      setAffectation(a);
      const [d, l, s] = await Promise.all([
        a.id_produit ? optionnel(affectationsService.decompte({ id_produit: a.id_produit }), null) : null,
        optionnel(licencesService.list()),
        optionnel(societesService.list()),
      ]);
      setDecompte(d); setLicences(l); setSocietes(s);
    } catch (err) {
      if (err.status === 404) { setAffectation(null); setError(null); }
      else { setError(err.message); setErrorStatus(err.status); }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const appliquer = useCallback(async (reponse) => {
    setAffectation(prev => prev ? appliquerStatut(prev, reponse) : prev);
    await load();
  }, [load]);
  const { valider, refuser } = useValidation(appliquer);

  async function handleRevalider() {
    setRevalidationEnCours(true);
    try {
      const fraiche = await affectationsService.revalider(id);
      addToast({ type: 'success', message: `Revalidation effectuee, prochaine echeance le ${formatDate(fraiche.date_prochaine_revalidation)}.` });
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message, persistent: true });
    } finally {
      setRevalidationEnCours(false);
    }
  }

  async function handleDelete() {
    try {
      await affectationsService.remove(id);
      addToast({ type: 'success', message: 'Affectation supprimee.' });
      navigate('/conformite/affectations');
    } catch (err) {
      addToast({ type: 'error', message: err.message, persistent: true });
    }
  }

  const fil = [{ label: 'Usage', to: '/conformite/affectations' }, { label: 'Affectations', to: '/conformite/affectations' }];

  if (isLoading) {
    return <div className="flex flex-col gap-6"><Skeleton height="h-16" /><Skeleton height="h-40" /><Skeleton height="h-64" /></div>;
  }
  if (error) {
    return <div className="flex flex-col gap-6"><Breadcrumb items={[...fil, { label: 'Erreur' }]} /><ErrorState message={error} status={errorStatus} onRetry={load} /></div>;
  }
  if (!affectation) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[...fil, { label: 'Introuvable' }]} />
        <EmptyState title="Affectation introuvable" description="Cette affectation n'existe pas ou a ete supprimee." ctaLabel="Retour a la liste" onCta={() => navigate('/conformite/affectations')} />
      </div>
    );
  }

  const a = affectation;
  const validee = a.statut_validation === 'valide' || a.statut_validation === 'a_revalider';
  const balance = decompte?.par_produit?.find(p => p.id_produit === a.id_produit) ?? null;
  const ratio = balance && balance.droits_total > 0 ? balance.quantite_declaree / balance.droits_total : 0;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[...fil, { label: a.reference_client }]} />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{a.reference_client}</h1>
            <ValidationCell statut={a.statut_validation} motif={a.message_refus} />
            {validee && <StatutRevalidationBadge revalidation={a.statut_revalidation} />}
          </div>
          <p className="text-sm text-gray-500 mt-1">{a.produit_label ?? a.licence_label ?? 'Produit inconnu'} - {a.societe_label ?? 'Societe non renseignee'}</p>
          <p className="text-xs text-gray-400 mt-1">
            Soumis par {a.soumis_par ?? 'inconnu'} le {formatDateTime(a.date_soumission)}
            {a.traite_par ? `, traite par ${a.traite_par}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canValidate && (
            <ValidationActions statut={a.statut_validation}
              onValidate={() => valider('affectation', a.id)}
              onRefuse={motif => refuser('affectation', a.id, motif)} />
          )}
          {canValidate && validee && (
            <Button variant="secondary" size="sm" onClick={handleRevalider} isLoading={revalidationEnCours}>
              {['a_revalider', 'depasse'].includes(a.statut_revalidation) ? 'Revalider maintenant' : 'Revalider en avance'}
            </Button>
          )}
          {canWrite && (
            <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}><Pencil size={14} /> Editer</Button>
          )}
          {canDelete && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Supprimer</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Identite</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Produit</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{a.produit_label ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Licence</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{a.licence_label ?? '-'}{a.licence_quantite != null ? ` (${a.licence_quantite} droits)` : ''}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Societe</p>
              {a.id_societe
                ? <Link to={`/referentiels/organisation/${a.id_societe}`} className="text-sm text-blue-800 hover:underline">{a.societe_label}</Link>
                : <p className="text-sm text-gray-500">-</p>}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Delai de revalidation</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{a.delai_revalidation} jours</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Quantite</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{a.quantite}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Reference client</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{a.reference_client}</p>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Balance du produit</h2>
          {balance ? (
            <>
              <ConformiteGaugeBar droits={balance.droits_total} usage={balance.quantite_declaree} niveau={niveau(ratio)} label="Droits acquis vs usage declare" />
              <p className="text-xs text-gray-500 mt-2">
                {balance.nb_affectations} affectation(s) validee(s) ou a revalider, somme brute sans deduplication par reference.
                {balance.quantite_a_revalider > 0 && ` Dont ${balance.quantite_a_revalider} en attente de revalidation.`}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Aucun usage valide pour ce produit, ou decompte non accessible.</p>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cycle de revalidation</h2>
          {validee && a.date_prochaine_revalidation ? (
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              Derniere validation le <strong>{formatDate(a.date_derniere_validation)}</strong>, prochaine echeance le <strong>{formatDate(a.date_prochaine_revalidation)}</strong>
              {' '}({a.jours_restants >= 0 ? `dans ${a.jours_restants} jours` : `depassee depuis ${-a.jours_restants} jours`}).
            </p>
          ) : (
            <p className="text-sm text-gray-500 mb-3">Aucune echeance opposable : l&apos;affectation n&apos;est pas validee.</p>
          )}
          {a.cycles?.length > 0 && (
            <ul className="flex flex-col gap-2">
              {a.cycles.map((c, i) => (
                <li key={c.created_at + i} className="flex items-start gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0 bg-amber-500" />
                  <p className="text-xs text-gray-600 dark:text-gray-400">Cycle ouvert le {formatDate(c.date_derniere_validation)}, echeance le {formatDate(c.date_prochaine_revalidation)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Soumissions au circuit de validation</h2>
          {a.soumissions?.length ? (
            <ul className="flex flex-col gap-3">
              {a.soumissions.map(s => (
                <li key={s.id} className="flex items-start gap-3">
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${s.statut === 'valide' ? 'bg-green-500' : s.statut === 'refuse' ? 'bg-red-500' : 'bg-gray-400'}`} />
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {s.statut_label ?? s.statut}, soumise par <strong>{s.soumis_par ?? 'inconnu'}</strong> le {formatDateTime(s.created_at)}
                    {s.traite_par ? `, traitee par ${s.traite_par}` : ''}
                    {s.statut === 'refuse' && s.message_refus ? ` : ${s.message_refus}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-500">Aucune soumission.</p>}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Historique des declarations</h2>
          <HistoriqueDeclarations filtres={{ id_affectation: a.id }} />
        </section>
      </div>

      <AffectationFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSaved={load} affectation={a} licences={licences} societes={societes} />
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer l'affectation"
        isDestructive
        confirmLabel="Supprimer"
        message={`Supprimer definitivement l'affectation "${a.reference_client}" ? Cette action est irreversible.`}
      />
    </div>
  );
}
