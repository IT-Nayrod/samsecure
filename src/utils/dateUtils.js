export function timeAgo(dateString) {
  if (!dateString) return '-';
  const diff = Math.floor((Date.now() - new Date(dateString)) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return 'hier';
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)} jours`;
  const w = Math.floor(diff / 604800);
  if (w < 5) return `il y a ${w} semaine${w > 1 ? 's' : ''}`;
  return formatDate(dateString);
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
