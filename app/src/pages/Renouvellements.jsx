import Card from '../components/ui/Card';
import { renouvellements } from '../data/mockData';

const statutColors = {
  urgent: { color: '#E8534A', bg: '#E8534A15', label: 'Urgent' },
  warning: { color: '#F4C842', bg: '#F4C84215', label: 'Attention' },
  ok: { color: '#52C97A', bg: '#52C97A15', label: 'OK' },
};

export default function Renouvellements() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1A1D23' }}>
          Renouvellements à venir
        </h2>
        <span style={{
          backgroundColor: '#FF4757',
          color: 'white',
          borderRadius: '12px',
          padding: '2px 10px',
          fontSize: '12px',
          fontWeight: '700',
        }}>
          2 urgents
        </span>
      </div>

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #EAECF0' }}>
              {['Logiciel', 'Licences', 'Expiration', 'Montant', 'Statut'].map((h) => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#8B9099', fontWeight: '500', fontSize: '12px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {renouvellements.map((r) => {
              const s = statutColors[r.statut];
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #F5F5F5' }}>
                  <td style={{ padding: '12px', fontWeight: '600', color: '#1A1D23' }}>{r.logiciel}</td>
                  <td style={{ padding: '12px', color: '#1A1D23' }}>{r.licences}</td>
                  <td style={{ padding: '12px', color: '#1A1D23' }}>{r.expiration}</td>
                  <td style={{ padding: '12px', color: '#1A1D23', fontWeight: '600' }}>
                    {r.montant.toLocaleString()}€
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      display: 'inline-flex',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: s.color,
                      backgroundColor: s.bg,
                    }}>
                      {s.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
