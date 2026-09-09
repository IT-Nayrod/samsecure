// Coût des licences manquantes (Financier), branche sur le contrat
// conformité (#192). L'écart valorisé négatif mesure ce que coûteraient les
// droits manquants face à l'usage déclaré : c'est le seuil en montant du
// module (bornes en euros de la configuration). L'ancienne courbe sur 16 mois
// nécessitait un historique mensuel qui n'est enregistré nulle part : le
// widget affiche l'état courant, la série temporelle viendra avec
// l'historisation.
import { useNavigate } from 'react-router-dom';
import CadreWidget from './CadreWidget';
import useSourceDashboard from '../useSourceDashboard';
import { useSeuils } from '../ContexteDashboard';
import { couleurSeuil, borneSeuil } from '../seuils';
import { ROUTES_DRILL } from '../drill';
import { conformiteService } from '../../../services/dashboardService';

export function CoutLicencesManquantesWidget() {
  const navigate = useNavigate();
  const seuils = useSeuils('cout-licences-manquantes');
  const { data, chargement, erreur, relancer } = useSourceDashboard(
    'conformite-global', () => conformiteService.synthese('global'));

  const ag = data?.agregats ?? data?.lignes?.[0] ?? null;
  const montant = Math.abs(ag?.ecart_valorise_negatif ?? 0);
  const nbDepassement = ag?.nb_depassement ?? 0;
  const color = couleurSeuil(montant, seuils);
  const b2 = borneSeuil(seuils, 2, 10000);
  const b4 = borneSeuil(seuils, 4, 50000);

  return (
    <CadreWidget
      widgetId="cout-licences-manquantes"
      titre="Coût des licences manquantes"
      info={"Valorisation des droits manquants : usage déclaré au-delà des droits acquis, multiplié par le prix unitaire des produits concernés. Les seuils de couleur sont en euros. Le clic ouvre la liste des licences."}
      derniereMaj={ag?.derniere_maj}
      chargement={chargement} erreur={erreur} onRelancer={relancer}
      vide={!chargement && !erreur && !ag}
      onOuvrir={() => navigate(ROUTES_DRILL.licences())}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 34, fontWeight: 700, color, lineHeight: 1 }}>
          {montant.toLocaleString('fr-FR')} €
        </span>
        <span style={{ fontSize: 11, color: '#8B9099', lineHeight: 1.4 }}>
          {nbDepassement > 0
            ? `${nbDepassement} produit${nbDepassement > 1 ? 's' : ''} en dépassement de droits`
            : 'Aucun produit en dépassement de droits'}
        </span>
        <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#8B9099', flexWrap: 'wrap' }}>
          <span>Seuil attention : {b2.toLocaleString('fr-FR')} €</span>
          <span>Seuil critique : {b4.toLocaleString('fr-FR')} €</span>
        </div>
      </div>
    </CadreWidget>
  );
}

export default CoutLicencesManquantesWidget;
