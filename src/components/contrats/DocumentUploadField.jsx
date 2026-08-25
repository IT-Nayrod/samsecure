// DocumentUploadField - zone de depot de fichier (clic ou glisser-deposer).
// Depuis la #49 le fichier est reellement televerse : le composant remonte
// l'objet File, plus seulement son nom. Les controles de taille et de format
// restent cote serveur, seule autorite : le front les rappelle en libelle mais
// ne les duplique pas en validation, sans quoi les deux regles divergeraient.
import { useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import DocumentIcon from './DocumentIcon';

const FORMATS = 'PDF, PNG ou JPG. 20 Mo maximum.';

function taille(octets) {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function DocumentUploadField({ file, onChange, disabled = false }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function onInputChange(e) {
    const f = e.target.files?.[0];
    if (f) onChange(f);
    e.target.value = '';
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onChange(f);
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`flex items-center gap-3 p-3 rounded-lg border-2 border-dashed transition-colors ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}
    >
      {file
        ? <DocumentIcon nomFichier={file.name} size={32} />
        : <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex-shrink-0"><Upload size={15} className="text-gray-400" /></span>
      }
      <div className="flex-1 min-w-0">
        {file
          ? <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{file.name}</p>
          : <p className="text-sm text-gray-500">Cliquez ou glissez-déposez un fichier</p>
        }
        <p className="text-xs text-gray-400">{file ? taille(file.size) : FORMATS}</p>
      </div>
      {file && !disabled && (
        <button type="button" onClick={e => { e.stopPropagation(); onChange(null); }} aria-label="Retirer le fichier" className="text-gray-400 hover:text-red-500 flex-shrink-0">
          <Trash2 size={14} />
        </button>
      )}
      <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={onInputChange} className="hidden" disabled={disabled} />
    </div>
  );
}
