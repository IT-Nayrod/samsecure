// ModalDoublonRevendeur - l'API a reconnu un revendeur deja enregistre.
//
// Deux motifs possibles, renvoyes par l'API dans details.motif :
//   siret          : identifiant legal identique, le doublon ne se discute pas ;
//   raison_sociale : nom tres proche apres retrait des accents, de la casse, de
//                    la ponctuation et de la forme juridique.
//
// L'ecran propose l'existant plutot que de le signaler : ouvrir sa fiche, ou le
// reactiver s'il etait desactive.
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

export default function ModalDoublonRevendeur({ doublon, onClose, onOuvrirFiche, onReactiver }) {
  if (!doublon?.existant) return null;
  const { existant, motif } = doublon;

  const explication = motif === 'siret'
    ? `Le SIRET ${existant.siret} est déjà enregistré sous ce revendeur.`
    : 'Un revendeur porte déjà un nom très proche de celui que vous saisissez.';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Ce revendeur existe déjà"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Modifier ma saisie</Button>
          {!existant.actif && onReactiver && (
            <Button variant="secondary" onClick={() => onReactiver(existant)}>Réactiver</Button>
          )}
          <Button variant="primary" onClick={() => onOuvrirFiche(existant)}>Ouvrir sa fiche</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-700 dark:text-gray-300">{explication}</p>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900 dark:text-white">{existant.raison_sociale}</span>
            <Badge variant={existant.actif ? 'success' : 'neutral'} label={existant.actif ? 'Actif' : 'Désactivé'} />
          </div>
          {existant.siret && (
            <p className="text-xs text-gray-500 mt-1">SIRET {existant.siret}</p>
          )}
        </div>

        <p className="text-xs text-gray-500">
          {existant.actif
            ? 'Ouvrez sa fiche plutôt que d\'en créer un second.'
            : 'Ce revendeur a été retiré du catalogue. Le réactiver vaut mieux que d\'en créer un second.'}
        </p>
      </div>
    </Modal>
  );
}