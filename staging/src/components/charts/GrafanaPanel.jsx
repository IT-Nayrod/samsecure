import { useState, useEffect } from 'react';

export default function GrafanaPanel({
  panelId,
  title,
  datasource,
  width = '100%',
  height = 200,
  fallback,
  grafanaUrl = 'http://localhost:3001',
}) {
  const [grafanaAvailable, setGrafanaAvailable] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Try to reach Grafana, fall back to recharts if unavailable
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    fetch(`${grafanaUrl}/api/health`, { signal: controller.signal, mode: 'no-cors' })
      .then(() => {
        setGrafanaAvailable(true);
        setChecked(true);
      })
      .catch(() => {
        setGrafanaAvailable(false);
        setChecked(true);
      })
      .finally(() => clearTimeout(timeoutId));
  }, [grafanaUrl]);

  const iframeSrc = `${grafanaUrl}/d-solo/dashboard/${panelId}?orgId=1&panelId=${panelId}&refresh=5s`;

  if (!checked) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B9099', fontSize: '12px' }}>
        Chargement...
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width, height }}>
      {/* Source indicator */}
      <div style={{
        position: 'absolute',
        top: 4,
        right: 4,
        zIndex: 10,
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '9px',
        fontWeight: '700',
        backgroundColor: grafanaAvailable ? '#3FC8B8' : '#8B9099',
        color: 'white',
        opacity: 0.8,
      }}>
        {grafanaAvailable ? 'Grafana' : 'Local'}
      </div>

      {grafanaAvailable ? (
        <iframe
          src={iframeSrc}
          title={title}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
          allowFullScreen
        />
      ) : (
        <div style={{ width: '100%', height: '100%' }}>
          {fallback}
        </div>
      )}
    </div>
  );
}
