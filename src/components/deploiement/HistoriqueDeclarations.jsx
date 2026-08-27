// HistoriqueDeclarations - lecture de historique_declaration (#106) par
// societe ou par affectation. Chaque ligne est une ecriture metier tracee par
// l'API : creation, modification, suppression, validation, refus, revalidation.
import { useEffect, useState } from 'react';
import { affectationsService } from '../../services/affectationsService';
import { optionnel } from '../../services/http';
import Skeleton from '../ui/Skeleton';
import { formatDate } from '../../utils/dateUtils';

const ACTIONS = {
  CREATE: { label: 'Déclaration', couleur: 'bg-gray-400' },
  UPDATE: { label: 'Modification', couleur: 'bg-blue-500' },
  DELETE: { label: 'Suppression', couleur: 'bg-gray-700' },
  VALIDATION: { label: 'Validation', couleur: 'bg-green-500' },
  REFUS: { label: 'Refus', couleur: 'bg-red-500' },
  REVALIDATION: { label: 'Revalidation', couleur: 'bg-amber-500' },
};

function resume(h) {
  const d = h.detail || {};
  const bouts = [];
  if (d.reference_client) bouts.push(d.reference_client);
  if (d.quantite != null) bouts.push(`quantité ${d.quantite}`);
  if (d.date_prochaine_revalidation) bouts.push(`échéance le ${formatDate(d.date_prochaine_revalidation)}`);
  if (d.message_refus) bouts.push(`motif : ${d.message_refus}`);
  if (d.modifications) bouts.push(`champs : ${Object.keys(d.modifications).join(', ')}`);
  if (d.transfert_vers) bouts.push('transférée vers une autre société');
  return bouts.join(' · ');
}

export default function HistoriqueDeclarations({ filtres, limite = 50 }) {
  const [lignes, setLignes] = useState(null);
  const cle = JSON.stringify(filtres);

  useEffect(() => {
    let actif = true;
    setLignes(null);
    optionnel(affectationsService.historique(JSON.parse(cle)))
      .then(rows => { if (actif) setLignes(rows); })
      .catch(() => { if (actif) setLignes([]); });
    return () => { actif = false; };
  }, [cle]);

  if (lignes === null) return <Skeleton lines={3} />;
  if (!lignes.length) return <p className="text-sm text-gray-500">Aucune déclaration enregistrée.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {lignes.slice(0, limite).map(h => {
        const cfg = ACTIONS[h.action] ?? { label: h.action, couleur: 'bg-gray-400' };
        return (
          <li key={h.id} className="flex items-start gap-3">
            <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.couleur}`} />
            <div className="min-w-0">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>{cfg.label}</strong>{h.utilisateur ? ` par ${h.utilisateur}` : ''} le {formatDate(h.created_at)}
              </p>
              <p className="text-xs text-gray-500 truncate" title={resume(h)}>{resume(h)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
