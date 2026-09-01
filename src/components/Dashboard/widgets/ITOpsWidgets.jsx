// Widgets operationnels du dashboard IT Ops (#192) : ecarts d'inventaire
// (donnees reelles du module 3) et collecteurs (module a venir).
import { useNavigate } from 'react-router-dom';
import CadreWidget from './CadreWidget';
import useSourceDashboard from '../useSourceDashboard';
import { useSeuils } from '../ContexteDashboard';
import { couleurSeuil } from '../seuils';
import { THRESHOLD_ORANGE, THRESHOLD_BLUE } from '../couleurs';
import { ROUTES_DRILL } from '../drill';
import { inventaireService } from '../../../services/inventaireService';

// ─── Écarts d'inventaire ────────────────────────────────────────────────────
export function EcartsInventaireWidget() {
  const navigate = useNavigate();
  const seuils = useSeuils('ecarts-inventaire');
  const { data, chargement, erreur, relancer } = useSourceDashboard(
    'inventaire-ecarts', () => inventaireService.ecarts());

  const compteurs = data?.compteurs;
  const constates = compteurs?.constates_sans_affectation ?? 0;
  const nonConstatees = compteurs?.affectations_non_constatees ?? 0;
  const totalEcarts = constates + nonConstatees;
  const color = couleurSeuil(totalEcarts, seuils);

  return (
    <CadreWidget
      widgetId="ecarts-inventaire"
      titre="Écarts d'inventaire"
      info={"Écarts entre le parc constaté par les relevés d'inventaire et les affectations déclarées, dans les deux sens : usage constaté sans affectation, affectation jamais constatée. Le clic ouvre l'écran de rapprochement."}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && !compteurs}
      videMessage="Aucun relevé d'inventaire importé pour le moment."
      onOuvrir={() => navigate(ROUTES_DRILL.inventaire())}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 34, fontWeight: 700, color, lineHeight: 1 }}>{totalEcarts}</span>
          <span style={{ fontSize: 11, color: '#8B9099' }}>écart{totalEcarts > 1 ? 's' : ''} à rapprocher</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <div style={{
            flex: 1, minWidth: 90, background: THRESHOLD_ORANGE + '14',
            borderRadius: 8, padding: '8px 8px',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: THRESHOLD_ORANGE }}>{constates}</div>
            <div style={{ fontSize: 9, color: '#8B9099', lineHeight: 1.3 }}>constatés sans affectation</div>
          </div>
          <div style={{
            flex: 1, minWidth: 90, background: THRESHOLD_BLUE + '14',
            borderRadius: 8, padding: '8px 8px',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: THRESHOLD_BLUE }}>{nonConstatees}</div>
            <div style={{ fontSize: 9, color: '#8B9099', lineHeight: 1.3 }}>déclarées jamais constatées</div>
          </div>
        </div>
      </div>
    </CadreWidget>
  );
}

// ─── Collecteurs ────────────────────────────────────────────────────────────
export function CollecteursWidget() {
  return (
    <CadreWidget
      widgetId="collecteurs"
      titre="Collecteurs"
      info={"État des collecteurs d'inventaire automatiques (actifs, défaillants). La collecte automatisée arrive avec le module collecteurs ; en attendant, l'inventaire s'alimente par import de fichiers."}
      moduleAbsent="collecteurs"
    />
  );
}
