// ProfileBadge - Section 3 Specs UX v0.5
const PROFIL_CONFIG = {
  manager_dsi: { label: 'Manager DSI', cls: 'bg-blue-100 text-blue-800' },
  financier: { label: 'Financier', cls: 'bg-purple-100 text-purple-800' },
  it_ops: { label: 'IT Ops', cls: 'bg-teal-100 text-teal-800' },
  admin_sam: { label: 'Admin SAM', cls: 'bg-gray-800 text-white' },
  it_data_input: { label: 'IT Data input', cls: 'bg-amber-100 text-amber-800' },
};

// `profil` accepte soit un code connu du catalogue, soit un objet groupe
// { code, label } pour les groupes créés côté client (libellé non mappé ici).
export default function ProfileBadge({ profil, label }) {
  const code = typeof profil === 'string' ? profil : profil?.code;
  const cfg = PROFIL_CONFIG[code];
  const displayLabel = label ?? cfg?.label ?? (typeof profil === 'object' ? profil?.label : profil) ?? code;
  const cls = cfg?.cls ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {displayLabel}
    </span>
  );
}
