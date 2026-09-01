// Bulle d'information (i) portee par chaque widget : explique la donnee
// affichee et son mode de calcul (#192). Accessible au clavier (focus) comme
// a la souris (survol).
import { useState } from 'react';
import { Info } from 'lucide-react';

export default function InfoBulle({ texte }) {
  const [visible, setVisible] = useState(false);
  if (!texte) return null;

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        aria-label="Explication de la donnée"
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={(e) => { e.stopPropagation(); setVisible((v) => !v); }}
        style={{
          background: 'none', border: 'none', cursor: 'help', padding: 0,
          color: '#8B9099', display: 'flex', alignItems: 'center',
        }}
      >
        <Info size={14} />
      </button>
      {visible && (
        <span
          role="tooltip"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: -8,
            zIndex: 30, width: 240,
            background: '#1A1D23', color: '#fff', borderRadius: 8,
            padding: '8px 10px', fontSize: 11, lineHeight: 1.45,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            whiteSpace: 'normal', textAlign: 'left',
          }}
        >
          {texte}
        </span>
      )}
    </span>
  );
}
