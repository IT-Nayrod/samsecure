// BudgetEmbeddedSection - Bloc budget embarque dans fiches Contrat et Licence - SamSecure v0.5
// mode='licence' : lignes budgetaires brutes de la licence (GET /budget?id_licence),
//   indicateurs de la licence (GET /budget/synthese?id_licence), saisie avec
//   licence verrouillee selon saisir_budget, suppression selon supprimer_budget.
// mode='contrat' : indicateurs agreges du contrat (GET /budget/synthese?id_contrat)
//   et repartition par licence (une synthese par licence des lignes du contrat),
//   en lecture seule, lien vers la page Budget globale.
// Periode : PeriodeSelector partage (#164), exercice fiscal de l'organisation
// de la fiche (societe payeuse de la licence, societe signataire du contrat).
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { budgetService } from '../../services/budgetService';
import { societesService } from '../../services/adminService';
import { optionnel } from '../../services/http';
import PeriodeSelector from '../ui/PeriodeSelector';
import BudgetProgressBar from './BudgetProgressBar';
import BudgetKPIBar from './BudgetKPIBar';
import BudgetFormModal from './BudgetFormModal';
import ConfirmModal from '../ui/ConfirmModal';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import Badge from '../ui/Badge';
import {
  parametresPeriode, exerciceDePeriode, formatEuros, formatDateIso, libelleType, totauxVides,
} from './budgetCalculs';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';

const TH_CLS = 'px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap';

// Exercice fiscal de l'organisation de la fiche, lu dans /societes (ressource
// accessoire : sans le droit, defaut du composant de periode).
function useDebutExercice(idSociete) {
  const [debut, setDebut] = useState(null);
  useEffect(() => {
    let annule = false;
    if (!idSociete) { setDebut(null); return undefined; }
    optionnel(societesService.list())
      .then(s => { if (!annule) setDebut(s.find(x => x.id === idSociete)?.debut_exercice_fiscal ?? null); })
      .catch(() => { if (!annule) setDebut(null); });
    return () => { annule = true; };
  }, [idSociete]);
  return debut;
}

function ModeLicence({ id, licence }) {
  const { canWrite, canDelete } = useRbac({ write: 'saisir_budget', delete: 'supprimer_budget' });
  const { addToast } = useToast();
  const debutExercice = useDebutExercice(licence?.id_societe ?? null);
  const [periode, setPeriode] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [totaux, setTotaux] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [syntheseErreur, setSyntheseErreur] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [ligneEnEdition, setLigneEnEdition] = useState(null);
  const [ligneASupprimer, setLigneASupprimer] = useState(null);
  const demande = useRef(0);

  const load = useCallback(async () => {
    if (!periode?.dateDebut) return;
    const jeton = ++demande.current;
    const filtres = { ...parametresPeriode(periode), id_licence: id };
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    setSyntheseErreur(null);
    try {
      const [l, s] = await Promise.all([
        budgetService.list(filtres),
        budgetService.synthese(filtres).catch(err => ({ erreur: err.message })),
      ]);
      if (jeton !== demande.current) return;
      setLignes(l);
      if (s?.erreur) { setTotaux(null); setSyntheseErreur(s.erreur); }
      else setTotaux(s.totaux);
    } catch (err) {
      if (jeton !== demande.current) return;
      setError(err.message);
      setErrorStatus(err.status);
    } finally {
      if (jeton === demande.current) setIsLoading(false);
    }
  }, [periode, id]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setLigneEnEdition(null);
    setFormOpen(true);
  }

  async function handleConfirmDelete() {
    try {
      await budgetService.remove(ligneASupprimer.id);
      addToast({ type: 'success', message: 'Ligne budgétaire supprimée.' });
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message, persistent: true });
    }
  }

  const showActions = canWrite || canDelete;
  const licences = useMemo(() => (licence ? [licence] : []), [licence]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PeriodeSelector debutExercice={debutExercice} onChange={setPeriode} />
        {canWrite && (
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={14} /> Ajouter
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton lines={4} />
      ) : error ? (
        <ErrorState message={error} status={errorStatus} onRetry={load} />
      ) : lignes.length === 0 ? (
        <EmptyState
          title="Aucune ligne budgétaire"
          description={`Aucun budget saisi pour cette licence sur ${periode?.label?.toLowerCase() ?? 'la période'}.`}
          ctaLabel={canWrite ? 'Ajouter une ligne' : undefined}
          onCta={canWrite ? openCreate : undefined}
        />
      ) : (
        <>
          <BudgetKPIBar totaux={totaux} erreur={syntheseErreur} compact />
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                  <th className={`${TH_CLS} text-left`}>Type</th>
                  <th className={`${TH_CLS} text-right`}>CAPEX</th>
                  <th className={`${TH_CLS} text-right`}>OPEX</th>
                  <th className={`${TH_CLS} text-left`}>Période</th>
                  <th className={`${TH_CLS} text-left`}>Organisation</th>
                  {showActions && <th className="w-16 px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {lignes.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-3 py-2">
                      <Badge variant={b.type === 'alloue' ? 'success' : 'neutral'}>{libelleType(b.type)}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{formatEuros(b.montant_capex)}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{formatEuros(b.montant_opex)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{formatDateIso(b.date_debut)} au {formatDateIso(b.date_fin)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{b.id_societe ? b.societe_label : 'Non déterminée'}</td>
                    {showActions && (
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {canWrite && (
                            <button
                              onClick={() => { setLigneEnEdition(b); setFormOpen(true); }}
                              aria-label="Modifier"
                              className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setLigneASupprimer(b)}
                              aria-label="Supprimer"
                              className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <BudgetFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setLigneEnEdition(null); }}
        onSaved={() => { setLigneEnEdition(null); load(); }}
        ligne={ligneEnEdition}
        licences={licences}
        defaultDateDebut={periode?.dateDebut}
        defaultDateFin={periode?.dateFin}
        exercice={exerciceDePeriode(periode)}
        lockedLicenceId={id}
      />
      <ConfirmModal
        isOpen={!!ligneASupprimer}
        onClose={() => setLigneASupprimer(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer la ligne budgétaire"
        message="Supprimer définitivement cette ligne budgétaire ? Cette action est irréversible."
        confirmLabel="Supprimer"
        isDestructive
      />
    </div>
  );
}

function ModeContrat({ id, contrat }) {
  const navigate = useNavigate();
  const debutExercice = useDebutExercice(contrat?.id_societe ?? null);
  const [periode, setPeriode] = useState(null);
  const [totaux, setTotaux] = useState(null);
  const [nbLignes, setNbLignes] = useState(0);
  const [parLicence, setParLicence] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const demande = useRef(0);

  const load = useCallback(async () => {
    if (!periode?.dateDebut) return;
    const jeton = ++demande.current;
    const plage = parametresPeriode(periode);
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      const [synthese, lignes] = await Promise.all([
        budgetService.synthese({ ...plage, id_contrat: id }),
        budgetService.list({ ...plage, id_contrat: id }),
      ]);
      if (jeton !== demande.current) return;
      setTotaux(synthese.totaux);
      setNbLignes(lignes.length);

      // Repartition par licence : une synthese par licence du contrat, meme
      // lissage que les indicateurs du contrat.
      const licences = new Map();
      for (const l of lignes) {
        if (!licences.has(l.id_licence)) {
          licences.set(l.id_licence, { id: l.id_licence, label: l.produit_label ?? l.licence_label ?? l.id_licence, lot: l.licence_label, societe_label: l.societe_label });
        }
      }
      const rows = await Promise.all([...licences.values()].map(lic =>
        budgetService.synthese({ ...plage, id_licence: lic.id }).then(s => ({ licence: lic, totaux: s.totaux }))));
      if (jeton !== demande.current) return;
      setParLicence(rows.filter(r => !totauxVides(r.totaux)));
      if (!rows.length && !lignes.length) setParLicence([]);
    } catch (err) {
      if (jeton !== demande.current) return;
      setError(err.message);
      setErrorStatus(err.status);
    } finally {
      if (jeton === demande.current) setIsLoading(false);
    }
  }, [periode, id]);

  useEffect(() => { load(); }, [load]);

  // Vide seulement sans aucune ligne ni engage : des lignes a zero existent.
  const vide = !isLoading && !error && nbLignes === 0 && totauxVides(totaux);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PeriodeSelector debutExercice={debutExercice} onChange={setPeriode} />
        {/* Sans consulter_budget, la page Budget refuserait aussi : lien retire. */}
        {errorStatus !== 403 && (
          <Link to={`/budget?contrat=${id}`} className="flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-400 hover:underline">
            <ExternalLink size={14} /> Voir tout le budget
          </Link>
        )}
      </div>

      {isLoading ? (
        <Skeleton lines={4} />
      ) : error ? (
        <ErrorState message={error} status={errorStatus} onRetry={load} />
      ) : vide ? (
        <EmptyState
          title="Aucune ligne budgétaire"
          description={`Aucun budget ni engagement pour ce contrat sur ${periode?.label?.toLowerCase() ?? 'la période'}.`}
          ctaLabel="Ouvrir la page Budget"
          onCta={() => navigate(`/budget?contrat=${id}`)}
        />
      ) : (
        <>
          <BudgetKPIBar totaux={totaux} compact />
          {parLicence.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                    <th className={`${TH_CLS} text-left`}>Produit / Licence</th>
                    <th className={`${TH_CLS} text-right`}>Prévisionnel CAPEX</th>
                    <th className={`${TH_CLS} text-right`}>Prévisionnel OPEX</th>
                    <th className={`${TH_CLS} text-right`}>Alloué CAPEX</th>
                    <th className={`${TH_CLS} text-right`}>Alloué OPEX</th>
                    <th className={`${TH_CLS} text-left`}>Engagé sur alloué</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {parLicence.map(r => (
                    <tr key={r.licence.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-3 py-2">
                        <Link to={`/conformite/licences/${r.licence.id}`} className="font-medium text-blue-800 dark:text-blue-400 hover:underline">{r.licence.label}</Link>
                        {r.licence.lot && r.licence.lot !== r.licence.label && (
                          <span className="block text-xs text-gray-400 dark:text-gray-500">{r.licence.lot}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{formatEuros(r.totaux.previsionnel_capex)}</td>
                      <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{formatEuros(r.totaux.previsionnel_opex)}</td>
                      <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200">{formatEuros(r.totaux.alloue_capex)}</td>
                      <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200">{formatEuros(r.totaux.alloue_opex)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5 min-w-[120px]">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatEuros(r.totaux.engage)}</span>
                          <BudgetProgressBar valeur={r.totaux.engage} total={r.totaux.alloue} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// licence / contrat : objet de la fiche parente (projection API), pour
// l'organisation de reference et le libelle de la licence verrouillee.
export default function BudgetEmbeddedSection({ mode, id, licence = null, contrat = null }) {
  if (mode === 'licence') return <ModeLicence id={id} licence={licence} />;
  if (mode === 'contrat') return <ModeContrat id={id} contrat={contrat} />;
  return null;
}
