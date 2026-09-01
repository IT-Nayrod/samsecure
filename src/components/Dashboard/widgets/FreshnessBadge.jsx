// Etiquette de fraicheur des donnees : affichee uniquement quand l'API
// fournit derniere_maj, jamais estimee localement (#192).
export default function FreshnessBadge({ dateIso }) {
  if (!dateIso) return null;

  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return null;

  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  let libelle;
  if (minutes < 1) libelle = "à l'instant";
  else if (minutes < 60) libelle = `il y a ${minutes} min`;
  else if (minutes < 60 * 48) libelle = `il y a ${Math.round(minutes / 60)} h`;
  else libelle = `le ${date.toLocaleDateString('fr-FR')}`;

  return (
    <span
      title={`Données mises à jour ${libelle} (${date.toLocaleString('fr-FR')})`}
      style={{
        fontSize: 9, fontWeight: 500, whiteSpace: 'nowrap',
        color: '#8B9099', background: '#F5F5F7',
        borderRadius: 10, padding: '2px 7px',
      }}
    >
      {'↻'} Mis à jour {libelle}
    </span>
  );
}
