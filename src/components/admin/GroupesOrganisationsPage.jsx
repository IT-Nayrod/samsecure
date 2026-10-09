// GroupesOrganisationsPage - onglet Groupes d'organisations de
// l'administration (US #277, décisions client du 08/10/2026, permission
// gerer_profils). Un groupe d'organisations est une somme de sociétés du
// tenant, référencée par les lignes d'accès des groupes d'utilisateurs
// (profil × groupe d'organisations). Une société peut appartenir à plusieurs
// groupes ; aucune visibilité implicite par la hiérarchie : cocher une
// société mère pré-coche ses filiales (confort de saisie), chacune reste
// décochable, seule la composition enregistrée fait foi.
// La suppression est douce et refusée par le serveur tant qu'une ligne
// d'accès s'en sert : son message, qui liste les usages, est affiché tel quel.
import { useState, useEffect, useCallback } from 'react';
import { Pencil, Plus, Trash2, Building2 } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import SlideOver from '../ui/SlideOver';
import ConfirmModal from '../ui/ConfirmModal';
import SocieteSelector from '../ui/SocieteSelector';
import { useToast } from '../../hooks/useToast';
import { validateRequired } from '../../utils/validation';
import { sortByHierarchy } from '../../utils/societeHierarchy';
import { groupesOrganisationsService, societesService } from '../../services/adminService';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

// Cascade mère-filles (décision du 08/10) : toute société nouvellement cochée
// pré-coche sa descendance entière ; décocher reste unitaire. Le calcul porte
// sur le delta de sélection, le composant SocieteSelector n'est pas modifié
// (ses autres usages, rattachement et exceptions, restent sans cascade).
function avecDescendance(societes, avant, apres) {
  const ajoutees = apres.filter((id) => !avant.includes(id));
  if (!ajoutees.length) return apres;
  const enfantsPar = new Map();
  for (const s of societes) {
    if (!s.id_societe_parent) continue;
    if (!enfantsPar.has(s.id_societe_parent)) enfantsPar.set(s.id_societe_parent, []);
    enfantsPar.get(s.id_societe_parent).push(s.id);
  }
  const resultat = new Set(apres);
  const pile = [...ajoutees];
  while (pile.length) {
    const id = pile.pop();
    for (const enfant of enfantsPar.get(id) || []) {
      if (!resultat.has(enfant)) { resultat.add(enfant); pile.push(enfant); }
    }
  }
  return [...resultat];
}

const FORM_VIDE = { nom: '', description: '' };

export default function GroupesOrganisationsPage() {
  const { addToast } = useToast();
  const [groupes, setGroupes] = useState([]);
  const [societes, setSocietes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [fiche, setFiche] = useState(null); // null fermé | { groupe: null (création) | objet }
  const [form, setForm] = useState(FORM_VIDE);
  const [selection, setSelection] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async ({ silencieux = false } = {}) => {
    if (!silencieux) setIsLoading(true);
    try {
      const [g, s] = await Promise.all([
        groupesOrganisationsService.list(),
        societesService.list(),
      ]);
      setGroupes(g);
      setSocietes(s);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  function ouvrirFiche(groupe) {
    setFiche({ groupe });
    setForm(groupe ? { nom: groupe.nom || '', description: groupe.description || '' } : FORM_VIDE);
    setSelection(groupe ? (groupe.societes || []).map((s) => s.id) : []);
    setErrors({});
  }

  async function enregistrer() {
    const err = validateRequired(form.nom, 'Le nom');
    if (err) { setErrors({ nom: err }); return; }
    setSaving(true);
    try {
      const payload = {
        nom: form.nom.trim(),
        description: form.description.trim() || null,
        societe_ids: selection,
      };
      if (fiche.groupe) {
        await groupesOrganisationsService.update(fiche.groupe.id, payload);
        addToast({ type: 'success', message: 'Groupe d\'organisations mis à jour.' });
      } else {
        await groupesOrganisationsService.create(payload);
        addToast({ type: 'success', message: 'Groupe d\'organisations créé.' });
      }
      setFiche(null);
      await load({ silencieux: true });
    } catch (err) {
      // Message de l'API tel quel (périmètre, nom déjà pris...), jamais reconstruit.
      setErrors({ global: err.message });
    } finally {
      setSaving(false);
    }
  }

  function demanderSuppression(groupe) {
    const usages = groupe.utilises_par || [];
    const message = usages.length
      ? `Le groupe "${groupe.nom}" est utilisé par ${usages.length > 1 ? 'les groupes d\'utilisateurs' : 'le groupe d\'utilisateurs'} ${usages.map((n) => `"${n}"`).join(', ')} : le serveur refusera la suppression tant que ces lignes d'accès existent. Tenter quand même ?`
      : `Supprimer le groupe d'organisations "${groupe.nom}" ? Les sociétés elles-mêmes ne sont pas touchées.`;
    setConfirm({
      title: 'Supprimer le groupe d\'organisations',
      confirmLabel: 'Supprimer',
      message,
      action: async () => {
        try {
          await groupesOrganisationsService.remove(groupe.id);
          addToast({ type: 'success', message: 'Groupe d\'organisations supprimé.' });
          if (fiche?.groupe?.id === groupe.id) setFiche(null);
          await load({ silencieux: true });
        } catch (err) {
          addToast({ type: 'error', message: err.message });
        }
      },
    });
  }

  // Sociétés sélectionnées, rendues dans l'ordre de la hiérarchie pour que la
  // composition se relise comme l'arbre du sélecteur.
  const selectionTriee = sortByHierarchy(societes.filter((s) => selection.includes(s.id)));

  const columns = [
    { key: 'nom', label: 'Nom', sortable: true, render: r => <span className="font-medium text-gray-900 dark:text-white">{r.nom}</span> },
    { key: 'description', label: 'Description', render: r => <span className="text-gray-500">{r.description || '—'}</span> },
    {
      key: 'societes', label: 'Sociétés', render: r => {
        const liste = r.societes || [];
        if (!liste.length) return <span className="text-xs text-gray-400">Aucune société</span>;
        return (
          <span className="text-xs text-gray-500" title={liste.map((s) => s.raison_sociale).join(', ')}>
            {liste.length} société{liste.length > 1 ? 's' : ''} : {liste.slice(0, 3).map((s) => s.raison_sociale).join(', ')}{liste.length > 3 ? '…' : ''}
          </span>
        );
      },
      csvValue: r => (r.societes || []).map((s) => s.raison_sociale).join(', '),
    },
    {
      key: 'utilises_par', label: 'Utilisé par', render: r => (
        (r.utilises_par || []).length
          ? <div className="flex flex-wrap gap-1">{r.utilises_par.map((n) => <Badge key={n} variant="neutral" label={n} />)}</div>
          : <span className="text-xs text-gray-400">Aucun accès</span>
      ),
      csvValue: r => (r.utilises_par || []).join(', '),
    },
    {
      key: 'actions', label: 'Actions', render: r => (
        <div className="flex items-center gap-1">
          <button onClick={() => ouvrirFiche(r)} aria-label="Modifier" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <Pencil size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); demanderSuppression(r); }} aria-label="Supprimer" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Groupes d'organisations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Un groupe d'organisations est une somme de sociétés, utilisée par les accès des groupes d'utilisateurs (profil × groupe d'organisations). Une société peut appartenir à plusieurs groupes.
          </p>
        </div>
        <Button variant="primary" onClick={() => ouvrirFiche(null)}>
          <Plus size={15} /> Nouveau groupe
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <DataTable columns={columns} data={groupes} filename="groupes-organisations" isLoading={isLoading} onRowClick={ouvrirFiche} emptyState={{ message: 'Aucun groupe d\'organisations.' }} />
      </div>

      <SlideOver
        isOpen={!!fiche}
        onClose={() => setFiche(null)}
        title={fiche?.groupe ? `Groupe "${fiche.groupe.nom}"` : 'Nouveau groupe d\'organisations'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFiche(null)}>Annuler</Button>
            <Button variant="primary" onClick={enregistrer} isLoading={saving}>Enregistrer</Button>
          </>
        }
      >
        {fiche && (
          <div className="flex flex-col gap-6">
            {errors.global && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-sm text-red-700">{errors.global}</p>
              </div>
            )}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                Identité
              </h3>
              <div className="flex flex-col gap-3">
                <FormField label="Nom" required error={errors.nom}>
                  <input className={INPUT_CLS} value={form.nom} onChange={e => setForm(v => ({ ...v, nom: e.target.value }))} />
                </FormField>
                <FormField label="Description">
                  <textarea className={INPUT_CLS} rows={2} value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} />
                </FormField>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                Sociétés du groupe ({selection.length})
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Cocher une société mère pré-coche ses filiales ; chacune reste décochable. La hiérarchie ne donne aucune visibilité implicite : seules les sociétés cochées comptent.
              </p>
              <SocieteSelector
                organisations={societes}
                selectedIds={selection}
                onChange={(apres) => setSelection(avecDescendance(societes, selection, apres))}
              />
              {selectionTriee.length > 0 && (
                <div className="mt-3 flex flex-col gap-1">
                  {selectionTriee.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700" style={{ paddingLeft: 8 + s.depth * 18 }}>
                      <span className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                        <Building2 size={14} className="text-gray-400" />
                        {s.depth > 0 && <span className="text-gray-400">|_</span>}
                        {s.raison_sociale}
                      </span>
                      <button
                        onClick={() => setSelection((ids) => ids.filter((x) => x !== s.id))}
                        className="text-xs text-gray-400 hover:text-red-600"
                        aria-label={`Retirer ${s.raison_sociale}`}
                      >
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {fiche.groupe && (fiche.groupe.utilises_par || []).length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                  Utilisé par
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {fiche.groupe.utilises_par.map((n) => <Badge key={n} variant="neutral" label={n} />)}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Modifier les sociétés du groupe change immédiatement la portée de ces accès.
                </p>
              </section>
            )}
          </div>
        )}
      </SlideOver>

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => { confirm?.action(); setConfirm(null); }}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        isDestructive
      />
    </div>
  );
}
