// Bandeau d'alertes critiques des dashboards (#192).
// L'ancien bandeau recalculait des alertes a partir des donnees de
// demonstration. Les alertes reelles (detection, accuse, historique) relevent
// du module alertes, qui n'existe pas encore : etat propre en attendant,
// conformement a la regle "zero mock".
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
