import Card from '../components/ui/Card';
import { equipeData } from '../data/mockData';

const avatarColors = ['#7C6FCD', '#3FC8B8', '#52C97A', '#F4C842', '#E8534A'];

export default function Equipe() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1A1D23' }}>Équipe et attributions</h2>
        <button style={{
          backgroundColor: '#7C6FCD',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
        }}>
          + Ajouter un membre
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
        {equipeData.map((member, idx) => (
          <Card key={member.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: avatarColors[idx % avatarColors.length],
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: '700',
            }}>
              {member.avatar}
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: '600', color: '#1A1D23', fontSize: '13px' }}>{member.nom}</p>
              <p style={{ fontSize: '11px', color: '#8B9099', marginTop: '2px' }}>{member.email}</p>
            </div>
            <span style={{
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600',
              backgroundColor: '#7C6FCD15',
              color: '#7C6FCD',
            }}>
              {member.role}
            </span>
            <p style={{ fontSize: '11px', color: '#8B9099' }}>
              {member.licences} licences attribuées
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
