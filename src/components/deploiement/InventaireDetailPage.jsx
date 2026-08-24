// InventaireDetailPage - fiche d'un releve d'inventaire, branchee sur
// GET /api/inventaire/releves/:id (#111). Donnee brute relue du fichier
// archive (pointeur "<fichier>#L<n>"), statut de rapprochement, affectation
// rapprochee ou candidates, actions de rapprochement manuel.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { inventaireService, RAPPROCHEMENT_STATUT } from '../../services/inventaireService';
import Breadcrumb from '../ui/Breadcrumb';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import RapprochementModal from './RapprochementModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import { formatDateTime } from '../../utils/dateUtils';

export default function InventaireDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canValidate: canRapprocher } = useRbac({ validate: 'rapprocher_inventaire' });

  const [releve, setReleve] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [modal, setModal] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setReleve(await inventaireService.getReleve(id));
    } catch (err) {
      setError(err.message);
      setErrorStatus(err.status);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function apresTransition(data, mode) {
    setReleve(data);
    addToast({ type: 'success', message: { rapprocher: 'Releve rapproche.', 'ecart-assume': 'Ecart assume.', rejeter: 'Releve rejete.', reouvrir: 'Releve remis en attente.' }[mode] });
  }

  async function reouvrir() {
    try { apresTransition(await inventaireService.reouvrir(id), 'reouvrir'); }
    catch (err) { addToast({ type: 'error', message: err.message }); }
  }

  const fil = [{ label: 'Usage', to: '/conformite/inventaire' }, { label: 'Inventaire', to: '/conformite/inventaire' }];

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[...fil, { label: 'Introuvable' }]} />
        <ErrorState message={error} status={errorStatus} onRetry={errorStatus === 404 ? undefined : load} />
        {errorStatus === 404 && <div><Button onClick={() => navigate('/conformite/inventaire')}>Retour a la liste</Button></div>}
      </div>
    );
  }
  if (isLoading || !releve) {
    return <div className="flex flex-col gap-6"><Breadcrumb items={fil} /><Skeleton lines={8} /></div>;
  }

  const cfg = RAPPROCHEMENT_STATUT[releve.statut_rapprochement] ?? RAPPROCHEMENT_STATUT.en_attente;
  const titre = releve.produit_label ?? (releve.fichier_absent ? 'Fichier archive absent' : 'Releve');

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[...fil, { label: titre }]} />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{titre}</h1>
            <Badge variant={cfg.variant} label={cfg.label} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {releve.societe_label ?? 'Societe non renseignee'} - import manuel csv{releve.date_import ? ` du ${formatDateTime(releve.date_import)}` : ''}
          </p>
        </div>
        {canRapprocher && (
          <div className="flex gap-2">
            {releve.statut_rapprochement !== 'rejete' && <Button onClick={() => setModal(true)}>Rapprocher</Button>}
            {releve.statut_rapprochement !== 'en_attente' && <Button variant="secondary" onClick={reouvrir}>Reouvrir</Button>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Donnee brute</h2>
          {releve.fichier_absent && (
            <p className="text-sm text-orange-600 mb-3">Le fichier archive est introuvable sur le serveur : le contenu de la ligne ne peut pas etre relu.</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Produit (tel que releve)</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{releve.produit ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Reference constatee</p>
              <p className="text-sm text-gray-800 dark:text-gray-200 font-mono">{releve.reference ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Quantite constatee</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{releve.quantite ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Societe (colonne du fichier)</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{releve.societe_csv ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Format source</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{releve.format_source ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Date d'enregistrement</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{formatDateTime(releve.created_at)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-1">Pointeur fichier archive (ligne {releve.ligne ?? '?'})</p>
              <p className="text-sm text-gray-800 dark:text-gray-200 flex items-center gap-1.5 font-mono break-all">
                <FileText size={13} className="flex-shrink-0 text-gray-400" /> {releve.url_fichier}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Rapprochement</h2>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Statut</p>
              <Badge variant={cfg.variant} label={cfg.label} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Affectation rapprochee</p>
              {releve.id_affectation
                ? <p className="text-sm text-gray-800 dark:text-gray-200">{releve.affectation_reference ?? releve.affectation_label}{releve.affectation_produit_label ? ` - ${releve.affectation_produit_label}` : ''}</p>
                : <p className="text-sm text-gray-500">Aucune affectation rapprochee.</p>}
            </div>
            {!releve.id_affectation && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Affectations candidates (meme reference)</p>
                {releve.candidates?.length
                  ? <ul className="text-sm text-gray-800 dark:text-gray-200 flex flex-col gap-1">
                      {releve.candidates.map(a => <li key={a.id}>{a.reference_client} - {a.produit_label ?? a.licence_label ?? a.label} x{a.quantite}{a.societe_label ? ` - ${a.societe_label}` : ''}</li>)}
                    </ul>
                  : <p className="text-sm text-orange-600 dark:text-orange-400">Aucune affectation declaree ne porte cette reference : usage constate sans affectation.</p>}
              </div>
            )}
          </div>
        </section>
      </div>

      <RapprochementModal isOpen={modal} onClose={() => setModal(false)} releve={releve} onDone={apresTransition} />
    </div>
  );
}
