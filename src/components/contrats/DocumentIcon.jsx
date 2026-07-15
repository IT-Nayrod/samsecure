// DocumentIcon - vignette placeholder pour un document mocke (pas de vrai fichier en v0.5)
import { FileText, Image, File } from 'lucide-react';

function extensionDe(nomFichier) {
  return nomFichier?.split('.').pop()?.toLowerCase() ?? '';
}

export default function DocumentIcon({ nomFichier, size = 36 }) {
  const ext = extensionDe(nomFichier);
  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
  const isPdf = ext === 'pdf';
  const Icon = isImage ? Image : isPdf ? FileText : File;
  const color = isPdf ? '#EF4444' : isImage ? '#3FC8B8' : '#8B9099';

  return (
    <span
      className="inline-flex items-center justify-center rounded-lg flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: `${color}18` }}
    >
      <Icon size={size * 0.5} style={{ color }} />
    </span>
  );
}
