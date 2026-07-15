// mockUsers - Section 9 Specs UX v0.5
export const mockUsers = [
  {
    id: '1', nom: 'Durand', prenom: 'Sophie', email: 'admin@demo.fr', langue: 'fr', actif: true,
    derniere_connexion: '2026-06-04T14:32:00Z', twoFactor: false,
    habilitations: [{ profil: 'manager_dsi', profilLabel: 'Manager DSI', societe_id: '1', societe_label: 'Acme France SA' }],
  },
  {
    id: '2', nom: 'Martin', prenom: 'Paul', email: 'financier@demo.fr', langue: 'fr', actif: true,
    derniere_connexion: '2026-06-03T09:15:00Z', twoFactor: false,
    habilitations: [{ profil: 'financier', profilLabel: 'Financier', societe_id: '1', societe_label: 'Acme France SA' }],
  },
  {
    id: '3', nom: 'Petit', prenom: 'Julie', email: 'itops@demo.fr', langue: 'fr', actif: true,
    derniere_connexion: '2026-06-05T08:05:00Z', twoFactor: false,
    habilitations: [
      { profil: 'it_ops', profilLabel: 'IT Ops', societe_id: '1', societe_label: 'Acme France SA' },
      { profil: 'it_ops', profilLabel: 'IT Ops', societe_id: '2', societe_label: 'Acme Lyon SARL' },
    ],
  },
  {
    id: '4', nom: 'Bernard', prenom: 'Thomas', email: 'thomas.bernard@acmegroup.fr', langue: 'fr', actif: true,
    derniere_connexion: '2026-06-02T16:45:00Z', twoFactor: false,
    habilitations: [{ profil: 'it_ops', profilLabel: 'IT Ops', societe_id: '2', societe_label: 'Acme Lyon SARL' }],
  },
  {
    id: '5', nom: 'Moreau', prenom: 'Claire', email: 'claire.moreau@acmegroup.fr', langue: 'fr', actif: false,
    derniere_connexion: '2026-05-15T10:20:00Z', twoFactor: false,
    habilitations: [{ profil: 'financier', profilLabel: 'Financier', societe_id: '3', societe_label: 'Acme Paris SAS' }],
  },
  {
    id: '6', nom: 'Lefebvre', prenom: 'Antoine', email: 'antoine.lefebvre@acmegroup.fr', langue: 'fr', actif: true,
    derniere_connexion: '2026-06-04T09:00:00Z', twoFactor: false,
    habilitations: [
      { profil: 'manager_dsi', profilLabel: 'Manager DSI', societe_id: '2', societe_label: 'Acme Lyon SARL' },
      { profil: 'financier', profilLabel: 'Financier', societe_id: '2', societe_label: 'Acme Lyon SARL' },
    ],
  },
  {
    id: '7', nom: 'Simon', prenom: 'Marie', email: 'marie.simon@acmegroup.fr', langue: 'fr', actif: false,
    derniere_connexion: '2026-04-20T14:10:00Z', twoFactor: false,
    habilitations: [{ profil: 'it_ops', profilLabel: 'IT Ops', societe_id: '1', societe_label: 'Acme France SA' }],
  },
  {
    id: '8', nom: 'Laurent', prenom: 'Nicolas', email: 'nicolas.laurent@acmegroup.fr', langue: 'fr', actif: true,
    derniere_connexion: '2026-06-05T07:30:00Z', twoFactor: false,
    habilitations: [
      { profil: 'financier', profilLabel: 'Financier', societe_id: '1', societe_label: 'Acme France SA' },
      { profil: 'financier', profilLabel: 'Financier', societe_id: '3', societe_label: 'Acme Paris SAS' },
    ],
  },
];

export const mockSessions = [
  { id: 's1', appareil: 'Chrome 124 – Windows 11', ip: '91.162.34.21', derniere_activite: '2026-06-05T11:30:00Z', current: true },
  { id: 's2', appareil: 'Firefox 125 – macOS', ip: '78.112.45.98', derniere_activite: '2026-06-04T17:22:00Z', current: false },
  { id: 's3', appareil: 'Mobile Safari – iOS 17', ip: '92.168.1.102', derniere_activite: '2026-06-01T09:10:00Z', current: false },
  { id: 's4', appareil: 'Edge 124 – Windows 10', ip: '185.73.44.12', derniere_activite: '2026-05-28T14:00:00Z', current: false },
];
