// UserGroupsSection - gestion des groupes d'un utilisateur depuis sa fiche.
// Premier des deux points d'entrée (miroir : GroupUsersSection). Cocher crée
// l'attribution, décocher la retire ; la portée découle automatiquement de
// l'intersection rattachement (utilisateur) x diffusion (groupe), jamais
// choisie ici. Sauvegarde immédiate à chaque case, comme la matrice de
// permissions de la sandbox — SAUF pour un groupe qui n'est cochable que
// grâce au rattachement en cours d'édition (non encore enregistré) : dans ce
// cas la coche est mise en attente (onTogglePendingAddition) et n'est
// réellement écrite qu'à l'enregistrement du formulaire, une fois le
// rattachement effectif en base (voir UserFormModal).
import { useState } from 'react';
import { Info } from 'lucide-react';
import ProfileBadge from './ProfileBadge';
import { useToast } from '../../hooks/useToast';
import { isGroupAssignable, attribuerGroupe, retirerGroupe } from '../../utils/attributionScope';

const MAX_SOCIETES_TOOLTIP = 4;

function diffusionLabel(groupSocieteIds, societesById) {
  const noms = (groupSocieteIds || []).filter(Boolean).map((id) => societesById[id]?.raison_sociale || id);
  if (noms.length === 0) return '';
  const visibles = noms.slice(0, MAX_SOCIETES_TOOLTIP).join(', ');
  const reste = noms.length - MAX_SOCIETES_TOOLTIP;
  return reste > 0 ? `${visibles} et ${reste} autre${reste > 1 ? 's' : ''}` : visibles;
}

export default function UserGroupsSection({
  userId, userSocieteIds, groups, groupDiffusions, attributions, onChange,
  pendingSocieteIds, pendingAdditions, onTogglePendingAddition, societes,
}) {
  const { addToast } = useToast();
  const [pending, setPending] = useState(null);
  const societesById = Object.fromEntries((societes || []).map((s) => [s.id, s]));

  const attributedGroupIds = new Set(
    attributions.filter((a) => a.id_utilisateur === userId).map((a) => a.id_profil)
  );

  // Rattachement effectivement en cours d'édition dans le formulaire (peut
  // différer du rattachement enregistré tant que l'utilisateur n'a pas
  // cliqué sur Enregistrer). Par défaut (pas d'édition en cours), identique
  // au rattachement enregistré : aucun état "en attente" ne se déclenche.
  const liveSocieteIds = pendingSocieteIds || userSocieteIds;

  async function toggle(group, checked) {
    const groupSocieteIds = groupDiffusions[group.id] || [];
    // Garde-fou défensif : même si la case ne devrait jamais être cochable
    // dans ce cas (désactivée), l'appel de création n'est émis que si
    // l'intersection est réellement non vide.
    if (checked && !isGroupAssignable(userSocieteIds, groupSocieteIds)) {
      addToast({ type: 'error', message: "Aucune société commune entre le rattachement de l'utilisateur et la diffusion de ce groupe." });
      return;
    }
    setPending(group.id);
    try {
      if (checked) {
        await attribuerGroupe(userId, group.id, userSocieteIds, groupSocieteIds);
        addToast({ type: 'success', message: `Groupe "${group.label}" attribué.` });
      } else {
        await retirerGroupe(userId, group.id, attributions);
        addToast({ type: 'info', message: `Groupe "${group.label}" retiré.` });
      }
      await onChange();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setPending(null);
    }
  }

  const rows = groups.map((group) => {
    const groupSocieteIds = groupDiffusions[group.id] || [];
    const attributedNow = attributedGroupIds.has(group.id);
    const assignableNow = isGroupAssignable(userSocieteIds, groupSocieteIds);
    const assignableLive = isGroupAssignable(liveSocieteIds, groupSocieteIds);
    const staged = pendingAdditions?.has(group.id) || false;
    // Sera retiré à l'enregistrement : actuellement attribué et valide, mais
    // la sélection de sociétés en cours (non enregistrée) fait disparaître
    // l'intersection.
    const willBeRemoved = attributedNow && assignableNow && !assignableLive;
    // Nouvellement disponible : pas attribué, pas assignable avec le
    // rattachement enregistré, mais le devient avec la sélection en cours.
    const newlyAvailable = !attributedNow && !assignableNow && assignableLive;
    return { group, groupSocieteIds, attributedNow, assignableNow, staged, willBeRemoved, newlyAvailable };
  });

  const nbRetires = rows.filter((r) => r.willBeRemoved).length;
  const nbDisponibles = rows.filter((r) => r.newlyAvailable).length;

  function handleToggle(row, e) {
    const checked = e.target.checked;
    if (row.newlyAvailable) {
      // Rattachement pas encore enregistré : on ne peut pas encore calculer
      // la bonne portée d'attribution. La coche est mise en attente et sera
      // réellement créée à l'enregistrement, une fois le rattachement
      // effectif (cf. UserFormModal / UsersPage.handleSubmit).
      onTogglePendingAddition?.(row.group.id, checked);
      return;
    }
    toggle(row.group, checked);
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
        Groupes
      </h3>
      {(nbRetires > 0 || nbDisponibles > 0) && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          À l'enregistrement : {nbRetires} groupe{nbRetires > 1 ? 's' : ''} retiré{nbRetires > 1 ? 's' : ''}, {nbDisponibles} nouvellement disponible{nbDisponibles > 1 ? 's' : ''}.
        </p>
      )}
      <div className="flex flex-col gap-1">
        {rows.map(({ group, groupSocieteIds, attributedNow, staged, willBeRemoved, newlyAvailable }) => {
          // Une coche en attente ne reste affichée que tant que le groupe
          // est encore "nouvellement disponible" : si la sélection de
          // sociétés change à nouveau et fait disparaître l'intersection,
          // l'état visuel se corrige automatiquement (attribuerGroupe est de
          // toute façon un no-op sûr si l'intersection est vide).
          const checked = attributedNow || (staged && newlyAvailable);
          const cochable = attributedNow || willBeRemoved || newlyAvailable
            ? true
            : isGroupAssignable(userSocieteIds, groupSocieteIds);
          const disabled = !cochable || pending === group.id;
          const tooltip = diffusionLabel(groupSocieteIds, societesById);
          return (
            <label
              key={group.id}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700'} ${willBeRemoved ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => handleToggle({ group, groupSocieteIds, attributedNow, willBeRemoved, newlyAvailable }, e)}
                className="rounded border-gray-300"
              />
              <ProfileBadge profil={group.code} label={group.label} />
              {willBeRemoved && (
                <span className="text-xs text-amber-700 italic">Sera retiré après enregistrement (aucune société commune avec la sélection actuelle)</span>
              )}
              {newlyAvailable && (
                <span className="text-xs text-green-700 italic">
                  {staged ? 'Sera attribué après enregistrement' : 'Peut désormais être attribué grâce aux sociétés nouvellement sélectionnées'}
                </span>
              )}
              {!checked && !newlyAvailable && !cochable && (
                <>
                  <span className="text-xs text-gray-400">Aucune société commune avec le rattachement</span>
                  {tooltip && (
                    <span
                      tabIndex={0}
                      role="img"
                      aria-label={`Ce groupe est diffusé sur : ${tooltip}. Rattachez l'utilisateur à au moins l'une d'elles pour pouvoir l'attribuer.`}
                      title={`Ce groupe est diffusé sur : ${tooltip}. Rattachez l'utilisateur à au moins l'une d'elles pour pouvoir l'attribuer.`}
                      className="text-gray-400 hover:text-gray-600 focus:text-gray-600 focus:outline-none"
                    >
                      <Info size={13} />
                    </span>
                  )}
                </>
              )}
            </label>
          );
        })}
        {groups.length === 0 && <p className="text-sm text-gray-400">Aucun groupe.</p>}
      </div>
    </section>
  );
}
