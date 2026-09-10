// Bandeau d'alertes critiques des dashboards (#192).
// L'ancien bandeau recalculait des alertes à partir des données de
// démonstration. Les alertes réelles (detection, accuse, historique) relèvent
// du module alertes, qui n'existe pas encore : état propre en attendant,
// conformément à la règle "zero mock".
import CadreWidget from './CadreWidget';

export default function AlertesWidget() {
  return (
    <CadreWidget
      widgetId="alertes"
      titre="Alertes"
      info={"Bandeau des indicateurs critiques du tableau de bord (dépassements de droits, contrats échus, validations en souffrance). La détection et le suivi des alertes arrivent avec le module alertes."}
      moduleAbsent="alertes"
    />
  );
}
