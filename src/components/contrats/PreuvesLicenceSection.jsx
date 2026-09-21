// PreuvesLicenceSection - preuves rattachées à une licence (#208), même
// présentation que la section Preuves de la fiche commande. Composant autonome :
// il charge ses données et porte le bouton de dépôt, la fiche licence ne fait
// que le monter avec la licence courante :
//   <PreuvesLicenceSection licence={licence} />
// Le dépôt suit le droit de l'écran Preuves, pas celui des licences.
// Preuve externe (#220) : la ligne porte son lien ou sa référence à la place du
// bouton d'ouverture du fichier, qui n'apparaît jamais sans fichier.
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Plus } from 'lucide-react';
import { preuvesService, typesPreuveService } from '../../services/documentsService';
import { optionnel } from '../../services/http';
import Button from '../ui/Button';
import PreuveFormModal from './PreuveFormModal';
import useRbac from '../../hooks/useRbac';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import PreuveSupportExterne from './PreuveSupportExterne';
import { fichierDepose, preuveExterne, libelleMode } from './preuveAffichage';

export default function PreuvesLicenceSection({ licence }) {
  const { addToast } = useToast();
  const { canWrite: canDeposer } = useRbac({ write: 'deposer_facture_preuve' });

  const [preuves, setPreuves] = useState([]);
  const [typesPreuve, setTypesPreuve] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [modal, setModal] = useState(false);
  const [ouverture, setOuverture] = useState(null);

  const load = useCallback(async () => {
    setErreur(null);
    try {
      // Les types ne servent qu'à la modale : leur refus n'efface pas la liste.
      const [p, t] = await Promise.all([
        preuvesService.list({ idLicence: licence.id }),
        optionnel(typesPreuveService.list()),
      ]);
      setPreuves(p); setTypesPreuve(t);
    } catch (err) {
      // Un refus de droit sur les documents laisse la fiche licence lisible,
      // la section dit simplement pourquoi elle est vide.
      setErreur(err.message);
    }
  }, [licence.id]);

  useEffect(() => { load(); }, [load]);

  // Le fichier est protégé par le jeton : on le télécharge puis on ouvre l'objet
  // URL local, comme le font la fiche document et la fiche commande.
  async function ouvrirFichier(idPreuve) {
    setOuverture(idPreuve);
    try {
      const url = await preuvesService.fichierUrl(idPreuve);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setOuverture(null);
    }
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Preuves ({preuves.length})</h2>
        {canDeposer && (
          <Button variant="secondary" size="sm" onClick={() => setModal(true)}><Plus size={14} /> Ajouter une preuve</Button>
        )}
      </div>
      {erreur ? (
        <p className="text-sm text-gray-500">{erreur}</p>
      ) : preuves.length === 0 ? (
        <p className="text-sm text-gray-500">Aucune preuve rattachée à cette licence.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {preuves.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <Link to={`/contrats/factures/${p.id}`} className="text-sm font-medium text-blue-800 hover:underline">{p.label}</Link>
                <p className="text-xs text-gray-500">
                  {p.type_label ?? '-'}{p.date_preuve ? ` du ${formatDate(p.date_preuve)}` : ''}
                  {preuveExterne(p) ? ` · ${libelleMode(p)} · enregistrée le ` : ' · déposée le '}{formatDate(p.created_at)}
                </p>
              </div>
              <PreuveSupportExterne preuve={p} compact avecEmpreinte />
              {fichierDepose(p) && (
                <Button variant="secondary" size="sm" onClick={() => ouvrirFichier(p.id)} isLoading={ouverture === p.id}>
                  <ExternalLink size={14} /> Ouvrir le fichier
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <PreuveFormModal
        isOpen={modal}
        onClose={() => setModal(false)}
        onDone={toast => { if (toast) addToast(toast); load(); }}
        typesPreuve={typesPreuve}
        licences={[licence]}
        licenceParDefaut={licence.id}
      />
    </section>
  );
}
