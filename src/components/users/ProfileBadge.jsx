// ProfileBadge - Section 3 Specs UX v0.5
const PROFIL_CONFIG = {
  manager_dsi: { label: 'Manager DSI', cls: 'bg-blue-100 text-blue-800' },
  financier: { label: 'Financier', cls: 'bg-purple-100 text-purple-800' },
  it_ops: { label: 'IT Ops', cls: 'bg-teal-100 text-teal-800' },
};

export default function ProfileBadge({ profil }) {
  const cfg = PROFIL_CONFIG[profil] ?? { label: profil, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
