import Card from '../components/ui/Card';
import { parcLicences } from '../data/mockData';

export default function ParcLicences() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1A1D23' }}>Parc de licences</h2>
      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #EAECF0' }}>
              {['Logiciel', 'Éditeur', 'Licences', 'Utilisés', 'Écart', 'Coût annuel'].map((h) => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#8B9099', fontWeight: '500', fontSize: '12px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parcLicences.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #F5F5F5' }}>
                <td style={{ padding: '12px', fontWeight: '600', color: '#1A1D23' }}>{p.nom}</td>
                <td style={{ padding: '12px', color: '#8B9099' }}>{p.editeur}</td>
                <td style={{ padding: '12px', color: '#1A1D23' }}>{p.licences}</td>
                <td style={{ padding: '12px', color: '#1A1D23' }}>{p.utilises}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    color: p.ecart > 20 ? '#E8534A' : '#52C97A',
                    fontWeight: '600',
                  }}>
                    {p.ecart > 0 ? '+' : ''}{p.ecart}
                  </span>
                </td>
                <td style={{ padding: '12px', fontWeight: '600', color: '#1A1D23' }}>
                  {p.cout.toLocaleString()}€
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
