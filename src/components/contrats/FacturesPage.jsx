// FacturesPage - écran Preuves, orienté audit.
// Titre « Preuves » depuis le 12/09 (décision du chef de projet, le ticket
// #200 conservait « Factures & Preuves ») : la facture est un type de preuve
// parmi les sept.
// Unification totale de l'affichage (#215, ticket client du 16/09/2026) : une
// seule source, GET /preuves, qui sert toutes les preuves, support de facture
// compris (id_facture et statut de la facture portés par la ligne). Plus de
// nature Preuve / Facture à l'écran : une seule colonne de type, celle du type
// documentaire, une seule tuile Preuves (total, répartition par type en
// sous-texte), un seul jeu de filtres et un export CSV alignés. Le circuit de
// dépôt reste celui de la modale unifiée (#204), inchangé.
// La validation vise l'entité qui porte la demande : la facture quand la ligne
// en est le support (id_facture), la preuve sinon. C'est la seule trace de la
// table facture dans cet écran, et elle est invisible.
// La détection des manques vient de /api/commandes/manques : une vue temps
// réel, jamais un stock d'anomalies, d'où le rechargement après chaque dépôt.
// « Sans facture » y désigne l'absence d'une preuve de type documentaire
// facture sur la commande (#215), même lecture que la colonne Type.
// Date de la preuve (#214) : colonne « Date de la preuve » (date métier du
// document, distincte de « Déposé le »), triable, et filtre par période (Du /
// Au) appliqué par l'API ; les preuves antérieures restent sans date.
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, FileCheck, AlertTriangle, X } from 'lucide-react';
import { preuvesService, typesPreuveService, manquesService } from '../../services/documentsService';
import { contratsService } from '../../services/contratsService';
import { optionnel } from '../../services/http';
import { commandesService } from '../../services/commandesService';
import { licencesService } from '../../services/licencesService';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Breadcrumb from '../ui/Breadcrumb';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import DocumentIcon from './DocumentIcon';
import ManqueBadge from './ManqueBadge';
import PreuveFormModal from './PreuveFormModal';
import { libelleContrat } from './libelleContrat';
import { contratDeLaPreuve, cibleValidation } from './preuveAffichage';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import ValidationCell from '../referentiels/ValidationCell';
import ValidationActions from '../referentiels/ValidationActions';
import useValidation from '../../hooks/useValidation';
import { appliquerStatut } from '../../services/validationService';

const SELECT_CLS = 'text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function FacturesPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canValidate } = useRbac({ write: 'deposer_facture_preuve', validate: 'valider_saisie' });

  const [preuves, setPreuves] = useState([]);
  const [manques, setManques] = useState(null);
  const [typesPreuve, setTypesPreuve] = useState([]);
  const [contrats, setContrats] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [licences, setLicences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);

  const [filterTypePreuve, setFilterTypePreuve] = useState('');
  const [filterContrat, setFilterContrat] = useState('');
  const [filterCommande, setFilterCommande] = useState('');
  const [filterDateMin, setFilterDateMin] = useState('');
  const [filterDateMax, setFilterDateMax] = useState('');
  const [searchParams] = useSearchParams();
  const contratParam = searchParams.get('contrat');
  const commandeParam = searchParams.get('commande');
  const [preuveModal, setPreuveModal] = useState(false);
  const manquesRef = useRef(null);

  // Les filtres partent à l'API plutôt que d'être appliqués en mémoire : la
  // règle de filtrage est celle du serveur (contrat direct ou par la
  // commande, #215), elle ne peut pas dériver de ce que l'écran suppose.
  const contratActif = filterContrat || contratParam || '';
  const commandeActive = filterCommande || commandeParam || '';

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    const filtres = {
      idTypePreuve: filterTypePreuve || undefined,
      idContrat: contratActif || undefined,
      idCommande: commandeActive || undefined,
      datePreuveMin: filterDateMin || undefined,
      datePreuveMax: filterDateMax || undefined,
    };
    try {
      // La liste des preuves est la ressource de l'écran. La détection des
      // manques, les types et les listes de rattachement sont accessoires :
      // leur refus retire une section ou un filtre, pas la page.
      // Les licences (#208) ne servent qu'au rattachement dans la modale de
      // dépôt : un refus de droit sur le module 3 laisse l'écran complet.
      const [p, m, t, c, k, l] = await Promise.all([
        preuvesService.list(filtres),
        optionnel(manquesService.list({ idContrat: contratActif || undefined }), null),
        optionnel(typesPreuveService.list()),
        optionnel(contratsService.list()),
        optionnel(commandesService.list()),
        optionnel(licencesService.list()),
      ]);
      setPreuves(p); setManques(m);
      setTypesPreuve(t); setContrats(c); setCommandes(k); setLicences(l);
    } catch (err) {
      setError(err.message);
      setErrorStatus(err.status);
    } finally {
      setIsLoading(false);
    }
  }, [filterTypePreuve, contratActif, commandeActive, filterDateMin, filterDateMax]);

  useEffect(() => { load(); }, [load]);

  function apresDepot(toast) {
    if (toast) addToast(toast);
    load();
  }

  // La réponse de traitement désigne l'entité traitée : la facture pour une
  // ligne support (id_facture), la preuve sinon. Une seule liste à mettre à jour.
  const appliquer = useCallback(reponse => {
    setPreuves(liste => liste.map(x => (
      (reponse.entite_type === 'facture' && x.id_facture === reponse.entite_id)
      || (reponse.entite_type === 'preuve' && x.id === reponse.entite_id)
        ? appliquerStatut(x, reponse) : x)));
  }, []);
  const { valider, refuser } = useValidation(appliquer);

  function resetFiltres() {
    setFilterTypePreuve(''); setFilterContrat(''); setFilterCommande('');
    setFilterDateMin(''); setFilterDateMax('');
  }

  const hasActiveFiltres = !!(filterTypePreuve || filterContrat || filterCommande || filterDateMin || filterDateMax);

  // Lignes de l'écran : une par preuve, telle que servie par l'API. Le contrat
  // affiché est le rattachement direct, sinon celui de la commande rattachée.
  const lignes = useMemo(() => preuves.map(p => ({
    ...p,
    nom_fichier: p.nom_origine || p.url_fichier,
    contrat_affiche: contratDeLaPreuve(p),
    // Une preuve rattachée à une licence sans libellé propre reste
    // identifiable : la fiche document porte le lien vers la licence.
    licence_affichee: p.id_licence ? (p.licence_label ?? 'Licence') : null,
  })), [preuves]);

  // Répartition par type documentaire, sous-texte de la tuile Preuves : les
  // types présents dans la liste courante, du plus fréquent au moins fréquent.
  const repartition = useMemo(() => {
    const compte = new Map();
    for (const p of preuves) {
      const cle = p.type_label ?? 'Sans type';
      compte.set(cle, (compte.get(cle) ?? 0) + 1);
    }
    return [...compte.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
      .map(([type, n]) => `${n} ${type.toLowerCase()}`)
      .join(', ');
  }, [preuves]);

  const columns = [
    { key: 'label', label: 'Document', render: r => (
      <button onClick={() => navigate(`/contrats/factures/${r.id}`)} className="flex items-center gap-2.5 font-medium text-blue-800 hover:underline text-left">
        <DocumentIcon nomFichier={r.nom_fichier} size={28} />
        {r.label}
      </button>
    ), csvValue: r => r.label },
    { key: 'type_label', label: 'Type', sortable: true, render: r => r.type_label ?? '-', csvValue: r => r.type_label ?? '' },
    { key: 'liaison', label: 'Rattachement',
      csvValue: r => [r.contrat_affiche, r.commande_label, r.licence_affichee].filter(Boolean).join(' - '),
      render: r => [r.contrat_affiche, r.commande_label, r.licence_affichee].filter(Boolean).join(' - ') || '-' },
    { key: 'date_preuve', label: 'Date de la preuve', sortable: true, render: r => formatDate(r.date_preuve), csvValue: r => r.date_preuve ? formatDate(r.date_preuve) : '' },
    { key: 'created_at', label: 'Déposé le', sortable: true, render: r => formatDate(r.created_at), csvValue: r => formatDate(r.created_at) },
    { key: 'statut_validation', label: 'Validation', sortable: true,
      csvValue: r => [r.statut_validation_label, r.message_refus].filter(Boolean).join(' - '),
      render: r => <ValidationCell statut={r.statut_validation} motif={r.message_refus} /> },
    { key: 'actions_validation', label: '', csvValue: () => '',
      render: r => {
        const cible = cibleValidation(r);
        return canValidate && (
          <ValidationActions
            statut={r.statut_validation}
            onValidate={() => valider(cible.entite, cible.id)}
            onRefuse={motif => refuser(cible.entite, cible.id, motif)}
          />
        );
      } },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Droits d\'usage' }, { label: 'Preuves' }]} />
        <Skeleton lines={3} height="h-20" />
        <Skeleton lines={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Droits d\'usage' }, { label: 'Preuves' }]} />
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <ErrorState message={error} status={errorStatus} onRetry={load} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Droits d\'usage' }, { label: 'Preuves' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Preuves</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pièces justificatives et aptitude à l&apos;audit</p>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={() => setPreuveModal(true)}>
            <Plus size={15} /> Déposer une preuve
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0" style={{ backgroundColor: '#1F4E7918' }}>
            <FileCheck size={17} style={{ color: '#1F4E79' }} />
          </span>
          <div className="min-w-0">
            <p className="text-xl font-semibold" style={{ color: '#1F4E79' }}>{preuves.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Preuves</p>
            {repartition && <p className="text-xs text-gray-400 mt-0.5 truncate" title={repartition}>{repartition}</p>}
          </div>
        </div>
        <button
          onClick={() => manquesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-left hover:border-blue-300 transition-colors"
        >
          <span className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0" style={{ backgroundColor: '#EF444418' }}>
            <AlertTriangle size={17} style={{ color: '#EF4444' }} />
          </span>
          <div>
            <p className="text-xl font-semibold" style={{ color: '#EF4444' }}>{manques?.total ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">Manques détectés</p>
          </div>
        </button>
      </div>

      <section ref={manquesRef} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Détection des manques (risque audit)</h2>
          {manques?.total > 0 && (
            <p className="text-xs text-gray-500">
              {manques.total_sans_facture} sans facture, {manques.total_sans_preuve} sans preuve
            </p>
          )}
        </div>
        {!manques || manques.total === 0 ? (
          <p className="text-sm text-gray-500">Aucun manque détecté : toutes les commandes ont une facture et une preuve.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {manques.commandes.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40" style={{ borderLeft: '3px solid #EF4444' }}>
                <button onClick={() => navigate(`/contrats/commandes/${c.id}`)} className="text-sm font-medium text-gray-900 dark:text-white hover:underline text-left">
                  {c.label}
                  <span className="ml-2 text-xs font-normal text-gray-500">{[libelleContrat(c.contrat_label, c.contrat_societe_label), c.societe_label].filter(Boolean).join(' - ')}</span>
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {c.facture_manquante && <ManqueBadge label="Sans facture" />}
                  {c.preuve_manquante && <ManqueBadge label="Sans preuve" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <select value={filterTypePreuve} onChange={e => setFilterTypePreuve(e.target.value)} className={SELECT_CLS}>
          <option value="">Tous les types</option>
          {typesPreuve.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select value={filterContrat} onChange={e => setFilterContrat(e.target.value)} className={SELECT_CLS}>
          <option value="">Tous les contrats</option>
          {contrats.map(c => <option key={c.id} value={c.id}>{libelleContrat(c.label, c.societe_label)}</option>)}
        </select>
        <select value={filterCommande} onChange={e => setFilterCommande(e.target.value)} className={SELECT_CLS}>
          <option value="">Toutes les commandes</option>
          {commandes.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          Date de la preuve du
          <input type="date" value={filterDateMin} max={filterDateMax || undefined} onChange={e => setFilterDateMin(e.target.value)} className={SELECT_CLS} aria-label="Date de la preuve, début de période" />
          au
          <input type="date" value={filterDateMax} min={filterDateMin || undefined} onChange={e => setFilterDateMax(e.target.value)} className={SELECT_CLS} aria-label="Date de la preuve, fin de période" />
        </label>
        {hasActiveFiltres && (
          <button onClick={resetFiltres} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-2">
            <X size={14} /> Réinitialiser les filtres
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable
          columns={columns}
          data={lignes}
          filename="preuves"
          emptyState={{ message: hasActiveFiltres ? 'Aucune preuve ne correspond aux filtres.' : 'Aucune preuve déposée à ce jour.' }}
        />
      </div>

      <PreuveFormModal
        isOpen={preuveModal}
        onClose={() => setPreuveModal(false)}
        onDone={apresDepot}
        typesPreuve={typesPreuve}
        contrats={contrats}
        commandes={commandes}
        licences={licences}
        contratParDefaut={contratActif || null}
        commandeParDefaut={commandeActive || null}
      />
    </div>
  );
}
