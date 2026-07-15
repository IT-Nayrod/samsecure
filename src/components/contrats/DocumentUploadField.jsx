// DocumentUploadField - zone d'upload de document (clic ou glisser-deposer)
// V0.5 : pas de back-end ni de filesystem, on ne stocke pas le contenu du fichier,
// seulement son nom (mocke par nom_fichier) avec une vignette placeholder. Le stockage
// reel (pointeur url_fichier) viendra avec le back-end.
import { useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import DocumentIcon from './DocumentIcon';

export default function DocumentUploadField({ nomFichier, onChange }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file) {
    onChange(file.name);
  }

  function onInputChange(e) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`flex items-center gap-3 p-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}
    >
      {nomFichier
        ? <DocumentIcon nomFichier={nomFichier} size={32} />
        : <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex-shrink-0"><Upload size={15} className="text-gray-400" /></span>
      }
      <div className="flex-1 min-w-0">
        {nomFichier
          ? <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{nomFichier}</p>
          : <p className="text-sm text-gray-500">Cliquez ou glissez-deposez un fichier</p>
        }
        <p className="text-xs text-gray-400">PDF, image ou document. Le fichier n'est pas televerse en v0.5 (apercu uniquement).</p>
      </div>
      {nomFichier && (
        <button type="button" onClick={e => { e.stopPropagation(); onChange(null); }} aria-label="Supprimer le document" className="text-gray-400 hover:text-red-500 flex-shrink-0">
          <Trash2 size={14} />
        </button>
      )}
      <input ref={inputRef} type="file" onChange={onInputChange} className="hidden" />
    </div>
  );
}
