// PhotoUploadField - zone d'upload de photo (clic ou glisser-deposer), apercu rond immediat
import { useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { validateImageFile } from '../../utils/validation';

export default function PhotoUploadField({ value, onChange, fallback, size = 72 }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);

  function handleFile(file) {
    const err = validateImageFile(file);
    if (err) { setError(err); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative cursor-pointer rounded-full flex-shrink-0 transition-all ${dragOver ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
          style={{ width: size, height: size }}
        >
          {value
            ? <img src={value} alt="Apercu" className="w-full h-full rounded-full object-cover" />
            : fallback
          }
          <div className="absolute inset-0 rounded-full bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
            <Upload size={16} className="text-white" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <button type="button" onClick={() => inputRef.current?.click()} className="text-sm font-medium text-blue-800 hover:underline text-left">
            {value ? 'Remplacer la photo' : 'Ajouter une photo'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} className="text-sm text-red-600 hover:underline text-left flex items-center gap-1">
              <Trash2 size={13} /> Supprimer la photo
            </button>
          )}
          <p className="text-xs text-gray-400">PNG, JPG ou WEBP, 1 Mo maximum. Glisser-deposer accepte.</p>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onInputChange} className="hidden" />
    </div>
  );
}
