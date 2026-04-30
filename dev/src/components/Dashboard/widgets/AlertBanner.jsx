// V2 - Bandeau d'alertes critiques — s'affiche uniquement si indicateurs en rouge

export default function AlertBanner({ alerts }) {
  if (!alerts?.length) return null;

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div style={{
      background: '#FEE2E2',
      border: '1px solid #991B1B',
      borderRadius: 10,
      padding: '10px 16px',
      marginBottom: 20,
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#991B1B', whiteSpace: 'nowrap' }}>
        ⚠ Indicateurs critiques :
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {alerts.map(a => (
          <button
            key={a.id}
            onClick={() => scrollTo(a.id)}
            style={{
              fontSize: 11, fontWeight: 500,
              color: '#991B1B', background: 'rgba(153,27,27,0.08)',
              border: '1px solid #991B1B', borderRadius: 20,
              padding: '3px 12px', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(153,27,27,0.18)'}
            onMouseLeave={e => e.target.style.background = 'rgba(153,27,27,0.08)'}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
