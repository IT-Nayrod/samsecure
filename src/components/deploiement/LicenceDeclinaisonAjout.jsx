// LicenceDeclinaisonAjout - ajout à la volée d'une version ou d'une édition à
// un produit du catalogue, depuis les formulaires de licence et de maintenance
// (décision du 11/09/2026). Le catalogue global reste en lecture seule : la
// valeur est enregistrée comme complément du client (migration 063) par
// l'API, qui refuse les doublons à la casse et aux accents près (4037). La
// déclinaison créée est rendue au parent, qui la sélectionne.
//
// #217 : le même geste sert la fiche logiciel de Référentiels. ajouter
// (facultatif) remplace l'appel par défaut : la fiche d'un logiciel créé
// localement y branche ses propres routes (/logiciels/:id/versions et
// /editions), celle d'un logiciel du catalogue garde les compléments. Dans
// les deux cas le refus de doublon reste celui du serveur, affiché tel quel.
import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { licencesService } from '../../services/licencesService';
import { useToast } from '../../hooks/useToast';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white';

const LIBELLES = {
  versions: { bouton: 'Ajouter une version', placeholder: 'Ex. 2024, 11.2', succes: 'Version ajoutée.' },
  editions: { bouton: 'Ajouter une édition', placeholder: 'Ex. Standard, Enterprise', succes: 'Édition ajoutée.' },
};

export default function LicenceDeclinaisonAjout({ type, idProduit, onAjout, disabled = false, ajouter = null }) {
  const { addToast } = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const textes = LIBELLES[type];

  function fermer() { setOuvert(false); setLabel(''); }

  async function enregistrer() {
    const valeur = label.trim();
    if (!valeur || !idProduit) return;
    setLoading(true);
    try {
      const parDefaut = type === 'versions'
        ? licencesService.complements.ajouterVersion
        : licencesService.complements.ajouterEdition;
      const creee = await (ajouter ?? parDefaut)(idProduit, valeur);
      addToast({ type: 'success', message: textes.succes });
      onAjout(creee);
      fermer();
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  if (!idProduit || disabled) return null;

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="mt-1 inline-flex items-center gap-1 text-xs text-blue-800 dark:text-blue-300 hover:underline">
        <Plus size={12} /> {textes.bouton}
      </button>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-1">
      <input
        type="text" className={INPUT_CLS} value={label} maxLength={100} autoFocus
        placeholder={textes.placeholder} onChange={e => setLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); enregistrer(); } if (e.key === 'Escape') fermer(); }}
      />
      <button type="button" onClick={enregistrer} disabled={loading || !label.trim()} aria-label="Enregistrer" className="p-2 rounded text-green-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"><Check size={14} /></button>
      <button type="button" onClick={fermer} aria-label="Annuler" className="p-2 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><X size={14} /></button>
    </div>
  );
}
