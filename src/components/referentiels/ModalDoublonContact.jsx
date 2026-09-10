// ModalDoublonContact - l'API a reconnu un contact deja enregistre.
//
// Deux motifs possibles, renvoyes par l'API dans details.motif :
//   email : adresse identique, elle designe la personne, le doublon ne se
//           discute pas ;
//   nom   : nom complet tres proche apres retrait des accents, de la casse et
//           de la ponctuation, prenom et nom dans un ordre indifferent.
//
// L'ecran propose l'existant plutot que de le signaler : ouvrir sa fiche. Un
// contact inactif (date de fin echue) se prolonge depuis sa fiche, il ne se
// ressaisit pas. Meme modele que ModalDoublonRevendeur.
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

export default function ModalDoublonContact({ doublon, onClose, onOuvrirFiche }) {
  if (!doublon?.existant) return null;
  const { existant, motif } = doublon;
  const nom = `${existant.prenom ?? ''} ${existant.nom}`.trim();

  const explication = motif === 'email'
    ? `L'adresse ${existant.email} est déjà enregistrée sous ce contact.`
    : 'Un contact porte déjà un nom très proche de celui que vous saisissez.';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Ce contact existe déjà"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Modifier ma saisie</Button>
          <Button variant="primary" onClick={() => onOuvrirFiche(existant)}>Ouvrir sa fiche</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-700 dark:text-gray-300">{explication}</p>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900 dark:text-white">{nom}</span>
            <Badge variant={existant.actif ? 'success' : 'neutral'} label={existant.actif ? 'Actif' : 'Inactif'} />
          </div>
          {existant.email && (
            <p className="text-xs text-gray-500 mt-1">{existant.email}</p>
          )}
        </div>

        <p className="text-xs text-gray-500">
          {existant.actif
            ? 'Ouvrez sa fiche plutôt que d\'en créer un second.'
            : 'Ce contact est inactif. Prolonger sa période depuis sa fiche vaut mieux que d\'en créer un second.'}
        </p>
      </div>
    </Modal>
  );
}
