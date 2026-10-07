// SocieteProfilsTab - onglet Profils de la fiche société (#249, permission
// gerer_profils). Pour chaque profil servi par l'API : état « Suit le
// défaut » ou « Configuré pour cette société » (badge et date, Q3), édition de
// la matrice complète groupée par module, enregistrement en remplacement
// complet (Q2) et « Revenir au défaut » qui retire la configuration. Chaque
// enregistrement est audité côté serveur (audit_log, codes 2071 et 2072).
// Tout est profil (#276, arbitrage du 07/10/2026) : GET /societes/:id/profils
// sert les profils par défaut ET les profils ajoutés ; seul le profil
// système admin_sam reste hors de la fiche société (matrice figée).
import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import ProfileBadge from '../users/ProfileBadge';
import MatricePermissions from '../admin/MatricePermissions';
import { formatDate } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import { societesService, permissionsService } from '../../services/adminService';

export default function SocieteProfilsTab({ societe }) {
  const { addToast } = useToast();
  const [profils, setProfils] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // Un seul profil déplié à la fois, avec sa matrice en cours d'édition.
  const [ouvert, setOuvert] = useState(null); // id du profil
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [initialIds, setInitialIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [etat, c] = await Promise.all([
        societesService.profils(societe.id),
        permissionsService.list(),
      ]);
      setProfils(etat.profils);
      setCatalogue(c);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [societe.id]);

  useEffect(() => { load(); }, [load]);

  function basculer(profil) {
    if (ouvert === profil.id) { setOuvert(null); return; }
    setOuvert(profil.id);
    const ids = new Set(profil.permission_ids);
    setSelectedIds(ids);
    setInitialIds(new Set(ids));
  }

  function togglePermission(permId, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(permId); else next.delete(permId);
      return next;
    });
  }

  const dirty = (() => {
    if (selectedIds.size !== initialIds.size) return true;
    for (const id of selectedIds) if (!initialIds.has(id)) return true;
    return false;
  })();

  async function enregistrer(profil) {
    setSaving(true);
    try {
      await societesService.configurerMatrice(societe.id, profil.id, Array.from(selectedIds));
      addToast({ type: 'success', message: `Profil "${profil.label}" configuré pour "${societe.raison_sociale}".` });
      setOuvert(null);
      await load();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  }

  function demanderRetour(profil) {
    setConfirm({
      title: 'Revenir au défaut',
      message: `Retirer la configuration du profil "${profil.label}" pour "${societe.raison_sociale}" ? La société suivra à nouveau la matrice par défaut du tenant, y compris ses évolutions futures.`,
      action: async () => {
        try {
          await societesService.revenirAuDefaut(societe.id, profil.id);
          addToast({ type: 'success', message: `Le profil "${profil.label}" suit à nouveau le défaut.` });
          setOuvert(null);
          await load();
        } catch (err) {
          addToast({ type: 'error', message: err.message });
        }
      },
    });
  }

  if (isLoading) return <p className="text-sm text-gray-400">Chargement…</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">
        Chaque profil suit la matrice par défaut du tenant, sauf s'il est configuré pour cette société : sa matrice remplace alors intégralement le défaut, même vidée. Une évolution du défaut ne touche jamais une société configurée.
      </p>

      {profils.map((profil) => {
        const estOuvert = ouvert === profil.id;
        return (
          <section key={profil.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => basculer(profil)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div className="flex items-center gap-3 flex-wrap">
                {estOuvert ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                <ProfileBadge profil={profil.code} label={profil.label} />
                {profil.configure ? (
                  <Badge variant="success" label="Configuré pour cette société" />
                ) : (
                  <Badge variant="neutral" label="Suit le défaut" />
                )}
              </div>
              {profil.configure && (
                <span className="text-xs text-gray-400">
                  Configuré le {formatDate(profil.configure_le)}{profil.configure_par_label ? ` par ${profil.configure_par_label}` : ''}
                </span>
              )}
            </button>

            {estOuvert && (
              <div className="px-4 pb-4 flex flex-col gap-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                <MatricePermissions
                  catalogue={catalogue}
                  selectedIds={selectedIds}
                  onToggle={togglePermission}
                />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {profil.configure ? (
                    <Button variant="secondary" size="sm" onClick={() => demanderRetour(profil)}>
                      <RotateCcw size={14} /> Revenir au défaut
                    </Button>
                  ) : <span />}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => enregistrer(profil)}
                    isLoading={saving}
                    disabled={profil.configure && !dirty}
                  >
                    {profil.configure ? 'Enregistrer la matrice' : 'Configurer pour cette société'}
                  </Button>
                </div>
              </div>
            )}
          </section>
        );
      })}
      {profils.length === 0 && <p className="text-sm text-gray-400">Aucun profil.</p>}

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => { confirm?.action(); setConfirm(null); }}
        title={confirm?.title}
        message={confirm?.message}
        isDestructive
        confirmLabel="Revenir au défaut"
      />
    </div>
  );
}
