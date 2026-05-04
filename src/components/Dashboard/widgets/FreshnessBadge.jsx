// V2 - Étiquette de fraîcheur des données — Temps réel vs précalculé
export default function FreshnessBadge({ type, minutesAgo }) {
  if (type === 'realtime') {
    return (
      <span style={{
        fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap',
        color: '#16A34A', background: '#DCFCE7',
        borderRadius: 10, padding: '2px 7px',
      }}>
        ● Temps réel
      </span>
    );
  }
  return (
    <span style={{
      fontSize: 9, fontWeight: 500, whiteSpace: 'nowrap',
      color: '#8B9099', background: '#F5F5F7',
      borderRadius: 10, padding: '2px 7px',
    }}>
      ↻ {minutesAgo ? `Mis à jour il y a ${minutesAgo}min` : 'Mis à jour'}
    </span>
  );
}
