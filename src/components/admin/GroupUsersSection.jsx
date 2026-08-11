// GroupUsersSection - gestion des utilisateurs d'un groupe depuis sa fiche.
// Second point d'entrée, en miroir de UserGroupsSection : même règle
// d'intersection, mêmes endpoints, même table utilisateur_profil_societe.
import { useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { isGroupAssignable, attribuerGroupe, retirerGroupe } from '../../utils/attributionScope';

export default function GroupUsersSection({ groupId, groupSocieteIds, users, userSocietesMap, attributions, onChange }) {
  const { addToast } = useToast();
  const [pending, setPending] = useState(null);

  const attributedUserIds = new Set(
    attributions.filter((a) => a.id_profil === groupId).map((a) => a.id_utilisateur)
  );

  async function toggle(user, checked) {
    const userSocieteIds = userSocietesMap[user.id] || [];
    // Garde-fou défensif : même si la case ne devrait jamais être cochable
    // dans ce cas (désactivée), l'appel de création n'est émis que si
    // l'intersection est réellement non vide.
    if (checked && !isGroupAssignable(userSocieteIds, groupSocieteIds)) {
      addToast({ type: 'error', message: "Aucune société commune entre le rattachement de l'utilisateur et la diffusion de ce groupe." });
      return;
    }
    setPending(user.id);
    try {
      if (checked) {
        await attribuerGroupe(user.id, groupId, userSocieteIds, groupSocieteIds);
        addToast({ type: 'success', message: `${user.prenom} ${user.nom} rattaché(e) au groupe.` });
      } else {
        await retirerGroupe(user.id, groupId, attributions);
        addToast({ type: 'info', message: `${user.prenom} ${user.nom} retiré(e) du groupe.` });
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
        Utilisateurs associés
      </h3>
      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
        {users.filter((u) => !u.date_suppression).map((user) => {
          const userSocieteIds = userSocietesMap[user.id] || [];
          const assignable = isGroupAssignable(userSocieteIds, groupSocieteIds);
          const checked = attributedUserIds.has(user.id);
          const disabled = (!assignable && !checked) || pending === user.id;
          return (
            <label
              key={user.id}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              title={!assignable && !checked ? "Aucune société commune entre le rattachement de l'utilisateur et la diffusion du groupe" : undefined}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => toggle(user, e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-gray-700 dark:text-gray-200">{user.prenom} {user.nom}</span>
              <span className="text-xs text-gray-400">{user.email}</span>
              {!assignable && !checked && (
                <span className="text-xs text-gray-400 ml-auto">Aucune société commune</span>
              )}
            </label>
          );
        })}
        {users.length === 0 && <p className="text-sm text-gray-400">Aucun utilisateur.</p>}
      </div>
    </section>
  );
}
