// UserSettingsPage - Section 4 Specs UX v0.5
import { useState } from 'react';
import { Eye, EyeOff, QrCode } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import useLocalStorage from '../../hooks/useLocalStorage';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import PasswordStrength from '../ui/PasswordStrength';
import Modal from '../ui/Modal';
import SessionsPanel from './SessionsPanel';
import NotifPrefsPanel from './NotifPrefsPanel';
import { validatePassword } from '../../utils/validation';

const TABS = ['Informations personnelles', 'Sécurité', 'Préférences', 'Notifications'];
const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

function InfoTab({ user }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({ prenom: user?.prenom ?? '', nom: user?.nom ?? '', email: user?.email ?? '' });
  const [loading, setLoading] = useState(false);
  async function save() {
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setLoading(false);
    addToast({ type: 'success', message: 'Informations mises à jour.' });
  }
  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Prénom" required><input className={INPUT_CLS} value={form.prenom} onChange={e => setForm(v => ({ ...v, prenom: e.target.value }))} /></FormField>
        <FormField label="Nom" required><input className={INPUT_CLS} value={form.nom} onChange={e => setForm(v => ({ ...v, nom: e.target.value }))} /></FormField>
      </div>
      <FormField label="Email" required><input type="email" className={INPUT_CLS} value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))} /></FormField>
      <Button variant="primary" onClick={save} isLoading={loading} className="self-start">Enregistrer</Button>
    </div>
  );
}

function SecurityTab() {
  const { addToast } = useToast();
  const [pwd, setPwd] = useState({ current: '', new: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [twoFa, setTwoFa] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [backupCodes] = useState(() => Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 10).toUpperCase()));

  async function changePwd() {
    const err = validatePassword(pwd.new);
    if (err) { addToast({ type: 'error', message: err }); return; }
    if (pwd.new !== pwd.confirm) { addToast({ type: 'error', message: 'Les mots de passe ne correspondent pas.' }); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setLoading(false);
    addToast({ type: 'success', message: 'Mot de passe modifié.' });
    setPwd({ current: '', new: '', confirm: '' });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Password */}
      <section className="max-w-lg">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Mot de passe</h3>
        <div className="flex flex-col gap-4">
          <FormField label="Mot de passe actuel">
            <input type={showPwd ? 'text' : 'password'} className={INPUT_CLS} value={pwd.current} onChange={e => setPwd(v => ({ ...v, current: e.target.value }))} />
          </FormField>
          <FormField label="Nouveau mot de passe">
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} className={INPUT_CLS + ' pr-10'} value={pwd.new} onChange={e => setPwd(v => ({ ...v, new: e.target.value }))} />
              <button type="button" onClick={() => setShowPwd(v => !v)} aria-label="Afficher" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <PasswordStrength password={pwd.new} />
          </FormField>
          <FormField label="Confirmer le nouveau mot de passe">
            <input type={showPwd ? 'text' : 'password'} className={INPUT_CLS} value={pwd.confirm} onChange={e => setPwd(v => ({ ...v, confirm: e.target.value }))} />
          </FormField>
          <Button variant="primary" size="sm" onClick={changePwd} isLoading={loading} className="self-start">Changer le mot de passe</Button>
        </div>
      </section>

      {/* 2FA */}
      <section className="max-w-lg">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Double authentification</h3>
        <div className="flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Authentification TOTP</p>
            <p className="text-xs text-gray-500">{twoFa ? 'Activée' : 'Non activée'}</p>
          </div>
          <button
            onClick={() => { setTwoFa(v => !v); if (!twoFa) setQrModal(true); else addToast({ type: 'info', message: '2FA désactivée.' }); }}
            role="switch" aria-checked={twoFa}
            className={`relative w-11 h-6 rounded-full transition-colors ${twoFa ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${twoFa ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </section>

      {/* Sessions */}
      <section>
        <SessionsPanel />
      </section>

      {/* QR Modal */}
      <Modal isOpen={qrModal} onClose={() => setQrModal(false)} title="Activer la double authentification" size="sm"
        footer={<Button variant="primary" onClick={() => { setQrModal(false); addToast({ type: 'success', message: '2FA activée avec succès.' }); }}>Confirmer l'activation</Button>}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-40 h-40 bg-gray-200 dark:bg-gray-700 flex items-center justify-center rounded-xl border border-gray-300">
            <QrCode size={48} className="text-gray-400" />
            <span className="sr-only">QR Code TOTP</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">Scannez ce code avec votre application d'authentification (Google Authenticator, Authy…)</p>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Codes de secours (conserver en lieu sûr)</p>
            <div className="grid grid-cols-2 gap-1.5">
              {backupCodes.map(c => <code key={c} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono text-center">{c}</code>)}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PrefsTab() {
  const [theme, setTheme] = useLocalStorage('ss_theme', 'light');
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  }
  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <FormField label="Langue d'interface">
        <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
          <option value="fr">Français</option>
          <option disabled>English (Bientôt disponible)</option>
        </select>
      </FormField>
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Thème</p>
          <p className="text-xs text-gray-500">{theme === 'dark' ? 'Sombre' : 'Clair'}</p>
        </div>
        <button
          onClick={toggleTheme}
          role="switch" aria-checked={theme === 'dark'}
          className={`relative w-11 h-6 rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${theme === 'dark' ? 'translate-x-5' : ''}`} />
        </button>
      </div>
    </div>
  );
}

export default function UserSettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Paramètres utilisateur</h1>
      <div className="flex gap-6 min-h-[500px]">
        {/* Tab nav */}
        <nav className="flex flex-col gap-1 w-52 flex-shrink-0">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${tab === i ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </nav>
        {/* Content */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          {tab === 0 && <InfoTab user={user} />}
          {tab === 1 && <SecurityTab />}
          {tab === 2 && <PrefsTab />}
          {tab === 3 && <NotifPrefsPanel />}
        </div>
      </div>
    </div>
  );
}
