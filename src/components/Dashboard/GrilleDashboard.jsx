// Grille commune des trois dashboards (#192) : rend les widgets du profil
// dans l'ordre effectif (configuration + preferences), masque ceux que
// l'utilisateur a retires, et propose leur reaffichage en mode
// personnalisation.
import { Eye } from 'lucide-react';
import { useContexteDashboard } from './ContexteDashboard';
import { composerListe, ORDRES, TITRES_WIDGETS } from './composition';

export default function GrilleDashboard({ profil, rendus }) {
  const { widgetsParProfil, preferences, personnalisation, basculerVisibilite } =
    useContexteDashboard();

  const liste = composerListe(widgetsParProfil?.[profil], preferences, ORDRES[profil] ?? []);
  const visibles = liste.filter((w) => w.visible && rendus[w.widget_code]);
  const masques = liste.filter((w) => !w.visible && rendus[w.widget_code]);

  return (
    <div>
      {personnalisation && masques.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          marginBottom: 16, fontSize: 11, color: '#8B9099',
        }}>
          <span style={{ fontWeight: 600 }}>Widgets masqués :</span>
          {masques.map((w) => (
            <button
              key={w.widget_code}
              onClick={() => basculerVisibilite(w.widget_code)}
              title="Réafficher ce widget"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 600, color: '#7C6FCD',
                background: '#7C6FCD14', border: '1px solid #7C6FCD40',
                borderRadius: 20, padding: '3px 10px', cursor: 'pointer',
              }}
            >
              <Eye size={12} />
              {TITRES_WIDGETS[w.widget_code] ?? w.widget_code}
            </button>
          ))}
        </div>
      )}
      <div className="dash-grid-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 20 }}>
        {visibles.map((w) => (
          <div key={w.widget_code} style={{ gridColumn: `span ${rendus[w.widget_code].span}` }}>
            {rendus[w.widget_code].element}
          </div>
        ))}
      </div>
    </div>
  );
}
