// Cadre commun de tous les widgets de dashboard (#192).
//
// Porte les invariants de la story #190 : bulle d'information (i) sur chaque
// widget, etiquette de fraicheur quand l'API fournit derniere_maj, etats de
// chargement, de vide et d'erreur (message de l'enveloppe, bouton Reessayer),
// etat propre "Disponible avec le module ..." pour les donnees dont la source
// n'existe pas encore, et drill-down : la carte entiere est cliquable et mene
// a l'ecran concerne (onOuvrir), les zones interactives internes arretent la
// propagation.
import { AlertTriangle, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import Card from '../../ui/Card';
import InfoBulle from './InfoBulle';
import FreshnessBadge from './FreshnessBadge';
import { useContexteDashboard } from '../ContexteDashboard';

function Squelette() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '6px 0' }} aria-busy="true">
      {[80, 55, 70].map((largeur, i) => (
        <div key={i} className="animate-pulse" style={{
          height: 14, width: `${largeur}%`, background: '#EAECF0', borderRadius: 6,
        }} />
      ))}
    </div>
  );
}

function Erreur({ erreur, onRelancer }) {
  const refuse = erreur?.status === 403;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      gap: 8, padding: '6px 0',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#B42318', fontWeight: 600 }}>
        <AlertTriangle size={14} />
        {refuse ? 'Accès refusé' : 'Chargement impossible'}
      </span>
      <span style={{ fontSize: 11, color: '#8B9099', lineHeight: 1.4 }}>
        {erreur?.message || 'Une erreur est survenue.'}
      </span>
      {!refuse && onRelancer && (
        <button
          onClick={(e) => { e.stopPropagation(); onRelancer(); }}
          style={{
            fontSize: 11, fontWeight: 600, color: '#7C6FCD',
            background: '#7C6FCD14', border: '1px solid #7C6FCD40',
            borderRadius: 20, padding: '4px 14px', cursor: 'pointer',
          }}
        >
          Réessayer
        </button>
      )}
    </div>
  );
}

function ModuleAbsent({ moduleAbsent }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 8, padding: '18px 0',
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, color: '#7C6FCD',
        background: '#7C6FCD18', borderRadius: 20, padding: '3px 12px',
        textAlign: 'center',
      }}>
        Disponible avec le module {moduleAbsent}
      </span>
    </div>
  );
}

export default function CadreWidget({
  widgetId, titre, sousTitre, info, derniereMaj,
  chargement = false, erreur = null, onRelancer,
  vide = false, videMessage = 'Aucune donnée à afficher pour le moment.',
  moduleAbsent = null,
  onOuvrir, actions, style = {}, children,
}) {
  const { personnalisation, basculerVisibilite, deplacerWidget } = useContexteDashboard();

  const cliquable = Boolean(onOuvrir) && !personnalisation && !chargement && !erreur && !moduleAbsent;

  let corps;
  if (moduleAbsent) corps = <ModuleAbsent moduleAbsent={moduleAbsent} />;
  else if (chargement) corps = <Squelette />;
  else if (erreur) corps = <Erreur erreur={erreur} onRelancer={onRelancer} />;
  else if (vide) {
    corps = (
      <div style={{ fontSize: 11, color: '#8B9099', padding: '14px 0', textAlign: 'center' }}>
        {videMessage}
      </div>
    );
  } else corps = children;

  // Card ne propage pas les props d'interaction : le conteneur externe porte
  // le clic, le clavier et l'ancre (id), la carte reste purement visuelle.
  return (
    <div
      id={widgetId}
      style={{ height: '100%', cursor: cliquable ? 'pointer' : 'default' }}
      {...(cliquable ? {
        role: 'link', tabIndex: 0,
        onClick: onOuvrir,
        onKeyDown: (e) => { if (e.key === 'Enter') onOuvrir(); },
      } : {})}
    >
    <Card
      style={{
        display: 'flex', flexDirection: 'column', gap: 10, height: '100%',
        outline: personnalisation ? '1px dashed #7C6FCD66' : 'none',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23', margin: 0 }}>{titre}</h3>
          {sousTitre && (
            <p style={{ fontSize: 10, color: '#8B9099', margin: '2px 0 0 0' }}>{sousTitre}</p>
          )}
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {personnalisation ? (
            <>
              <button title="Monter le widget" onClick={() => deplacerWidget(widgetId, -1)} style={BOUTON_PERSO}>
                <ChevronUp size={14} />
              </button>
              <button title="Descendre le widget" onClick={() => deplacerWidget(widgetId, 1)} style={BOUTON_PERSO}>
                <ChevronDown size={14} />
              </button>
              <button title="Masquer le widget" onClick={() => basculerVisibilite(widgetId)} style={BOUTON_PERSO}>
                <EyeOff size={14} />
              </button>
            </>
          ) : (
            <>
              {actions}
              <FreshnessBadge dateIso={derniereMaj} />
              <InfoBulle texte={info} />
            </>
          )}
        </div>
      </div>
      {corps}
    </Card>
    </div>
  );
}

const BOUTON_PERSO = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 24, height: 24, borderRadius: 6,
  border: '1px solid #EAECF0', background: 'white',
  color: '#7C6FCD', cursor: 'pointer', padding: 0,
};
