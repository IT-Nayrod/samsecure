// En-tête de page du gabarit Layout : titre, sélecteur de période, langue et
// icônes. Ce gabarit n'est pas monté par le routeur, qui utilise AppLayout.

import { useState } from 'react';
import { Mail, Bell, Calendar } from 'lucide-react';

const periods = ['Jour', 'Semaine', 'Mensuel', 'Annuel'];

export default function Header({ title = 'Dashboard' }) {
  const [activePeriod, setActivePeriod] = useState('Mensuel');

  return (
    <header style={{
      height: '56px',
      backgroundColor: '#FFFFFF',
      borderBottom: '1px solid #EAECF0',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: '16px',
      flexShrink: 0,
    }}>
      {/* Gauche : bouton Rapports */}
      <button style={{
        border: '1px solid #EAECF0',
        borderRadius: '6px',
        padding: '6px 14px',
        color: '#1A1D23',
        fontSize: '13px',
        fontWeight: '500',
        backgroundColor: 'white',
        cursor: 'pointer',
        flexShrink: 0,
      }}>
        Rapports
      </button>

      {/* Centre : titre, sélecteur de période et date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        <h1 style={{ fontSize: '16px', fontWeight: '700', color: '#1A1D23', flexShrink: 0 }}>
          {title}
        </h1>

        {/* Sélecteur de période */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: activePeriod === p ? '600' : '400',
                backgroundColor: activePeriod === p ? '#7C6FCD' : 'transparent',
                color: activePeriod === p ? 'white' : '#8B9099',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Date */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          border: '1px solid #EAECF0',
          borderRadius: '6px',
          padding: '5px 10px',
          fontSize: '12px',
          color: '#1A1D23',
        }}>
          <Calendar size={13} color="#8B9099" />
          Mai 01, 2026
        </div>
      </div>

      {/* Droite : langue, utilisateur et icônes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {/* Langue */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#1A1D23' }}>
          <span>🇫🇷</span>
          <span>Français</span>
        </div>

        <div style={{ width: '1px', height: '16px', backgroundColor: '#EAECF0' }} />

        {/* Salutation */}
        <span style={{ fontSize: '12px', color: '#1A1D23' }}>
          Bonjour <strong>Sandy</strong>
        </span>

        {/* Avatar */}
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: '#7C6FCD',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: '700',
          flexShrink: 0,
        }}>
          SS
        </div>

        {/* Icône courrier */}
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <Mail size={17} color="#8B9099" />
        </button>

        {/* Cloche avec badge */}
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Bell size={17} color="#8B9099" />
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            backgroundColor: '#FF4757',
            color: 'white',
            borderRadius: '50%',
            width: '14px',
            height: '14px',
            fontSize: '9px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            1
          </span>
        </button>
      </div>
    </header>
  );
}
