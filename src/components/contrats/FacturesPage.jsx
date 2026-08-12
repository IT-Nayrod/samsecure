// FacturesPage - ecran unifie Factures et Preuves, oriente audit.
// Branche sur deux ressources API distinctes, /api/preuves et /api/factures,
// fidelement au schema : la page les assemble pour l'affichage mais ne fusionne
// pas les modeles. Chaque ligne conserve sa ressource d'origine, qui determine
// l'API a interroger pour sa fiche.
// La detection des manques vient de /api/commandes/manques : une vue temps
// reel, jamais un stock d'anomalies, d'ou le rechargement apres chaque depot.
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Receipt, FileCheck, AlertTriangle, X } from 'lucide-react';
import { preuvesService, facturesService, typesPreuveService, manquesService } from '../../services/documentsService';
import { contratsService } from '../../services/contratsService';
import { optionnel } from '../../services/http';
import { commandesService } from '../../services/commandesService';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Breadcrumb from '../ui/Breadcrumb';
import ErrorState from '../ui/ErrorState';
import Skeleton from '../ui/Skeleton';
import DocumentIcon from './DocumentIcon';
import ManqueBadge from './ManqueBadge';
import DeploiementKpiCard from '../deploiement/DeploiementKpiCard';
import PreuveFormModal from './PreuveFormModal';
import FactureFormModal from './FactureFormModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import ValidationCell from '../referentiels/ValidationCell';
import ValidationActions from '../referentiels/ValidationActions';
import useValidation from '../../hooks/useValidation';
import { appliquerStatut } from '../../services/validationService';

export default function FacturesPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canValidate } = useRbac({ write: 'deposer_facture_preuve', validate: 'valider_saisie' });

  const [preuves, setPreuves] = useState([]);
  const [factures, setFactures] = useState([]);
  const [manques, setManques] = useState(null);
  const [typesPreuve, setTypesPreuve] = useState([]);
  const [contrats, setContrats] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);

  const [filterType, setFilterType] = useState('');
  const [filterTypePreuve, setFilterTypePreuve] = useState('');
  const [filterContrat, setFilterContrat] = useState('');
  const [filterCommande, setFilterCommande] = useState('');
  const [searchParams] = useSearchParams();
  const contratParam = searchParams.get('contrat');
  const commandeParam = searchParams.get('commande');
  const [preuveModal, setPreuveModal] = useState(false);
  const [factureModal, setFactureModal] = useState(false);
  const manquesRef = useRef(null);

  // Les filtres partent a l'API plutot que d'etre appliques en memoire : c'est
  // la meme regle de filtrage pour les deux ressources, et elle ne peut pas
  // deriver de ce que le serveur considere comme rattache.
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
    };
    try {
      // Preuves et factures sont les deux ressources de l'ecran. La detection
      // des manques, les types et les listes de rattachement sont accessoires :
      // leur refus retire une section ou un filtre, pas la page.
      const [p, f, m, t, c, k] = await Promise.all([
        preuvesService.list(filtres),
        facturesService.list(filtres),
        optionnel(manquesService.list({ idContrat: contratActif || undefined }), null),
        optionnel(typesPreuveService.list()),
        optionnel(contratsService.list()),
        optionnel(commandesService.list()),
      ]);
      setPreuves(p); setFactures(f); setManques(m);
      setTypesPreuve(t); setContrats(c); setCommandes(k);
    } catch (err) {
      setError(err.message);
      setErrorStatus(err.status);
    } finally {
      setIsLoading(false);
    }
  }, [filterTypePreuve, contratActif, commandeActive]);

  useEffect(() => { load(); }, [load]);

  function apresDepot(toast) {
    if (toast) addToast(toast);
    load();
  }

  // Les deux ressources restent separees, comme le veut l'en-tete de ce
  // fichier : la reponse dit laquelle mettre a jour.
  const appliquer = useCallback(reponse => {
    const maj = liste => liste.map(x => x.id === reponse.entite_id ? appliquerStatut(x, reponse) : x);
    if (reponse.entite_type === 'preuve') setPreuves(maj);
    else setFactures(maj);
  }, []);
  const { valider, refuser } = useValidation(appliquer);

  function resetFiltres() {
    setFilterType(''); setFilterTypePreuve(''); setFilterContrat(''); setFilterCommande('');
  }

  const hasActiveFiltres = !!(filterType || filterTypePreuve || filterContrat || filterCommande);

  // Assemblage et non fusion : chaque ligne porte sa ressource d'origine, qui
  // dit quelle API sert sa fiche et quels champs elle possede reellement.
  const lignes = useMemo(() => {
    const dePreuves = preuves.map(p => ({
      ressource: 'preuve',
      id: p.id,
      label: p.label,
      nom_fichier: p.nom_origine || p.url_fichier,
      type_preuve_label: p.type_label,
      contrat_label: p.contrat_label,
      commande_label: p.commande_label,
      created_at: p.created_at,
      statut_validation: p.statut_validation,
      statut_validation_label: p.statut_validation_label,
      message_refus: p.message_refus,
    }));
    const deFactures = factures.map(f => ({
      ressource: 'facture',
      id: f.id,
      label: f.label,
      nom_fichier: f.preuve_url_fichier,
      type_preuve_label: f.preuve_type_label,
      contrat_label: f.contrat_label,
      commande_label: f.commande_label,
      created_at: f.created_at,
      statut_validation: f.statut_validation,
      statut_validation_label: f.statut_validation_label,
      message_refus: f.message_refus,
    }));
    const tout = [...deFactures, ...dePreuves];
    const visibles = filterType ? tout.filter(l => l.ressource === filterType) : tout;
    return visibles.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }, [preuves, factures, filterType]);

  const columns = [
    { key: 'label', label: 'Document', render: r => (
      <button onClick={() => navigate(`/contrats/factures/${r.id}?ressource=${r.ressource}`)} className="flex items-center gap-2.5 font-medium text-blue-800 hover:underline text-left">
        <DocumentIcon nomFichier={r.nom_fichier} size={28} />
        {r.label}
      </button>
    ), csvValue: r => r.label },
    { key: 'ressource', label: 'Type', sortable: true, render: r => r.ressource === 'facture' ? 'Facture' : 'Preuve' },
    { key: 'type_preuve_label', label: 'Type de preuve', render: r => r.type_preuve_label ?? '-' },
    { key: 'liaison', label: 'Contrat / Commande', render: r => [r.contrat_label, r.commande_label].filter(Boolean).join(' - ') || '-' },
    { key: 'created_at', label: 'Depose le', sortable: true, render: r => formatDate(r.created_at) },
    { key: 'statut_validation', label: 'Validation', sortable: true,
      csvValue: r => [r.statut_validation_label, r.message_refus].filter(Boolean).join(' - '),
      render: r => <ValidationCell statut={r.statut_validation} motif={r.message_refus} /> },
    { key: 'actions_validation', label: '', csvValue: () => '',
      render: r => canValidate && (
        <ValidationActions
          statut={r.statut_validation}
          onValidate={() => valider(r.ressource, r.id)}
          onRefuse={motif => refuser(r.ressource, r.id, motif)}
        />
      ) },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Droits d\'usage' }, { label: 'Factures & Preuves' }]} />
        <Skeleton lines={3} height="h-20" />
        <Skeleton lines={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Droits d\'usage' }, { label: 'Factures & Preuves' }]} />
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <ErrorState message={error} status={errorStatus} onRetry={load} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Droits d\'usage' }, { label: 'Factures & Preuves' }]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Factures & Preuves</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pieces justificatives et aptitude a l&apos;audit</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPreuveModal(true)}>
              <Plus size={15} /> Deposer une preuve
            </Button>
            <Button variant="primary" onClick={() => setFactureModal(true)}>
              <Plus size={15} /> Deposer une facture
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DeploiementKpiCard label="Factures" value={factures.length} icon={Receipt} color="#1F4E79"
          onClick={() => setFilterType(v => v === 'facture' ? '' : 'facture')} active={filterType === 'facture'} />
        <DeploiementKpiCard label="Preuves" value={preuves.length} icon={FileCheck} color="#22C55E"
          onClick={() => setFilterType(v => v === 'preuve' ? '' : 'preuve')} active={filterType === 'preuve'} />
        <DeploiementKpiCard label="Manques detectes" value={manques?.total ?? 0} icon={AlertTriangle} color="#EF4444"
          onClick={() => manquesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
      </div>

      <section ref={manquesRef} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Detection des manques (risque audit)</h2>
          {manques?.total > 0 && (
            <p className="text-xs text-gray-500">
              {manques.total_sans_facture} sans facture, {manques.total_sans_preuve} sans preuve
            </p>
          )}
        </div>
        {!manques || manques.total === 0 ? (
          <p className="text-sm text-gray-500">Aucun manque detecte : toutes les commandes ont facture et preuve.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {manques.commandes.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40" style={{ borderLeft: '3px solid #EF4444' }}>
                <button onClick={() => navigate(`/contrats/commandes/${c.id}`)} className="text-sm font-medium text-gray-900 dark:text-white hover:underline text-left">
                  {c.label}
                  <span className="ml-2 text-xs font-normal text-gray-500">{[c.contrat_label, c.societe_label].filter(Boolean).join(' - ')}</span>
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
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tout</option>
          <option value="facture">Factures</option>
          <option value="preuve">Preuves</option>
        </select>
        <select value={filterTypePreuve} onChange={e => setFilterTypePreuve(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les types de preuve</option>
          {typesPreuve.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select value={filterContrat} onChange={e => setFilterContrat(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les contrats</option>
          {contrats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={filterCommande} onChange={e => setFilterCommande(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les commandes</option>
          {commandes.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        {hasActiveFiltres && (
          <button onClick={resetFiltres} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-2">
            <X size={14} /> Reinitialiser les filtres
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable
          columns={columns}
          data={lignes}
          filename="documents"
          emptyState={{ message: hasActiveFiltres ? 'Aucun document ne correspond aux filtres.' : 'Aucun document depose a ce jour.' }}
        />
      </div>

      <PreuveFormModal
        isOpen={preuveModal}
        onClose={() => setPreuveModal(false)}
        onDone={apresDepot}
        typesPreuve={typesPreuve}
        contrats={contrats}
        commandes={commandes}
        contratParDefaut={contratActif || null}
        commandeParDefaut={commandeActive || null}
      />
      <FactureFormModal
        isOpen={factureModal}
        onClose={() => setFactureModal(false)}
        onDone={apresDepot}
        typesPreuve={typesPreuve}
        commandes={commandes}
        commandeParDefaut={commandeActive || null}
      />
    </div>
  );
}
