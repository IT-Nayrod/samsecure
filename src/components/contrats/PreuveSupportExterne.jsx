// PreuveSupportExterne - support d'une preuve externe (#220, règle client du
// 17/09/2026) : le document vit dans un autre système, SamSecure n'en garde que
// l'adresse ou la référence. Mode url : lien qui ouvre l'adresse dans un nouvel
// onglet. Mode reference : texte copiable. Composant partagé par la liste des
// preuves, la fiche document et la section preuves de la licence, pour qu'une
// preuve externe se présente partout de la même façon ; il ne rend rien pour
// une preuve en mode fichier, dont l'ouverture reste portée par chaque écran.
// compact : une ligne tronquée, pour une cellule de tableau ou une liste.
// avecEmpreinte : rappelle l'empreinte SHA-256 abrégée quand elle existe (la
// fiche document l'affiche en entier dans sa propre section).
import { useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { modeDeLaPreuve, preuveExterne, urlExterneSure, empreinteAbregee } from './preuveAffichage';
import { useToast } from '../../hooks/useToast';

export default function PreuveSupportExterne({ preuve, compact = false, avecEmpreinte = false }) {
  const { addToast } = useToast();
  const [copie, setCopie] = useState(false);

  if (!preuveExterne(preuve)) return null;

  const mode = modeDeLaPreuve(preuve);
  const url = mode === 'url' ? urlExterneSure(preuve.url_externe) : null;
  const texte = mode === 'url' ? preuve.url_externe : preuve.reference_externe;

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte ?? '');
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      addToast({ type: 'error', message: 'Copie impossible depuis ce navigateur.' });
    }
  }

  const largeur = compact ? 'max-w-[16rem] truncate' : 'break-all';

  return (
    <div className={`flex flex-col gap-1 min-w-0 ${compact ? 'text-xs' : 'text-sm'}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" title={url}
            className={`inline-flex items-center gap-1.5 text-blue-800 dark:text-blue-300 hover:underline min-w-0 ${compact ? '' : 'items-start'}`}>
            <ExternalLink size={compact ? 12 : 14} className="flex-shrink-0" />
            <span className={largeur}>{url}</span>
          </a>
        ) : (
          <span title={texte ?? undefined} className={`text-gray-800 dark:text-gray-200 ${compact ? largeur : 'font-mono text-xs bg-gray-50 dark:bg-gray-900/60 px-3 py-2 rounded-lg break-all'}`}>
            {texte || '-'}
          </span>
        )}
        {texte && (
          <button type="button" onClick={copier}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 px-1.5 py-1 flex-shrink-0"
            aria-label={mode === 'url' ? "Copier l'URL" : 'Copier la référence'}>
            {copie
              ? <><Check size={compact ? 12 : 14} className="text-green-600" />{!compact && ' Copié'}</>
              : <><Copy size={compact ? 12 : 14} />{!compact && ' Copier'}</>}
          </button>
        )}
      </div>
      {avecEmpreinte && preuve.hash_sha256 && (
        <p className="text-xs text-gray-500 dark:text-gray-400" title={preuve.hash_sha256}>
          SHA-256 : <span className="font-mono">{empreinteAbregee(preuve.hash_sha256)}</span>
        </p>
      )}
    </div>
  );
}
