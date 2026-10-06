// UserGroupsSection - section Groupes de la fiche utilisateur. Premier des
// deux points d'entrée (miroir : GroupUsersSection). Cocher crée
// l'attribution, décocher la retire, sauvegarde immédiate à chaque case.
//
// Refonte #249 (#57) : un groupe ne porte plus de sociétés de diffusion, il
// s'ajoute au profil par défaut de l'utilisateur et vaut sur son rattachement.
// Plus de règle d'intersection, plus de coche en attente du rattachement :
// tout groupe est attribuable.
import { useState } from 'react';
import ProfileBadge from './ProfileBadge';
import { useToast } from '../../hooks/useToast';
import { attribuerGroupe, retirerGroupe } from '../../utils/attributionScope';

export default function UserGroupsSection({ userId, groups, attributions, onChange }) {
  const { addToast } = useToast();
  const [pending, setPending] = useState(null);

  const attributedGroupIds = new Set(
    attributions.filter((a) => a.id_utilisateur === userId).map((a) => a.id_profil)
  );

  async function toggle(group, checked) {
    setPending(group.id);
    try {
      if (checked) {
        await attribuerGroupe(userId, group.id);
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

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
        Groupes
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        Les groupes s'ajoutent au profil : leurs permissions valent sur les sociétés de rattachement de l'utilisateur.
      </p>
      <div className="flex flex-col gap-1">
        {groups.map((group) => {
          const checked = attributedGroupIds.has(group.id);
          const disabled = pending === group.id;
          return (
            <label
              key={group.id}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => toggle(group, e.target.checked)}
                className="rounded border-gray-300"
              />
              <ProfileBadge profil={group.code} label={group.label} />
            </label>
          );
        })}
        {groups.length === 0 && <p className="text-sm text-gray-400">Aucun groupe.</p>}
      </div>
    </section>
  );
}
