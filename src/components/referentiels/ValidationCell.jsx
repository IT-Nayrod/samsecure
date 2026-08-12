// ValidationCell - statut de validation et, sur un refus, son motif.
// Rassemble badge et motif en un seul composant pour que les trois listes du
// module 2 aient rigoureusement le meme rendu.
import StatutValidationBadge from './StatutValidationBadge';

export default function ValidationCell({ statut, motif }) {
  return (
    <div className="flex flex-col gap-0.5 max-w-[200px]">
      <StatutValidationBadge statut={statut} />
      {statut === 'refuse' && motif && (
        // Tronque a une ligne, texte entier en infobulle native : le motif doit
        // rester visible sans geste (critere herite de la #17), sans pour
        // autant deformer la colonne.
        <span className="text-xs text-red-600 dark:text-red-400 truncate" title={motif}>{motif}</span>
      )}
    </div>
  );
}
