// ImportReleveModal - import manuel d'un fichier csv de releve (#111).
// Colonnes minimales : produit (identifiant ou libelle), reference, quantite ;
// colonne societe optionnelle. Le serveur juge ligne a ligne, la modale rend
// son verdict (statut global et erreurs) sans reformuler.
import { useState, useEffect } from 'react';
import { Upload } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import Badge from '../ui/Badge';
import { inventaireService, societesInventaireService, IMPORT_STATUT } from '../../services/inventaireService';
import { optionnel } from '../../services/http';

const inputCls = 'w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function ImportReleveModal({ isOpen, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [idSociete, setIdSociete] = useState('');
  const [societes, setSocietes] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [resultat, setResultat] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setFile(null); setIdSociete(''); setError(null); setResultat(null);
    // Liste accessoire : sans le droit sur les referentiels, l'import reste
    // possible, seule la societe par defaut n'est pas proposee.
    optionnel(societesInventaireService.list()).then(setSocietes);
  }, [isOpen]);

  async function submit(e) {
    e?.preventDefault();
    if (!file) { setError('Choisissez un fichier csv.'); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const data = await inventaireService.importer({ file, idSociete: idSociete || undefined });
      setResultat({ import: data.import, erreurs: data.erreurs });
      onImported?.({ type: data.import.statut === 'succes' ? 'success' : 'warning',
        message: data.import.statut === 'succes'
          ? `Import effectué : ${data.import.nb_releves} relevé(s).`
          : `Import partiel : ${data.import.nb_releves} relevé(s), ${data.erreurs.length} ligne(s) en erreur.` });
    } catch (err) {
      // 4228 : aucune ligne exploitable, l'import est trace en echec et les
      // erreurs sont jointes dans details.
      if (err.code === 4228 && err.details) {
        setResultat({ import: err.details.import, erreurs: err.details.erreurs });
        onImported?.({ type: 'error', message: err.message });
      } else {
        setError(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const cfg = resultat ? (IMPORT_STATUT[resultat.import?.statut] ?? IMPORT_STATUT.en_cours) : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importer un relevé d'inventaire" size="md"
      footer={resultat
        ? <Button onClick={onClose}>Fermer</Button>
        : <>
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Button>
            <Button onClick={submit} isLoading={isSubmitting}>Importer</Button>
          </>}
    >
      {resultat ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge variant={cfg.variant} label={cfg.label} />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {resultat.import?.nb_lignes_total ?? 0} ligne(s) lue(s), {resultat.import?.nb_releves ?? 0} relevé(s) enregistré(s), {resultat.erreurs?.length ?? 0} erreur(s).
            </span>
          </div>
          {resultat.erreurs?.length > 0 && (
            <ul className="text-sm text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-lg px-4 py-3 flex flex-col gap-1 max-h-60 overflow-y-auto">
              {resultat.erreurs.map(e => <li key={e.ligne}>Ligne {e.ligne} : {e.motif}</li>)}
            </ul>
          )}
          <p className="text-xs text-gray-500">Le fichier est archivé et l'import tracé, y compris en échec. Aucune affectation n'a été créée ni modifiée : le rapprochement se fait à la main depuis la liste des relevés.</p>
        </div>
      ) : (
        <form id="import-releve-form" onSubmit={submit} className="flex flex-col gap-4">
          <FormField label="Fichier csv" required hint="Colonnes attendues : produit (identifiant ou libellé), référence, quantité. Colonne société optionnelle. 20 Mo et 10 000 lignes maximum.">
            <input type="file" accept=".csv,text/csv" onChange={e => setFile(e.target.files?.[0] ?? null)} className={inputCls} />
          </FormField>
          <FormField label="Société par défaut" hint="Appliquée aux lignes sans colonne société.">
            <select value={idSociete} onChange={e => setIdSociete(e.target.value)} className={inputCls}>
              <option value="">Aucune</option>
              {societes.map(s => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
            </select>
          </FormField>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-gray-500 flex items-center gap-1.5"><Upload size={13} /> Le fichier sera archivé sous un nom neutre et son empreinte SHA-256 tracée.</p>
        </form>
      )}
    </Modal>
  );
}
