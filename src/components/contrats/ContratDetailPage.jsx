// ContratDetailPage - fiche detail d'un contrat : echeance, hierarchie, commandes, licences, preuves
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2, ChevronDown } from 'lucide-react';
import BudgetEmbeddedSection from '../budget/BudgetEmbeddedSection';
import {
  mockContrats, getSousContrats, getCommandesByContrat, getTousDocumentsContrat, getEcheanceContrat,
} from '../../data/mockContrats';
import { mockEditeurs, mockSocietes, mockProduits } from '../../data/mockReferentiels';
import { getLicencesByContrat } from '../../data/mockDeploiement';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyState from '../ui/EmptyState';
import StatutValidationBadge from '../referentiels/StatutValidationBadge';
import ValidationActions from '../referentiels/ValidationActions';
import LogoEditeur from '../referentiels/LogoEditeur';
import StatutEcheanceBadge from './StatutEcheanceBadge';
import ContratFormModal from './ContratFormModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';
import { formatDate } from '../../utils/dateUtils';

export default function ContratDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canWrite, canValidate, canDelete, submitsForValidation } = useRbac();
  const { user } = useAuth();
  const [contrats, setContrats] = useState(mockContrats);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(true);

  const contrat = contrats.find(c => c.id === id);

  if (!contrat) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Droits d\'usage', to: '/contrats/liste' }, { label: 'Contrat', to: '/contrats/liste' }, { label: 'Introuvable' }]} />
        <EmptyState title="Contrat introuvable" description="Ce contrat n'existe pas ou a ete supprime." ctaLabel="Retour a la liste" onCta={() => navigate('/contrats/liste')} />
      </div>
    );
  }

  const editeur = mockEditeurs.find(e => e.id === contrat.id_editeur);
  const societe = mockSocietes.find(s => s.id === contrat.id_societe);
  const parent = contrat.id_contrat_parent ? contrats.find(c => c.id === contrat.id_contrat_parent) : null;
  const sousContrats = getSousContrats(contrat.id);
  const commandes = getCommandesByContrat(contrat.id);
  const licences = getLicencesByContrat(contrat.id);
  const documents = getTousDocumentsContrat(contrat.id);
  const echeance = getEcheanceContrat(contrat);
  const produits = [...new Set(licences.map(l => l.id_produit))].map(idP => mockProduits.find(p => p.id === idP)).filter(Boolean);
  const nbLiens = commandes.length + licences.length + sousContrats.length;

  function handleValidate() {
    setContrats(prev => prev.map(c => c.id === contrat.id ? { ...c, statut_validation: 'valide', motif_refus: undefined } : c));
    addToast({ type: 'success', message: 'Contrat valide.' });
  }

  function handleRefuse(motif) {
    setContrats(prev => prev.map(c => c.id === contrat.id ? { ...c, statut_validation: 'refuse', motif_refus: motif } : c));
    addToast({ type: 'info', message: 'Contrat refuse.' });
  }

  function handleSave(data, existing) {
    const resoumis = submitsForValidation;
    setContrats(prev => prev.map(c => c.id === existing.id ? {
      ...c, ...data,
      statut_validation: resoumis ? 'en_attente' : 'valide',
      soumis_par: `${user.prenom} ${user.nom}`,
    } : c));
    addToast({ type: 'success', message: resoumis ? 'Modification soumise a validation.' : 'Contrat mis a jour.' });
  }

  function handleDelete() {
    setContrats(prev => prev.filter(c => c.id !== contrat.id));
    addToast({ type: 'success', message: 'Contrat supprime.' });
    navigate('/contrats/liste');
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[
        { label: 'Droits d\'usage', to: '/contrats/liste' },
        { label: 'Contrat', to: '/contrats/liste' },
        { label: contrat.label },
      ]} />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <LogoEditeur editeur={editeur} size={48} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{contrat.label}</h1>
              {contrat.type === 'cadre' && <span className="text-xs font-semibold text-blue-700 bg-blue-100 dark:bg-blue-900/30 px-2.5 py-1 rounded-full">Cadre</span>}
              <StatutEcheanceBadge statut={echeance.statut} />
              <StatutValidationBadge statut={contrat.statut_validation} />
            </div>
            <p className="text-sm text-gray-500 mt-1">{editeur?.raison_sociale}{societe ? ` - ${societe.raison_sociale}` : ''}{contrat.numero ? ` - ${contrat.numero}` : ''}</p>
            {contrat.statut_validation === 'refuse' && contrat.motif_refus && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">Motif du refus : {contrat.motif_refus}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">Soumis par {contrat.soumis_par}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canValidate && <ValidationActions statut={contrat.statut_validation} onValidate={handleValidate} onRefuse={handleRefuse} />}
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

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Echeance et renouvellement</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Date de debut</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{formatDate(contrat.date_debut)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Date de fin</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{contrat.date_fin ? formatDate(contrat.date_fin) : 'Perpetuel'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">A renouveler</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{contrat.a_renouveler ? 'Oui' : 'Non'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Preavis de resiliation</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{contrat.preavis_resiliation_jours ? `${contrat.preavis_resiliation_jours} jours` : '-'}</p>
          </div>
        </div>
        {echeance.statut !== 'actif' && echeance.joursRestants !== null && (
          <p className="text-sm mt-3" style={{ color: echeance.statut === 'expire' ? '#EF4444' : '#F59E0B' }}>
            {echeance.statut === 'expire' ? `Echu depuis ${-echeance.joursRestants} jours` : `Echeance dans ${echeance.joursRestants} jours`}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Hierarchie</h2>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Contrat cadre parent</p>
              {parent
                ? <Link to={`/contrats/liste/${parent.id}`} className="text-sm text-blue-800 hover:underline">{parent.label}</Link>
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
                      <li key={s.id}><Link to={`/contrats/liste/${s.id}`} className="text-sm text-blue-800 hover:underline">{s.label}</Link></li>
                    ))}
                  </ul>
                )}
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Produits associes ({produits.length})</h2>
          {produits.length === 0
            ? <p className="text-sm text-gray-500">Aucun produit associe.</p>
            : (
              <ul className="flex flex-col gap-1">
                {produits.map(p => (
                  <li key={p.id}><Link to={`/referentiels/logiciels/${p.id}`} className="text-sm text-blue-800 hover:underline">{p.label}</Link></li>
                ))}
              </ul>
            )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Commandes rattachees ({commandes.length})</h2>
          {commandes.length === 0
            ? <p className="text-sm text-gray-500">Aucune commande rattachee.</p>
            : (
              <ul className="flex flex-col gap-1">
                {commandes.map(k => (
                  <li key={k.id}><Link to={`/contrats/commandes/${k.id}`} className="text-sm text-blue-800 hover:underline">{k.label}</Link></li>
                ))}
              </ul>
            )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Licences rattachees ({licences.length})</h2>
          {licences.length === 0
            ? <p className="text-sm text-gray-500">Aucune licence rattachee.</p>
            : (
              <ul className="flex flex-col gap-1">
                {licences.map(l => {
                  const produit = mockProduits.find(p => p.id === l.id_produit);
                  return <li key={l.id}><Link to={`/conformite/licences/${l.id}`} className="text-sm text-blue-800 hover:underline">{produit?.label ?? l.id} ({l.quantite} {l.unite_mesure})</Link></li>;
                })}
              </ul>
            )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Preuves rattachees ({documents.length})</h2>
          {documents.length === 0
            ? <p className="text-sm text-gray-500">Aucune piece justificative rattachee.</p>
            : (
              <div className="flex flex-wrap gap-2">
                {documents.map(d => (
                  <Link key={d.id} to={`/contrats/factures/${d.id}`} className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors">
                    {d.type === 'facture' ? 'Facture' : 'Preuve'} - {d.label}
                  </Link>
                ))}
              </div>
            )}
        </section>
      </div>

      {/* Section Budget (depliee par defaut) */}
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
            <BudgetEmbeddedSection mode="contrat" id={contrat.id} />
          </div>
        )}
      </section>

      <ContratFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} contrat={contrat} existingContrats={contrats} />

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={nbLiens > 0 ? () => setDeleteOpen(false) : handleDelete}
        title="Supprimer le contrat"
        isDestructive={nbLiens === 0}
        confirmLabel={nbLiens > 0 ? 'Compris' : 'Supprimer'}
        message={
          nbLiens > 0
            ? `Suppression impossible : ${contrat.label} est rattache a ${commandes.length} commande${commandes.length > 1 ? 's' : ''}, ${licences.length} licence${licences.length > 1 ? 's' : ''} et ${sousContrats.length} sous-contrat${sousContrats.length > 1 ? 's' : ''}. Detachez ou supprimez d'abord ces elements.`
            : `Supprimer definitivement ${contrat.label} ? Cette action est irreversible.`
        }
      />
    </div>
  );
}
