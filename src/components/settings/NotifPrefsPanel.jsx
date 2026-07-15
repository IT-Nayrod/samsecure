// NotifPrefsPanel - Section 4 Specs UX v0.5
import useLocalStorage from '../../hooks/useLocalStorage';
import { NOTIF_PREFS_DEFAULT, NOTIF_PREFS_LABELS } from '../../data/mockSettings';

function Toggle({ checked, onChange, id }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      id={id}
      className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export default function NotifPrefsPanel() {
  const [prefs, setPrefs] = useLocalStorage('ss_notif_prefs', NOTIF_PREFS_DEFAULT);

  function toggle(key) {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="flex flex-col gap-3">
      {Object.entries(NOTIF_PREFS_LABELS).map(([key, label]) => (
        <div key={key} className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
          <label htmlFor={`pref-${key}`} className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            {label}
          </label>
          <Toggle id={`pref-${key}`} checked={prefs[key] ?? false} onChange={() => toggle(key)} />
        </div>
      ))}
    </div>
  );
}
